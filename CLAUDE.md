# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

P2P Chat is a WebRTC-based peer-to-peer chat application. Users create/join rooms via 6-character codes, establish a direct WebRTC DataChannel connection through a signaling server, then communicate P2P without messages touching the server.

## Commands

```bash
npm install          # Install dependencies
npm start            # Start server on :3000 (or PORT env var)
npm run dev          # Same as npm start
docker-compose up    # Run via Docker
```

No test framework, linter, or build step is configured. The frontend is vanilla JS served as static files.

## Architecture

**Server** (`server/`): Node.js + Express + ws (WebSocket)
- `index.js` — HTTP server, static file serving, WebSocket signaling relay. Routes `/room/:code` to `chat.html`. Runs hourly stale room cleanup.
- `rooms.js` — `RoomManager` class. In-memory Map of rooms (max 2 users each: host + guest). Generates 6-char uppercase alphanumeric codes.

**Client** (`public/`): Vanilla JS with class-based modules, no bundler.
- `index.html` — Landing page. Create room (shows QR code modal) or join by code. Redirects to `/room/:code`.
- `chat.html` — Chat page. Loads four JS modules in order:
  1. `js/signaling.js` — `SignalingClient`: WebSocket wrapper with auto-reconnect (exponential backoff 1s→10s). Event emitter pattern.
  2. `js/webrtc.js` — `WebRTCManager`: RTCPeerConnection + DataChannel lifecycle. Uses Google STUN servers (no TURN). Host creates offer, guest answers.
  3. `js/ui.js` — `UI`: DOM manipulation, connection status indicator, message rendering with XSS escaping.
  4. `js/app.js` — `App`: Orchestrator wiring SignalingClient, WebRTCManager, and UI together. Extracts room code from URL path.

**Connection flow**: Both clients join room via signaling WS → host creates DataChannel + offer → exchange offer/answer/ICE candidates through server → DataChannel opens → all messages flow P2P.

**WebSocket message types**: `create-room`, `join-room`, `check-room`, `offer`, `answer`, `ice-candidate`, `peer-joined`, `peer-left`.

## Key Design Decisions

- Server is signaling-only; no message content is relayed or stored.
- STUN-only NAT traversal (no TURN fallback — connections may fail on restrictive NATs).
- Rooms are ephemeral (in-memory, cleaned up after 1 hour of inactivity).
- Client modules communicate via event emitter patterns and callback wiring in App.
