const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Prevent Windows disk cache file-lock and GPU shader cache errors
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 410,
    height: 760,
    resizable: true,
    minWidth: 380,
    minHeight: 460,
    maxWidth: 520,
    maxHeight: 900,
    frame: false, // frameless for custom aesthetic widget look
    backgroundColor: '#FAF0CC',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'FocusME! Pomodoro Timer',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    alwaysOnTop: false,
  });

  mainWindow.loadFile('index.html');

  // Handle window control IPCs
  ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
  });

  ipcMain.on('window-toggle-pin', (event, shouldPin) => {
    if (mainWindow) {
      mainWindow.setAlwaysOnTop(shouldPin);
      event.reply('window-pin-status', mainWindow.isAlwaysOnTop());
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createWindow,
    getMainWindow: () => mainWindow,
    setMainWindow: (win) => { mainWindow = win; },
  };
}
