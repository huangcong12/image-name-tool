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
        
        // 添加加载效果
        contentDisplay.innerHTML = '<div id="loading">Loading...</div>';
    
        // 使用 setTimeout 来允许加载效果显示
        setTimeout(() => {
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
    
            // 移除加载效果
            const loadingElement = document.getElementById('loading');
            if (loadingElement) {
                loadingElement.remove();
            }
        }, 0);
    });

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            copySelectedNames();
        }
    });
};

// 更新面包屑
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

// 创建树形目录
function createTreeItem(name, fullPath, isDirectory, level = 0) {
    const li = document.createElement('li');
    li.dataset.path = fullPath;
    li.style.cursor = 'pointer';
    li.classList.add('tree-item');

    const content = document.createElement('div');
    content.style.display = 'flex';
    content.style.alignItems = 'center';

    const indent = document.createElement('span');
    indent.style.width = `${level * 10}px`;
    content.appendChild(indent);

    const expandIcon = document.createElement('span');
    expandIcon.textContent = isDirectory ? '▶' : '';
    expandIcon.style.marginRight = '3px';
    expandIcon.style.width = '10px';
    expandIcon.classList.add('expand-icon');
    content.appendChild(expandIcon);

    const text = document.createElement('span');
    text.style.marginLeft = '5px';
    text.textContent = name;
    content.appendChild(text);

    li.appendChild(content);

    if (isDirectory) {
        const ul = document.createElement('ul');
        ul.style.display = 'none';
        li.appendChild(ul);

        content.onclick = (e) => {
            e.stopPropagation();
            clearSelection();
            li.classList.add('selected');

            // 更新所有兄弟元素的图标
            updateSiblingIcons(li);

            if (ul.style.display === 'none') {
                expandIcon.textContent = '▼';
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
                expandIcon.textContent = '▶';
                ul.style.display = 'none';
            }
        };

        content.ondblclick = (e) => {
            e.stopPropagation();
            ul.innerHTML = ''; // Clear previous content
            ipcRenderer.send('get-dir-content', fullPath);
        };
    } else {
        content.onclick = (e) => {
            e.stopPropagation();
            clearSelection();
            li.classList.add('selected');
        };
    }

    return li;
}

// 更新所有兄弟元素的图标
function updateSiblingIcons(currentLi) {
    const parent = currentLi.parentElement;
    const siblings = Array.from(parent.children);
    siblings.forEach(sibling => {
        if (sibling !== currentLi) {
            const siblingIcon = sibling.querySelector('.expand-icon');
            if (siblingIcon) {
                siblingIcon.textContent = '▶';
                const siblingUl = sibling.querySelector('ul');
                if (siblingUl) {
                    siblingUl.style.display = 'none';
                }
            }
        }
    });
}

// 清除所有选中状态
function clearSelection() {
    const selectedItems = document.querySelectorAll('.tree-item.selected');
    selectedItems.forEach(item => item.classList.remove('selected'));
}

// 创建内容元素
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

// 处理选中
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

// 更新选中状态
function updateSelectionUI() {
    const currentlySelected = new Set(Array.from(document.querySelectorAll('.content-item.selected')).map(item => item.dataset.path));
    const shouldBeSelected = new Set(selectedPaths);

    // Remove 'selected' class from items that should no longer be selected
    currentlySelected.forEach(path => {
        if (!shouldBeSelected.has(path)) {
            const item = document.querySelector(`[data-path="${replaceSpacesWithUnderscore(path)}"]`);
            if (item) item.classList.remove('selected');
        }
    });

    // Add 'selected' class to newly selected items
    shouldBeSelected.forEach(path => {
        if (!currentlySelected.has(path)) {
            const item = document.querySelector(`[data-path="${replaceSpacesWithUnderscore(path)}"]`);
            if (item) item.classList.add('selected');
        }
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