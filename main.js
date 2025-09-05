// Audio Track Structure Implementation

/**
 * Represents an audio track in the DAW application
 */
class TrackNode {
  constructor(id, audioData, metadata = {}) {
    this.id = id;
    this.audioData = audioData; // Base64 encoded ArrayBuffer
    this.metadata = { ...metadata };
    this.children = [];
    this.effects = []; // Effect chain

    // Required metadata fields
    if (!this.metadata.tempo) this.metadata.tempo = 120;
    if (!this.metadata.key) this.metadata.key = 'C Major';
    if (!this.metadata.instrument) this.metadata.instrument = 'Piano';

    // Default mixer parameters
    this.volume = 0.5; // 0-1 range
    this.pan = 0; // -1 (left) to 1 (right)
  }
  
  /**
   * Add a child track to this node
   */
  addChild(track) {
    this.children.push(track);
  }
}

/**
 * Manages hierarchical organization of tracks through tagging
 */
class TagManager {
  constructor() {
    this.tags = new Map(); // tag name to array of track IDs
  }

  /**
   * Add a tag to a specific track
   */
  addTagToTrack(trackId, tagName) {
    if (!this.tags.has(tagName)) {
      this.tags.set(tagName, []);
    }
    
    this.tags.get(tagName).push(trackId);
  }

  /**
   * Remove a tag from a track
   */
  removeTagFromTrack(trackId, tagName) {
    const tagTracks = this.tags.get(tagName);
    if (tagTracks) {
      const index = tagTracks.indexOf(trackId);
      if (index !== -1) {
        tagTracks.splice(index, 1);
        if (tagTracks.length === 0) {
          this.tags.delete(tagName);
        }
      }
    }
  }

  /**
   * Get all tracks with a specific tag
   */
  getTracksByTag(tagName) {
    return this.tags.get(tagName) || [];
  }
}

// Example usage
const track1 = new TrackNode('track-001', 'base64data...', { tempo: 128, key: 'A Minor' });
const track2 = new TrackNode('track-002', 'anotherBase64...', { instrument: 'Guitar' });

const tagManager = new TagManager();
tagManager.addTagToTrack(track1.id, 'melody');
tagManager.addTagToTrack(track2.id, 'rhythm');

console.log('Tracks with melody tag:', tagManager.getTracksByTag('melody'));