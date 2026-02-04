const WebSocket = require('ws');
const http = require('http');

class SignalingServer {
  constructor(discovery) {
    this.discovery = discovery;
    this.wss = null;
    this.browserClients = new Set();
    this.peerConnections = new Map(); // peerId -> WebSocket
  }

  attach(server) {
    this.wss = new WebSocket.Server({ server });

    this.wss.on('connection', (ws, req) => {
      const isFromPeer = req.headers['x-peer-id'];

      if (isFromPeer) {
        this.handlePeerConnection(ws, isFromPeer);
      } else {
        this.handleBrowserConnection(ws);
      }
    });

    // Listen for discovery events
    this.discovery.on('peer-joined', (peer) => {
      this.connectToPeer(peer);
      this.broadcastPeerList();
    });

    this.discovery.on('peer-left', (peer) => {
      this.peerConnections.delete(peer.peerId);
      this.broadcastPeerList();
    });

    console.log('Signaling server attached');
  }

  handleBrowserConnection(ws) {
    console.log('Browser connected');
    this.browserClients.add(ws);

    // Send current peer list
    ws.send(JSON.stringify({
      type: 'peer-list',
      peers: this.discovery.getPeers().map(p => ({
        peerId: p.peerId,
        address: p.address
      }))
    }));

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleBrowserMessage(ws, msg);
      } catch (e) {
        console.error('Invalid browser message:', e.message);
      }
    });

    ws.on('close', () => {
      this.browserClients.delete(ws);
      console.log('Browser disconnected');
    });
  }

  handleBrowserMessage(ws, msg) {
    // Messages from browser to relay to peer
    // Types: offer, answer, ice-candidate
    if (['offer', 'answer', 'ice-candidate'].includes(msg.type)) {
      const peerWs = this.peerConnections.get(msg.targetPeerId);
      if (peerWs && peerWs.readyState === WebSocket.OPEN) {
        peerWs.send(JSON.stringify({
          type: msg.type,
          data: msg.data,
          fromPeerId: this.discovery.peerId
        }));
      } else {
        console.log(`Cannot relay to peer ${msg.targetPeerId}: not connected`);
      }
    }
  }

  handlePeerConnection(ws, peerId) {
    console.log(`Peer server connected: ${peerId}`);
    this.peerConnections.set(peerId, ws);

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handlePeerMessage(ws, msg, peerId);
      } catch (e) {
        console.error('Invalid peer message:', e.message);
      }
    });

    ws.on('close', () => {
      this.peerConnections.delete(peerId);
      console.log(`Peer server disconnected: ${peerId}`);
    });
  }

  handlePeerMessage(ws, msg, fromPeerId) {
    // Relay signaling messages from peer servers to browser
    if (['offer', 'answer', 'ice-candidate'].includes(msg.type)) {
      this.broadcastToBrowsers({
        type: msg.type,
        data: msg.data,
        fromPeerId: fromPeerId
      });
    }
  }

  connectToPeer(peer) {
    if (this.peerConnections.has(peer.peerId)) return;

    try {
      const ws = new WebSocket(`ws://${peer.address}:${peer.httpPort}`, {
        headers: { 'x-peer-id': this.discovery.peerId }
      });

      ws.on('open', () => {
        console.log(`Connected to peer server: ${peer.peerId}`);
        this.peerConnections.set(peer.peerId, ws);
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handlePeerMessage(ws, msg, peer.peerId);
        } catch (e) {
          console.error('Invalid peer message:', e.message);
        }
      });

      ws.on('close', () => {
        this.peerConnections.delete(peer.peerId);
      });

      ws.on('error', (err) => {
        console.error(`Peer connection error (${peer.peerId}):`, err.message);
      });
    } catch (e) {
      console.error('Failed to connect to peer:', e.message);
    }
  }

  broadcastToBrowsers(msg) {
    const data = JSON.stringify(msg);
    for (const client of this.browserClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  broadcastPeerList() {
    this.broadcastToBrowsers({
      type: 'peer-list',
      peers: this.discovery.getPeers().map(p => ({
        peerId: p.peerId,
        address: p.address
      }))
    });
  }
}

module.exports = SignalingServer;
