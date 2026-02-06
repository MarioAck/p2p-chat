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

    this.signaling.on('room-joined', (msg) => {
      console.log('room-joined message:', msg);
      const code = msg.code || (msg.data && msg.data.code);
      const isHost = msg.isHost !== undefined ? msg.isHost : (msg.data && msg.data.isHost);
      console.log('Joined room:', code, 'as', isHost ? 'host' : 'guest');
      this.isHost = isHost;
      this.webrtc.setHost(isHost);
      if (isHost) {
        this.ui.setConnectionStatus('waiting');
        this.ui.addSystemMessage('Waiting for peer to join...');
        this.loadSavedMessages();
      } else {
        this.ui.setConnectionStatus('connecting');
        this.ui.addSystemMessage('Joined room. Waiting for connection...');
      }
    });

    this.signaling.on('error', (msg) => {
      const error = msg.error || (msg.data && msg.data.error);
      console.error('Room error:', error, 'full msg:', msg);
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
      // Someone joined the room, initiate WebRTC connection
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
      this.sendHistory();
    });

    this.webrtc.on('channel-close', () => {
      this.ui.setConnectionStatus('disconnected');
      this.ui.addSystemMessage('Connection closed.');
    });

    this.webrtc.on('disconnected', () => {
      this.ui.setConnectionStatus('disconnected');
    });

    this.webrtc.on('message', (msg) => {
      if (msg.type === 'history') {
        this.ui.addSystemMessage('Loaded previous chat history.');
        this.ui.loadMessages(msg.messages.map(m => ({
          text: m.text,
          type: m.type === 'sent' ? 'received' : 'sent',
          timestamp: m.timestamp
        })));
        return;
      }
      this.ui.addMessage(msg.text, 'received', msg.timestamp);
      this.saveMessage(msg.text, 'received', msg.timestamp);
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
      const timestamp = Date.now();
      this.ui.addMessage(text, 'sent', timestamp);
      this.saveMessage(text, 'sent', timestamp);
    }
  }

  sendHistory() {
    if (!this.isHost) return;
    const key = `chat_${this.roomCode}`;
    const messages = JSON.parse(localStorage.getItem(key) || '[]');
    if (messages.length === 0) return;
    this.webrtc.dataChannel.send(JSON.stringify({
      type: 'history',
      messages: messages
    }));
  }

  saveMessage(text, type, timestamp) {
    if (!this.isHost) return;
    const key = `chat_${this.roomCode}`;
    const messages = JSON.parse(localStorage.getItem(key) || '[]');
    messages.push({ text, type, timestamp });
    localStorage.setItem(key, JSON.stringify(messages));
  }

  loadSavedMessages() {
    if (!this.isHost) return;
    const key = `chat_${this.roomCode}`;
    const messages = JSON.parse(localStorage.getItem(key) || '[]');
    if (messages.length > 0) {
      this.ui.addSystemMessage('Loaded previous chat history.');
      this.ui.loadMessages(messages);
    }
  }
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
