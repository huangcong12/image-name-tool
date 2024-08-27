const { ipcRenderer } = require('electron');
const pathModule = require('path');
const os = require('os');

let selectedPaths = []; // 全局变量，用于保存选中的文件或文件夹路径

window.onload = () => {
    const platform = os.platform();
    
    if (platform === 'win32') {
        // 仅在 Windows 上展示盘符
        ipcRenderer.send('get-root-dirs', { onlyDrives: true });
    } else {
        ipcRenderer.send('get-root-dirs');
    }

    ipcRenderer.on('root-dirs', (event, dirs) => {
        const dirList = document.getElementById('dir-list');
        dirList.innerHTML = '';
        dirs.forEach(dir => {
            const li = createTreeItem(dir.name, dir.path, true);
            dirList.appendChild(li);
        });

        // 请求根目录的内容
        if (dirs.length > 0) {
            ipcRenderer.send('get-dir-content', dirs[0].path);
        }
    });

    ipcRenderer.on('dir-content', (event, { path, folders, files }) => {
        updateBreadcrumb(path);

        const contentDisplay = document.getElementById('content-display');
        contentDisplay.innerHTML = '';

        // 展示文件夹
        folders.forEach(folder => {
            const folderElement = createContentElement(folder.name, folder.path, 'folder');
            contentDisplay.appendChild(folderElement);
        });

        // 展示文件
        files.forEach(file => {
            const fileElement = createContentElement(file.name, file.path, 'file');
            contentDisplay.appendChild(fileElement);
        });
    });

    // 监听键盘按下事件，检测 Ctrl+C
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            copySelectedNames();
        }
    });
};

document.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    showContextMenu(event.clientX, event.clientY);
});

function updateBreadcrumb(path) {
    const breadcrumb = document.getElementById('breadcrumb');
    breadcrumb.innerHTML = ''; // 清空之前的路径

    const pathParts = pathModule.normalize(path).split(pathModule.sep);
    let cumulativePath = pathParts[0] === '' ? pathModule.sep : '';

    pathParts.forEach((part, index) => {
        if (part) {
            if (index > 0) {
                cumulativePath = pathModule.join(cumulativePath, part);
            } else {
                cumulativePath = pathParts[0] === '' ? pathModule.sep : part;
            }

            const span = document.createElement('span');
            span.textContent = part;
            span.style.cursor = 'pointer';
            span.style.marginRight = '5px';

            span.onclick = () => {
                // 正确拼接路径，确保点击时导航到正确的目录
                const targetPath = pathModule.join(...pathParts.slice(0, index + 1));
                ipcRenderer.send('get-dir-content', targetPath);
            };

            breadcrumb.appendChild(span);

            if (index < pathParts.length - 1) {
                const separator = document.createElement('span');
                separator.textContent = '>';
                separator.style.marginRight = '5px';
                breadcrumb.appendChild(separator);
            }
        }
    });
}

function createTreeItem(name, fullPath, isDirectory, level = 0) {
    const li = document.createElement('li');
    li.textContent = name;
    li.dataset.path = fullPath;
    li.style.paddingLeft = `${level * 5}px`; // 设置缩进

    if (isDirectory) {
        const ul = document.createElement('ul');
        ul.style.display = 'none'; // Initially hide the sub-directory
        li.appendChild(ul);
        li.style.cursor = 'pointer';

        li.onclick = (e) => {
            e.stopPropagation();

            if (ul.style.display === 'none') {
                // 如果子文件夹还未加载，获取子文件夹内容并加载
                if (ul.childElementCount === 0) {
                    ipcRenderer.send('get-dir-content', fullPath);
                    ipcRenderer.once('dir-content', (event, { folders }) => {
                        folders.forEach(folder => {
                            const subLi = createTreeItem(folder.name, folder.path, true, level + 1);
                            ul.appendChild(subLi);
                        });
                    });
                }
                ul.style.display = 'block';
            } else {
                ul.style.display = 'none';
            }
        };

        li.ondblclick = (e) => {
            e.stopPropagation();
            ul.innerHTML = ''; // Clear previous content
            ipcRenderer.send('get-dir-content', fullPath);
        };
    }

    return li;
}

