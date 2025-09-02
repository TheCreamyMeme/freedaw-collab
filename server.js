const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const app = express();

app.use(express.static('public'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (socket) => {
    console.log('Client connected');
    socket.on('message', (data) => {
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN && client !== socket) {
                client.send(data);
            }
        });
    });

    socket.on('close', () => {
        console.log('Client disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
