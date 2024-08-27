const { ipcRenderer } = require('electron');
const pathModule = require('path');
let selectedPaths = []; // 全局变量，用于保存选中的文件或文件夹路径

window.onload = () => {
    ipcRenderer.send('get-root-dirs');

    ipcRenderer.on('root-dirs', (event, dirs) => {
        const dirList = document.getElementById('dir-list');
        dirList.innerHTML = '';
        dirs.forEach(dir => {
            const li = createTreeItem(dir.name, dir.path, true);
            dirList.appendChild(li);
        });
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

        // 只展示图片文件
        files.forEach(file => {
            if (isImageFile(file.name)) {
                const fileElement = createContentElement(file.name, file.path, 'file');
                contentDisplay.appendChild(fileElement);
            }
        });
    });

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            copySelectedNames();
        }
    });
};

function updateBreadcrumb(path) {
    const breadcrumb = document.getElementById('breadcrumb');
    breadcrumb.innerHTML = ''; // 清空之前的路径

    const pathParts = pathModule.normalize(path).split(pathModule.sep);
    let cumulativePath = pathParts[0] === '' ? pathModule.sep : '';

    pathParts.forEach((part, index) => {
        if (part) {
            cumulativePath = index > 0 ? pathModule.join(cumulativePath, part) : part;

            const span = document.createElement('span');
            span.textContent = part;
            span.style.cursor = 'pointer';
            span.style.marginRight = '5px';

            span.onclick = () => {
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
    li.style.paddingLeft = `${level * 5}px`;

    if (isDirectory) {
        const ul = document.createElement('ul');
        ul.style.display = 'none';
        li.appendChild(ul);
        li.style.cursor = 'pointer';

        li.onclick = (e) => {
            e.stopPropagation();

            if (ul.style.display === 'none') {
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

function createContentElement(name, path, type) {
    const div = document.createElement('div');
    div.className = `content-item ${type}`;
    div.dataset.path = path;

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

    div.onclick = (e) => handleSelection(e, path);

    if (type === 'folder') {
        div.ondblclick = () => ipcRenderer.send('get-dir-content', path);
    }

    div.oncontextmenu = (e) => {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY);
    };

    return div;
}

function handleSelection(event, path) {
    requestAnimationFrame(() => {
        const allItems = document.querySelectorAll('.content-item');
        const currentIndex = Array.from(allItems).indexOf(document.querySelector(`[data-path="${replaceSpacesWithUnderscore(path)}"]`));

        let updatedSelection = [];

        if (event.shiftKey && lastSelectedIndex >= 0) {
            const start = Math.min(currentIndex, lastSelectedIndex);
            const end = Math.max(currentIndex, lastSelectedIndex);

            for (let i = start; i <= end; i++) {
                updatedSelection.push(allItems[i].dataset.path);
            }
        } else if (event.ctrlKey || event.metaKey) {
            if (selectedPaths.includes(path)) {
                updatedSelection = selectedPaths.filter(p => p !== path);
            } else {
                updatedSelection = [...selectedPaths, path];
            }
        } else {
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
    document.querySelectorAll('.content-item.selected').forEach(item => {
        item.classList.remove('selected');
    });

    selectedPaths.forEach(path => {
        const item = document.querySelector(`[data-path="${replaceSpacesWithUnderscore(path)}"]`);
        if (item) item.classList.add('selected');
    });
}

function replaceSpacesWithUnderscore(str) {
    return str.replace(/\\/g, '\\\\');
}

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

    document.addEventListener('click', () => document.body.removeChild(menu), { once: true });
}

function copySelectedNames() {
    if (selectedPaths.length === 0) return;

    const namesToCopy = selectedPaths.map(path => {
        const parts = path.split(pathModule.sep);
        return parts[parts.length - 1];
    }).join('\n');

    navigator.clipboard.writeText(namesToCopy).then(() => {
        console.log('名字已复制到剪切板');
    }).catch(err => console.error('复制失败', err));
}

function isImageFile(fileName) {
    return /\.(jpg|jpeg|png|gif|bmp|webp|tiff)$/.test(fileName.toLowerCase());
}