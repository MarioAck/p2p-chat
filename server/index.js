const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const Discovery = require('./discovery');
const SignalingServer = require('./signaling');

const PORT = process.env.PORT || 3000;
const PEER_ID = crypto.randomBytes(4).toString('hex');

console.log(`Starting P2P Chat Server`);
console.log(`Peer ID: ${PEER_ID}`);

// Express app for static files
const app = express();
app.use(express.static(path.join(__dirname, '../public')));

// Endpoint to get local peer info
app.get('/api/info', (req, res) => {
  res.json({
    peerId: PEER_ID,
    localIPs: discovery.getLocalIPs()
  });
});

// HTTP server
const server = http.createServer(app);

// Initialize discovery
const discovery = new Discovery(PEER_ID, PORT);

// Initialize signaling
const signaling = new SignalingServer(discovery);
signaling.attach(server);

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTP/WebSocket server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
  console.log('');
  console.log('Local IPs:', discovery.getLocalIPs().join(', '));
  console.log('');

  // Start discovery after server is ready
  discovery.start();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  discovery.stop();
  server.close();
  process.exit(0);
});
