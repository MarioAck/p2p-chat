const RoomManager = require('../server/rooms');

// The module exports a singleton, so we clear rooms between tests
beforeEach(() => {
  RoomManager.rooms.clear();
});

describe('RoomManager', () => {
  describe('generateCode()', () => {
    test('returns a 6-character uppercase alphanumeric string', () => {
      const code = RoomManager.generateCode();
      expect(code).toMatch(/^[A-Z0-9]{6}$/);
    });
  });

  describe('createRoom()', () => {
    test('creates a room and sets host', () => {
      const mockWs = {};
      const code = RoomManager.createRoom(mockWs);

      expect(code).toMatch(/^[A-Z0-9]{6}$/);
      expect(RoomManager.rooms.has(code)).toBe(true);

      const room = RoomManager.getRoom(code);
      expect(room.host).toBe(mockWs);
      expect(room.guest).toBeNull();
      expect(mockWs.roomCode).toBe(code);
      expect(mockWs.isHost).toBe(true);
    });
  });

  describe('joinOrCreate()', () => {
    test('joins existing room as guest', () => {
      const host = {};
      const guest = {};
      const code = RoomManager.createRoom(host);

      const result = RoomManager.joinOrCreate(code, guest);

      expect(result.success).toBe(true);
      expect(result.isHost).toBe(false);
      expect(result.hasExistingPeer).toBe(true);
      expect(guest.roomCode).toBe(code);
      expect(guest.isHost).toBe(false);
    });

    test('creates room if it does not exist', () => {
      const ws = {};
      const result = RoomManager.joinOrCreate('NEWCODE', ws);

      expect(result.success).toBe(true);
      expect(result.isHost).toBe(true);
      expect(result.hasExistingPeer).toBe(false);
      expect(RoomManager.rooms.has('NEWCODE')).toBe(true);
    });

    test('rejects when room is full', () => {
      const host = {};
      const guest = {};
      const third = {};
      const code = RoomManager.createRoom(host);
      RoomManager.joinOrCreate(code, guest);

      const result = RoomManager.joinOrCreate(code, third);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Room is full');
    });
  });

  describe('leaveRoom()', () => {
    test('removes user and deletes room when empty', () => {
      const host = {};
      const code = RoomManager.createRoom(host);

      RoomManager.leaveRoom(host);

      expect(RoomManager.rooms.has(code)).toBe(false);
    });

    test('keeps room when one user remains', () => {
      const host = {};
      const guest = {};
      const code = RoomManager.createRoom(host);
      RoomManager.joinOrCreate(code, guest);

      RoomManager.leaveRoom(guest);

      expect(RoomManager.rooms.has(code)).toBe(true);
      const room = RoomManager.getRoom(code);
      expect(room.host).toBe(host);
      expect(room.guest).toBeNull();
    });
  });

  describe('getPeer()', () => {
    test('returns the other user in the room', () => {
      const host = {};
      const guest = {};
      const code = RoomManager.createRoom(host);
      RoomManager.joinOrCreate(code, guest);

      expect(RoomManager.getPeer(host)).toBe(guest);
      expect(RoomManager.getPeer(guest)).toBe(host);
    });
  });

  describe('cleanupStaleRooms()', () => {
    test('removes old rooms and keeps fresh ones', () => {
      const ws1 = {};
      const ws2 = {};
      const oldCode = RoomManager.createRoom(ws1);
      const freshCode = RoomManager.createRoom(ws2);

      // Make the first room stale
      RoomManager.getRoom(oldCode).createdAt = Date.now() - 7200000;

      RoomManager.cleanupStaleRooms();

      expect(RoomManager.rooms.has(oldCode)).toBe(false);
      expect(RoomManager.rooms.has(freshCode)).toBe(true);
    });
  });
});
