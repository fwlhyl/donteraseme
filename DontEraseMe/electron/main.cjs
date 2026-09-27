const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        minWidth: 800,
        minHeight: 600,
        title: "DontEraseMe",
        fullscreen: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        backgroundColor: '#111111'
    });

    // Remove the default menu bar
    Menu.setApplicationMenu(null);

    // Load the vite build output
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

    // Handle full screen toggle from renderer
    ipcMain.on('toggle-fullscreen', (event, isFullscreen) => {
        if (mainWindow) {
            mainWindow.setFullScreen(isFullscreen);
        }
    });

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
    if (mainWindow === null) createWindow();
});
