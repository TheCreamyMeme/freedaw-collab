import React from 'react';
import TrackCard from './track-card';

const TrackList = ({ tracks, selectedTrack }) => {
  return (
    <div className="tracker-container">
      {tracks.map((track) => <TrackCard key={track.id} track={track} selectedTrack={selectedTrack} />)}
    </div>
  );
};

export default TrackList;
