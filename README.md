# LDB_FieldIQ_Alpha
Alpha version for FieldIQ - LDB field force tooling




Access points going forward:

Same laptop: http://localhost:3020 — direct, no Caddy, camera/mic work fine
Tablet over LAN: https://<your-mac-LAN-IP>:8443 — Caddy handles TLS, accept the self-signed cert once
To find your LAN IP: ipconfig getifaddr en0



To run the app

cp .env.example .env
# Edit .env — add your ANTHROPIC_API_KEY
docker-compose up -d
docker-compose exec app npm run db:migrate
docker-compose exec app npm run db:seed
# Then open https://localhost
Test credentials:

Manager: marie.dupont@loreal.com / password123
Rep 1: thomas.martin@loreal.com / password123
Rep 2: sarah.bernard@loreal.com / password123


Ready to start Phase 2 (Claude API integration — shelf analysis, voice notes, order scanning)?