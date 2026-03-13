const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// Increase JSON payload limit for large DAW files
app.use(express.json({ limit: '50mb' }));

// Directories for persistent storage inside the container
const PROJECTS_DIR = path.join(__dirname, 'projects');
const SAMPLES_DIR = path.join(__dirname, 'samples');

// Ensure directories exist
if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });
if (!fs.existsSync(SAMPLES_DIR)) fs.mkdirSync(SAMPLES_DIR, { recursive: true });

// --- Audio Sample Endpoints ---
// 1. Serve audio files statically via GET
app.use('/api/samples', express.static(SAMPLES_DIR));

// 2. Upload audio samples (accepts raw binary WAV)
app.post('/api/samples/:sampleId', express.raw({ type: 'audio/wav', limit: '100mb' }), (req, res) => {
    try {
        const filePath = path.join(SAMPLES_DIR, `${req.params.sampleId}.wav`);
        // Only write if we don't already have it, to save disk wear
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, req.body);
        }
        res.json({ status: 'saved' });
    } catch (e) {
        console.error('Error saving sample:', e);
        res.status(500).json({ error: 'Failed to write audio file' });
    }
});

// --- Existing Project Endpoints ---
// 1. Save project JSON
app.post('/api/projects', (req, res) => {
    try {
        const project = req.body;
        if (!project || !project.id) {
            return res.status(400).json({ error: 'Invalid project data' });
        }
        
        const filePath = path.join(PROJECTS_DIR, `${project.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(project, null, 2));
        res.json({ status: 'saved', id: project.id });
    } catch (error) {
        console.error('Error saving project:', error);
        res.status(500).json({ error: 'Failed to save project' });
    }
});

// 2. Load project JSONs
app.get('/api/projects', (req, res) => {
    try {
        const files = fs.readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.json'));
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`WebDAW Host Server running on port ${PORT}`));