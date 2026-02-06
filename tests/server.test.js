const request = require('supertest');
const { app, server, cleanupInterval } = require('../server/index');
const rooms = require('../server/rooms');

afterAll(() => {
  clearInterval(cleanupInterval);
});

beforeEach(() => {
  rooms.rooms.clear();
});

describe('HTTP endpoints', () => {
  test('GET / returns 200 with HTML', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });

  test('GET /room/ABC123 returns 200 with chat HTML', async () => {
    const res = await request(app).get('/room/ABC123');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });

  test('GET /health returns 200 with status JSON', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.rooms).toBe('number');
    expect(typeof res.body.uptime).toBe('number');
  });

  test('GET /health returns correct room count', async () => {
    const ws1 = {};
    const ws2 = {};
    rooms.createRoom(ws1);
    rooms.createRoom(ws2);

    const res = await request(app).get('/health');
    expect(res.body.rooms).toBe(2);

    // Leave one room
    rooms.leaveRoom(ws1);

    const res2 = await request(app).get('/health');
    expect(res2.body.rooms).toBe(1);
  });
});
