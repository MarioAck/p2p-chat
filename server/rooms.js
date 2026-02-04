// Room management for WebRTC signaling

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  generateCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  createRoom(hostWs) {
    let code;
    do {
      code = this.generateCode();
    } while (this.rooms.has(code));

    const room = {
      code,
      host: hostWs,
      guest: null,
      createdAt: Date.now()
    };

    this.rooms.set(code, room);
    hostWs.roomCode = code;
    hostWs.isHost = true;

    return code;
  }

  joinRoom(code, guestWs) {
    const room = this.rooms.get(code);

    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    if (room.guest) {
      return { success: false, error: 'Room is full' };
    }

    room.guest = guestWs;
    guestWs.roomCode = code;
    guestWs.isHost = false;

    return { success: true, room };
  }

  getRoom(code) {
    return this.rooms.get(code);
  }

  getPeer(ws) {
    const room = this.rooms.get(ws.roomCode);
    if (!room) return null;

    return ws.isHost ? room.guest : room.host;
  }

  leaveRoom(ws) {
    const code = ws.roomCode;
    if (!code) return null;

    const room = this.rooms.get(code);
    if (!room) return null;

    const peer = this.getPeer(ws);

    if (ws.isHost) {
      // Host left - destroy room
      this.rooms.delete(code);
    } else {
      // Guest left - room stays, waiting for new guest
      room.guest = null;
    }

    return peer;
  }

  roomExists(code) {
    return this.rooms.has(code);
  }

  cleanupStaleRooms(maxAge = 3600000) {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (now - room.createdAt > maxAge) {
        this.rooms.delete(code);
      }
    }
  }
}

module.exports = new RoomManager();
