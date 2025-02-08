// Default behavior to prevent any drag and drop
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

// Audio Waveform Visualization Class
class AudioWaveform {
    constructor(container, audioElement) {
        this.container = container;
        this.audio = audioElement;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.rafId = null;
        this.barWidth = 2;
        this.barGap = 1;
        this.playhead = document.createElement('div');
        
        this.initialize();
    }
    
    async initialize() {
        // Set up canvas
        this.container.appendChild(this.canvas);
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        
        // Set up playhead
        this.playhead.className = 'playhead';
        this.container.appendChild(this.playhead);
        
        // Initialize audio context and analyzer
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            
            // Create audio source
            const source = this.audioContext.createMediaElementSource(this.audio);
            source.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
            
            // Configure analyzer
            this.analyser.fftSize = 2048;
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);
            
            // Start visualization
            this.resize();
            this.draw();
            
            // Add event listeners
            window.addEventListener('resize', () => this.resize());
            this.container.addEventListener('click', (e) => this.handleClick(e));
            
            // Update playhead position during playback
            this.audio.addEventListener('timeupdate', () => {
                const progress = (this.audio.currentTime / this.audio.duration) * 100;
                this.playhead.style.left = `${progress}%`;
            });
        } catch (error) {
            console.error('Error initializing AudioWaveform:', error);
            this.container.innerHTML = `
                <div class="error-message">
                    <p>Unable to initialize audio visualization</p>
                    <p>Error: ${error.message}</p>
                </div>`;
        }
    }
    
    resize() {
        // Get container dimensions
        const rect = this.container.getBoundingClientRect();
        
        // Set canvas size with device pixel ratio for sharp rendering
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        
        // Set canvas styles
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
    }
    
    draw() {
        // Stop if component is destroyed
        if (!this.analyser) return;
        
        // Get frequency data
        this.analyser.getByteFrequencyData(this.dataArray);
        
        // Clear canvas
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        this.ctx.clearRect(0, 0, width, height);
        
        // Calculate number of bars based on container width
        const totalBars = Math.floor(width / (this.barWidth + this.barGap));
        const dataPerBar = Math.floor(this.dataArray.length / totalBars);
        
        // Draw bars
        for (let i = 0; i < totalBars; i++) {
            // Average frequency data for this bar
            let sum = 0;
            for (let j = 0; j < dataPerBar; j++) {
                sum += this.dataArray[i * dataPerBar + j];
            }
            const average = sum / dataPerBar;
            
            // Calculate bar height (max 80% of container height)
            const barHeight = (average / 255) * height * 0.8;
            
            // Position bar vertically centered
            const x = i * (this.barWidth + this.barGap);
            const y = (height - barHeight) / 2;
            
            // Draw bar with gradient
            const gradient = this.ctx.createLinearGradient(0, y, 0, y + barHeight);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
            
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(x, y, this.barWidth, barHeight);
        }
        
        // Request next frame
        this.rafId = requestAnimationFrame(() => this.draw());
    }
    
    handleClick(e) {
        const rect = this.container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const progress = x / rect.width;
        
        // Set audio position
        if (this.audio.duration) {
            this.audio.currentTime = progress * this.audio.duration;
        }
    }
    
    destroy() {
        // Clean up resources
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
        // Remove elements
        this.container.innerHTML = '';
        // Remove event listeners
        window.removeEventListener('resize', this.resize);
    }
}

// Global state management
const state = {
    currentFolder: null,
    folderStructure: null,
    currentFile: null,
    mediaFiles: [],
    currentMediaIndex: 0,
    currentWaveform: null,
    currentFolderNumber: null,
    fileStats: {
        video: 0,
        audio: 0,
        transcript: 0
    }
};

// DOM Elements
const elements = {
    selectFolder: document.getElementById('selectFolder'),
    folderTree: document.getElementById('folderTree'),
    videoArea: document.getElementById('videoArea'),
    photoArea: document.getElementById('photoArea'),
    transcriptText: document.getElementById('transcriptText'),
    saveTranscript: document.getElementById('saveTranscript'),
    currentFile: document.getElementById('currentFile'),
    warningOverlay: document.createElement('div')
};

