class App {
  constructor() {
    this.ui = new UI();
    this.signaling = new SignalingClient();
    this.webrtc = new WebRTCManager(this.signaling);

    this.myPeerId = null;
    this.peers = [];
    this.activePeerId = null;

    this.init();
  }

  async init() {
    // Fetch local peer info
    try {
      const response = await fetch('/api/info');
      const info = await response.json();
      this.myPeerId = info.peerId;
      this.ui.setLocalPeerId(info.peerId);
    } catch (e) {
      console.error('Failed to get peer info:', e);
    }

    // Setup UI callbacks
    this.ui.onConnect = (peerId) => this.connectToPeer(peerId);
    this.ui.onSendMessage = (text) => this.sendMessage(text);

    // Setup signaling handlers
    this.signaling.on('peer-list', (msg) => {
      this.peers = msg.peers;
      this.updatePeerList();
    });

    // Setup WebRTC handlers
    this.webrtc.on('channel-open', ({ peerId }) => {
      this.activePeerId = peerId;
      this.ui.setConnectionStatus('connected', peerId);
      this.ui.addSystemMessage(`Connected to ${peerId}`);
      this.updatePeerList();
    });

    this.webrtc.on('channel-close', ({ peerId }) => {
      if (this.activePeerId === peerId) {
        this.activePeerId = null;
        this.ui.setConnectionStatus('disconnected');
        this.ui.addSystemMessage(`Disconnected from ${peerId}`);
      }
      this.updatePeerList();
    });

    this.webrtc.on('disconnected', ({ peerId }) => {
      if (this.activePeerId === peerId) {
        this.activePeerId = null;
        this.ui.setConnectionStatus('disconnected');
      }
      this.updatePeerList();
    });

    this.webrtc.on('message', ({ peerId, text, timestamp }) => {
      this.ui.addMessage(text, 'received', timestamp);
    });

    this.webrtc.on('error', ({ peerId, error }) => {
      this.ui.addSystemMessage(`Connection error with ${peerId}`);
      this.ui.setConnectionStatus('disconnected');
    });

    // Connect to signaling server
    this.signaling.connect();
  }

  connectToPeer(peerId) {
    this.ui.setConnectionStatus('connecting', peerId);
    this.webrtc.connect(peerId);
  }

  sendMessage(text) {
    if (this.activePeerId) {
      const sent = this.webrtc.sendMessage(this.activePeerId, text);
      if (sent) {
        this.ui.addMessage(text, 'sent');
      }
    }
  }

  updatePeerList() {
    const connectedPeers = this.webrtc.getConnectedPeers();
    this.ui.updatePeerList(this.peers, connectedPeers);
  }
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
