class UI {
  constructor() {
    this.elements = {
      myPeerId: document.getElementById('my-peer-id'),
      peerList: document.getElementById('peer-list'),
      connectionStatus: document.getElementById('connection-status'),
      messages: document.getElementById('messages'),
      messageForm: document.getElementById('message-form'),
      messageInput: document.getElementById('message-input'),
      sendBtn: document.getElementById('send-btn')
    };

    this.onConnect = null;
    this.onSendMessage = null;
    this.connectedPeerId = null;

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.elements.messageForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.elements.messageInput.value.trim();
      if (text && this.onSendMessage) {
        this.onSendMessage(text);
        this.elements.messageInput.value = '';
      }
    });
  }

  setLocalPeerId(peerId) {
    this.elements.myPeerId.textContent = peerId;
  }

  updatePeerList(peers, connectedPeers = []) {
    const list = this.elements.peerList;
    list.innerHTML = '';

    if (peers.length === 0) {
      list.innerHTML = '<li class="no-peers">Searching for peers...</li>';
      return;
    }

    peers.forEach(peer => {
      const li = document.createElement('li');
      const isConnected = connectedPeers.includes(peer.peerId);

      li.innerHTML = `
        <div class="peer-info">
          <span class="peer-id">${peer.peerId}</span>
          <span class="peer-address">${peer.address}</span>
        </div>
        <button class="connect-btn ${isConnected ? 'connected' : ''}"
                data-peer-id="${peer.peerId}"
                ${isConnected ? 'disabled' : ''}>
          ${isConnected ? 'Connected' : 'Connect'}
        </button>
      `;

      const btn = li.querySelector('.connect-btn');
      if (!isConnected) {
        btn.addEventListener('click', () => {
          if (this.onConnect) {
            this.onConnect(peer.peerId);
          }
        });
      }

      list.appendChild(li);
    });
  }

  setConnectionStatus(status, peerId = null) {
    const el = this.elements.connectionStatus;
    el.className = 'status ' + status;

    switch (status) {
      case 'disconnected':
        el.textContent = 'No peer connected';
        this.connectedPeerId = null;
        this.setInputEnabled(false);
        break;
      case 'connecting':
        el.textContent = `Connecting to ${peerId}...`;
        break;
      case 'connected':
        el.textContent = `Connected to ${peerId}`;
        this.connectedPeerId = peerId;
        this.setInputEnabled(true);
        break;
    }
  }

  setInputEnabled(enabled) {
    this.elements.messageInput.disabled = !enabled;
    this.elements.sendBtn.disabled = !enabled;

    if (enabled) {
      this.elements.messageInput.focus();
    }
  }

  addMessage(text, type, timestamp = Date.now()) {
    const div = document.createElement('div');
    div.className = `message ${type}`;

    const time = new Date(timestamp).toLocaleTimeString();
    div.innerHTML = `
      ${this.escapeHtml(text)}
      <span class="timestamp">${time}</span>
    `;

    this.elements.messages.appendChild(div);
    this.scrollToBottom();
  }

  addSystemMessage(text) {
    const div = document.createElement('div');
    div.className = 'system-message';
    div.textContent = text;
    this.elements.messages.appendChild(div);
    this.scrollToBottom();
  }

  scrollToBottom() {
    this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  clearMessages() {
    this.elements.messages.innerHTML = '';
  }
}

window.UI = UI;
