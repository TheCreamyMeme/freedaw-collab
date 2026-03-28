# FreeDaw-Collab

FreeDaw-Collab is a secure, collaborative, and offline-first web-based Digital Audio Workstation (DAW). It features a comprehensive Web Audio DSP engine, real-time collaboration, and project management capabilities, all split between a React frontend and a Node.js backend.

---

## 🚀 Cool Features & Major Updates

### The "Plugin Playground" (New!)
* **Custom Plugin Architecture (SDK):** Extend the DAW's capabilities instantly. Upload custom JavaScript (`.js`) plugins to dynamically generate Web Audio API nodes. The DAW auto-generates UI knobs based on your plugin's JSON parameter schemas!
* **In-App Code Viewer:** Click on any internal or custom plugin in the file browser to instantly view, highlight, and copy its raw source code. It acts as a self-documenting playground for learning how to build your own Web Audio effects and instruments.

### Audio Engine & Production
* **Full DSP & Web Audio Engine:** Built-in instruments (Analog Subtractive, FM Synth, Supersaw, Drum Machine) and native DSP effects (Digital Delay, Parametric EQ, Room Reverb, Tube Distortion, Bitcrusher).
* **MIDI & Audio Support:** Zero-dependency native MIDI parsing and writing, plus live browser-based audio recording.
* **Exporting:** Generate Multitrack ZIP stems or render complete mixdowns to WAV.

### Collaboration, Storage & Persistence
* **Real-time Collaboration:** Powered by Socket.io, allowing multiple users to sync DAW actions, presence, and live visual previews smoothly.
* **Offline-First Architecture:** Uses a custom IndexedDB wrapper to save projects locally when offline, syncing seamlessly to the server when reconnected.
* **Granular Backend Persistence:** User accounts, custom `.js` plugins, audio samples, and projects are now safely persisted across server reboots via dedicated file mounts and JSON configurations.

### Robust Deployment
* **Aggressive Cache Busting:** The frontend uses a multi-stage Docker build with dynamic Node-based HTML injection and strict `serve.json` configurations to defeat aggressive browser caching, guaranteeing users always load the latest UI.

---

## 🛠️ Custom Plugin SDK Guide

FreeDaw-Collab features a flexible SDK for injecting your own DSP. Plugins are written as standard JavaScript files and pushed to the global `window.FreeDawPlugins` array. 

> **Note:** To load a plugin, save your code as a `.js` file and upload it via the Browser panel using the **Import .js** button.

### 1. Custom Instruments
Instrument plugins generate sound based on MIDI note input.

```javascript
window.FreeDawPlugins.push({
    id: "my-custom-synth",
    name: "My Custom Synth",
    category: "instrument",
    vendor: "My Studio",
    defaultParams: { cutoff: 2000, res: 1.5, attack: 0.01, release: 0.2 },
    triggerNote: (ctx, bus, pitch, time, vol, dur, params, vel, pbNode) => {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440 * Math.pow(2, (pitch - 69) / 12), time);

        env.gain.setValueAtTime(0, time);
        env.gain.linearRampToValueAtTime(vol * (vel/127), time + (params.attack || 0.01));
        env.gain.setTargetAtTime(0, time + dur, params.release || 0.1);

        if (pbNode) pbNode.connect(osc.detune);

        osc.connect(env);
        env.connect(bus);
        
        osc.start(time);
        osc.stop(time + dur + (params.release || 0.1) + 0.5);
    }
});
```

### 2. Custom Effects
Effect plugins process an existing audio stream. You must route audio between the input and output using wet and dry gain nodes.

```javascript
window.FreeDawPlugins.push({
    id: "my-custom-filter",
    name: "My Custom Filter",
    category: "effect",
    vendor: "My Studio",
    defaultParams: { mix: 0.5, frequency: 1000 },
    processAudio: async (ctx, input, output, wet, dry, params) => {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = params?.frequency || 1000;

        input.connect(filter);
        filter.connect(wet);
        wet.connect(output);

        return {
            fxType: 'custom',
            filter, wet, dry, 
            updateParam: (paramName, value, time) => {
                if (paramName === 'frequency') filter.frequency.setTargetAtTime(value, time, 0.05);
                if (paramName === 'mix') {
                    wet.gain.setTargetAtTime(value, time, 0.05);
                    dry.gain.setTargetAtTime(1 - value, time, 0.05);
                }
            }
        };
    }
});
```

### 🎛️ Parameter Schema (Auto-UI)
The DAW automatically generates UI knobs and formats their values based on your `defaultParams` keys:

| Parameter Keys | Range | Format / Curve |
| :--- | :--- | :--- |
| `cutoff`, `freq`, `tone`, `damping` | 20 - 20,000 | Logarithmic Hz |
| `time`, `attack`, `release`, `decay` | 0.001 - 10 | Logarithmic Seconds |
| `mix`, `depth`, `amount` | 0.0 - 1.0 | Linear Float |
| `gain`, `low`, `mid`, `high` | -24 to +24 | Linear Decibels |
| `rate` | 0.1 - 20 | Logarithmic Hz for LFOs |

---

## 🐳 Deployment & Docker Setup

### 1. Frontend Web App
* **Stage 1:** Scaffolds a Vite React app, injects PostCSS/Tailwind configuration, and builds the production app.
* **Stage 2:** Uses `serve` on an Alpine container. Hosts from `/var/www/html` to prevent Docker layer caching issues, leveraging a strict `serve.json` for SPA routing.

### 2. Backend Server
* **Environment:** Node 20 Alpine image handling Express, CORS, JWT, Socket.io, and Multer.
* **Volumes:** `/app/projects`, `/app/samples`, `/app/users`, and `/app/plugins` guarantee zero data loss.

---

## 🔌 API Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **POST** | `/api/auth/login` | Authenticate and receive a JWT. |
| **GET** | `/api/users` | Fetch users. |
| **PUT** | `/api/users/profile` | Update profiles. |
| **POST** | `/api/samples/upload/:sampleId` | Upload audio samples. |
| **GET** | `/api/projects` | Retrieve project JSON files. |
| **POST** | `/api/projects` | Sync project JSON files. |
| **DELETE** | `/api/projects/:projectId` | Securely delete a project (restricted to owners). |
| **GET** | `/api/plugins` | Retrieve `.js` DSP plugins. |
| **POST** | `/api/plugins/upload` | Upload `.js` DSP plugins. |