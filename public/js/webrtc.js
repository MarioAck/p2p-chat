class WebRTCManager {
  constructor(signaling) {
    this.signaling = signaling;
    this.pc = null;
    this.dataChannel = null;
    this.handlers = {};
    this.isHost = false;

    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    this.setupSignalingHandlers();
  }

  setupSignalingHandlers() {
    this.signaling.on('offer', (msg) => this.handleOffer(msg));
    this.signaling.on('answer', (msg) => this.handleAnswer(msg));
    this.signaling.on('ice-candidate', (msg) => this.handleIceCandidate(msg));
    this.signaling.on('peer-joined', () => this.onPeerJoined());
    this.signaling.on('peer-left', () => this.onPeerLeft());
  }

  setHost(isHost) {
    this.isHost = isHost;
  }

  onPeerJoined() {
    // Host initiates connection when guest joins
    if (this.isHost) {
      console.log('Peer joined, initiating WebRTC connection');
      this.emit('peer-joined');
      this.createConnection(true);
    }
  }

  onPeerLeft() {
    console.log('Peer left');
    this.emit('peer-left');
    this.cleanup();
  }

  createConnection(isInitiator) {
    if (this.pc) {
      this.cleanup();
    }

    console.log('Creating peer connection, initiator:', isInitiator);
    this.pc = new RTCPeerConnection(this.rtcConfig);
    this.setupPeerConnection();

    if (isInitiator) {
      // Create data channel (initiator creates it)
      this.dataChannel = this.pc.createDataChannel('chat', {
        ordered: true
      });
      this.setupDataChannel(this.dataChannel);
      this.createOffer();
    }
  }

  setupPeerConnection() {
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.send('ice-candidate', { candidate: event.candidate });
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      console.log('ICE state:', this.pc.iceConnectionState);

      if (this.pc.iceConnectionState === 'connected') {
        this.emit('connected');
      } else if (this.pc.iceConnectionState === 'disconnected' ||
                 this.pc.iceConnectionState === 'failed') {
        this.emit('disconnected');
      }
    };

    this.pc.ondatachannel = (event) => {
      console.log('Data channel received');
      this.dataChannel = event.channel;
      this.setupDataChannel(event.channel);
    };
  }

  setupDataChannel(dc) {
    dc.onopen = () => {
      console.log('Data channel open');
      this.emit('channel-open');
    };

    dc.onclose = () => {
      console.log('Data channel closed');
      this.emit('channel-close');
    };

    dc.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.emit('message', msg);
      } catch (e) {
        // Plain text message
        this.emit('message', { text: event.data });
      }
    };

    dc.onerror = (error) => {
      console.error('Data channel error:', error);
    };
  }

  async createOffer() {
    try {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      this.signaling.send('offer', { sdp: offer });
    } catch (e) {
      console.error('Failed to create offer:', e);
      this.emit('error', { error: e });
    }
  }

  async handleOffer(msg) {
    // Support both { sdp } and { data: { sdp } } formats
    const sdp = msg.sdp || (msg.data && msg.data.sdp);
    console.log('Received offer', sdp ? 'valid' : 'invalid');

    if (!sdp) {
      console.error('No SDP in offer message:', msg);
      return;
    }

    // Guest creates connection when receiving offer
    this.createConnection(false);

    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      this.signaling.send('answer', { sdp: answer });
    } catch (e) {
      console.error('Failed to handle offer:', e);
      this.emit('error', { error: e });
    }
  }

  async handleAnswer(msg) {
    // Support both { sdp } and { data: { sdp } } formats
    const sdp = msg.sdp || (msg.data && msg.data.sdp);
    console.log('Received answer', sdp ? 'valid' : 'invalid');

    if (this.pc && sdp) {
      try {
        await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch (e) {
        console.error('Failed to handle answer:', e);
      }
    }
  }

  async handleIceCandidate(msg) {
    // Support both { candidate } and { data: { candidate } } formats
    const candidate = msg.candidate || (msg.data && msg.data.candidate);

    if (this.pc && candidate) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Failed to add ICE candidate:', e);
      }
    }
  }

  sendMessage(text) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({
        text,
        timestamp: Date.now()
      }));
      return true;
    }
    return false;
  }

  isConnected() {
    return this.dataChannel && this.dataChannel.readyState === 'open';
  }

  cleanup() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
  }

  on(event, handler) {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event].push(handler);
  }

  emit(event, data) {
    if (this.handlers[event]) {
      this.handlers[event].forEach(handler => handler(data));
    }
  }
}

window.WebRTCManager = WebRTCManager;
