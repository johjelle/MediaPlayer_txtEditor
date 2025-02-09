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
    
    if (file.type === 'video') {
        // Clear video area and show loading state
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
        
        // Create a promise to handle video loading
        const videoLoaded = new Promise((resolve, reject) => {
            video.addEventListener('loadedmetadata', () => resolve());
            video.addEventListener('error', (e) => reject(e));
        });

        // Set up video element
        video.src = 'file://' + file.path;
        video.style.maxWidth = '100%';
        video.style.maxHeight = 'calc(100% - 60px)';
        video.style.margin = 'auto';
        
        try {
            // Wait for video to load
            await videoLoaded;
            
            // Initialize controls after video is loaded
            const videoControls = await initializeVideoControls(video);
            
            // Add everything to container
            container.appendChild(video);
            container.appendChild(videoControls);
            elements.videoArea.appendChild(container);
            
            // Start playing after everything is set up
            try {
                await video.play();
            } catch (playError) {
                console.log('Auto-play prevented:', playError);
            }
        } catch (error) {
            console.error('Error loading video:', error);
            elements.videoArea.innerHTML = `
                <div class="error-message">
                    <p>Error loading video: ${error.message}</p>
                    <button onclick="window.api.openExternal('file://${file.path}')">
                        Open in Default Player
                    </button>
                </div>`;
        }
    }
}

async function initializeVideoControls(video) {
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

    // Create play/pause button with async state handling and clear state indication
    const playPauseBtn = document.createElement('button');
    playPauseBtn.className = 'play-pause-btn';
    playPauseBtn.style.padding = '8px 16px';
    playPauseBtn.style.borderRadius = '4px';
    playPauseBtn.style.border = 'none';
    playPauseBtn.style.fontSize = '16px';
    playPauseBtn.style.fontWeight = 'bold';
    playPauseBtn.style.minWidth = '80px';
    playPauseBtn.style.display = 'flex';
    playPauseBtn.style.alignItems = 'center';
    playPauseBtn.style.justifyContent = 'center';
    playPauseBtn.style.gap = '6px';

    const updatePlayPauseState = (isPlaying) => {
        if (isPlaying) {
            playPauseBtn.innerHTML = '<span>⏸</span><span>Pause</span>';
            playPauseBtn.style.backgroundColor = '#ff4444';
            playPauseBtn.style.color = 'white';
        } else {
            playPauseBtn.innerHTML = '<span>▶</span><span>Play</span>';
            playPauseBtn.style.backgroundColor = '#44ff44';
            playPauseBtn.style.color = 'black';
        }
    };

    // Set initial state
    updatePlayPauseState(!video.paused);

    playPauseBtn.onclick = async () => {
        try {
            if (video.paused) {
                await video.play();
            } else {
                await video.pause();
            }
        } catch (error) {
            console.error('Error toggling play state:', error);
        }
    };

    // Handle async state changes
    video.addEventListener('play', () => updatePlayPauseState(true));
    video.addEventListener('pause', () => updatePlayPauseState(false));

    // Time display with async updates
    const timeDisplay = document.createElement('span');
    timeDisplay.style.color = 'white';
    timeDisplay.style.minWidth = '100px';
    timeDisplay.style.textAlign = 'center';

    // Progress container with async seeking
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

    // Async timeline seeking
    progressContainer.addEventListener('click', async (e) => {
        const rect = progressContainer.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        try {
            video.currentTime = pos * video.duration;
        } catch (error) {
            console.error('Error seeking:', error);
        }
    });

    // Async time preview
    let timeUpdateDebounce;
    progressContainer.addEventListener('mousemove', (e) => {
        clearTimeout(timeUpdateDebounce);
        timeUpdateDebounce = setTimeout(() => {
            const rect = progressContainer.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            const time = pos * video.duration;
            timeDisplay.textContent = `${formatTime(time)} / ${formatTime(video.duration)}`;
        }, 50);
    });

    progressContainer.addEventListener('mouseout', () => {
        clearTimeout(timeUpdateDebounce);
        timeDisplay.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
    });

    // Volume control with async state
    const volumeContainer = document.createElement('div');
    volumeContainer.style.display = 'flex';
    volumeContainer.style.alignItems = 'center';
    volumeContainer.style.gap = '5px';

    const volumeIcon = document.createElement('button');
    volumeIcon.innerHTML = video.muted ? '🔇' : '🔊';
    volumeIcon.onclick = async () => {
        try {
            video.muted = !video.muted;
            volumeIcon.innerHTML = video.muted ? '🔇' : '🔊';
        } catch (error) {
            console.error('Error toggling mute:', error);
        }
    };

    const volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.min = '0';
    volumeSlider.max = '1';
    volumeSlider.step = '0.1';
    volumeSlider.value = video.volume;
    volumeSlider.style.width = '80px';
    volumeSlider.onchange = async () => {
        try {
            video.volume = volumeSlider.value;
            volumeIcon.innerHTML = volumeSlider.value === '0' ? '🔇' : '🔊';
        } catch (error) {
            console.error('Error changing volume:', error);
        }
    };

    // Async time updates
    let progressUpdateDebounce;
    video.addEventListener('timeupdate', () => {
        clearTimeout(progressUpdateDebounce);
        progressUpdateDebounce = setTimeout(() => {
            timeDisplay.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
            progress.style.width = `${(video.currentTime / video.duration) * 100}%`;
        }, 50);
    });

    // Add all controls
    videoControls.append(
        playPauseBtn,
        progressContainer,
        timeDisplay,
        volumeIcon,
        volumeSlider
    );

    return videoControls;
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