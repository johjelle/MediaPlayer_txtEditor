const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const sharp = require('sharp')

// Debug logging
console.log('App starting from directory:', __dirname)

function createWindow() {
    // Get absolute path to preload script
    const preloadPath = path.resolve(__dirname, 'preload.js')
    
    // Debug logging
    console.log('Looking for preload script at:', preloadPath)
    console.log('Preload script exists:', fs.existsSync(preloadPath))

    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            preload: preloadPath
        }
    })

    // Load the index.html file
    const indexPath = path.join(__dirname, 'index.html')
    console.log('Loading index.html from:', indexPath)
    mainWindow.loadFile(indexPath)

    // Open DevTools to help with debugging
    mainWindow.webContents.openDevTools()

    return mainWindow
}

app.whenReady().then(() => {
    try {
        const mainWindow = createWindow()
        
        mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
            console.error('Failed to load:', errorCode, errorDescription)
        })

        app.on('activate', function () {
            if (BrowserWindow.getAllWindows().length === 0) createWindow()
        })
    } catch (error) {
        console.error('Error creating window:', error)
    }
})

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})

// Scan directory function
// Modified scanDirectory function for main.js
function scanDirectory(dirPath) {
    console.log('Scanning directory:', dirPath);
    try {
        const items = fs.readdirSync(dirPath);
        const structure = [];

        items.forEach(item => {
            // Skip hidden files and directories (those starting with '.')
            if (item.startsWith('.')) {
                console.log('Skipping hidden item:', item);
                return;
            }

            try {
                const fullPath = path.join(dirPath, item);
                const stats = fs.statSync(fullPath);
                
                if (stats.isDirectory()) {
                    console.log('Found directory:', item);
                    const children = scanDirectory(fullPath);
                    // Only add directory if it has visible children or is empty
                    if (children.length > 0 || fs.readdirSync(fullPath).some(f => !f.startsWith('.'))) {
                        structure.push({
                            type: 'directory',
                            name: item,
                            path: fullPath,
                            children: children
                        });
                    }
                } else {
                    const ext = path.extname(item).toLowerCase();
                    let type = 'file';
                    
                    // Determine file type based on extension
                    if (['.jpg', '.jpeg', '.png', '.tif', '.tiff'].includes(ext)) {
                        type = 'image';
                    } else if (['.mp4', '.avi', '.mov', '.mkv', '.webm'].includes(ext)) {
                        type = 'video';
                    } else if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) {
                        type = 'audio';
                    } else if (ext === '.txt') {
                        type = 'transcript';
                    }

                    console.log('Found file:', item, 'of type:', type);
                    structure.push({
                        type,
                        name: item,
                        path: fullPath
                    });
                }
            } catch (itemError) {
                console.error('Error processing item:', item, itemError);
            }
        });

        return structure;
    } catch (error) {
        console.error('Error scanning directory:', error);
        throw error;
    }
}

// Handle folder selection
ipcMain.handle('select-folder', async () => {
    try {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory']
        })
        if (!result.canceled) {
            const folderPath = result.filePaths[0]
            const structure = scanDirectory(folderPath)
            return { path: folderPath, structure }
        }
        return null
    } catch (error) {
        console.error('Error in select-folder:', error)
        throw error
    }
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