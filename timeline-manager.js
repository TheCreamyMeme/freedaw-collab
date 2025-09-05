/**
 * Manages synchronization of audio tracks with the sequencer timeline
 */
class TimelineManager {
  constructor() {
    this.tracks = [];
    this.currentTime = 0;
    this.isPlaying = false;
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  /**
   * Add a track to the timeline manager
   */
  addTrack(track) {
    this.tracks.push(track);
    this.syncTrackWithTimeline(track);
  }

  /**
   * Synchronize track with timeline based on metadata
   */
  syncTrackWithTimeline(track) {
    // Align track start time with tempo and key signature
    const startTime = this.calculateStartTime(track.metadata.tempo, track.metadata.key);
    track.startTime = startTime;
  }

  /**
   * Calculate optimal start time based on tempo and key
   */
  calculateStartTime(tempo, key) {
    // Simple implementation - could be more complex with musical timing
    return Math.random() * 1000; // Random start time for demonstration
  }

  /**
   * Start playback of all synchronized tracks
   */
  startPlayback() {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this.currentTime = 0;
    
    // Start audio context
    this.audioContext.resume();
    
    // Schedule track playback
    this.tracks.forEach(track => {
      const startTime = track.startTime;
      const buffer = this.decodeAudioData(track.audioData);
      
      // Create and schedule audio buffer source node
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start(startTime);
    });
  }

  /**
   * Stop all track playback
   */
  stopPlayback() {
    this.isPlaying = false;
    this.currentTime = 0;
    
    // Stop all audio sources (simplified)
    this.tracks.forEach(track => {
      const source = track.audioSource;
      if (source) {
        source.stop();
      }
    });
  }

  /**
   * Decode Base64 audio data into AudioBuffer
   */
  decodeAudioData(base64Data) {
    // Convert Base64 to ArrayBuffer
    const binary = atob(base64Data);
    const array = new Uint8Array(binary.length);
    
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    
    // Create AudioBuffer
    const buffer = this.audioContext.createBuffer(
      1,
      array.length,
      this.audioContext.sampleRate
    );
    
    buffer.getChannelData(0).set(array);
    return buffer;
  }
}

// Export for use in other modules
export { TimelineManager };