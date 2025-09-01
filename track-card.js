import React from 'react';

const TrackCard = ({ track }) => {
    return (
        <div className="track-card">
            <p className="track-name">{track.name}</p>
            {/* Add additional elements for track title, duration, and controls */}
        </div>
    );
};

export default TrackCard;