// Set up default logo
function setupDefaultLogo() {
    const logoContainer = document.createElement('div');
    logoContainer.className = 'default-logo';
    logoContainer.style.textAlign = 'center';
    logoContainer.style.opacity = '0.2';
    
    const logo = document.createElement('img');
    logo.src = './assets/logo.png';
    logo.alt = 'Logo';
    logo.style.width = '200px';
    logo.style.height = 'auto';
    
    logoContainer.appendChild(logo);
    elements.videoArea.appendChild(logoContainer);
}

async function showMedia(file) {
    elements.currentFile.textContent = file.name;
    
    if (file.type === 'image') {
        try {
            console.log('Processing image file:', file.path);
            const ext = window.api.extname(file.path).toLowerCase();
            
            if (ext === '.tif' || ext === '.tiff') {
                try {
                    console.log('Processing TIFF file...');
                    const buffer = await window.api.readFile(file.path);
                    console.log('TIFF file read, size:', buffer.length);
                    
                    const processedBuffer = await window.api.processImage(buffer);
                    console.log('TIFF processing complete');
                    
                    const blob = new Blob([processedBuffer], { type: 'image/jpeg' });
                    const url = URL.createObjectURL(blob);
                    displayImage(url);
                } catch (tiffError) {
                    console.error('Detailed TIFF error:', tiffError);
                    elements.photoArea.innerHTML = `
                        <div class="error-message">
                            <p>Unable to display this TIFF image</p>
                            <p>Error details: ${tiffError.message}</p>
                            <button onclick="window.api.openExternal('file://${file.path}')">Open in Default App</button>
                        </div>`;
                }
            } else if (['.jpg', '.jpeg', '.png'].includes(ext)) {
                console.log('Displaying regular image:', file.path);
                displayImage(file.path);
            } else {
                throw new Error('Unsupported image format: ' + ext);
            }
        } catch (error) {
            console.error('Error displaying image:', error);
            elements.photoArea.innerHTML = `
                <div class="error-message">
                    <p>Error loading image: ${error.message}</p>
                    <button onclick="window.api.openExternal('file://${file.path}')">Open in Default App</button>
                </div>`;
        }
    } else if (file.type === 'video') {
        // Only clear video area
        elements.videoArea.innerHTML = '';
        
        const container = document.createElement('div');
        container.className = 'video-container';
        container.style.position = 'relative';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'center';
        container.style.backgroundColor = '#000';
        
        const video = document.createElement('video');
        video.src = 'file://' + file.path;
        video.style.maxWidth = '100%';
        video.style.maxHeight = 'calc(100% - 60px)';
        video.style.margin = 'auto';
        
        // Custom video controls container
        const videoControls = document.createElement('div');
        videoControls.className = 'video-controls';
        videoControls.style.width = '100%';
        videoControls.style.padding = '10px';
        videoControls.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        videoControls.style.position = 'absolute';
        videoControls.style.bottom = '0';
        videoControls.style.left = '0';
        videoControls.style.display = 'flex';
        videoControls.style.alignItems = 'center';
        videoControls.style.gap = '10px';
        videoControls.style.transition = 'opacity 0.3s';

        // Create play/pause button
        const playPauseBtn = document.createElement('button');
        playPauseBtn.innerHTML = '⏯️';
        playPauseBtn.onclick = () => video.paused ? video.play() : video.pause();

        // Create volume container and controls
        const volumeContainer = document.createElement('div');
        volumeContainer.style.display = 'flex';
        volumeContainer.style.alignItems = 'center';

        // Time display
        const timeDisplay = document.createElement('span');
        timeDisplay.style.color = 'white';
        timeDisplay.style.minWidth = '100px';
        timeDisplay.style.textAlign = 'center';

        // Progress container
        const progressContainer = document.createElement('div');
        progressContainer.style.flex = '1';
        progressContainer.style.height = '5px';
        progressContainer.style.backgroundColor = '#444';
        progressContainer.style.cursor = 'pointer';
        progressContainer.style.position = 'relative';
        progressContainer.style.borderRadius = '2px';

        const progress = document.createElement('div');
        progress.style.width = '0%';
        progress.style.height = '100%';
        progress.style.backgroundColor = '#2196F3';
        progress.style.borderRadius = '2px';
        progress.style.transition = 'width 0.1s';
        progressContainer.appendChild(progress);

        // Add controls
        videoControls.appendChild(playPauseBtn);
        videoControls.appendChild(progressContainer);
        videoControls.appendChild(volumeContainer);
        videoControls.appendChild(timeDisplay);

        // Add everything to container
        container.appendChild(video);
        container.appendChild(videoControls);
        elements.videoArea.appendChild(container);

    } else if (file.type === 'audio') {
        // Only clear video area for audio files
        elements.videoArea.innerHTML = '';
        
        const audioContainer = document.createElement('div');
        audioContainer.style.width = '100%';
        audioContainer.style.height = '100%';
        audioContainer.style.display = 'flex';
        audioContainer.style.flexDirection = 'column';
        audioContainer.style.alignItems = 'center';
        audioContainer.style.justifyContent = 'center';
        audioContainer.style.padding = '20px';
        
        const waveformContainer = document.createElement('div');
        waveformContainer.style.width = '100%';
        waveformContainer.style.position = 'relative';
        waveformContainer.style.backgroundColor = 'rgb(126,210,243)';
        waveformContainer.style.borderRadius = '8px';
        waveformContainer.style.overflow = 'hidden';
        
        const audio = document.createElement('audio');
        audio.src = 'file://' + file.path;
        audio.controls = false;
        
        const controls = createMediaControls(audio);
        
        audioContainer.appendChild(waveformContainer);
        audioContainer.appendChild(controls);
        elements.videoArea.appendChild(audioContainer);
        
        if (state.currentWaveform) {
            state.currentWaveform.destroy();
        }
        state.currentWaveform = new AudioWaveform(waveformContainer, audio);
    }
} 

