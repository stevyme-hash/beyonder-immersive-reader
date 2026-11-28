# Beyonder — Immersive Reader

Beyonder is an **unofficial, non-commercial fan project**. It is not affiliated with or endorsed by the author, Webnovel, or Yen Press. The project does not run ads, charge for access, or sell content.

All names and works belong to their respective owners. **A non-commercial disclaimer, attribution, or public availability does not grant permission to redistribute copyrighted text or artwork.**

## Local reading

Install the project dependencies and start the local development server:

```powershell
npm install
npm run dev
```

The chapter manifests are generated automatically by the `manifest` script before development and builds. Chapter text belongs in `public/content/lotm/` and `public/content/coi/`; artwork belongs in `public/assets/lotm/` and `public/assets/coi/`.

For a production build:

```powershell
npm run build
```

The generated website is written to `dist/`. For copyright or attribution questions, contact **ninjabhaicreator13@gmail.com**. Please identify the specific work and provide its original source.

## Deploy on Cloudflare Pages

1. Push the project to a GitHub repository.
2. In Cloudflare Pages, create a project connected to that repository.
3. Use the repository root as the root directory.
4. Set the build command to `npm run build`.
5. Set the build output directory to `dist`.
6. Connect the production branch. Cloudflare Pages will build and publish the site when that branch is updated.

You do not need to install or run a local server to use the GitHub-connected deployment.

## Features

- Searchable chapter library with volumes, navigation, bookmarks, and reading progress
- Reader themes, typography controls, optional browser speech narration, and reduced-motion support
- Illustration gallery and responsive, atmospheric layouts
- Optional Buy Me a Coffee support link
- Local journal, highlights, reading history, and milestones stored in browser `localStorage`
- Optional ambience is off by default and starts only after the reader activates it

The encyclopedia avoids unsupported canon claims: the atlas is illustrative, exhibit concepts are marked non-canon, and spoiler-sensitive portraits are gated.

## Repository notes

- `.gitignore` excludes dependencies, build output, environment files, logs, editor settings, and ZIP archives.
- Cloudflare Pages uses `npm run build` and the `dist/` output directory.
- The custom [`license.md`](./license.md) contains credits and an owner-provided statement that the site engine is under the MIT License. It does not license third-party stories or artwork. GitHub may not identify a custom lowercase `license.md` as a standard MIT license; a standard root `LICENSE` file is needed for license detection.
- `package.json` settings do not prevent using GitHub or Cloudflare Pages.

## Accessibility

The interface includes keyboard-operable controls, visible focus indicators, responsive layouts, semantic sections, and support for `prefers-reduced-motion`.
