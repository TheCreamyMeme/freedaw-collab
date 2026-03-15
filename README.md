# FreeDaw-Collab

FreeDaw-Collab is a secure, collaborative, and offline-first web-based Digital Audio Workstation (DAW). It features a comprehensive Web Audio DSP engine, real-time collaboration, and project management capabilities, all split between a React frontend and a Node.js backend.

## Features

### Audio Engine & Production
* **Full DSP & Web Audio Engine:** Includes built-in instruments (Analog Subtractive, FM Synth, Supersaw, Drum Machine, etc.) and native DSP effects (Digital Delay, Parametric EQ, Room Reverb, Tube Distortion, Bitcrusher, and more).
* **MIDI & Audio Support:** Zero-dependency native MIDI parsing and writing, along with audio recording capabilities straight from the browser.
* **Exporting:** Supports generating Multitrack ZIP stems and rendering mixdowns to WAV.
* **Dynamic Grid & Piano Roll:** Features a dynamic styling engine for the arrangement grid and piano roll, along with snapping capabilities.

### Collaboration & Storage
* **Real-time Collaboration:** Powered by Socket.io, allowing multiple users to sync DAW actions, presence, and live visual previews smoothly.
* **Offline-First Architecture:** Utilizes a custom IndexedDB wrapper to save projects and samples locally when offline, with the ability to sync to the server when connected.
* **Project Sharing:** Users can make projects public or explicitly share them with other registered users. 

### User Authentication & Management
* **Secure Access:** JWT-based authentication ensures secure login and API access.
* **User Profiles:** Users can customize their profiles with avatars, bios, and customized UI colors.

## Tech Stack

**Frontend:**
* React (Vite template)
* TailwindCSS (v3) for styling
* Lucide React for iconography
* Socket.io-client for real-time WebSocket communication

**Backend:**
* Node.js with Express
* Socket.io for WebRTC negotiation and real-time signaling
* Multer for handling multitrack audio sample uploads
* JSON Web Tokens (JWT) for route protection

## Deployment & Docker Setup

The project includes two separate Dockerfiles to easily spin up the frontend and backend independently.

### 1. Frontend Web App
The frontend uses a multi-stage Docker build to keep the image lightweight:
* **Stage 1:** Scaffolds a Vite React app, installs dependencies (`lucide-react`, `tailwindcss`, `socket.io-client`), dynamically injects the PostCSS/Tailwind configuration, and builds the static production app.
* **Stage 2:** Uses `serve` on a Node 20 Alpine container to host the compiled static files as a Single Page Application (SPA) on port `3000`.

### 2. Backend Server
The backend is containerized using the lightweight Node 20 Alpine image:
* Automatically installs Express, CORS, JWT, Socket.io, and Multer.
* Maps persistent storage using Docker Volumes for the `/app/projects` and `/app/samples` directories so user data and audio files are not lost when the container stops.
* Runs on port `3000` by default (can be mapped differently to avoid conflict with the frontend).

## API Endpoints Overview

The Node.js server provides several protected REST API routes:
* `POST /api/auth/login`: Authenticate and receive a JWT.
* `GET /api/users`: Fetch registered users.
* `PUT /api/users/profile`: Update user profile details like avatars and bios.
* `POST /api/samples/upload/:sampleId`: Upload audio samples via Multer.
* `GET /api/projects` & `POST /api/projects`: Sync and retrieve DAW project JSON files.