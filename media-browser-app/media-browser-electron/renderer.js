// Required imports

// Audio Waveform Visualization Class
class AudioWaveform {
    constructor(container, audioElement) {
        this.container = container;
        this.audio = audioElement;
        this.canvas = document.createElement('canvas');
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100px';
        this.ctx = this.canvas.getContext('2d');
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.isPlaying = false;
        this.animationId = null;

        // Configure analyser
        this.analyser.fftSize = 2048;
        this.bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(this.bufferLength);

        // Setup canvas
        this.setupCanvas();
        
        // Connect audio to analyser
        this.source = this.audioContext.createMediaElementSource(this.audio);
        this.source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);

        // Start animation
        this.animate();

        // Add progress indicator
        this.setupProgressBar();

        // Add click handling for seeking
        this.setupSeekHandling();
    }

    setupCanvas() {
        // Set actual dimensions (2x for retina displays)
        this.canvas.width = this.container.clientWidth * 2;
        this.canvas.height = 200; // Fixed height
        this.container.appendChild(this.canvas);
    }

    setupProgressBar() {
        this.progressCanvas = document.createElement('canvas');
        this.progressCanvas.style.position = 'absolute';
        this.progressCanvas.style.top = '0';
        this.progressCanvas.style.left = '0';
        this.progressCanvas.style.width = '100%';
        this.progressCanvas.style.height = '100px';
        this.progressCanvas.style.pointerEvents = 'none';
        this.progressCtx = this.progressCanvas.getContext('2d');
        this.progressCanvas.width = this.canvas.width;
        this.progressCanvas.height = this.canvas.height;
        this.container.appendChild(this.progressCanvas);
    }

    setupSeekHandling() {
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percentage = x / rect.width;
            this.audio.currentTime = percentage * this.audio.duration;
        });

        this.canvas.style.cursor = 'pointer';
    }

    animate() {
        this.animationId = requestAnimationFrame(this.animate.bind(this));
        this.analyser.getByteTimeDomainData(this.dataArray);
        
        // Clear canvas
        this.ctx.fillStyle = 'rgb(126,210,243)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw waveform
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = 'rgb(45,101,148)';
        this.ctx.beginPath();

        const sliceWidth = this.canvas.width * 1.0 / this.bufferLength;
        let x = 0;

        for (let i = 0; i < this.bufferLength; i++) {
            const v = this.dataArray[i] / 128.0;
            const y = v * this.canvas.height / 2;

            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        this.ctx.lineTo(this.canvas.width, this.canvas.height / 2);
        this.ctx.stroke();

        // Draw progress
        this.drawProgress();
    }

    drawProgress() {
        if (!this.audio.duration) return;

        this.progressCtx.clearRect(0, 0, this.progressCanvas.width, this.progressCanvas.height);
        
        const progress = (this.audio.currentTime / this.audio.duration) * this.progressCanvas.width;
        
        // Draw progress overlay
        this.progressCtx.fillStyle = 'rgba(45,101,148, 0.2)';
        this.progressCtx.fillRect(0, 0, progress, this.progressCanvas.height);
        
        // Draw progress line
        this.progressCtx.beginPath();
        this.progressCtx.strokeStyle = 'rgb(45,101,148)';
        this.progressCtx.lineWidth = 2;
        this.progressCtx.moveTo(progress, 0);
        this.progressCtx.lineTo(progress, this.progressCanvas.height);
        this.progressCtx.stroke();
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        // Stop the audio
        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
        }
        
        // Clean up audio context
        if (this.source) {
            this.source.disconnect();
        }
        if (this.analyser) {
            this.analyser.disconnect();
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
        
        // Remove visual elements
        if (this.canvas && this.canvas.parentNode) {
            this.container.removeChild(this.canvas);
        }
        if (this.progressCanvas && this.progressCanvas.parentNode) {
            this.container.removeChild(this.progressCanvas);
        }
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

// Call setupDefaultLogo after elements are defined
setupDefaultLogo();

// Style the warning overlay
elements.warningOverlay.style.position = 'fixed';
elements.warningOverlay.style.bottom = '20px';
elements.warningOverlay.style.left = '50%';
elements.warningOverlay.style.transform = 'translateX(-50%)';
elements.warningOverlay.style.backgroundColor = 'rgba(255, 0, 0, 0.9)';
elements.warningOverlay.style.color = 'white';
elements.warningOverlay.style.padding = '15px 30px';
elements.warningOverlay.style.borderRadius = '5px';
elements.warningOverlay.style.zIndex = '9999';
elements.warningOverlay.style.fontSize = '16px';
elements.warningOverlay.style.fontWeight = 'bold';
elements.warningOverlay.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
elements.warningOverlay.style.display = 'none';
document.body.appendChild(elements.warningOverlay);

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

// Function to extract folder number from filename
function getFolderNumber(filename) {
    const match = filename.match(/(AV\d{10})/);
    if (match && match[1]) {
        return match[1];
    }
    return null;
}

// Function to show/hide warning
function toggleFolderWarning(show) {
    if (show) {
        elements.warningOverlay.textContent = "Obs! Du har valgt filer fra ulike mapper.";
        elements.warningOverlay.style.display = 'block';
    } else {
        elements.warningOverlay.style.display = 'none';
    }
}

// Main Event Listeners
// In renderer.js
elements.selectFolder.addEventListener('click', async () => {
    console.log('Select folder button clicked');
    try {
        const result = await window.api.selectFolder();
        console.log('Got result from select-folder:', result);
        if (result) {
            state.currentFolder = result.path;
            state.folderStructure = result.structure;
            state.currentFolderNumber = null;
            toggleFolderWarning(false);
            renderFolderTree(state.folderStructure);
            countFiles(state.folderStructure);
        }
    } catch (error) {
        console.error('Error selecting folder:', error);
    }
});

// Transcript save functionality
elements.saveTranscript.addEventListener('click', async () => {
    if (state.currentFile && state.currentFile.type === 'transcript') {
        try {
            const result = await window.api.saveTranscript({
                filePath: state.currentFile.path,
                content: elements.transcriptText.value
            });
            
            if (result.success) {
                alert('Transcript saved successfully!');
            } else {
                alert('Error saving transcript: ' + result.error);
            }
        } catch (error) {
            alert('Error saving transcript: ' + error.message);
            console.error('Save error:', error);
        }
    } else {
        alert('Please select a transcript file first');
    }
});

// Folder Tree Rendering
function renderFolderTree(items, parentElement = elements.folderTree) {
    parentElement.innerHTML = '';
    
    const sortedItems = items.sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
    });

    sortedItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'folder-item';
        
        const icon = document.createElement('span');
        icon.textContent = getItemIcon(item.type);
        div.appendChild(icon);
        
        const name = document.createElement('span');
        name.textContent = item.name;
        div.appendChild(name);
        
        if (item.type === 'directory') {
            const expandIcon = document.createElement('span');
            expandIcon.textContent = '+';
            expandIcon.style.marginRight = '5px';
            div.insertBefore(expandIcon, icon);

            const children = document.createElement('div');
            children.className = 'folder-children';
            children.style.display = 'none';
            
            let childrenLoaded = false;
            
            div.addEventListener('click', (e) => {
                e.stopPropagation();
                expandIcon.textContent = children.style.display === 'none' ? '-' : '+';
                children.style.display = children.style.display === 'none' ? 'block' : 'none';
                
                if (!childrenLoaded && item.children) {
                    renderFolderTree(item.children, children);
                    childrenLoaded = true;
                }
            });
            
            parentElement.appendChild(div);
            parentElement.appendChild(children);
        } else {
            div.addEventListener('click', () => {
                document.querySelectorAll('.folder-item').forEach(item => 
                    item.classList.remove('active'));
                div.classList.add('active');
                handleFileClick(item);
            });
            parentElement.appendChild(div);
        }
    });
}

