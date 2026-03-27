const express = require('express');
const http = require('http');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const multer = require('multer');

const app = express();
const server = http.createServer(app);

// Socket.io for Signaling, Presence, and WebRTC Negotiation
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

const JWT_SECRET = process.env.JWT_SECRET || 'webdaw_super_secret_key_2026';
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '100mb' }));

const PROJECTS_DIR = path.join(__dirname, 'projects');
const SAMPLES_DIR = path.join(__dirname, 'samples');
const USERS_DIR = path.join(__dirname, 'users');
if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });
if (!fs.existsSync(SAMPLES_DIR)) fs.mkdirSync(SAMPLES_DIR, { recursive: true });
if (!fs.existsSync(USERS_DIR)) fs.mkdirSync(USERS_DIR, { recursive: true });

// Multer Storage Configuration for Audio Samples


// --- 1. AUTHENTICATION ---
app.post('/api/auth/login', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });

    // In production, verify passwords against a database here.
    const user = { id: `u_${username}_${Date.now()}`, username };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    res.js// --- 1. AUTHENTICATION ---
app.post('/api/auth/login', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });

    let user = null;
    const files = fs.readdirSync(USERS_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
        const u = JSON.parse(fs.readFileSync(path.join(USERS_DIR, file), 'utf-8'));
        if (u.username === username) {
            user = u;
            break;
        }
    }

    if (!user) {
        user = { id: `u_${username}_${Date.now()}`, username };
        fs.writeFileSync(path.join(USERS_DIR, `${user.id}.json`), JSON.stringify(user, null, 2));
    }

    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user });
});
on({ token, user });
});
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, SAMPLES_DIR),
    filename: (req, file, cb) => cb(null, `${req.params.sampleId}.wav`)
});
const upload = multer({ storage });

// --- 1. AUTHENTICATION ---
app.post('/api/auth/login', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });

    // In production, verify passwords against a database here.
    const user = { id: `u_${username}_${Date.now()}`, username };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user });
});

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Forbidden' });
        req.user = user;
        next();
    });
};

// --- 2. SAMPLES API (Protected Upload/Delete) ---
app.use('/api/samples', express.static(SAMPLES_DIR));

app.post('/api/samples/upload/:sampleId', authenticateToken, upload.single('audio'), (req, res) => {
    res.json({ status: 'saved', url: `/api/samples/${req.params.sampleId}.wav` });
});

app.delete('/api/samples/:sampleId', authenticateToken, (req, res) => {
    try {
        const filePath = path.join(SAMPLES_DIR, `${req.params.sampleId}.wav`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return res.json({ status: 'deleted' });
        }
        res.status(404).json({ error: 'Sample not found' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete sample' });
    }
});

// User Lookup API
app.get('/api/users', authenticateToken, (req, res) => {
    const users = [];
    const files = fs.readdirSync(USERS_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
        const u = JSON.parse(fs.readFileSync(path.join(USERS_DIR, file), 'utf-8'));
        users.push({ 
            id: u.id, username: u.username, avatar: u.avatar, 
            bio: u.bio, color: u.color, email: u.email,
            website: u.website, instagram: u.instagram, twitter: u.twitter
        });
    }
    res.json(users);
});

app.put('/api/users/profile', authenticateToken, (req, res) => {
    const filePath = path.join(USERS_DIR, `${req.user.id}.json`);
    if (fs.existsSync(filePath)) {
        let user = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const allowedFields = ['avatar', 'bio', 'color', 'email', 'website', 'instagram', 'twitter'];
        
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                user[field] = req.body[field];
            }
        }
        
        fs.writeFileSync(filePath, JSON.stringify(user, null, 2));
        res.json({ status: 'success', user });
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

// --- 3. PROJECTS API (Protected Upload/Delete) ---
app.get('/api/projects', authenticateToken, (req, res) => {
    try {
        const files = fs.readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.json'));
        const authorizedProjects = [];

        for (const file of files) {
            const project = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, file), 'utf-8'));

            const isOwner = project.ownerId === req.user.id;
            const isSharedWithMe = project.sharedWith && project.sharedWith.includes(req.user.username);
            const isPublic = project.isPublic === true || !project.ownerId;

            if (isOwner || isSharedWithMe || isPublic) {
                authorizedProjects.push(project);
            }
        }

        res.json(authorizedProjects);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load projects' });
    }
});

app.post('/api/projects', authenticateToken, (req, res) => {
    try {
        const project = req.body;
        if (!project || !project.id) return res.status(400).json({ error: 'Invalid project data' });

        fs.writeFileSync(path.join(PROJECTS_DIR, `${project.id}.json`), JSON.stringify(project, null, 2));
        res.json({ status: 'saved', id: project.id });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save project' });
    }
});

app.delete('/api/projects/:projectId', authenticateToken, (req, res) => {
    try {
        const filePath = path.join(PROJECTS_DIR, `${req.params.projectId}.json`);

        if (fs.existsSync(filePath)) {
            const project = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

            if (project.ownerId && project.ownerId !== req.user.id) {
                return res.status(403).json({ error: 'Forbidden: Only the owner can delete this project' });
            }

            fs.unlinkSync(filePath);
            return res.json({ status: 'deleted' });
        }
        res.status(404).json({ error: 'Project not found' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

// --- 4. REAL-TIME SIGNALING & COLLABORATION (Socket.io) ---
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    let currentRoom = null;

    socket.on('join-room', (roomId, userProfile) => {
        if (currentRoom) socket.leave(currentRoom);
        currentRoom = roomId;
        socket.join(roomId);
        socket.to(roomId).emit('user-connected', socket.id, userProfile);
    });

    // WebRTC Signaling
    socket.on('webrtc-offer', (targetId, offer) => {
        io.to(targetId).emit('webrtc-offer', socket.id, offer);
    });
    socket.on('webrtc-answer', (targetId, answer) => {
        io.to(targetId).emit('webrtc-answer', socket.id, answer);
    });
    socket.on('webrtc-ice-candidate', (targetId, candidate) => {
        io.to(targetId).emit('webrtc-ice-candidate', socket.id, candidate);
    });

    // DAW State & Actions
    socket.on('daw-action', (actionData) => {
        if (currentRoom) {
            socket.broadcast.to(currentRoom).emit('daw-action', actionData);
        }
    });

    // Presence (Avatars, Mouse cursors, active tracks)
    socket.on('presence-update', (presenceData) => {
        if (currentRoom) {
            socket.to(currentRoom).emit('presence-update', socket.id, presenceData);
        }
    });

    socket.on('disconnect', () => {
        if (currentRoom) {
            socket.to(currentRoom).emit('user-disconnected', socket.id);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Secured WebDAW Server running on port ${PORT}`);
});

app.post('/api/logs/frontend-error', (req, res) => {
    console.error('\n🚨 [FRONTEND ERROR REPORT] 🚨');
    console.error('Timestamp:', new Date().toISOString());
    console.error('Details:', JSON.stringify(req.body, null, 2));
    console.error('---------------------------\n');
    res.status(200).send({ status: 'logged' });
});