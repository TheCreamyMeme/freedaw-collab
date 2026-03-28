FreeDaw-Collab

FreeDaw-Collab is a secure, collaborative, and offline-first web-based Digital Audio Workstation (DAW). It features a comprehensive Web Audio DSP engine, real-time collaboration, and project management capabilities, all split between a React frontend and a Node.js backend.

Features

Audio Engine & Production

Full DSP & Web Audio Engine: Includes built-in instruments (Analog Subtractive, FM Synth, Supersaw, Drum Machine, etc.) and native DSP effects (Digital Delay, Parametric EQ, Room Reverb, Tube Distortion, Bitcrusher, and more).

Custom Plugin Architecture (SDK): Extend the DAW's capabilities by directly uploading custom JavaScript (.js) plugins. The engine dynamically evaluates Web Audio API nodes, auto-generates UI knob controls based on JSON parameter schemas, and routes audio automatically.

In-App Code Viewer: The built-in browser allows developers to preview the raw source code of internal and custom plugins, acting as a self-documenting playground for building Web Audio plugins.

MIDI & Audio Support: Zero-dependency native MIDI parsing and writing, along with audio recording capabilities straight from the browser.

Exporting: Supports generating Multitrack ZIP stems and rendering mixdowns to WAV.

Dynamic Grid & Piano Roll: Features a dynamic styling engine for the arrangement grid and piano roll, along with snapping capabilities.

Collaboration & Storage

Real-time Collaboration: Powered by Socket.io, allowing multiple users to sync DAW actions, presence, and live visual previews smoothly.

Offline-First Architecture: Utilizes a custom IndexedDB wrapper to save projects and samples locally when offline, with the ability to sync to the server when connected.

Project Sharing: Users can make projects public or explicitly share them with other registered users.

User Authentication & Management

Secure Access: JWT-based authentication ensures secure login and API access.

User Profiles: Users can customize their profiles with avatars, bios, social links, and customized UI colors.

Custom Plugin SDK Guide

FreeDaw-Collab features a flexible SDK for injecting your own DSP (Digital Signal Processing) code. Plugins are written as standard JavaScript files and pushed to the global window.FreeDawPlugins array.

To load a plugin, save your code as a .js file and upload it via the Browser panel using the Import .js button.

1. Custom Instruments

Instrument plugins generate sound based on MIDI note input.

window.FreeDawPlugins.push({
    id: "my-custom-synth",
    name: "My Custom Synth",
    category: "instrument",
    vendor: "My Studio",
    defaultParams: {
        cutoff: 2000,
        res: 1.5,
        attack: 0.01,
        release: 0.2
    },
    triggerNote: (ctx, bus, pitch, time, vol, dur, params, vel, pbNode) => {
        // ctx:    Web Audio Context
        // bus:    The output gain node for this track
        // pitch:  MIDI note number (0-127)
        // time:   Absolute audio context time to start the note
        // vol:    Track volume (0.0 - 1.0)
        // dur:    Duration of the note in seconds
        // params: The current state of your defaultParams (controlled by user)
        // vel:    Note velocity (0-127)
        // pbNode: Pitch Bend ConstantSourceNode (connect this to osc.detune)

        const osc = ctx.createOscillator();
        const env = ctx.createGain();

        // Convert MIDI pitch to frequency
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440 * Math.pow(2, (pitch - 69) / 12), time);

        // Apply Envelope
        env.gain.setValueAtTime(0, time);
        env.gain.linearRampToValueAtTime(vol * (vel/127), time + (params.attack || 0.01));
        env.gain.setTargetAtTime(0, time + dur, params.release || 0.1);

        // Apply Pitch Bend
        if (pbNode) pbNode.connect(osc.detune);

        // Connect Graph
        osc.connect(env);
        env.connect(bus);
        
        // Start & Stop
        osc.start(time);
        osc.stop(time + dur + (params.release || 0.1) + 0.5);
    }
});


2. Custom Effects

