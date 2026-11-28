# Bunny Burrow Game

## Objective 1 – Deployment

**Live deployment:** https://bunnyburrowgame.fun

### Running locally
`docker compose up --build`
Then open `http://localhost:8080`

### Deployment (server only)
- `compose.prod.yml` and `nginx/nginx.prod.conf` are used on the deployed server.
- Requires a Let's Encrypt certificate in `/etc/letsencrypt` (via Certbot) and a `.env` file with `POSTGRES_PASSWORD`.
- Start with: `docker compose -f compose.prod.yml up -d --build`

---

## Objective 3 – WebSockets (Real-Time Multiplayer)

### Overview
Bunny Burrow is a real-time multiplayer 2D platformer powered by **Go WebSockets** (`github.com/gorilla/websocket`) and **Phaser 3**. Multiple players share the same room simultaneously and see each other's movement, jumping, shaman object placements, boops, and collisions live as they happen.

> **Authentication Note:** All players currently join as **guests** (choosing a bunny name and fur color). **Authenticated WebSocket connections** (requiring login and verifying a JWT during the WebSocket handshake so only authenticated players can join) will be implemented alongside **Objective 2**.

### Multiplayer Architecture & Features
- **Shared Space & Auto-Scaling Rooms:** Each room supports up to **8 players**. When a room fills up, a new room is automatically created for incoming players. The top HUD displays the player's current room and occupancy (e.g., `Room 1 (3/8)`).
- **20-Second Waiting Phase:** Whenever a room has players (`> 0` users), a 20-second waiting phase runs before Round 1 and between each round so players can gather and start together. If only 1 player is present when the 20 seconds end, the round starts anyway and any late joiner (`< 8` players) enters the same room.
- **Goroutine-Driven Room Loop:** Every active room runs its own dedicated Go goroutine (`app/rooms/room.go`) that processes joins, leaves, player state updates, collisions, item spawns/deletions, and 25 Hz world snapshots without blocking other rooms, shutting down cleanly when empty.
- **Real-Time Player Interactions:**
  - **Player Collisions:** Bunnies physically collide with each other in the shared world, with server-resolved collision bumps and Matter.js contact response.
  - **Hop-Boop (`F`):** Players can boop nearby bunnies to knock them back in real time.
  - **Per-Round Item Kit:** Every player gets **1 of each item** (`Plank`, `Crate`, `Mushroom`, `Wind Gust`, and `Deleter`) per round, synchronized live across all players in the room.
- **Continuous Random Map Rotation:** Each round randomly selects one of four themed maps (`Sunlit Meadow`, `Frosty Pine Ridge`, `Mushroom Cavern`, `Twilight Hollow`) and keeps starting new rounds indefinitely as long as at least one player remains in the room.
- **`ws://` and `wss://` Support:** The frontend automatically selects `ws:` over local HTTP (`http://localhost:8080`) and `wss:` over production HTTPS (`https://bunnyburrowgame.fun`), with WebSocket upgrade proxying configured in both `nginx/nginx.conf` and `nginx/nginx.prod.conf`.

### Folder Structure
- **Go Backend (`app/`)**
  - `app/main.go` — HTTP routes, `/ws` endpoint, and static file server.
  - `app/network/` — WebSocket connection upgrade, `readPump`/`writePump`, and JSON protocol (`client.go`, `messages.go`).
  - `app/rooms/` — 8-player room manager and per-room game loop goroutine (`manager.go`, `room.go`).
  - `app/game/` — Shared game types, map definitions/random picker, and player collision/boop math (`types.go`, `maps.go`, `collision.go`).
- **Frontend (`app/frontend/src/`)**
  - `app/frontend/src/network/socket.ts` — `ws`/`wss` WebSocket client.
  - `app/frontend/src/game/` — Phaser `GameScene.ts`, spatial audio (`audio.ts`), and textures (`textures.ts`).
  - `app/frontend/src/components/` — React UI components (`PhaserCanvas.tsx`, `ShamanBar.tsx`).
  - `app/frontend/src/types/game.ts` — Shared TypeScript protocol and map types.

---

## Objective 4 – Graphics and Interaction

### Features
- **Player Customization:** Players can enter a bunny name and choose their fur color.
- **Physics-Based Movement:** Matter.js handles movement, jumping, wall-jumping, gravity, and collisions.
- **Multiple Maps:** Four themed environments with different layouts and difficulty levels: Sunlit Meadow, Frosty Pine Ridge, Mushroom Cavern, and Twilight Hollow.
- **Carrot Collection:** Players must collect a golden carrot and bring it back to the stump nest to finish a round (any player with the carrot can enter the stump immediately).
- **Per-Round Items:** Every player gets 1 Plank, 1 Crate, 1 Mushroom, 1 Wind Gust, and 1 Deleter each round to place, rotate, or delete objects on the map.
- **Round System:** Rounds end when the timer expires or everyone reaches the burrow. A new random map is selected each round after a 20-second waiting lobby.
- **Visual and Audio Effects:** Includes themed parallax environments, animations, particle effects, interaction feedback, and spatial audio.

### Controls
| Key | Action |
|---|---|
| `A` / `D` (or Arrow keys) | Move |
| `W` / `Space` | Jump & Wall-Jump |
| `F` | Boop nearby bunnies |
| `1`–`5` | Select item |
| `Q` / `E` (or Mouse Wheel) | Rotate selected item |
| Mouse click | Use selected item (place / delete) |
