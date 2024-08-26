const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
}

ipcMain.on('get-root-dirs', (event) => {
  const rootDirs = [];
  const rootPaths = ['/'];

  if (process.platform === 'win32') {
    rootPaths.push(...getWindowsDrives());
  }

  rootPaths.forEach(rootPath => {
    const files = fs.readdirSync(rootPath);
    files.forEach(file => {
      const fullPath = path.join(rootPath, file);
      if (fs.lstatSync(fullPath).isDirectory() && !isHidden(file, fullPath)) {
        rootDirs.push({ name: file, path: fullPath });
      }
    });
  });

  event.sender.send('root-dirs', rootDirs);
});

ipcMain.on('get-dir-content', (event, dirPath) => {
  const folders = fs.readdirSync(dirPath).map(file => {
    const fullPath = path.join(dirPath, file);
    return {
      name: file,
      path: fullPath,
      isDirectory: fs.lstatSync(fullPath).isDirectory()
    };
  }).filter(item => item.isDirectory && !isHidden(item.name, item.path));

  event.sender.send('dir-content', { path: dirPath, folders });
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
