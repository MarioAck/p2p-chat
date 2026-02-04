class WebRTCManager {
  constructor(signaling) {
    this.signaling = signaling;
    this.connections = new Map(); // peerId -> { pc, dataChannel }
    this.handlers = {};

    this.rtcConfig = {
      iceServers: [] // Empty for local network - no STUN/TURN needed
    };

    this.setupSignalingHandlers();
  }

  setupSignalingHandlers() {
    this.signaling.on('offer', (msg) => this.handleOffer(msg));
    this.signaling.on('answer', (msg) => this.handleAnswer(msg));
    this.signaling.on('ice-candidate', (msg) => this.handleIceCandidate(msg));
  }

  async connect(peerId) {
    console.log(`Initiating connection to ${peerId}`);

    const pc = new RTCPeerConnection(this.rtcConfig);
    const connection = { pc, dataChannel: null, peerId };
    this.connections.set(peerId, connection);

    this.setupPeerConnection(pc, peerId);

    // Create data channel (initiator creates it)
    const dataChannel = pc.createDataChannel('chat', {
      ordered: true
    });
    connection.dataChannel = dataChannel;
    this.setupDataChannel(dataChannel, peerId);

    // Create and send offer
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.signaling.send('offer', offer, peerId);
    } catch (e) {
      console.error('Failed to create offer:', e);
      this.emit('error', { peerId, error: e });
    }
  }

  setupPeerConnection(pc, peerId) {
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.send('ice-candidate', event.candidate, peerId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE state (${peerId}):`, pc.iceConnectionState);

      if (pc.iceConnectionState === 'connected') {
        this.emit('connected', { peerId });
      } else if (pc.iceConnectionState === 'disconnected' ||
                 pc.iceConnectionState === 'failed') {
        this.emit('disconnected', { peerId });
        this.cleanup(peerId);
      }
    };

    pc.ondatachannel = (event) => {
      console.log(`Data channel received from ${peerId}`);
      const connection = this.connections.get(peerId);
      if (connection) {
        connection.dataChannel = event.channel;
        this.setupDataChannel(event.channel, peerId);
      }
    };
  }

  setupDataChannel(dc, peerId) {
    dc.onopen = () => {
      console.log(`Data channel open with ${peerId}`);
      this.emit('channel-open', { peerId });
    };

    dc.onclose = () => {
      console.log(`Data channel closed with ${peerId}`);
      this.emit('channel-close', { peerId });
    };

    dc.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.emit('message', { peerId, ...msg });
      } catch (e) {
        // Plain text message
        this.emit('message', { peerId, text: event.data });
      }
    };

    dc.onerror = (error) => {
      console.error(`Data channel error (${peerId}):`, error);
    };
  }

  async handleOffer(msg) {
    const { fromPeerId, data: offer } = msg;
    console.log(`Received offer from ${fromPeerId}`);

    const pc = new RTCPeerConnection(this.rtcConfig);
    const connection = { pc, dataChannel: null, peerId: fromPeerId };
    this.connections.set(fromPeerId, connection);

    this.setupPeerConnection(pc, fromPeerId);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.signaling.send('answer', answer, fromPeerId);
    } catch (e) {
      console.error('Failed to handle offer:', e);
      this.emit('error', { peerId: fromPeerId, error: e });
    }
  }

  async handleAnswer(msg) {
    const { fromPeerId, data: answer } = msg;
    console.log(`Received answer from ${fromPeerId}`);

    const connection = this.connections.get(fromPeerId);
    if (connection) {
      try {
        await connection.pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (e) {
        console.error('Failed to handle answer:', e);
      }
    }
  }

  async handleIceCandidate(msg) {
    const { fromPeerId, data: candidate } = msg;

    const connection = this.connections.get(fromPeerId);
    if (connection) {
      try {
        await connection.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Failed to add ICE candidate:', e);
      }
    }
  }

  sendMessage(peerId, text) {
    const connection = this.connections.get(peerId);
    if (connection && connection.dataChannel &&
        connection.dataChannel.readyState === 'open') {
      connection.dataChannel.send(JSON.stringify({
        text,
        timestamp: Date.now()
      }));
      return true;
    }
    return false;
  }

  isConnected(peerId) {
    const connection = this.connections.get(peerId);
    return connection &&
           connection.dataChannel &&
           connection.dataChannel.readyState === 'open';
  }

  getConnectedPeers() {
    const connected = [];
    for (const [peerId, conn] of this.connections) {
      if (conn.dataChannel && conn.dataChannel.readyState === 'open') {
        connected.push(peerId);
      }
    }
    return connected;
  }

  cleanup(peerId) {
    const connection = this.connections.get(peerId);
    if (connection) {
      if (connection.dataChannel) {
        connection.dataChannel.close();
      }
      connection.pc.close();
      this.connections.delete(peerId);
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