function displayImage(src) {
    const container = document.createElement('div');
    container.style.position = 'relative';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    
    const img = document.createElement('img');
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.objectFit = 'contain';
    
    // If it's already a blob URL or starts with file://, use it as is
    if (src.startsWith('blob:') || src.startsWith('file://')) {
        img.src = src;
    } else {
        img.src = 'file://' + src;
    }
    
    // Add error handling
    img.onerror = (e) => {
        console.error('Error loading image:', e);
        container.innerHTML = `<div class="error">Error loading image: ${src}</div>`;
    };
    
    container.appendChild(img);
    
    // Only clear photo area
    elements.photoArea.innerHTML = '';
    elements.photoArea.appendChild(container);
    
    // Log for debugging
    console.log('Displaying image with src:', img.src);
}

function createMediaControls(media) {
    const controls = document.createElement('div');
    controls.className = 'media-controls';
    controls.style.display = 'flex';
    controls.style.alignItems = 'center';
    controls.style.gap = '15px';
    controls.style.padding = '10px';
    controls.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    controls.style.borderRadius = '8px';
    controls.style.margin = '10px 0';
    
    // Rewind button
    const rewindBtn = document.createElement('button');
    rewindBtn.innerHTML = '⏪';
    rewindBtn.title = 'Rewind 10 seconds';
    rewindBtn.onclick = () => {
        media.currentTime = Math.max(0, media.currentTime - 10);
    };
    
    // Play/Pause button
    const playBtn = document.createElement('button');
    playBtn.innerHTML = '⏯️';
    playBtn.title = 'Play/Pause';
    playBtn.onclick = () => {
        if (media.paused) {
            media.play();
            playBtn.innerHTML = '⏸️';
        } else {
            media.pause();
            playBtn.innerHTML = '▶️';
        }
    };
    
    // Forward button
    const forwardBtn = document.createElement('button');
    forwardBtn.innerHTML = '⏩';
    forwardBtn.title = 'Forward 10 seconds';
    forwardBtn.onclick = () => {
        media.currentTime = Math.min(media.duration, media.currentTime + 10);
    };
    
    // Time display
    const timeDisplay = document.createElement('span');
    timeDisplay.style.color = 'white';
    timeDisplay.style.fontFamily = 'monospace';
    timeDisplay.style.fontSize = '14px';
    timeDisplay.style.minWidth = '140px';
    timeDisplay.style.textAlign = 'center';
    
    // Progress bar container
    const progressContainer = document.createElement('div');
    progressContainer.style.flex = '1';
    progressContainer.style.height = '8px';
    progressContainer.style.backgroundColor = '#444';
    progressContainer.style.borderRadius = '4px';
    progressContainer.style.cursor = 'pointer';
    progressContainer.style.position = 'relative';
    
    // Progress bar
    const progress = document.createElement('div');
    progress.style.width = '0%';
    progress.style.height = '100%';
    progress.style.backgroundColor = '#2196F3';
    progress.style.borderRadius = '4px';
    progress.style.transition = 'width 0.1s';
    progressContainer.appendChild(progress);
    
    // Volume control
    const volumeContainer = document.createElement('div');
    volumeContainer.style.display = 'flex';
    volumeContainer.style.alignItems = 'center';
    volumeContainer.style.gap = '5px';
    
    const volumeIcon = document.createElement('button');
    volumeIcon.innerHTML = '🔊';
    volumeIcon.title = 'Mute/Unmute';
    volumeIcon.onclick = () => {
        media.muted = !media.muted;
        volumeIcon.innerHTML = media.muted ? '🔇' : '🔊';
    };
    
    const volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.min = '0';
    volumeSlider.max = '1';
    volumeSlider.step = '0.1';
    volumeSlider.value = '1';
    volumeSlider.style.width = '80px';
    volumeSlider.onchange = () => {
        media.volume = volumeSlider.value;
        volumeIcon.innerHTML = volumeSlider.value === '0' ? '🔇' : '🔊';
    };
    
    // Update time display and progress bar
    media.ontimeupdate = () => {
        const current = formatTime(media.currentTime);
        const total = formatTime(media.duration);
        timeDisplay.textContent = `${current} / ${total}`;
        progress.style.width = `${(media.currentTime / media.duration) * 100}%`;
    };
    
    // Click handler for progress bar
    progressContainer.onclick = (e) => {
        const rect = progressContainer.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        media.currentTime = pos * media.duration;
    };
    
    // Add all controls to the container
    controls.append(
        rewindBtn,
        playBtn,
        forwardBtn,
        timeDisplay,
        progressContainer,
        volumeIcon,
        volumeSlider
    );
    
    // Style all buttons consistently
    controls.querySelectorAll('button').forEach(button => {
        button.style.backgroundColor = 'transparent';
        button.style.border = 'none';
        button.style.color = 'white';
        button.style.fontSize = '20px';
        button.style.cursor = 'pointer';
        button.style.padding = '5px 10px';
        button.style.transition = 'transform 0.1s';
        
        // Hover effect
        button.onmouseenter = () => {
            button.style.transform = 'scale(1.1)';
        };
        button.onmouseleave = () => {
            button.style.transform = 'scale(1)';
        };
    });
    
    return controls;
}

