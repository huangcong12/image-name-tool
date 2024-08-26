const { ipcRenderer } = require('electron');

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
    const parentItem = document.querySelector(`li[data-path="${path}"] > ul`);
    parentItem.innerHTML = '';
    folders.forEach(folder => {
      const li = createTreeItem(folder.name, folder.path, folder.isDirectory);
      parentItem.appendChild(li);
    });

    // 展示右侧文件夹内容
    const contentDisplay = document.getElementById('content-display');
    contentDisplay.innerHTML = '';
    folders.forEach(folder => {
      const folderElement = createContentElement(folder.name, folder.path, 'folder');
      contentDisplay.appendChild(folderElement);
    });
    files.forEach(file => {
      const fileElement = createContentElement(file.name, file.path, 'file');
      contentDisplay.appendChild(fileElement);
    });
  });
};

function createTreeItem(name, fullPath, isDirectory, level = 0) {
  const li = document.createElement('li');
  li.textContent = name;
  li.dataset.path = fullPath;
  li.style.paddingLeft = `${level * 20}px`; // 设置缩进

  if (isDirectory) {
    const ul = document.createElement('ul');
    ul.style.display = 'none'; // Initially hide the sub-directory
    li.appendChild(ul);
    li.style.cursor = 'pointer';

    li.onclick = (e) => {
      e.stopPropagation();
      ul.style.display = ul.style.display === 'none' ? 'block' : 'none';
      ipcRenderer.send('get-dir-content', fullPath);
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

