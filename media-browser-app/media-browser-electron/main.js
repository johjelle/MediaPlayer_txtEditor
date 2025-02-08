const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

function createWindow () {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            preload: path.join(__dirname, 'preload.js')
        }
    })

    // Add these lines to enable media playback support
    app.commandLine.appendSwitch('no-sandbox');
    app.commandLine.appendSwitch('ignore-gpu-blacklist');
    app.commandLine.appendSwitch('enable-features', 'HardwareMediaKeys');
    app.commandLine.appendSwitch('enable-features', 'PictureInPicture');
    app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

    mainWindow.loadFile('index.html')
}

// Make sure this line is before any createWindow calls
app.commandLine.appendSwitch('no-sandbox');

app.whenReady().then(() => {
    createWindow()
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

// Scan directory function
function scanDirectory(dirPath) {
    console.log('Scanning directory:', dirPath);
    const items = fs.readdirSync(dirPath);
    const structure = [];

    items.forEach(item => {
        const fullPath = path.join(dirPath, item);
        console.log('Processing item:', item);
        try {
            const stats = fs.statSync(fullPath);
            
            if (stats.isDirectory()) {
                console.log('Found directory:', item);
                structure.push({
                    type: 'directory',
                    name: item,
                    path: fullPath,
                    children: scanDirectory(fullPath)
                });
            } else {
                const ext = path.extname(item).toLowerCase();
                let type = 'file';
                if (['.jpg', '.jpeg', '.png', '.tif', '.tiff'].includes(ext)) type = 'image';
                if (['.mp4', '.avi', '.mov'].includes(ext)) type = 'video';
                if (['.mp3', '.wav'].includes(ext)) type = 'audio';
                if (ext === '.txt') type = 'transcript';

                console.log('Found file:', item, 'of type:', type);
                structure.push({
                    type,
                    name: item,
                    path: fullPath
                });
            }
        } catch (error) {
            console.error('Error processing item:', item, error);
        }
    });

    return structure;
}

// Handle folder selection
ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
    })
    console.log('Dialog result:', result);
    if (!result.canceled) {
        const folderPath = result.filePaths[0]
        const structure = scanDirectory(folderPath)
        return { path: folderPath, structure }
    }
    return null
})

// Handle transcript saving
ipcMain.handle('save-transcript', async (event, { filePath, content }) => {
    try {
        await fs.promises.writeFile(filePath, content, 'utf8')
        return { success: true }
    } catch (error) {
        return { success: false, error: error.message }
    }
})