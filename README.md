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
- **Goroutine-Driven Room Loop:** Every active room runs its own dedicated Go goroutine (`app/rooms/room.go`) that processes joins, leaves, player state updates, collisions, shaman builds, and 25 Hz world snapshots without blocking other rooms, shutting down cleanly when empty.
- **Real-Time Player Interactions:**
  - **Player Collisions:** Bunnies physically collide with each other in the shared world, with server-resolved collision bumps and Matter.js contact response.
  - **Hop-Boop (`F`):** Players can boop nearby bunnies to knock them back in real time.
  - **Live Shaman Building:** The room's Shaman places, rotates, and removes planks, crates, bouncy mushrooms, and wind gusts while all players see the Shaman's live cursor preview and summoned objects immediately.
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
- **Carrot Collection:** Players must collect a golden carrot and bring it back to the stump nest to finish a round.
- **Shaman Mechanics:** The designated Shaman can place, rotate, and delete objects to help (or challenge) other players navigate the map.
- **Round System:** Rounds end when the timer expires or everyone reaches the burrow. A new random map is selected each round, and the first player to finish becomes the next Shaman (or a random player if nobody finishes).
- **Visual and Audio Effects:** Includes themed parallax environments, animations, particle effects, interaction feedback, and spatial audio.

### Controls
| Key | Action |
|---|---|
| `A` / `D` (or Arrow keys) | Move |
| `W` / `Space` | Jump & Wall-Jump |
| `F` | Boop nearby bunnies |
| `1`–`5` | Select Shaman tool |
| `Q` / `E` (or Mouse Wheel) | Rotate selected Shaman tool |
| Mouse click | Place / remove Shaman objects |
