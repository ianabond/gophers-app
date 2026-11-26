# Bunny Burrow Game

**Live deployment:** https://bunnyburrowgame.fun

## Running locally
docker compose up --build
Then open http://localhost:8080

## Deployment (server only)
- `compose.prod.yml` and `nginx/nginx.prod.conf` are used on the deployed server.
- Requires a Let's Encrypt certificate in /etc/letsencrypt (via Certbot) and a `.env` file with POSTGRES_PASSWORD.
- Start with: docker compose -f compose.prod.yml up -d --build