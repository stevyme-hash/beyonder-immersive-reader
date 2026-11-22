# Cloudflare Pages

Connect the GitHub repository and production branch to a Cloudflare Pages project. Configure:

- Framework preset: Vite
- Root directory: repository root
- Build command: `npm run build`
- Build output directory: `dist`

Cloudflare Pages builds and publishes updates from the connected branch. It runs `npm run build` and deploys the generated `dist/` directory. Use a `main` production branch or choose the branch used for deployment.