// File click handler
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

async function showMedia(file) {
    elements.currentFile.textContent = file.name;
    
    if (file.type === 'image') {
        try {
            const ext = window.api.extname(file.path).toLowerCase();
            if (ext === '.tif' || ext === '.tiff') {
                try {
                    // Read the file as a buffer
                    const buffer = await window.api.readFile(file.path);
                    
                    // Process the image using our preload API
                    const processedBuffer = await window.api.processImage(buffer);
                    
                    // Create a blob from the processed buffer
                    const blob = new Blob([processedBuffer], { type: 'image/jpeg' });
                    const url = URL.createObjectURL(blob);
                    
                    displayImage(url);
                } catch (sharpError) {
                    console.error('TIFF conversion failed:', sharpError);
                    elements.photoArea.innerHTML = `
                        <div class="error">
                            Error: Unable to display this TIFF image<br>
                            Try opening the file directly: <button onclick="window.open('file://${file.path}')">Open File</button>
                        </div>`;
                }
            } else {
                displayImage('file://' + file.path);
            }
        } catch (error) {
            console.error('Error displaying image:', error);
            elements.photoArea.innerHTML = '<div class="error">Error loading image</div>';
        }
    } else if (file.type === 'video') {
        // Clear existing content
        elements.videoArea.innerHTML = '';
        elements.photoArea.innerHTML = '';
        
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

        // Progress bar
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

        // Update progress bar
        video.addEventListener('timeupdate', () => {
            const percentage = (video.currentTime / video.duration) * 100;
            progress.style.width = percentage + '%';
        });

        // Click on progress bar to seek
        progressContainer.addEventListener('click', (e) => {
            const rect = progressContainer.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            video.currentTime = pos * video.duration;
        });

        // Control buttons
        const playPauseBtn = document.createElement('button');
        playPauseBtn.innerHTML = '⏵';
        playPauseBtn.style.color = 'white';
        playPauseBtn.style.background = 'none';
        playPauseBtn.style.border = 'none';
        playPauseBtn.style.fontSize = '20px';
        playPauseBtn.style.cursor = 'pointer';
        playPauseBtn.onclick = () => {
            if (video.paused) {
                video.play();
                playPauseBtn.innerHTML = '⏸';
            } else {
                video.pause();
                playPauseBtn.innerHTML = '⏵';
            }
        };

        // Volume control
        const volumeContainer = document.createElement('div');
        volumeContainer.style.display = 'flex';
        volumeContainer.style.alignItems = 'center';
        volumeContainer.style.gap = '5px';

        const volumeBtn = document.createElement('button');
        volumeBtn.innerHTML = '🔊';
        volumeBtn.style.color = 'white';
        volumeBtn.style.background = 'none';
        volumeBtn.style.border = 'none';
        volumeBtn.style.fontSize = '16px';
        volumeBtn.style.cursor = 'pointer';

        const volumeSlider = document.createElement('input');
        volumeSlider.type = 'range';
        volumeSlider.min = '0';
        volumeSlider.max = '1';
        volumeSlider.step = '0.1';
        volumeSlider.value = '1';
        volumeSlider.style.width = '60px';

        volumeSlider.oninput = () => {
            video.volume = volumeSlider.value;
            volumeBtn.innerHTML = video.volume === 0 ? '🔇' : '🔊';
        };

        volumeBtn.onclick = () => {
            if (video.volume > 0) {
                video.volume = 0;
                volumeSlider.value = 0;
                volumeBtn.innerHTML = '🔇';
            } else {
                video.volume = 1;
                volumeSlider.value = 1;
                volumeBtn.innerHTML = '🔊';
            }
        };

        volumeContainer.appendChild(volumeBtn);
        volumeContainer.appendChild(volumeSlider);

        const fullscreenBtn = document.createElement('button');
        fullscreenBtn.innerHTML = '⛶';
        fullscreenBtn.style.color = 'white';
        fullscreenBtn.style.background = 'none';
        fullscreenBtn.style.border = 'none';
        fullscreenBtn.style.fontSize = '20px';
        fullscreenBtn.style.cursor = 'pointer';
        fullscreenBtn.onclick = () => {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                container.requestFullscreen();
            }
        };

        // Time display
        const timeDisplay = document.createElement('div');
        timeDisplay.style.color = 'white';
        timeDisplay.style.fontSize = '14px';
        timeDisplay.style.marginLeft = '10px';
        timeDisplay.style.fontFamily = 'monospace';

        video.addEventListener('timeupdate', () => {
            const currentTime = formatTime(video.currentTime);
            const duration = formatTime(video.duration);
            timeDisplay.textContent = `${currentTime} / ${duration}`;
        });

        // Navigation controls
        const navControls = document.createElement('div');
        navControls.style.position = 'absolute';
        navControls.style.top = '50%';
        navControls.style.width = '100%';
        navControls.style.display = 'flex';
        navControls.style.justifyContent = 'space-between';
        navControls.style.padding = '0 20px';
        navControls.style.transform = 'translateY(-50%)';
        navControls.style.pointerEvents = 'none';
        navControls.style.transition = 'opacity 0.3s';

        const navBtn = (direction) => {
            const btn = document.createElement('button');
            btn.innerHTML = direction === 'prev' ? '⬅️' : '➡️';
            btn.style.fontSize = '24px';
            btn.style.background = 'rgba(0, 0, 0, 0.5)';
            btn.style.border = 'none';
            btn.style.borderRadius = '50%';
            btn.style.width = '40px';
            btn.style.height = '40px';
            btn.style.cursor = 'pointer';
            btn.style.pointerEvents = 'auto';
            btn.onclick = () => navigateMedia(direction === 'prev' ? -1 : 1);
            return btn;
        };

        navControls.appendChild(navBtn('prev'));
        navControls.appendChild(navBtn('next'));

        // Assemble controls
        videoControls.appendChild(playPauseBtn);
        videoControls.appendChild(progressContainer);
        videoControls.appendChild(volumeContainer);
        videoControls.appendChild(timeDisplay);
        videoControls.appendChild(fullscreenBtn);

        // Add everything to container
        container.appendChild(video);
        container.appendChild(videoControls);
        container.appendChild(navControls);
        
        elements.videoArea.appendChild(container);

        // Auto-hide controls
        let controlsTimeout;
        const showControls = () => {
            videoControls.style.opacity = '1';
            navControls.style.opacity = '1';
            clearTimeout(controlsTimeout);
            controlsTimeout = setTimeout(() => {
                if (!video.paused) {
                    videoControls.style.opacity = '0';
                    navControls.style.opacity = '0';
                }
            }, 3000);
        };

        container.addEventListener('mousemove', showControls);
        container.addEventListener('mouseleave', () => {
            if (!video.paused) {
                videoControls.style.opacity = '0';
                navControls.style.opacity = '0';
            }
        });

        // Add keyboard controls
        container.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (video.paused) video.play();
                else video.pause();
            }
            else if (e.code === 'ArrowLeft') video.currentTime -= 5;
            else if (e.code === 'ArrowRight') video.currentTime += 5;
            else if (e.code === 'ArrowUp') video.volume = Math.min(1, video.volume + 0.1);
            else if (e.code === 'ArrowDown') video.volume = Math.max(0, video.volume - 0.1);
        });

        // Make container focusable for keyboard controls
        container.tabIndex = 0;
        container.focus();

    } else if (file.type === 'audio') {
        elements.videoArea.innerHTML = '';
        elements.photoArea.innerHTML = '';
        
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
        audio.controls = false; // Using custom controls
        
        const controls = createMediaControls(audio);
        
        // Add navigation controls
        const navControls = document.createElement('div');
        navControls.className = 'media-controls';
        
        const prevBtn = document.createElement('button');
        prevBtn.innerHTML = '⬅️';
        prevBtn.onclick = () => navigateMedia(-1);
        
        const nextBtn = document.createElement('button');
        nextBtn.innerHTML = '➡️';
        nextBtn.onclick = () => navigateMedia(1);
        
        navControls.append(prevBtn, nextBtn);
        
        audioContainer.appendChild(waveformContainer);
        audioContainer.appendChild(controls);
        audioContainer.appendChild(navControls);
        elements.videoArea.appendChild(audioContainer);
        
        // Initialize waveform visualization
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
    
    const img = document.createElement('img');
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.objectFit = 'contain';
    img.src = src.startsWith('blob:') ? src : 'file://' + src;
    
    const navControls = document.createElement('div');
    navControls.className = 'media-controls';
    
    const prevBtn = document.createElement('button');
    prevBtn.innerHTML = '⬅️';
    prevBtn.onclick = () => navigateMedia(-1);
    
    const nextBtn = document.createElement('button');
    nextBtn.innerHTML = '➡️';
    nextBtn.onclick = () => navigateMedia(1);
    
    navControls.append(prevBtn, nextBtn);
    container.append(img, navControls);
    
    elements.photoArea.innerHTML = '';
    elements.photoArea.appendChild(container);
}

