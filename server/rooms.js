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

  // Join existing room or create if it doesn't exist (for chat page reconnects)
  joinOrCreate(code, ws) {
    let room = this.rooms.get(code);

    if (!room) {
      // Room doesn't exist, create it with this user as host
      room = {
        code,
        host: ws,
        guest: null,
        createdAt: Date.now()
      };
      this.rooms.set(code, room);
      ws.roomCode = code;
      ws.isHost = true;
      return { success: true, room, isHost: true, hasExistingPeer: false };
    }

    // Room exists - check if we can join
    if (room.host && room.guest) {
      return { success: false, error: 'Room is full' };
    }

    // If no host (host disconnected), become host
    if (!room.host) {
      room.host = ws;
      ws.roomCode = code;
      ws.isHost = true;
      const hasExistingPeer = room.guest !== null;
      return { success: true, room, isHost: true, hasExistingPeer };
    }

    // Join as guest
    room.guest = ws;
    ws.roomCode = code;
    ws.isHost = false;
    return { success: true, room, isHost: false, hasExistingPeer: true };
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
      room.host = null;
      // If guest is also gone, delete room
      if (!room.guest) {
        this.rooms.delete(code);
      }
    } else {
      room.guest = null;
      // If host is also gone, delete room
      if (!room.host) {
        this.rooms.delete(code);
      }
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
