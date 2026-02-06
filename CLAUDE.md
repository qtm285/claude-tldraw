# Claude TLDraw - Paper Review & Annotation System

Collaborative annotation system for reviewing LaTeX papers. Renders PDFs as SVGs with TLDraw, supports KaTeX math in notes, real-time sync, and source-anchored annotations that survive document rebuilds.

## Quick Reference

| Task | Command |
|------|---------|
| Start dev server | `npm run dev` |
| Start sync server | `npm run sync` |
| Start collab session | `npm run collab` |
| Start collab + watcher | `npm run collab -- --watch /path/to/main.tex doc-name` |
| Watch for changes | `npm run watch -- /path/to/main.tex doc-name` |
| Build paper | `./build-svg.sh /path/to/paper.tex doc-name "Title"` |
| Publish snapshot | `npm run publish-snapshot -- doc-name` |
| Migrate annotations | `node scripts/migrate-annotations.js <room> <doc>` |

## Adding a New Paper

```bash
./build-svg.sh /path/to/paper.tex short-name "Paper Title"
```

This:
1. Compiles LaTeX → DVI → SVG pages
2. Extracts preamble macros for KaTeX rendering
3. Updates `public/docs/manifest.json`

Access at: `http://localhost:5173/?doc=short-name&room=review-session`

No app rebuild needed.

## Updating a Paper After Edits

When the LaTeX source changes:

```bash
# 1. Rebuild SVGs (from the claude-tldraw directory)
./build-svg.sh /path/to/paper.tex doc-name "Title"

# 2. Start synctex server (if not running)
node server/synctex-server.js doc-name:/path/to/paper.tex

# 3. Migrate annotations to new positions
node scripts/migrate-annotations.js <room-id> <doc-name>
```

### How annotation migration works

- Each annotation stores a **source anchor**: `file.tex:line`
- After rebuild, synctex resolves where that line now appears
- Annotations move to follow their source content

### When migration might fail

- Source line was deleted → annotation stays in place (manual fix needed)
- Major restructuring → some annotations may land in wrong spots
- No synctex file → compile with `pdflatex -synctex=1` or use `latexmk`

## Architecture

```
├── public/docs/
│   ├── manifest.json          # Document registry
│   └── {doc-name}/
│       ├── page-01.svg        # Rendered pages
│       ├── page-02.svg
│       └── macros.json        # KaTeX macros from preamble
├── server/
│   ├── sync-server.js         # Yjs WebSocket sync + persistence
│   ├── synctex-server.js      # Source ↔ PDF coordinate mapping
│   └── data/{room}.yjs        # Persisted annotations per room
└── src/
    ├── MathNoteShape.tsx      # KaTeX-enabled sticky notes
    ├── synctexAnchor.ts       # Client-side anchor utilities
    └── useYjsSync.ts          # Real-time sync hook
```

## Collaboration

### Collab session (recommended)

Start everything in one command:

```bash
# All services (sync, dev, MCP)
npm run collab

# All services + auto-rebuild on .tex changes
npm run collab -- --watch ~/papers/main.tex my-paper
```

Prints Tailscale/LAN URLs for collaborators. Viewers auto-detect the sync server from the hostname they're connecting to.

### Auto-rebuild watcher

Watch a .tex file and auto-rebuild + hot-reload viewers on change:

```bash
npm run watch -- /path/to/main.tex doc-name
```

The watcher:
- Watches `.tex`, `.bib`, `.sty`, `.cls` files in the directory
- Debounces changes (2s default, set `DEBOUNCE_MS` env var)
- Runs `build-svg.sh` on change
- Signals connected viewers to hot-reload via Yjs
- Does an initial build on startup

### Publishing snapshots

Bake current annotations into a static snapshot and deploy to GitHub Pages:

```bash
npm run publish-snapshot -- doc-name
```

This exports annotations from the Yjs sync server, builds the static site, and deploys. The static viewer loads annotations read-only from `annotations.json` when no sync server is available.

### Manual setup
```bash
npm run sync                    # Port 5176
npm run dev                     # Port 5173

# Share URL with room param
http://<your-ip>:5173/?doc=paper&room=shared-review
```

### Remote (Fly.io)
```bash
cd server
fly launch
fly volumes create sync_data --size 1
fly deploy
```

Set `VITE_SYNC_SERVER=wss://your-app.fly.dev` in `.env`

## Room Management

- Each `?room=` param creates an isolated annotation space
- Annotations persist in `server/data/{room}.yjs`
- Same room = shared annotations (real-time sync)
- Different rooms = independent annotation sets

### Suggested room naming
- `paper-name-review` - Main review session
- `paper-name-alice` - Personal annotations
- `paper-name-v2` - After major revision

## Math Notes

Press `m` or click the note tool to create a math note.

Syntax:
- `$x^2$` - inline math
- `$$\int_0^1 f(x) dx$$` - display math

Custom macros from the paper's preamble are automatically available (e.g., `$\E[X]$`, `$\chis$`).

## Troubleshooting

### "Document not found in manifest"
Run `./build-svg.sh` to add it.

### Math macros not working
Check `public/docs/{doc}/macros.json` exists. Rebuild if needed.

### Annotations not syncing
- Check sync server is running (`npm run sync`)
- Check browser console for WebSocket errors
- Verify same `?room=` param on all clients

### Migration moves annotations to wrong places
- Source content may have moved significantly
- Create a new room for the updated version
- Or manually adjust misplaced annotations

## Files Overview

| File | Purpose |
|------|---------|
| `build-svg.sh` | Convert .tex → SVG pages + macros |
| `server/sync-server.js` | Yjs WebSocket sync with persistence |
| `server/synctex-server.js` | Source ↔ PDF coordinate mapping |
| `scripts/extract-preamble.js` | Parse LaTeX macros for KaTeX |
| `scripts/migrate-annotations.js` | Reposition annotations after rebuild |
| `scripts/watch.mjs` | Auto-rebuild on .tex changes + signal reload |
| `scripts/collab.mjs` | Start all services for collaborative editing |
| `scripts/publish-snapshot.mjs` | Export annotations + deploy to Pages |
| `src/MathNoteShape.tsx` | Custom TLDraw shape with KaTeX |
| `src/useYjsSync.ts` | Real-time collaboration hook |
| `src/synctexAnchor.ts` | Anchor storage and resolution |

## Permissions

These operations are pre-approved for autonomous work:

- **Bash**: `npm run *`, `node`, shell scripts in this project, `curl` for local API testing, `open` for browser, process management (`pkill`, `lsof`)
- **Edit/Write**: Any file in `/Users/skip/work/claude-tldraw/`
- **Git**: All operations within this repo (commit, push, branch, etc.)

**Restriction**: Git write operations (commit, push) in other repos require approval.