function setupVideoPlayer(src) {
    const video = document.createElement('video');
    video.src = 'file://' + src;
    video.controls = true;
    video.style.maxWidth = '100%';
    video.style.maxHeight = '100%';
    
    const controls = createMediaControls(video);
    
    elements.videoArea.innerHTML = '';
    elements.videoArea.appendChild(video);
    elements.videoArea.appendChild(controls);
}
function setupAudioPlayer(filePath) {
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
    audio.src = 'file://' + filePath;
    audio.controls = false; // We'll use our custom controls
    
    const controls = createMediaControls(audio);
    
    audioContainer.appendChild(waveformContainer);
    audioContainer.appendChild(controls);
    elements.videoArea.appendChild(audioContainer);
    
    // Initialize waveform visualization
    state.currentWaveform = new AudioWaveform(waveformContainer, audio);
}

function createMediaControls(media) {
    const controls = document.createElement('div');
    controls.className = 'media-controls';
    
    const rewindBtn = document.createElement('button');
    rewindBtn.innerHTML = '⏪';
    rewindBtn.onclick = () => media.currentTime = Math.max(0, media.currentTime - 10);
    
    const playBtn = document.createElement('button');
    playBtn.innerHTML = '⏯️';
    playBtn.onclick = () => media.paused ? media.play() : media.pause();
    
    const forwardBtn = document.createElement('button');
    forwardBtn.innerHTML = '⏩';
    forwardBtn.onclick = () => media.currentTime = Math.min(media.duration, media.currentTime + 10);
    
    const timeDisplay = document.createElement('span');
    timeDisplay.style.color = 'white';
    
    media.ontimeupdate = () => {
        timeDisplay.textContent = `${formatTime(media.currentTime)} / ${formatTime(media.duration)}`;
    };
    
    controls.append(rewindBtn, playBtn, forwardBtn, timeDisplay);
    return controls;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}



