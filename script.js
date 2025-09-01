import React, { useState } from 'react';
import TrackList from './track-list';

const tracks = [
  { id: 1, name: 'Track 1', duration: '3:00' },
  { id: 2, name: 'Track 2', duration: '4:30' },
  // Add more tracks...
];

const [selectedTrack] = useState({});

const App = () => {
  return (
    <div>
      <h1>Timeline UI</h1>
      <TrackList tracks={tracks} selectedTrack={selectedTrack} />
    </div>
  );
};

export default App;
