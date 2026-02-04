const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const rooms = require('./rooms');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Room route - serves chat page
app.get('/room/:code', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/chat.html'));
});

// Cleanup stale rooms every hour
setInterval(() => rooms.cleanupStaleRooms(), 3600000);

// WebSocket handling
wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleMessage(ws, message);
    } catch (err) {
      console.error('Invalid message:', err);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    const peer = rooms.leaveRoom(ws);

    if (peer && peer.readyState === WebSocket.OPEN) {
      peer.send(JSON.stringify({ type: 'peer-left' }));
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

function handleMessage(ws, message) {
  const { type } = message;

  switch (type) {
    case 'create-room': {
      const code = rooms.createRoom(ws);
      ws.send(JSON.stringify({ type: 'room-created', code }));
      console.log(`Room created: ${code}`);
      break;
    }

    case 'join-room': {
      const { code } = message;
      const result = rooms.joinRoom(code.toUpperCase(), ws);

      if (result.success) {
        ws.send(JSON.stringify({ type: 'room-joined', code: code.toUpperCase() }));

        // Notify host that guest joined
        const host = result.room.host;
        if (host && host.readyState === WebSocket.OPEN) {
          host.send(JSON.stringify({ type: 'peer-joined' }));
        }
        console.log(`Guest joined room: ${code}`);
      } else {
        ws.send(JSON.stringify({ type: 'error', error: result.error }));
      }
      break;
    }

    case 'check-room': {
      const { code } = message;
      const exists = rooms.roomExists(code.toUpperCase());
      const room = rooms.getRoom(code.toUpperCase());
      const isFull = room && room.guest !== null;
      ws.send(JSON.stringify({ type: 'room-status', exists, isFull }));
      break;
    }

    // WebRTC signaling - relay to peer
    case 'offer':
    case 'answer':
    case 'ice-candidate': {
      const peer = rooms.getPeer(ws);
      if (peer && peer.readyState === WebSocket.OPEN) {
        peer.send(JSON.stringify(message));
      }
      break;
    }

    default:
      console.log('Unknown message type:', type);
  }
}

server.listen(PORT, () => {
  console.log(`P2P Chat server running on http://localhost:${PORT}`);
});
