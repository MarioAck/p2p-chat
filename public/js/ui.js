class UI {
  constructor() {
    this.elements = {
      roomCode: document.getElementById('room-code'),
      connectionStatus: document.getElementById('connection-status'),
      messages: document.getElementById('messages'),
      messageForm: document.getElementById('message-form'),
      messageInput: document.getElementById('message-input'),
      sendBtn: document.getElementById('send-btn')
    };

    this.onSendMessage = null;

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

  setRoomCode(code) {
    if (this.elements.roomCode) {
      this.elements.roomCode.textContent = code;
    }
  }

  setConnectionStatus(status, extra = '') {
    const el = this.elements.connectionStatus;
    el.className = 'status ' + status;

    switch (status) {
      case 'disconnected':
        el.textContent = 'Peer disconnected';
        this.setInputEnabled(false);
        break;
      case 'connecting':
        el.textContent = 'Connecting...';
        break;
      case 'waiting':
        el.textContent = 'Waiting for peer to join...';
        break;
      case 'connected':
        el.textContent = 'Connected - P2P Active';
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
