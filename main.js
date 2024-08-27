const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

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

ipcMain.on('get-root-dirs', (event) => {
  if (process.platform === 'win32') {
    const username = os.userInfo().username; // 动态获取当前用户名
    const userPath = path.join('C:/Users', username, "Desktop"); // 构建用户目录路径

    // 获取除 C 盘外的所有可用磁盘
    // const otherDrives = getWindowsDrives();

    const dirs = [
        { name: username + "'s Desktop", path: userPath },
        // ...otherDrives  // 其他驱动器
    ];
    event.reply('root-dirs', dirs);
  } else {
      // 其他平台的处理逻辑
      event.reply('root-dirs', [
          { name: '/', path: '/' },
          { name: '/home', path: '/home' },
          // 添加其他需要列出的根目录
      ]);
  }
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

function getWindowsDrives(exclude = ['A', 'B', 'C']) {
  const drives = [];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  letters.forEach(letter => {
    if (!exclude.includes(letter)) {
      const drivePath = `${letter}:\\`;
      if (fs.existsSync(drivePath)) {
        drives.push({ name: `${letter} Drive`, path: drivePath });
      }
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