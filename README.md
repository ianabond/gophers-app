# BunnyBurrow (`gophers-app`)

A real-time multiplayer 2D platformer inspired by *Transformice*, built with **TypeScript + React + Phaser.io (Matter.js)** on the frontend, **Go + Gin + WebSockets** on the backend, **PostgreSQL**, **Nginx**, and **Docker Compose**.

Instead of mice, cheese, and mouse holes, players control animated **bunnies** racing across meadows, icy ridges, mushroom caverns, and twilight hollows to grab the **Golden Carrot** and hop safely into the **Tree Stump Nest**!

> **Live Deployment:** `https://YOUR_DOMAIN_HERE` *(Update this URL once deployed to your public server with HTTPS.)*

---

## Running Locally

Prerequisites: Docker and Docker Compose (`docker compose`).

1. Clone the repository and enter the project directory:
   ```bash
   git clone <your-repo-url>
   cd gophers-app
   ```
2. Start all services:
   ```bash
   docker compose up --build
   ```
3. Open `http://localhost:8080/` in your browser.

All containers (`nginx`, `auth-server`, `app-server`, `db`) start automatically. PostgreSQL is kept strictly on the internal Docker network with no host ports exposed.

---

## Production Deployment (Nginx + HTTPS)

1. Point your domain's DNS `A` record to your server's public IP.
2. Create a `.env` file on the server (do not commit it):
   ```bash
   POSTGRES_PASSWORD=choose-a-strong-random-password
   ```
3. Replace `YOUR_DOMAIN` inside `nginx/nginx.prod.conf` with your actual domain name.
4. Obtain a TLS certificate with Certbot (e.g. `certbot certonly --standalone -d yourdomain.com` before starting Nginx, or using `/var/www/certbot` webroot).
5. Launch with the production Compose override so Nginx listens on ports `80` and `443`, redirects `http://` to `https://`, and serves `wss://` WebSockets:
   ```bash
   docker compose -f compose.yml -f compose.prod.yml up -d --build
   ```

---

## Architecture & Security

- **Reverse Proxy (`nginx/nginx.conf`)**:
  - Routes `/register`, `/login`, and `/logout` exclusively to `auth-server`. The `app-server` container never sees auth endpoints.
  - Routes `/ws` (with WebSocket `Upgrade` headers) and all other paths (`/`, `/api/me`, `/api/leaderboard`, static React + Phaser bundle) to `app-server`.
- **Auth Server (`auth-server/`, Go + Gin + `pgx/v5`)**:
  - Generates and persists a 2048-bit RSA keypair inside the `auth_keys` Docker volume (`internal/keys/keys.go`) so sessions survive container restarts.
  - Hashes passwords with `golang.org/x/crypto/bcrypt` and signs `RS256` JWTs (`golang-jwt/jwt/v5`) containing `exp` (24h expiration), stored in `HttpOnly`, `SameSite=Lax` cookies (`Secure` when behind HTTPS).
- **App Server (`app-server/`, Go + Gin + `gorilla/websocket`)**:
  - Fetches the RSA public key once at startup from `http://auth-server:3001/public-key` (`internal/auth/jwt.go`) and verifies all HTTP & WebSocket JWTs locally using `RS256` only (`jwt.WithValidMethods([]string{"RS256"})`, `jwt.WithIssuer("gophers-auth")`, `jwt.WithExpirationRequired()`).
  - Validates the JWT cookie during the WebSocket HTTP `upgrade` handshake before accepting any connection, rejecting unauthenticated, invalid, or expired tokens with `401 Unauthorized`.

---

## Objective 4 — Graphics and Interaction

This project targets the **Graphics and Interaction** category of Objective 4 by going far beyond drawing basic shapes on a canvas and integrating rich visual, physical, and spatial audio interaction directly into the Objective 3 real-time multiplayer loop:

1. **TypeScript + React + Phaser 3 (Matter.js) Engine (`frontend/src/game/GameScene.ts`)**:
   - Multi-sensor Matter.js bunny controller with compound foot and left/right wall sensors enabling **coyote time**, **jump buffering**, **wall-sliding**, **wall-jumping**, **low-friction ice sliding**, and **squash-and-stretch mushroom trampolines**.
   - **Authoritative Server Room & Crate Physics (`app-server/internal/game/room.go`)**: A race-free Go goroutine actor loop runs 30 Hz physics for Shaman-summoned heavy wooden crates (gravity, rotated-plank collisions, and bunny push impulses) while broadcasting 20 Hz world snapshots.
2. **Procedural Layered Sprites, Parallax Worlds & Particle Systems (`frontend/src/game/textures.ts`)**:
   - Multi-layer parallax backgrounds across 4 map themes (*Sunlit Meadow*, *Frosty Pine Ridge*, *Mushroom Cavern*, *Twilight Hollow*) with drifting ambient spores/pollen/snow particles.
   - Procedurally illustrated canvas textures for 8 customizable bunny fur colors, Golden Carrots, hollowed mossy Tree Stump Nests with lantern glow, spotted bouncy mushrooms, rune-carved planks, crates, and wind gusts.
   - Real-time animation states (running hop bounce, airborne squash/stretch, carried carrot in paws, golden Shaman crown & aura, floating emote bubbles) paired with dust, sparkle, and leaf particle emitters.
3. **Real-Time Forest Shaman Construction & Bunny-to-Bunny Interactions**:
   - Every round rotates a **Forest Shaman** who selects tools (`[1]` Plank, `[2]` Crate, `[3]` Bouncy Mushroom, `[4]` Wind Gust), rotates them (`Q`/`E` or mouse wheel), broadcasts live translucent **aiming ghost previews** over WebSockets, and summons objects directly into the shared world.
   - Players can press `F` to emit a **Hop-Boop** shockwave that playfully knocks nearby bunnies and crates with expanding ring visuals.
4. **2D Spatial Web Audio (`frontend/src/game/audio.ts`)**:
   - Procedural Web Audio synthesizer using `StereoPannerNode` and inverse-square distance attenuation relative to the local bunny's world coordinates. Players hear other bunnies' hops, boops, mushroom bounces, carrot pickups, Shaman casts, and stump nest chimes panned left/right and attenuated by distance in real time.
