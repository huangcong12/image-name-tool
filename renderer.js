const { ipcRenderer } = require('electron');
const pathModule = require('path');

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
    
        // 展示文件
        files.forEach(file => {
            const fileElement = createContentElement(file.name, file.path, 'file');
            contentDisplay.appendChild(fileElement);
        });
    });
    
};

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

function createContentElement(name, path, type) {
    const div = document.createElement('div');
    div.className = `content-item ${type}`;

    const icon = document.createElement('img');
    icon.style.width = '50px';
    icon.style.height = '50px';
    icon.style.marginRight = '10px';

    if (type === 'folder') {
        icon.src = 'folder-icon.png'; // 文件夹图标路径
    } else if (isImageFile(name)) {
        icon.src = path; // 真实图片的路径
        icon.style.objectFit = 'cover'; // 确保图片缩略图展示得更好
    } else {
        icon.src = 'file-icon.png'; // 其他文件的图标路径
    }

    const text = document.createElement('span');
    text.textContent = name;

    div.appendChild(icon);
    div.appendChild(text);

    if (type === 'folder') {
        div.onclick = () => {
            ipcRenderer.send('get-dir-content', path);
        };
    }

    return div;
}

function isImageFile(fileName) {
    return /\.(jpg|jpeg|png|gif|bmp|webp|tiff)$/.test(fileName.toLowerCase());
}

