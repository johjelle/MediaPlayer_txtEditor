const { contextBridge, ipcRenderer } = require('electron');
const { promises: fsPromises, readdirSync, statSync } = require('fs');
const path = require('path');
const sharp = require('sharp');

console.log('Preload script starting...');

// Initialize sharp
sharp.cache(false);
sharp.simd(true);

// Define the API to expose to renderer process
const api = {
    // File system operations
    readFile: async (filepath, options) => {
        try {
            return await fsPromises.readFile(filepath, options);
        } catch (error) {
            console.error('Error reading file:', error);
            throw error;
        }
    },

    readdirSync: (dirPath) => {
        try {
            return readdirSync(dirPath);
        } catch (error) {
            console.error('Error reading directory:', error);
            throw error;
        }
    },

    statSync: (filepath) => {
        try {
            return statSync(filepath);
        } catch (error) {
            console.error('Error getting file stats:', error);
            throw error;
        }
    },
    
    // Path operations
    getPath: (...args) => path.join(...args),
    dirname: (filepath) => path.dirname(filepath),
    basename: (filepath) => path.basename(filepath),
    extname: (filepath) => path.extname(filepath),
    
    // IPC operations
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    saveTranscript: (data) => ipcRenderer.invoke('save-transcript', data),
    
    // Image processing
    processImage: async (buffer) => {
        try {
            const processedBuffer = await sharp(buffer, {
                unlimited: true,
                sequentialRead: true
            })
            .rotate()
            .flatten({ background: { r: 255, g: 255, b: 255 } })
            .jpeg({
                quality: 90,
                chromaSubsampling: '4:4:4'
            })
            .toBuffer();

            return processedBuffer;
        } catch (error) {
            console.error('Error processing image:', error);
            throw error;
        }
    },

    // Shell operations
    openExternal: (url) => {
        const { shell } = require('electron');
        shell.openExternal(url);
    }
};

// Expose the API to the renderer process
console.log('Exposing API to renderer process...');
contextBridge.exposeInMainWorld('api', api);
console.log('Preload script completed successfully');