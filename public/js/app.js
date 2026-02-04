class App {
  constructor() {
    this.ui = new UI();
    this.signaling = new SignalingClient();
    this.webrtc = new WebRTCManager(this.signaling);

    this.roomCode = null;
    this.isHost = false;

    this.init();
  }

  init() {
    // Get room code from URL
    const pathParts = window.location.pathname.split('/');
    const roomIndex = pathParts.indexOf('room');
    if (roomIndex !== -1 && pathParts[roomIndex + 1]) {
      this.roomCode = pathParts[roomIndex + 1].toUpperCase();
      this.ui.setRoomCode(this.roomCode);
    } else {
      // No room code, redirect to home
      window.location.href = '/';
      return;
    }

    // Setup UI callbacks
    this.ui.onSendMessage = (text) => this.sendMessage(text);

    // Setup signaling handlers
    this.signaling.on('connected', () => {
      console.log('Connected to signaling server');
      // Join the room
      this.signaling.send('join-room', { code: this.roomCode });
    });

    this.signaling.on('room-joined', ({ code }) => {
      console.log('Joined room as guest:', code);
      this.isHost = false;
      this.webrtc.setHost(false);
      this.ui.setConnectionStatus('connecting');
      this.ui.addSystemMessage('Joined room. Waiting for connection...');
    });

    this.signaling.on('error', ({ error }) => {
      console.error('Room error:', error);
      if (error === 'Room not found') {
        this.ui.addSystemMessage('Room not found. It may have expired.');
        this.ui.setConnectionStatus('disconnected');
      } else if (error === 'Room is full') {
        this.ui.addSystemMessage('Room is full. Only 2 people can join.');
        this.ui.setConnectionStatus('disconnected');
      } else {
        this.ui.addSystemMessage('Error: ' + error);
      }
    });

    this.signaling.on('peer-joined', () => {
      // This means we are the host and someone joined
      this.isHost = true;
      this.webrtc.setHost(true);
      this.ui.setConnectionStatus('connecting');
      this.ui.addSystemMessage('Peer joined! Establishing connection...');
    });

    this.signaling.on('peer-left', () => {
      this.ui.setConnectionStatus('disconnected');
      this.ui.addSystemMessage('Peer disconnected.');
    });

    // Setup WebRTC handlers
    this.webrtc.on('channel-open', () => {
      this.ui.setConnectionStatus('connected');
      this.ui.addSystemMessage('P2P connection established! You can now chat securely.');
    });

    this.webrtc.on('channel-close', () => {
      this.ui.setConnectionStatus('disconnected');
      this.ui.addSystemMessage('Connection closed.');
    });

    this.webrtc.on('disconnected', () => {
      this.ui.setConnectionStatus('disconnected');
    });

    this.webrtc.on('message', ({ text, timestamp }) => {
      this.ui.addMessage(text, 'received', timestamp);
    });

    this.webrtc.on('error', ({ error }) => {
      this.ui.addSystemMessage('Connection error: ' + error.message);
      this.ui.setConnectionStatus('disconnected');
    });

    // Connect to signaling server
    this.signaling.connect();
  }

  sendMessage(text) {
    const sent = this.webrtc.sendMessage(text);
    if (sent) {
      this.ui.addMessage(text, 'sent');
    }
  }
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