// Helper function to format time in MM:SS format
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

async function handleFileClick(file) {
    const newFolderNumber = getFolderNumber(file.name);
    
    if (state.currentFolderNumber === null) {
        state.currentFolderNumber = newFolderNumber;
    } else if (newFolderNumber !== state.currentFolderNumber) {
        toggleFolderWarning(true);
    } else {
        toggleFolderWarning(false);
    }

    state.currentFile = file;
    
    if (file.type === 'transcript') {
        try {
            const content = await window.api.readFile(file.path, { encoding: 'utf8' });
            elements.transcriptText.value = content;
            elements.currentFile.textContent = file.name;
        } catch (error) {
            console.error('Error reading transcript:', error);
            alert('Error reading transcript file');
        }
    } else if (file.type === 'image' || file.type === 'video' || file.type === 'audio') {
        const dirPath = window.api.dirname(file.path);
        const files = window.api.readdirSync(dirPath);
        
        state.mediaFiles = files
            .filter(f => {
                const ext = window.api.extname(f).toLowerCase();
                return ['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.mp4', '.avi', '.mov', '.mp3', '.wav'].includes(ext);
            })
            .map(f => ({
                path: window.api.getPath(dirPath, f),
                type: getFileType(f)
            }));
        
        state.currentMediaIndex = state.mediaFiles.findIndex(f => f.path === file.path);
        showMedia(file);
    }
}

