const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs-extra');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      // preload: path.join(__dirname, 'preload.js'),
      icon: path.join(__dirname, 'assets', 'app_icon.png'), // 设置图标路径
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  // mainWindow.webContents.openDevTools()
}

ipcMain.on('get-root-dirs', async (event) => {
  const rootDirs = [];
  const rootPaths = ['/'];

  if (process.platform === 'win32') {
    rootPaths.push(...getWindowsDrives());
  }

  for (const rootPath of rootPaths) {
    try {
      const files = await fs.readdir(rootPath);
      for (const file of files) {
        const fullPath = path.join(rootPath, file);
        if ((await fs.lstat(fullPath)).isDirectory() && !isHidden(file, fullPath)) {
          rootDirs.push({ name: file, path: fullPath });
        }
      }
    } catch (error) {
      console.error(`Error reading root directory ${rootPath}:`, error);
    }
  }

  event.sender.send('root-dirs', rootDirs);
});

ipcMain.on('get-dir-content', async (event, targetPath) => {
  try {
    const files = await fs.readdir(targetPath);
    const folders = [];
    const filePaths = [];

    for (const file of files) {
      const fullPath = path.join(targetPath, file);
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory() && !isHidden(file, fullPath)) {
        folders.push({ name: file, path: fullPath });
      } else if (!stat.isDirectory()) {
        filePaths.push({ name: file, path: fullPath });
      }
    }

    event.sender.send('dir-content', {
      path: targetPath,
      folders: folders,
      files: filePaths
    });
  } catch (error) {
    console.error('Error reading directory:', error);
  }
});

function isHidden(fileName, fullPath) {
  if (process.platform === 'win32') {
    const stats = fs.statSync(fullPath);
    return !!(stats.mode & 0x8000); // 检查是否为隐藏文件夹
  } else {
    return fileName.startsWith('.'); // 在 Linux 和 macOS 上，检查是否以 "." 开头
  }
}

function getWindowsDrives() {
  const drives = [];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  letters.forEach(letter => {
    const drivePath = `${letter}:\\`;
    if (fs.existsSync(drivePath)) {
      drives.push(drivePath);
    }
  });
  return drives;
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});