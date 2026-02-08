# Claude TLDraw - Paper Review & Annotation System

Collaborative annotation system for reviewing LaTeX papers. Renders PDFs as SVGs with TLDraw, supports KaTeX math in notes, real-time sync, and source-anchored annotations that survive document rebuilds.

## Quick Reference

| Task | Command |
|------|---------|
| **Open a paper** | `./scripts/open.sh <tex-file \| dir \| doc-name>` |
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
./scripts/open.sh /path/to/paper.tex
# or: ./scripts/open.sh /path/to/project-dir/
```

This builds SVGs (if not already built), starts services + watcher, builds the diff, and opens the browser. The doc name defaults to the tex filename stem.

To build SVGs manually without starting services: `./build-svg.sh /path/to/paper.tex doc-name "Title"`

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

## iPad Review via MCP

### Starting a session
When the user asks to review or view a paper (e.g. "let's review this", "review bregman", "pull up the paper"):

```bash
./scripts/open.sh <tex-file | dir | doc-name>
```

This handles everything: builds SVGs if needed, starts services + watcher, builds the diff, and opens the browser. Examples:
- `./scripts/open.sh ~/work/bregman-lower-bound/bregman-lower-bound.tex`
- `./scripts/open.sh ~/work/bregman-lower-bound/`
- `./scripts/open.sh bregman-lower-bound`

**Do NOT run `build-svg.sh`, `npm run collab`, `npm run dev`, `npm run sync`, or `npm run watch` individually.** `open.sh` handles all of it. Running them separately will duplicate services or conflict with what's already running.

How it works under the hood:
- **Services** (dev server, sync server) are shared — started once, used by all docs
- **Watchers** are per-doc — each doc gets its own `watch.mjs` process that auto-rebuilds SVGs and the diff on tex changes
- If services are already running (another agent/session), `open.sh` skips startup but still adds a watcher for the new doc
- The initial SVG build is synchronous (must finish before you can view); the diff build runs in the background
- The diff compares the current tex on disk against the last git commit (HEAD)
- After the initial build, the watcher handles all subsequent rebuilds — don't re-run `build-svg.sh` or `build-diff.sh` manually

For an **iPad review session** (not just viewing), also:
1. Print a QR code: `node -e "import('qrcode-terminal').then(m => m.default.generate('http://IP:5173/?doc=DOC', {small: true}))"`
   - Get IP from `ifconfig | grep 'inet 100\.'` (Tailscale) or LAN
2. Open the tex file in Zed: `open -a Zed /path/to/file.tex`
3. Enter the listen-respond loop with `wait_for_feedback(doc)`

### Listening for feedback
Call `wait_for_feedback(doc)` in a loop. It blocks until:
- Ping (user tapped share) — immediate
- Text selection — 2s debounce
- Drawn shape (pen, highlight, arrow, geo) — 5s debounce
- Annotation edit — 5s debounce

### Reading annotations
- `read_pen_annotations(doc)` — all drawn shapes with source line mapping
- `list_annotations(doc)` — all math-note stickies

### Responding
- `add_annotation(doc, line, text)` — persistent note anchored to source line
- `send_note(doc, line, text)` — quick note via WebSocket + Yjs
- `reply_annotation(doc, id, text)` — append to existing note
- `highlight_location(file, line)` — flash red circle at source line
- `scroll_to_line(doc, line)` — scroll viewer to source line

### Cleanup
- `delete_annotation(doc, id)` — remove a note

### Review loop behavior
When the user says they're reviewing a document, enter a listen-respond loop:
1. Call `wait_for_feedback(doc)` to block for the next annotation
2. Interpret what came in (pen stroke, highlight, text selection, etc.)
3. Scroll Zed to the relevant source line: `zed /path/to/file.tex:LINE`
4. Respond — drop a note, reply, answer the question, edit tex, whatever's needed
5. Call `wait_for_feedback(doc)` again automatically

Always keep Zed in sync: whenever you're discussing, highlighting, or responding to a specific source line, scroll Zed there with `zed file.tex:LINE`. This is the default behavior, not something the user should have to ask for.

If the user interrupts with a chat message, handle it, then resume `wait_for_feedback`. The default is to stay in the loop until the user says they're done.

### Diff review workflow

When starting a review of a diff document (`format: "diff"` in manifest):

1. **Populate summaries at session start.** Read `diff-info.json` and git diff to write a one-line summary per changed page:
   - Read `public/docs/{doc}/diff-info.json` to get page pairs and the git ref
   - Run `git diff {ref} -- {texfile}` in the tex repo to get the actual hunks
   - Map hunks to pages using the line ranges in diff-info
   - Write summaries to Yjs `signal:diff-summaries` via a Node one-liner:
     ```bash
     node -e "
     import WebSocket from 'ws'; import * as Y from 'yjs';
     const doc = new Y.Doc(); const ws = new WebSocket('ws://localhost:5176/DOC');
     ws.on('message', d => Y.applyUpdate(doc, new Uint8Array(d)));
     setTimeout(() => {
       const m = doc.getMap('records');
       doc.transact(() => m.set('signal:diff-summaries', {
         summaries: { PAGE: 'summary text', ... }, timestamp: Date.now()
       }));
       setTimeout(() => { ws.close(); process.exit(); }, 500);
     }, 1000);
     "
     ```
   - Keep summaries short: ~35 chars for simple changes, bullets with `\n` for complex ones
   - Focus on *what* changed semantically ("tightened bound in Prop 2.1"), not mechanically ("changed page 5")

2. **Triage with the user.** The Changes tab shows three status dots per change:
   - Blue = keep new version, Red = revert to old, Violet = discuss
   - Review state syncs via Yjs and adjusts highlight opacity on canvas
   - `n`/`p` keyboard shortcuts jump between changes with a pulse animation

3. **Don't redo decided changes.** When summaries and triage state already exist (from a previous session or earlier in the current one), respect them. Only update summaries if the diff itself changes (reload signal clears both).

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
