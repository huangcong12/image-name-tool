const {app, BrowserWindow, ipcMain} = require('electron');
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
            {name: username + "'s Desktop", path: userPath},
            // ...otherDrives  // 其他驱动器
        ];
        event.reply('root-dirs', dirs);
    } else {
        // 其他平台的处理逻辑
        event.reply('root-dirs', [
            {name: '/', path: '/'},
            {name: '/home', path: '/home'},
            // 添加其他需要列出的根目录
        ]);
    }
});

ipcMain.on('get-dir-content', (event, dirPath) => {
    fs.readdir(dirPath, {withFileTypes: true}, (err, dirents) => {
        if (err) {
            console.error('Error reading directory:', err);
            event.reply('dir-content', {path: dirPath, folders: [], files: []});
            return;
        }

        const folders = [];
        const files = [];

        dirents.forEach(dirent => {
            const fullPath = path.join(dirPath, dirent.name);
            let stats;
            try {
                stats = fs.statSync(fullPath);
            } catch (error) {
                console.error(`Error getting stats for ${fullPath}:`, error);
                return; // Skip this file/folder if we can't get its stats
            }

            const item = {
                name: dirent.name,
                path: fullPath,
                size: stats.size,
                mtime: stats.mtime.getTime(), // 修改时间，转换为时间戳
                ctime: stats.ctime.getTime(), // 创建时间，转换为时间戳
                atime: stats.atime.getTime(), // 访问时间，转换为时间戳
                isDirectory: stats.isDirectory()
            };

            if (item.isDirectory && !isHidden(dirent.name, fullPath)) {
                folders.push(item);
            } else {
                files.push(item);
            }
        });

        event.reply('dir-content', {path: dirPath, folders, files});
    });
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
                drives.push({name: `${letter} Drive`, path: drivePath});
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