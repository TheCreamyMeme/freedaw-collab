// Track Management System
const trackContainer = document.getElementById('track-container');

// Add Track Functionality
function addTrack() {
    const track = document.createElement('div');
    track.className = 'track';
    track.draggable = true;
    track.innerHTML = `
        <button class="remove-track">✖</button>
        <audio class="track-audio" src=""></audio>
    `;
    
    // Drag and drop initialization
    track.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', track.id);
    });
    
    // Enable dragover highlighting
    track.addEventListener('dragover', (e) => {
        e.preventDefault();
        track.style.backgroundColor = '#f0f0f0';
    });
    
    // Reset background color on drag leave
    track.addEventListener('dragleave', () => {
        track.style.backgroundColor = '';
    });
    
    // Handle drop to reorder tracks
    track.addEventListener('drop', (e) => {
        e.preventDefault();
        track.style.backgroundColor = '';
        
        const draggedTrackId = e.dataTransfer.getData('text/plain');
        const draggedTrack = document.getElementById(draggedTrackId);
        
        // Find the target position based on mouse coordinates
        const rect = track.getBoundingClientRect();
        const mouseY = e.clientY;
        
        // Determine if dropping above or below the target track
        const isAbove = mouseY < rect.top + rect.height / 2;
        
        // Get all tracks and filter out the dragged track
        const tracks = Array.from(trackContainer.children)
            .filter(id => id !== draggedTrackId);
            
        // Insert at the correct position
        if (isAbove) {
            trackContainer.insertBefore(draggedTrack, track);
        } else {
            trackContainer.appendChild(draggedTrack);
        // Playback Controls
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        function playTrack(trackIndex) {
            const track = document.querySelectorAll('.track')[trackIndex];
            const audioElement = track.querySelector('.track-audio');
            
            // Create buffer source node
            const source = audioContext.createBufferSource();
            source.buffer = audioContext.decodeAudioData(audioElement.src);
            
            // Connect to destination
            source.connect(audioContext.destination);
            
            // Start playback
            source.start(0);
        }
        
        function pauseTrack(trackIndex) {
            const track = document.querySelectorAll('.track')[trackIndex];
            const audioElement = track.querySelector('.track-audio');
            
            // Pause playback
            audioContext.suspend();
        }
        
        function stopTrack(trackIndex) {
            const track = document.querySelectorAll('.track')[trackIndex];
            const audioElement = track.querySelector('.track-audio');
            
            // Stop playback
            audioContext.resume();
        }
        
        // Add control buttons
        const controlsContainer = document.createElement('div');
        controlsContainer.id = 'controls';
        controlsContainer.innerHTML = `
            <button onclick="playTrack(0)">Play Track 1</button>
            <button onclick="pauseTrack(0)">Pause Track 1</button>
            <button onclick="stopTrack(0)">Stop Track 1</button>
            <!-- Add more buttons for additional tracks -->
        `;
        
        document.body.appendChild(controlsContainer);
    });
    
    // Track removal
    track.querySelector('.remove-track').addEventListener('click', () => {
        trackContainer.removeChild(track);
    });
    
// Playback Controls
document.addEventListener('DOMContentLoaded', () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    function playTrack(trackIndex) {
        const track = document.querySelectorAll('.track')[trackIndex];
        const audioElement = track.querySelector('.track-audio');
        
        // Create buffer source node
        const source = audioContext.createBufferSource();
        source.buffer = audioContext.decodeAudioData(audioElement.src);
        
        // Connect to destination
        source.connect(audioContext.destination);
        
        // Start playback
        source.start(0);
    }

    function pauseTrack(trackIndex) {
        const track = document.querySelectorAll('.track')[trackIndex];
        const audioElement = track.querySelector('.track-audio');
        
        // Pause playback
        audioContext.suspend();
    }

    function stopTrack(trackIndex) {
        const track = document.querySelectorAll('.track')[trackIndex];
        const audioElement = track.querySelector('.track-audio');
        
        // Stop playback
        audioContext.resume();
    }

    // Add control buttons
    const controlsContainer = document.createElement('div');
    controlsContainer.id = 'controls';
    controlsContainer.innerHTML = `
        <button onclick="playTrack(0)">Play Track 1</button>
        <button onclick="pauseTrack(0)">Pause Track 1</button>
        <button onclick="stopTrack(0)">Stop Track 1</button>
        <!-- Add more buttons for additional tracks -->
    `;

    document.body.appendChild(controlsContainer);
});

// Initialize with 4 tracks
for (let i = 0; i < 4; i++) {
    addTrack();
}