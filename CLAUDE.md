# Claude TLDraw - Paper Review & Annotation System

Collaborative annotation system for reviewing LaTeX papers. Renders PDFs as SVGs with TLDraw, supports KaTeX math in notes, real-time sync, and source-anchored annotations that survive document rebuilds.

## Quick Reference

| Task | Command |
|------|---------|
| **Open a paper** | `./scripts/open.sh <tex-file \| dir \| doc-name>` |
| Build paper (manual) | `./build-svg.sh /path/to/paper.tex doc-name "Title"` |
| Publish snapshot | `npm run publish-snapshot -- doc-name` |

**Do NOT run `build-svg.sh`, `npm run collab`, `npm run dev`, `npm run sync`, or `npm run watch` individually.** `open.sh` handles all of it.

**If something goes wrong** (services won't start, build fails, viewer not loading, ports in use), delegate to the **ops agent** (`subagent_type: "ops"`). It knows the full build pipeline, service architecture, health checks, and common fixes.

## Architecture

```
├── public/docs/
│   ├── manifest.json          # Document registry
│   └── {doc-name}/
│       ├── page-01.svg        # Rendered pages
│       ├── macros.json        # KaTeX macros from preamble
│       ├── lookup.json        # Synctex line → page/y mapping
│       └── proof-info.json    # Theorem/proof pairs + dependencies
├── server/
│   ├── sync-server.js         # Yjs WebSocket sync + persistence
│   ├── synctex-server.js      # Source ↔ PDF coordinate mapping
│   └── data/{room}.yjs        # Persisted annotations per room
└── src/
    ├── MathNoteShape.tsx      # KaTeX-enabled sticky notes
    ├── ProofStatementOverlay.tsx # Proof reader overlays
    ├── synctexAnchor.ts       # Client-side anchor utilities
    └── useYjsSync.ts          # Real-time sync hook
```

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

This handles everything: builds SVGs if needed, starts services + watcher, builds the diff, and opens the browser.

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

### Proof reader

Press `r` to toggle proof reader mode. This highlights proof regions and shows a statement overlay panel (bottom-right) when scrolled to a cross-page proof.

**Statement panel** (green): shared-store TLDraw showing the theorem statement. Click header to jump to the statement page. Annotations drawn in the panel appear in the main view.

**Definition panel** (blue/indigo): appears above the statement panel when the proof references definitions, lemmas, or equations from other pages. Auto-selects the furthest-away dependency. Clickable badges in the statement header swap which dependency is shown; click the active badge to dismiss.

Data flow:
- `compute-proof-pairing.mjs` scans proof bodies for `\ref{}`/`\eqref{}`, builds a global label map, resolves to page regions, outputs `dependencies` array in `proof-info.json`
- `svgDocumentLoader.ts` loads `ProofDependency[]` per pair
- `ProofStatementOverlay.tsx` renders stacked panels with two shared-store TLDraw editors

Dependencies are sorted by page distance descending (furthest first). Same-page deps (dist=0) are filtered out. Section, figure, and table labels are excluded.

## Files Overview

| File | Purpose |
|------|---------|
| `build-svg.sh` | Convert .tex → SVG pages + macros + lookup + proof-info |
| `server/sync-server.js` | Yjs WebSocket sync with persistence |
| `server/synctex-server.js` | Source ↔ PDF coordinate mapping |
| `scripts/extract-preamble.js` | Parse LaTeX macros for KaTeX |
| `scripts/migrate-annotations.js` | Reposition annotations after rebuild |
| `scripts/watch.mjs` | Auto-rebuild on .tex changes + signal reload |
| `scripts/collab.mjs` | Start all services for collaborative editing |
| `scripts/publish-snapshot.mjs` | Export annotations + deploy to Pages |
| `scripts/compute-proof-pairing.mjs` | Match theorems to proofs, scan deps, output proof-info.json |
| `src/MathNoteShape.tsx` | Custom TLDraw shape with KaTeX |
| `src/ProofStatementOverlay.tsx` | Proof reader: statement + definition panel overlays |
| `src/useYjsSync.ts` | Real-time collaboration hook |
| `src/synctexAnchor.ts` | Anchor storage and resolution |

## Self-Service Rule

You have puppeteer and MCP tools available. Use them to check console output, read screen content, take screenshots, verify UI state, count elements, read error messages, etc. Never ask the user to report what they see on screen — do it yourself.

## Permissions

These operations are pre-approved for autonomous work:

- **Bash**: `npm run *`, `node`, shell scripts in this project, `curl` for local API testing, `open` for browser, process management (`pkill`, `lsof`)
- **Edit/Write**: Any file in `/Users/skip/work/claude-tldraw/`
- **Git**: All operations within this repo (commit, push, branch, etc.)

**Restriction**: Git write operations (commit, push) in other repos require approval.
