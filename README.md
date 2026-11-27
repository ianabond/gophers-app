# Bunny Burrow Game

## Objective 1 – Deployment

**Live deployment:** https://bunnyburrowgame.fun

### Running locally
docker compose up --build
Then open http://localhost:8080

### Deployment (server only)
- `compose.prod.yml` and `nginx/nginx.prod.conf` are used on the deployed server.
- Requires a Let's Encrypt certificate in /etc/letsencrypt (via Certbot) and a `.env` file with POSTGRES_PASSWORD.
- Start with: docker compose -f compose.prod.yml up -d --build


## Objective 4 – Graphics and Interaction

### Overview

Bunny Burrow uses **Phaser 3**, integrated with React and TypeScript, to provide an interactive 2D platforming game. Players control customizable bunnies, collect carrots, navigate obstacles, and work toward reaching the burrow.

### Features

- **Player Customization:** Players can enter a username and choose their bunny's fur color.
- **Physics-Based Movement:** Matter.js handles movement, jumping, gravity, and collisions.
- **Multiple Maps:** Four themed environments with different layouts and difficulty levels: Sunlit Meadow, Frosty Pine Ridge, Mushroom Cavern, and Twilight Hollow.
- **Carrot Collection:** Players must collect a golden carrot and bring it back to the burrow to finish a round.
- **Shaman Mechanics:** The designated Shaman can place and rotate objects to help other players navigate the map.
- **Round System:** Rounds end when the timer expires or everyone reaches the burrow. A new map is selected through a shuffled rotation, and the first player to finish becomes the next Shaman. If nobody finishes, the next Shaman is selected randomly.
- **Visual and Audio Effects:** The game includes themed environments, animations, particle effects, interaction feedback, and spatial audio.

### Controls

| Key | Action |
|---|---|
| A / D | Move |
| W / Space | Jump |
| F | Boop |
| 1–5 | Select Shaman tool |
| Q / E | Rotate selected tool |
| Mouse click | Place Shaman objects |

### Technologies

- **Phaser 3** – Game engine and rendering
- **Matter.js** – Physics and collisions
- **React** – User interface and HUD
- **TypeScript** – Game logic and type safety

### Implementation

React manages the menus, player customization, HUD, and Shaman toolbar, while Phaser manages the game world, physics, player interactions, and round progression. Callbacks connect the two systems to keep the interface synchronized with the game.
