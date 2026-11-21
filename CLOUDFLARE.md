# Cloudflare Pages

Connect the GitHub repository and production branch to a Cloudflare Pages project. Configure:

- Framework preset: Vite
- Root directory: repository root
- Build command: `npm run build`
- Build output directory: `dist`

Cloudflare Pages builds and publishes updates from the connected branch; no local server is needed. This repository excludes LOTM/COI chapter text and artwork because redistribution rights have not been confirmed, so a deployment from it contains the reader interface without that media.

Do not upload a local `dist/` folder or the project ZIP: local builds can include ignored files still present on the development computer. Use the clean GitHub checkout for the code-only deployment.
