// User registration endpoint
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const app = express();
const httpServer = http.createServer(app);
const wss = new WebSocket.Server({ server: httpServer });

app.use(express.json());
app.use(express.static('public'));

// In-memory user storage
const users = {};

// Registration endpoint
app.post('/register', (req, res) => {
  const { username } = req.body;
  
  // Simple validation
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Invalid username' });
  }
  
  // Check if username exists
  if (users[username]) {
    return res.status(400).json({ error: 'Username already taken' });
  }
  
  // Create new user
  users[username] = {
    id: Date.now(),
    connected: false
  };
  
  return res.json({ success: true, userId: users[username].id });
});

// WebSocket connection handling
wss.on('connection', (socket) => {
  const username = socket.handshake.query.username;
  
  // Check if user exists
  if (!users[username]) {
    return socket.emit('error', 'User not found');
  }
  
  // Mark user as connected
  users[username].connected = true;
  
  // Broadcast to other users
  io.to(username).emit('user_connected', { username });
  
  // Handle messages
  socket.on('message', (msg) => {
    io.to(username).emit('message', msg);
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    users[username].connected = false;
    io.to(username).emit('user_disconnected', { username });
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
