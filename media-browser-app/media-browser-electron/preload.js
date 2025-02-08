const { contextBridge, ipcRenderer } = require('electron')
const { promises: fsPromises, readdirSync, statSync } = require('fs')
const path = require('path')
const sharp = require('sharp')

// Expose protected methods that allow the renderer process to use
// IPC and filesystem operations without exposing the entire objects
contextBridge.exposeInMainWorld('api', {
    // File system operations
    readFile: async (filepath, options) => {
        try {
            return await fsPromises.readFile(filepath, options)
        } catch (error) {
            throw error
        }
    },
    readdirSync: (dirPath) => readdirSync(dirPath),
    statSync: (filepath) => statSync(filepath),
    
    // Path operations
    getPath: (...args) => path.join(...args),
    dirname: (filepath) => path.dirname(filepath),
    basename: (filepath) => path.basename(filepath),
    extname: (filepath) => path.extname(filepath),
    
    // IPC operations
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    saveTranscript: (data) => ipcRenderer.invoke('save-transcript', data),
    
    // Sharp image processing
    processImage: async (buffer) => {
        try {
            const processedBuffer = await sharp(buffer, {
                unlimited: true,
                sequentialRead: true
            })
            .rotate() // Auto-rotate based on EXIF data
            .flatten({ background: { r: 255, g: 255, b: 255 } })
            .jpeg({
                quality: 90,
                chromaSubsampling: '4:4:4'
            })
            .toBuffer();

            return processedBuffer;
        } catch (error) {
            throw error;
        }
    }
})