let lastSelectedIndex = -1;

function createContentElement(name, path, type) {
    const div = document.createElement('div');
    div.className = `content-item ${type}`;
    div.dataset.path = path; // 为元素添加路径数据

    const icon = document.createElement('img');
    icon.style.width = '80px';
    icon.style.height = '80px';
    icon.style.objectFit = 'cover';

    if (type === 'folder') {
        icon.src = 'folder-icon.png';
    } else if (isImageFile(name)) {
        icon.src = path;
    } else {
        icon.src = 'file-icon.png';
    }

    const text = document.createElement('span');
    text.textContent = name;

    div.appendChild(icon);
    div.appendChild(text);

    // 点击选择
    div.onclick = (e) => {
        handleSelection(e, path);
    };

    // 双击打开文件夹
    if (type === 'folder') {
        div.ondblclick = () => {
            ipcRenderer.send('get-dir-content', path);
        };
    }

    // 右键菜单
    div.oncontextmenu = (e) => {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY);
    };

    return div;
}

function handleSelection(event, path) {
    requestAnimationFrame(() => {
        const allItems = document.querySelectorAll('.content-item');
        const currentIndex = Array.from(allItems).indexOf(document.querySelector(`[data-path="${path}"]`));

        let updatedSelection = [];

        if (event.shiftKey && lastSelectedIndex >= 0) {
            // Shift 多选
            const start = Math.min(currentIndex, lastSelectedIndex);
            const end = Math.max(currentIndex, lastSelectedIndex);

            for (let i = start; i <= end; i++) {
                const itemPath = allItems[i].dataset.path;
                updatedSelection.push(itemPath);
            }
        } else if (event.ctrlKey || event.metaKey) {
            // Ctrl / Command 键多选
            if (selectedPaths.includes(path)) {
                updatedSelection = selectedPaths.filter(p => p !== path);
            } else {
                updatedSelection = [...selectedPaths, path];
            }
        } else {
            // 普通点击，清除之前的选择，只选择当前的文件或文件夹
            updatedSelection = [path];
        }

        if (JSON.stringify(selectedPaths) !== JSON.stringify(updatedSelection)) {
            selectedPaths = updatedSelection;
            updateSelectionUI();
        }

        lastSelectedIndex = currentIndex;
    });
}

function updateSelectionUI() {
    // 首先移除所有选中的效果
    document.querySelectorAll('.content-item.selected').forEach(item => {
        item.classList.remove('selected');
    });

    // 为选中的项目添加选中效果
    selectedPaths.forEach(path => {
        const item = document.querySelector(`[data-path="${path}"]`);
        if (item) {
            item.classList.add('selected');
        }
    });
}

// 展示右键菜单
function showContextMenu(x, y) {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.top = `${y}px`;
    menu.style.left = `${x}px`;

    const copyNameOption = document.createElement('div');
    copyNameOption.textContent = 'Copy Name';
    copyNameOption.onclick = copySelectedNames;

    menu.appendChild(copyNameOption);
    document.body.appendChild(menu);

    document.addEventListener('click', () => {
        document.body.removeChild(menu);
    }, { once: true });
}

function copySelectedNames() {
    if (selectedPaths.length === 0) return;

    // 获取选中项的名字
    const namesToCopy = selectedPaths.map(path => {
        const parts = path.split(pathModule.sep);
        return parts[parts.length - 1];
    }).join('\n');

    // 将名字复制到剪切板
    navigator.clipboard.writeText(namesToCopy).then(() => {
        console.log('名字已复制到剪切板');
    }).catch(err => {
        console.error('复制失败', err);
    });
}

function isImageFile(fileName) {
    return /\.(jpg|jpeg|png|gif|bmp|webp|tiff)$/.test(fileName.toLowerCase());
}
