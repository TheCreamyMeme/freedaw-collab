const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// Enable Cross-Origin Resource Sharing (CORS) for all routes
// This allows your frontend (e.g., daw.sprig.cc) to talk to this API (api.sprig.cc)
app.use(cors());

// Increase JSON payload limit for large DAW project files (50mb is plenty)
app.use(express.json({ limit: '50mb' }));

// Directories for persistent storage inside the container/host
const PROJECTS_DIR = path.join(__dirname, 'projects');
const SAMPLES_DIR = path.join(__dirname, 'samples');

// Ensure directories exist on startup
if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });
if (!fs.existsSync(SAMPLES_DIR)) fs.mkdirSync(SAMPLES_DIR, { recursive: true });

// ==========================================
// AUDIO SAMPLE ENDPOINTS
// ==========================================

// 1. Serve audio files statically via GET
// A request to /api/samples/my_sample.wav will serve the file from the SAMPLES_DIR
app.use('/api/samples', express.static(SAMPLES_DIR));

// 2. Upload audio samples (accepts raw binary WAV)
app.post('/api/samples/:sampleId', express.raw({ type: 'audio/wav', limit: '100mb' }), (req, res) => {
    try {
        const filePath = path.join(SAMPLES_DIR, `${req.params.sampleId}.wav`);
        
        // Only write if we don't already have it, to save disk wear
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, req.body);
            console.log(`Saved new sample: ${req.params.sampleId}.wav`);
        }
        res.json({ status: 'saved' });
    } catch (e) {
        console.error('Error saving sample:', e);
        res.status(500).json({ error: 'Failed to write audio file' });
    }
});

// ==========================================
// PROJECT DATA ENDPOINTS
// ==========================================

// 1. Save project JSON
app.post('/api/projects', (req, res) => {
    try {
        const project = req.body;
        if (!project || !project.id) {
            return res.status(400).json({ error: 'Invalid project data' });
        }
        
        const filePath = path.join(PROJECTS_DIR, `${project.id}.json`);
        
        // Write the JSON formatted nicely with 2-space indentation
        fs.writeFileSync(filePath, JSON.stringify(project, null, 2));
        console.log(`Saved project: ${project.name} (${project.id})`);
        
        res.json({ status: 'saved', id: project.id });
    } catch (error) {
        console.error('Error saving project:', error);
        res.status(500).json({ error: 'Failed to save project' });
    }
});

// 2. Load all project JSONs
app.get('/api/projects', (req, res) => {
    try {
        // Read all files ending in .json
        const files = fs.readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.json'));
        
        // Map them into an array of objects
        const projects = files.map(f => {
            const filePath = path.join(PROJECTS_DIR, f);
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        });
        
        res.json(projects);
    } catch (error) {
        console.error('Error reading projects:', error);
        res.status(500).json({ error: 'Failed to load projects' });
    }
});

// ==========================================
// SERVER INITIALIZATION
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`WebDAW Host Server running on port ${PORT}`);
    console.log(`- Projects Directory: ${PROJECTS_DIR}`);
    console.log(`- Samples Directory:  ${SAMPLES_DIR}`);
    console.log(`- CORS Enabled for all origins`);
});