Effect plugins process an existing audio stream. They must connect the input to the output using wet and dry gain nodes, and return an interface so the DAW can update parameters in real-time.

window.FreeDawPlugins.push({
    id: "my-custom-filter",
    name: "My Custom Filter",
    category: "effect",
    vendor: "My Studio",
    defaultParams: {
        mix: 0.5,
        frequency: 1000
    },
    processAudio: async (ctx, input, output, wet, dry, params) => {
        // ctx:          Web Audio Context
        // input/output: The main I/O nodes for this effect in the chain
        // wet/dry:      Gain nodes for handling the mix. You MUST route through these.
        // params:       The initial state of your defaultParams

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = params?.frequency || 1000;

        // Connect DSP graph
        input.connect(filter);
        filter.connect(wet);
        wet.connect(output);

        // Return the DAW interface
        return {
            fxType: 'custom',
            filter, wet, dry, // Expose internal nodes so they get cleaned up on delete
            updateParam: (paramName, value, time) => {
                // This function is called whenever a user turns a knob or triggers automation
                if (paramName === 'frequency') {
                    filter.frequency.setTargetAtTime(value, time, 0.05);
                }
                if (paramName === 'mix') {
                    wet.gain.setTargetAtTime(value, time, 0.05);
                    dry.gain.setTargetAtTime(1 - value, time, 0.05);
                }
            }
        };
    }
});


Parameter Schema (Auto-UI)

The DAW automatically generates UI knobs, sets their min/max constraints, and formats their display values based on the keys provided in your defaultParams object. It uses keyword matching:

cutoff, freq, tone, damping: 20 - 20,000 (Logarithmic Hz)

time, attack, release, decay: 0.001 - 10 (Logarithmic Seconds)

mix, depth, amount: 0.0 - 1.0 (Linear Float)

gain, low, mid, high: -24 to +24 (Linear Decibels)

rate: 0.1 - 20 (Logarithmic Hz for LFOs)

Tech Stack

Frontend:

React (Vite template)

TailwindCSS (v3) for styling

Lucide React for iconography

Socket.io-client for real-time WebSocket communication

Backend:

Node.js with Express

Socket.io for WebRTC negotiation and real-time signaling

Multer for handling multitrack audio sample and plugin script uploads

JSON Web Tokens (JWT) for route protection

Deployment & Docker Setup

The project includes two separate Dockerfiles to easily spin up the frontend and backend independently.

1. Frontend Web App

The frontend uses a multi-stage Docker build to keep the image lightweight and bypass aggressive browser caching:

Stage 1: Scaffolds a Vite React app, installs dependencies (lucide-react, tailwindcss, socket.io-client), dynamically injects the PostCSS/Tailwind configuration, and builds the static production app.

Stage 2: Uses serve on a Node 20 Alpine container to host the compiled static files as a Single Page Application (SPA) on port 3000. Custom serve.json definitions ensure safe routing.

2. Backend Server

The backend is containerized using the lightweight Node 20 Alpine image:

Automatically installs Express, CORS, JWT, Socket.io, and Multer.

Maps persistent storage using Docker Volumes for the /app/projects, /app/samples, /app/users, and /app/plugins directories so user data, audio files, and custom scripts are not lost when the container stops.

Runs on port 3000 by default (can be mapped differently to avoid conflict with the frontend).

API Endpoints Overview

The Node.js server provides several protected REST API routes:

POST /api/auth/login: Authenticate and receive a JWT.

GET /api/users & PUT /api/users/profile: Fetch registered users and update profile details (avatars, bios, links).

POST /api/samples/upload/:sampleId: Upload audio samples via Multer.

GET /api/projects & POST /api/projects: Sync and retrieve DAW project JSON files.

DELETE /api/projects/:projectId: Securely delete a project (restricted to owners).

GET /api/plugins & POST /api/plugins/upload: Retrieve and upload custom JavaScript DSP plugins.

GET /api/plugins/files/*: Serve raw .js static plugin files.