async function navigateMedia(direction) {
    const newIndex = state.currentMediaIndex + direction;
    if (newIndex >= 0 && newIndex < state.mediaFiles.length) {
        const nextFile = state.mediaFiles[newIndex];
        const newFolderNumber = getFolderNumber(path.basename(nextFile.path));
        
        if (newFolderNumber !== state.currentFolderNumber) {
            toggleFolderWarning(true);
        } else {
            toggleFolderWarning(false);
        }

        state.currentMediaIndex = newIndex;
        showMedia({ ...nextFile, name: path.basename(nextFile.path) });
    }
}

function countFiles(items) {
    state.fileStats = {
        video: 0,
        audio: 0,
        transcript: 0
    };
    
    function recursiveCount(items) {
        items.forEach(item => {
            if (item.type === 'directory' && item.children) {
                recursiveCount(item.children);
            } else {
                if (item.type === 'video') state.fileStats.video++;
                if (item.type === 'audio') state.fileStats.audio++;
                if (item.type === 'transcript') state.fileStats.transcript++;
            }
        });
    }
    
    recursiveCount(items);
    
    // Update display
    const statsDiv = document.getElementById('fileStats');
    statsDiv.innerHTML = `
        File Statistics:<br>
        📽️ Videos: ${state.fileStats.video}<br>
        🎵 Audio: ${state.fileStats.audio}<br>
        📝 Transcripts: ${state.fileStats.transcript}
    `;
}

// Utility Functions
function getFileType(filename) {
    const ext = window.api.extname(filename).toLowerCase();
    console.log('File extension:', ext, 'for file:', filename);

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

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
