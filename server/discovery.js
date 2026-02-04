const dgram = require('dgram');
const os = require('os');
const { EventEmitter } = require('events');

const DISCOVERY_PORT = 41234;
const BROADCAST_INTERVAL = 3000;
const PEER_TIMEOUT = 10000;

class Discovery extends EventEmitter {
  constructor(peerId, httpPort) {
    super();
    this.peerId = peerId;
    this.httpPort = httpPort;
    this.peers = new Map();
    this.socket = null;
    this.broadcastInterval = null;
    this.cleanupInterval = null;
  }

  getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }
    return ips;
  }

  getBroadcastAddresses() {
    const interfaces = os.networkInterfaces();
    const broadcasts = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal && iface.netmask) {
          const ip = iface.address.split('.').map(Number);
          const mask = iface.netmask.split('.').map(Number);
          const broadcast = ip.map((octet, i) => octet | (~mask[i] & 255)).join('.');
          broadcasts.push(broadcast);
        }
      }
    }
    return broadcasts.length > 0 ? broadcasts : ['255.255.255.255'];
  }

  start() {
    this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    this.socket.on('error', (err) => {
      console.error('Discovery socket error:', err.message);
    });

    this.socket.on('message', (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.peerId && data.peerId !== this.peerId) {
          this.handlePeerMessage(data, rinfo.address);
        }
      } catch (e) {
        // Ignore malformed messages
      }
    });

    this.socket.bind(DISCOVERY_PORT, () => {
      this.socket.setBroadcast(true);
      console.log(`Discovery listening on UDP port ${DISCOVERY_PORT}`);
      this.startBroadcasting();
      this.startCleanup();
    });
  }

  handlePeerMessage(data, address) {
    const { peerId, httpPort, timestamp } = data;
    const existing = this.peers.get(peerId);

    const peerInfo = {
      peerId,
      address,
      httpPort,
      lastSeen: Date.now(),
      timestamp
    };

    this.peers.set(peerId, peerInfo);

    if (!existing) {
      console.log(`Peer discovered: ${peerId} at ${address}:${httpPort}`);
      this.emit('peer-joined', peerInfo);
    }
  }

  startBroadcasting() {
    const broadcast = () => {
      const message = JSON.stringify({
        peerId: this.peerId,
        httpPort: this.httpPort,
        timestamp: Date.now()
      });

      const buffer = Buffer.from(message);
      const broadcasts = this.getBroadcastAddresses();

      for (const addr of broadcasts) {
        this.socket.send(buffer, 0, buffer.length, DISCOVERY_PORT, addr, (err) => {
          if (err && err.code !== 'ENOENT') {
            // Silently ignore common broadcast errors
          }
        });
      }
    };

    broadcast();
    this.broadcastInterval = setInterval(broadcast, BROADCAST_INTERVAL);
  }

  startCleanup() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [peerId, peer] of this.peers) {
        if (now - peer.lastSeen > PEER_TIMEOUT) {
          console.log(`Peer timeout: ${peerId}`);
          this.peers.delete(peerId);
          this.emit('peer-left', peer);
        }
      }
    }, PEER_TIMEOUT / 2);
  }

  getPeers() {
    return Array.from(this.peers.values());
  }

  stop() {
    if (this.broadcastInterval) clearInterval(this.broadcastInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this.socket) this.socket.close();
  }
}

module.exports = Discovery;