// Folder Tree Rendering
function renderFolderTree(items, parentElement = elements.folderTree) {
    // Clear the parent element if it's the root folder tree
    if (parentElement === elements.folderTree) {
        parentElement.innerHTML = '';
    }

    items.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'folder-item';
        
        // Add icon based on item type
        const icon = getItemIcon(item.type);
        itemElement.textContent = `${icon} ${item.name}`;

        // Add click handler for files
        if (item.type !== 'directory') {
            itemElement.addEventListener('click', () => handleFileClick({
                type: item.type,
                name: item.name,
                path: item.path
            }));
        }

        // If it's a directory with children, create a container for child items
        if (item.type === 'directory' && item.children) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'folder-children';
            childrenContainer.style.display = 'none'; // Initially hidden
            
            // Add click handler to toggle children visibility
            itemElement.addEventListener('click', (e) => {
                e.stopPropagation();
                childrenContainer.style.display = 
                    childrenContainer.style.display === 'none' ? 'block' : 'none';
            });

            // Render children recursively
            renderFolderTree(item.children, childrenContainer);
            
            // Add children container after the item element
            parentElement.appendChild(itemElement);
            parentElement.appendChild(childrenContainer);
        } else {
            // If it's a file, just add the item element
            parentElement.appendChild(itemElement);
        }
    });
}

function countFiles(items) {
    const stats = {
        video: 0,
        audio: 0,
        transcript: 0
    };

    if (!items) return stats;

    items.forEach(item => {
        if (item.type === 'directory' && item.children) {
            const subdirStats = countFiles(item.children);
            stats.video += subdirStats.video;
            stats.audio += subdirStats.audio;
            stats.transcript += subdirStats.transcript;
        } else {
            switch (item.type) {
                case 'video':
                    stats.video++;
                    break;
                case 'audio':
                    stats.audio++;
                    break;
                case 'transcript':
                    stats.transcript++;
                    break;
            }
        }
    });

    return stats;
}

// Utility Functions
function getFileType(filename) {
    const ext = window.api.extname(filename).toLowerCase();
    
    if (['.jpg', '.jpeg', '.png', '.tif', '.tiff'].includes(ext)) return 'image';
    if (['.mp4', '.avi', '.mov'].includes(ext)) return 'video';
    if (['.mp3', '.wav'].includes(ext)) return 'audio';
    if (ext === '.txt') return 'transcript';
    return 'file';
}

function getItemIcon(type) {
    switch (type) {
        case 'directory': return '📁';
        case 'image': return '🖼️';
        case 'video': return '🎥';
        case 'audio': return '🎵';
        case 'transcript': return '📝';
        default: return '📄';
    }
}

// Add this function to renderer.js
function getFolderNumber(filename) {
    // Match a number at the start of the filename
    const match = filename.match(/^(\d+)/);
    if (match) {
        return parseInt(match[1]);
    }
    return null;
}

function toggleFolderWarning(show) {
    if (show) {
        elements.warningOverlay.className = 'warning-overlay';
        elements.warningOverlay.innerHTML = `
            <div class="warning-message">
                Warning: You are viewing files from different folder numbers
            </div>
        `;
        if (!elements.warningOverlay.parentElement) {
            document.body.appendChild(elements.warningOverlay);
        }
    } else {
        if (elements.warningOverlay.parentElement) {
            elements.warningOverlay.parentElement.removeChild(elements.warningOverlay);
        }
    }
}

// Add keyboard navigation
document.addEventListener('keydown', (e) => {
    if (state.currentFile && (state.currentFile.type === 'image' || state.currentFile.type === 'video' || state.currentFile.type === 'audio')) {
        if (e.key === 'ArrowLeft') {
            navigateMedia(-1);
        } else if (e.key === 'ArrowRight') {
            navigateMedia(1);
        }
    }
});

// Initial setup
setupDefaultLogo();

// Add click handler for select folder button
elements.selectFolder.addEventListener('click', async () => {
    try {
        const result = await window.api.selectFolder();
        if (result) {
            state.currentFolder = result.path;
            state.folderStructure = result.structure;
            renderFolderTree(result.structure);
            
            // Update file statistics
            if (result.structure) {
                const stats = countFiles(result.structure);
                state.fileStats = stats;
                
                // Update stats display
                const statsElement = document.getElementById('fileStats');
                statsElement.innerHTML = `File Statistics:<br>
                    Videos: ${stats.video}<br>
                    Audio: ${stats.audio}<br>
                    Transcripts: ${stats.transcript}`;
            }
        }
    } catch (error) {
        console.error('Error selecting folder:', error);
        alert('Error selecting folder: ' + error.message);
    }
});