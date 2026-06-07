# tlda - Paper Review & Annotation System

Collaborative annotation system for reviewing LaTeX papers. Renders PDFs as SVGs with TLDraw, supports KaTeX math in notes, real-time sync, and source-anchored annotations that survive document rebuilds.

## Quick Reference

| Task | Command |
|------|---------|
| **Start the server** | `tlda server start` |
| **Start the fleet daemon** | `tlda daemon start` |
| **Open in browser** | `tlda doc open <name>` |
| List projects | `tlda doc list` |
| Build status | `tlda doc status <name>` |
| LaTeX errors | `tlda doc errors <name>` |
| Visual check | `tlda doc preview <name> [page ...]` |
| Push files manually | `tlda doc push <name> --dir /path/to/project` |
| Publish snapshot | `npm run publish-snapshot -- doc-name` |

**`tlda daemon start`** runs the per-machine **fleet-daemon** (`bin/fleet-daemon.mjs`), which watches every project's source directory AND every Claude Code session JSONL on this machine, pushing events (source changes, activity cards, terminal-user chat) to the tlda server over a single WebSocket. The server tells the daemon what to watch via a `daemon-welcome` message and pushes `projects-updated` when new projects are created — no polling needed. `tlda daemon start` is an alias for the same command. The daemon also handles tmux RPCs (interrupt, send-key, capture-pane, restart-mcp, kick) routed by `machine_id`.

**Never use `tlda build` to work around pipeline issues.** It bypasses change detection and masks bugs. If something isn't rebuilding when it should, fix the pipeline.

**IMPORTANT: Always use `tlda server start` to start the server.** It daemonizes properly and writes a PID file. NEVER use `node server/unified-server.mjs &` or run it in a background task — the server dies when the parent exits, leaving a zombie that holds the port but doesn't serve requests. Use `tlda server stop` to stop, `tlda server status` to check.

**If something goes wrong** (services won't start, build fails, viewer not loading, ports in use), delegate to the **ops agent** (`subagent_type: "ops"`). It knows the full build pipeline, service architecture, health checks, and common fixes.

## Markdown Format

tlda supports a `markdown` format for lightweight notes and scratch documents. No LaTeX build pipeline — the server renders the `.md` file with markdown-it + KaTeX and serves it as an HTML iframe page.

```bash
# Create a markdown project
tlda doc create my-notes --dir ~/work/notes/ --format markdown --title "My Notes"
# --main defaults to the first .md file found in the dir

# The fleet daemon auto-detects .md changes and rebuilds
tlda daemon start
```

Math works the same as in LaTeX: `$inline$` and `$$display$$`. KaTeX renders server-side; CSS served from `/katex/`.

The viewer uses the same `html-page` shape and iframe machinery as HTML/Quarto projects. All MCP annotation tools (`add_note`, `read_annotations`, etc.) work normally. Source-line anchoring is not yet implemented for markdown — notes are placed visually on the canvas.

## Not a Keyboard App

**This is a voice-and-touch-first application.** Do not propose keyboard shortcuts as primary access points for features. The primary user has RSI and uses voice input and iPad touch — keybindings are inaccessible. When designing UI access patterns, use toolbar buttons, touch targets, or voice commands. A keybinding may exist as a secondary path but never as the primary or only trigger.

## Multi-Machine Architecture — No Local Fallbacks

**The fleet abstraction assumes agents can be on different machines.** This is not a hypothetical. The real deployment: agents run on a Mac Mini (NFS server in a closet), the tlda server runs on a laptop, and the UI is accessed from the laptop, iPad, or phone. These are genuinely separate machines with separate filesystems.

**The daemon is the bridge from an agent's machine to the server.** It can access files that the server cannot. Any operation that needs to touch files on an agent's machine MUST route through that agent's daemon via RPC. Never "fall back" to local processing when the daemon is unreachable — the file is not on the server's machine.

**Concrete rule:** If an RPC route resolves to `via: 'none'`, return 503. Do not attempt to process the request locally as a substitute. Silently succeeding on a single-machine dev setup while failing on the real multi-machine setup is the worst kind of bug.

## Two Communication Systems: Yjs vs. Fire-and-Forget Signals

The viewer has two distinct channels between server and browser. Knowing which to use (and why) prevents the class of bug where the viewer shows stale state after a reconnect.

### Yjs shapes — convergent state

Yjs is a CRDT: any client that connects or reconnects always converges to the latest shared state. **Use Yjs for anything that must be correct even if missed.**

Examples:
- The `doc-version` sentinel shape (`shape:doc-version--sentinel`) — stores `commitHash` and `buildReadyAt` so the corner timestamp is always accurate after reconnect
- Annotations, highlights, notes — all annotation state

### Fire-and-forget signals — transient events

Signals are custom messages piggybacked on the Yjs WebSocket via `broadcastSignal()`. They are not persisted; a client that misses one (because it was disconnected) never receives it. **Use fire-and-forget only when missing one is self-correcting.**

Examples:
- `signal:reload` — triggers page reload after a build; self-correcting because the new SVG files are already on disk, a tab opened later will just load the current version
- `signal:build-status` — drives build progress pills; self-correcting because pills are ephemeral UI
- `signal:camera` / `signal:scroll` — presenter sync; self-correcting because the next camera move updates it

### The principle

> **Fire-and-forget is appropriate when missing one is self-correcting. Yjs is required when missing means the viewer stays wrong.**

### Missed-reload detection

Since `signal:reload` is fire-and-forget, the viewer includes a missed-reload guard: when the Yjs sentinel's `buildReadyAt` advances past the last known reload timestamp by more than 5 seconds, the viewer synthesizes a local reload signal. This makes the system resilient to disconnects during a build.

## No Backward Compatibility

**Do not add backward-compat shims, fallbacks, or migration layers.** When changing an API, schema, tool interface, or shape prop format — just make the breaking change. Callers adapt. No old-param fallbacks, no "accept both formats," no compatibility cruft.

## TLDraw-Native UI Rule

**All UI that lives on the TLDraw canvas MUST use TLDraw-native patterns** unless there's a specific, documented reason not to. This means:

- **Shape state lives in shape props**, not in meta fields coordinated across multiple shapes
- **One shape = one visual unit.** Don't use N shapes with opacity toggling to simulate tabs/states. Use a single shape with data props (arrays, indices) instead.
- **Use TLDraw's event system** (`stopEventPropagation` from tldraw, not bare `e.stopPropagation()`). TLDraw uses capture-phase listeners; bare stopPropagation doesn't prevent TLDraw from intercepting events.
- **Don't fight TLDraw's selection/editing model.** If your component needs click handling, make sure it works *with* TLDraw's pointer state, not around it.

Deviations from this rule require justification in a code comment explaining why the TLDraw-native approach doesn't work. "It was easier" is not a justification.

**Custom shape types must be registered in TWO places, and props must match exactly.** If you create or modify a custom shape type:
1. **Client**: implement `FooShapeUtil extends BaseBoxShapeUtil` in `src/shapes/`, import and add to `customUtils` array in `SvgDocument.tsx`
2. **Server**: add `'foo-shape': { props: { ... }, migrations: createMigrationSequence(...) }` to `customShapeSchemas` in `server/lib/sync-rooms.mjs`

The prop list in `sync-rooms.mjs` must exactly mirror the shape's `static props` on the client — same field names, same types. Adding, removing, or renaming a prop on either side without updating the other causes a `TLSyncError` that crashes sync for everyone in that room. **Any time you change a shape's props, update both files.**

**Visual design is deliberately subtle.** UI chrome should be nearly invisible until hovered or needed. Follow the conventions established by existing elements (e.g., `.build-warning-badge`): 10% opacity default, 60% on hover, 0.3s transition. Use CSS classes with `.tl-theme__dark` variants — never hardcode colors inline. New UI elements should look like they belong next to existing ones in size, weight, and opacity.

## Fleet Shape Ownership & Junk Identities

Per-user fleet shapes (`fleet-chat`, `fleet-agents`, `fleet-search`, `fleet-docview`, `fleet-reaper`) and the HUD anchor (`fleet-hud-anchor--<user>`) are scoped by a `userId` prop. The **single source of truth** for ownership is `isMyFleetShape` in `src/shapes/fleet-utils.ts`: a shape is yours iff `!!uid && uid === getHumanId()`. Both the HUD (what to render) and `createFleetLayout` (what to delete/replace on a layout switch) import that one function, so they can't disagree. A shape with an empty/missing `userId` belongs to **no one** — it is not rendered or claimed by anyone. `createFleetLayout` and `saveAnchorOffsets` bail when `getHumanId()` is falsy rather than stamping `userId:""` / creating a bare anchor, so no-identity sessions can't spawn orphans.

**Incidental, tolerated issue — junk human identities.** The WS `register` handler (`server/unified-server.mjs`) stores whatever `id` the client sends, verbatim. The production identity flow (`registerHuman`) always sends `fleet:<sanitized-name>`, but **test scripts call `register` directly with arbitrary ids** (numeric floats like `2.0`, `7.0`, `261710.0`), creating human-agent rows whose id is not `fleet:`-prefixed. A session that logs in as one of those test names gets the malformed id, and fleet shapes it creates get that id as their `userId`.

This is **fine and tolerated**: because ownership is `uid === getHumanId()`, a shape scoped to a junk id only ever shows in a session holding that same junk id — it never pollutes a real user's (`fleet:skip`, `fleet:dmitry`, …) view. We deliberately do **not** harden `register` to reject non-`fleet:` human ids. If junk rows accumulate in `~/.config/tlda/fleet.db` they can be swept with `DELETE FROM agents WHERE human=1 AND id NOT LIKE 'fleet:%'` (back up the rows first; never touch `fleet:`-prefixed humans).

## Architecture

```
server/
├── unified-server.mjs        # Single process: Express + Yjs WS + SPA + API
├── lib/
│   ├── yjs-sync.mjs           # Yjs doc management + persistence
│   ├── project-store.mjs      # Project CRUD (server/projects/{name}/)
│   └── build-runner.mjs       # Build pipeline (latexmk → dvisvgm → synctex → proof-pairing)
├── routes/
│   └── projects.mjs           # REST API: /api/projects/*
├── projects/                  # Per-project storage
│   └── {name}/
│       ├── project.json       # Metadata (name, title, pages, buildStatus)
│       ├── source/            # Uploaded tex/bib/sty/cls/figure files
│       ├── output/            # Build output (SVGs, lookup, macros, proof-info)
│       └── build.log
└── data/{room}.yjs            # Persisted annotations per room

cli/
├── tlda.mjs                    # CLI entry point (installed as `tlda`)
└── lib/
    └── watcher.mjs            # File watcher → HTTP push to server

src/                           # Viewer SPA (React + TLDraw)
├── SvgDocument.tsx            # SVG page loading, layout, reload handling
├── MathNoteShape.tsx          # KaTeX-enabled sticky notes
├── ProofStatementOverlay.tsx  # Proof reader overlays
├── useYjsSync.ts              # Real-time Yjs sync hook
├── synctexAnchor.ts           # Source-anchored annotation resolution
└── svgDocumentLoader.ts       # Document loading, manifest, proof-info

mcp-server/
├── index.mjs                  # MCP tools (read_annotations, add_note, screenshot, etc.)
├── data-source.mjs            # Reads doc assets from disk or HTTP (TLDA_SERVER)
└── svg-text.mjs               # SVG text extraction for shape interpretation

public/docs/                   # Legacy doc storage (served as fallback)
├── manifest.json              # Legacy document registry
└── {doc-name}/                # SVGs + metadata
```

### How it fits together

```
Author's machine                     Server (localhost or remote, port 5176)
┌──────────────────┐                 ┌──────────────────────────────┐
│ Editor (Zed)     │                 │ unified-server.mjs           │
│     ↓ save       │                 │                              │
│ tlda daemon        │──POST /push───→ │ Project API → Build runner   │
│                  │                 │   latexmk → dvisvgm → etc.  │
│ Claude Code      │                 │   ↓                          │
│ └─ MCP (stdio)   │──Yjs WS──────→ │ Yjs sync + signal:reload     │
│                  │                 │   ↓                          │
│ iPad viewer      │←─Yjs WS───────│ Viewer SPA (/docs/* assets)  │
└──────────────────┘                 └──────────────────────────────┘
```

**Server URL resolution:** `TLDA_SERVER` env → `--server` flag → `~/.config/tlda/config.json` → `http://localhost:5176`

**Split sync server:** Set `TLDA_SYNC_SERVER` to route shapes/signals to a different server (e.g. Fly) while reading doc assets from `TLDA_SERVER` or local disk. Used for running Todd against the published version.

### Publishing and Todd

`npm run publish-snapshot -- <doc>` syncs the working copy to `~/work/published/tlda/`, builds the viewer, and deploys to GitHub Pages + Fly. The published clone is a frozen snapshot — safe for Todd to read from while the working copy keeps changing.

To run Todd against the published version:
```bash
cd ~/work/published/tlda
TLDA_SYNC_SERVER=https://tldraw-sync-skip.fly.dev node cli/lib/triage-agent.mjs
```

Todd reads doc assets (lookup tables, macros, page data) from the published clone on disk. Shapes and signals sync through Fly — the same room students are connected to.

### For viewer development only

Working on the React/TLDraw code (not normal paper review):

```bash
node server/unified-server.mjs   # API + Yjs on 5176
npx vite                          # HMR on 5173, proxies /api and /docs to 5176
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

1. Make sure the server is running: `tlda server start`
2. Start the fleet daemon: `tlda daemon start`
3. Open in browser: `tlda doc open <name>`

**If you'll be doing other work while the doc is open** (editing code, running sims, writing), subscribe to feedback with the **`monitor_add`** MCP tool — new annotations arrive as fleet chat from `fleet:tlda`, the same channel as any other message.

For an **iPad review session** (dedicated to review, not multitasking):
1. Print a QR code: `node -e "import('qrcode-terminal').then(m => m.default.generate('http://IP:5176/?doc=DOC', {small: true}))"`
   - Get IP from `ifconfig | grep 'inet 100\.'` (Tailscale) or LAN
2. Open the tex file in Zed: `open -a Zed /path/to/file.tex`
3. Subscribe with `monitor_add(doc)` so feedback reaches you on the channel.

### Listening for feedback

Use the **`monitor_add` / `monitor_remove` / `monitor_list` MCP tools**. `monitor_add(doc)` subscribes you to a document; new annotations, pings, and drawn shapes arrive as **fleet chat from `fleet:tlda`** — no hook, no polling, and it reaches you whether you're busy or idle (the channel works either way). When feedback arrives, read the details with `read_annotations(doc)`.

### Reading annotations
- `read_annotations(doc)` — all annotations: math notes, highlighter strokes, pen strokes, arrows, geo, text. Source-line anchored. Filter by `type`, `since`, `startLine`/`endLine`, `unaddressed_only`. Sort by `document` (default) or `time`.

### Responding
- `add_note(doc, line, text, file?)` — persistent math note anchored to a source line
- `reply_note(doc, id, text)` — append a reply tab to an existing note
- `flash_location(file, line)` — flash a red circle at a source line
- `scroll_to_line(doc, line, file?)` — scroll viewer to source line
- `delete_annotation(doc, id)` — remove a note (or any annotation shape)
- `screenshot(doc, target)` — capture viewer (target: viewport / screen / annotation ref / explicit bounds)

**Multi-file projects:** For documents that use `\input{}`/`\include{}`, pass the `file` parameter (e.g. `file="appendix.tex"`) to target lines in input files. Without `file`, tools default to the main tex file. The `lookup.json` keys input file lines as `"filename.tex:N"`.

### Note threading
Notes support reply chains via **threads**. A thread is a group of notes sharing the same canvas position, displayed as stacked tabs.

- `reply_note(doc, id, text)` adds a new tab to the note's `tabs` array and switches to it.
- `read_annotations(doc)` returns `tabCount`, `activeTab`, and `tabs` fields when a note has multiple tabs.
- `delete_annotation(doc, id)` deletes the entire note shape (all tabs).

On the viewer canvas, multi-tab notes show numbered tab handles above the note. The user can merge notes by dragging one onto another (tabs combine), or detach a tab via right-click.

The Notes tab in the panel has sort (document order / recency) and filter (all / pending MC / plain notes) controls.

### Cleanup
- `delete_annotation(doc, id)` — remove a note (deletes all tabs)

### Review loop behavior
When the user explicitly says they're reviewing a document with you — and reviewing is your primary task — subscribe with `monitor_add(doc)` and respond to feedback as it arrives on the channel:
1. `monitor_add(doc)` — feedback (pen stroke, highlight, sticky, text selection, …) arrives as fleet chat from `fleet:tlda`.
2. Call `read_annotations(doc)` to see the details of what came in.
3. Scroll Zed to the relevant source line: `zed /path/to/file.tex:LINE`
4. Respond — drop a note, reply, answer the question, edit tex, whatever's needed.

Always keep Zed in sync: whenever you're discussing, highlighting, or responding to a specific source line, scroll Zed there with `zed file.tex:LINE`. This is the default behavior, not something the user should have to ask for.

You don't "block and wait" — feedback reaches you on the channel whether you're mid-task or idle, so just keep working and handle it when it arrives. `monitor_remove(doc)` when you're done.

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

### Viewing previous versions — what exists and what does NOT

For a **normal `svg` doc** (e.g. `synth-supplement`), the **only** way to view an earlier version is the **shadow-history scrubber**: click the **version timestamp** in the corner to open a slim time-axis scrubber at the bottom of the canvas (`ShadowHistoryOverlay`), then drag/step to a past build — the old version renders as a "shadow column" beside the current one, fed by `/api/projects/{doc}/history/shadow` off the doc's shadow git repo.

Things that **do NOT exist** — don't reference them to the user or look for them:
- **No "compare" / "diff" button** on a normal doc. The Blue/Red/Violet Changes-tab diff workflow above exists *only* for docs created with `format: "diff"` (a dedicated diff document) — not for an ordinary `svg` doc.
- **The doc-view panel is not a version viewer.** The `fleet-docview` panel shows a *region of the current doc*; it has nothing to do with version history.

When the user mentions a "previous version," it's the timestamp→scrubber path. (Known issue to watch for: the shadow column can render page geometry but **no text** if the doc's shadow repo / historical build is incomplete — see the shadow-mirroring notes.)

### Proof reader

Press `r` to toggle proof reader mode. This highlights proof regions and shows a statement overlay panel (bottom-right) when scrolled to a cross-page proof.

**Statement panel** (green): shared-store TLDraw showing the theorem statement. Click header to jump to the statement page. Annotations drawn in the panel appear in the main view.

**Definition panel** (blue/indigo): appears above the statement panel when the proof references definitions, lemmas, or equations from other pages. Auto-selects the furthest-away dependency. Clickable badges in the statement header swap which dependency is shown; click the active badge to dismiss.

Data flow:
- `compute-proof-pairing.mjs` scans proof bodies for `\ref{}`/`\eqref{}`, builds a global label map, resolves to page regions, outputs `dependencies` array in `proof-info.json`
- `svgDocumentLoader.ts` loads `ProofDependency[]` per pair
- `ProofStatementOverlay.tsx` renders stacked panels with two shared-store TLDraw editors

Dependencies are sorted by page distance descending (furthest first). Same-page deps (dist=0) are filtered out. Section, figure, and table labels are excluded.

## Voice Input

Voice input uses **whisper-stream** for local real-time transcription. No Google dependency, no network latency, runs entirely on the Mac's GPU.

**Architecture:**
```
mic → whisper-stream (SDL) → stdout → whisper-bridge.mjs → ws:8179 → browser
```

- `whisper-stream` captures the mic directly (via SDL, not the browser) and transcribes in 3-second streaming steps with VAD
- `bin/whisper-bridge.mjs` relays transcription text over WebSocket to the browser
- The browser connects to `ws://localhost:8179` and appends transcript chunks to the active chat textarea
- Falls back to Chrome's Web Speech API if the bridge isn't running

**Starting:** `tlda server start` auto-starts the whisper bridge. Manual start: `node bin/whisper-bridge.mjs`

**Model:** Uses `small.en` (`/opt/homebrew/share/whisper-cpp/ggml-small.en.bin`). Override with `--model /path/to/model.bin`.

**Forcing Chrome:** Add `&voice=chrome` to the URL to use Chrome's Web Speech API instead.

**Log:** `~/.config/tlda/whisper-bridge.log`

## Client Logging

**Browser code uses `src/logger.ts`.** Every `log.{debug,info,warn,error}('namespace', 'message', { data })` call:

1. Goes to the browser console (only when the namespace's level beats the console threshold — default `warn`)
2. **Always** gets POSTed to `/api/log` and appended to `~/.config/tlda/client.log`

So agents can `tail -f ~/.config/tlda/client.log` (or grep it) to see what the browser is doing without needing playwright or the user's DevTools.

The file is JSON-lines: `{"ts","level","ns","msg","data","session"}`. The `session` field is a short per-tab id so you can tell which window logged what.

**Tune the console threshold** via URL `?log=ns:debug` or `localStorage.setItem('tlda-log', 'chat-scroll:debug')`. The server sink captures everything regardless — the threshold only affects what shows in DevTools.

**Use this everywhere.** Don't `console.log` from app code; use `log.debug/info/warn/error` so the event lands in the file. Server-side code uses `shared/logger.mjs` instead, which writes to per-process log files (`server.log`, `fleet-daemon.log`, etc.).

## Playwright Coordination

**Drive the browser with `tlda-dev pw` — one shared browser, never your own session.** `tlda-dev pw <verb>` is `playwright-cli <verb>` wrapped around a single persistent session that pops up lazily and persists across calls (so it stops "closing between commands"). You never `open`/`close` and never pick a `-s=` session — that per-agent lifecycle churn is what `tlda-dev pw` exists to kill. Playwright MCP is gone; don't use `mcp__playwright__*`.

```bash
tlda-dev pw acquire                 # take the lock + pop the shared browser (lazy)
tlda-dev pw goto "URL" ; tlda-dev pw click <ref> ; tlda-dev pw screenshot --filename f ; tlda-dev pw eval "() => expr"
tlda-dev pw status                  # lock holder + browser up/down + URL
tlda-dev pw release                 # give up the lock (browser stays up for the next agent)
tlda-dev pw reap                    # close the shared browser (the reaper)
```

The lock is the existing `bin/pw-lock.sh` (auto-expires after 10 min; `tlda-dev pw status` shows the holder; `bin/pw-lock.sh steal <you>` to force-take as a last resort). The first forwarded `tlda-dev pw` verb auto-acquires it. **Skip's machine still can't handle two concurrent playwright sessions** — that's exactly why there's one shared browser behind a lock.

Per `src/main.tsx`, automated sessions get `tlda-theme=fog-dark` + `tlda-camera-linked=false` set in localStorage on app startup. **Detection: `navigator.webdriver` OR `?pw=1` in the URL.** Always include `&pw=1` in your `tlda-dev pw goto` URLs. This means:
- Playwright windows are dark theme (not a white flash on Skip's screen at night)
- The agent's pan/zoom does NOT broadcast over the camera-link sync to Skip's view

Do not undo either of these.

### Deleting shapes from a live room: use `store.remove`, not `deleteShapes`

When removing shapes from a synced room programmatically in a playwright/automated session (e.g. cleaning up orphan/junk shapes), call **`editor.store.remove(['shape:…'])`**, not `editor.deleteShapes([...])`.

Observed during the userless-fleet-shape cleanup (2026-06-01): in an automated session, `editor.deleteShapes([...])` on fleet/anchor shapes tore the page down — the eval returned nothing, `window.__tldraw_editor__` went null afterward, and the delete **never flushed to the server** (the shape was still present after reload). The lower-level `editor.store.remove([...])` deleted the same shapes cleanly, persisted across reload, and left the editor alive. Root cause of the `deleteShapes` teardown is not pinned down — treat this as an observed automation gotcha, not a settled explanation.

Even simpler for one-off cleanup: the MCP tool **`delete_annotation(doc, id)`** removes any shape from the room server-side (no browser needed) and is the most reliable path. (Reminder: never use `POST …/sync/clear` or bulk-delete — see app-development rule 8.)

## Self-Service Rule

**NEVER tell the user to check something.** Do not say "reload and check," "try it on the iPad," "go verify," "see if that works," or any variant. You have `tlda-dev pw` (the shared browser), the tlda MCP tools, `tlda doc preview`, and screenshots. Use them. If you can't verify it yourself, say so explicitly — don't punt to the user.

**Verify before declaring success.** After deploying changes (server restart, SPA rebuild, viewer fix), open the viewer with `tlda-dev pw` and confirm it actually works. Don't guess at CSS fixes — load the page and look.

**Look at layout, not just functionality.** When taking verification screenshots, actually examine proportions, spacing, and visual balance — don't just confirm that elements exist and render. A sidebar that's 80/20 instead of 50/50, text crammed into a sliver, an overlay that's misaligned by 100px — these are obvious to a human glancing at the screenshot. Check: Are columns balanced? Does text have room to breathe? Are things where they should be relative to each other? If you changed something that affects sizing or positioning, measure the actual computed values (grid columns, bounding rects, offsets) rather than eyeballing.

**Chromium is the default; WebKit is usually a waste of time.** Don't routinely re-run in WebKit — only reach for it when you have a *concrete, reproduced* Safari-specific bug to chase (e.g. a behavior Skip reports on iPad/Safari that you can't reproduce in Chromium). Routine "let me also check WebKit" passes burn time for no signal.

**Never tell the user to force-refresh.** Open a new tab instead: `open -a Safari http://localhost:5176/?doc=NAME` or use `tlda-dev pw` to open a fresh page. A new tab has no cache to worry about.

**When you DO chase a Safari-specific bug:** don't claim "it'll work in real Safari" without justification — if WebKit fails, explain why (e.g. a known TDZ bug in minified bundles under strict mode) or don't claim it. If a bug isn't reproducible at all, set it up before involving the user: open the page, use `tlda-dev pw` to scroll and screenshot as much as possible, and give them a specific thing to confirm rather than "go check if it works."

**Debug with live tools.** When something is visually broken in the viewer, use `tlda-dev pw` to inspect the live page (console errors, DOM state, network requests). `tlda doc preview` renders static SVGs — it can't diagnose viewer runtime issues like blank pages, broken WebSocket, or CSS problems.

**If headless can't verify it, go headed.** If iframes, canvas rendering, or animations don't work in headless playwright, launch headed (`headless: false`), take screenshots at each step, and read them yourself. Don't punt to the user because your default verification tool has limits.

**For motion/interaction issues, record a video.** If the bug is about how something animates, transitions, or responds to a sequence of interactions, screenshots won't capture it. Use playwright's video recording:

```js
const context = await browser.newContext({ recordVideo: { dir: '/tmp/tlda-video/' } });
const page = await context.newPage();
// ... your test ...
await context.close(); // flushes the video
```

Then extract frames and read them:
```bash
ffmpeg -i /tmp/tlda-video/*.webm -vf fps=15 /tmp/frames/frame-%03d.png 2>/dev/null
```

Read the frames as images to see the full interaction sequence. For a specific moment, seek to a timestamp: `ffmpeg -ss 2.5 -i video.webm -frames:v 1 /tmp/frame.png`.

**When a feature is built, fixed, and verified, offer a tour.** After you've confirmed it works yourself, offer to run a headed playwright walkthrough — so the user sees the same thing you saw. This is confirmation, not verification. Don't offer before you've verified it yourself, and don't kick it off without asking.

**Read this file before starting any tlda session.** The self-service rule, verification patterns, TLDraw-native UI rules, and tool permissions are all here. Don't wait to be corrected on something that's already documented.

**Test exactly what the user said is broken.** If the user says "button X doesn't navigate to a new page," the test is: click button X, assert page changed. Not a broader test suite that touches the same code path. Don't test something adjacent and declare the reported issue fixed.

## Permissions

These operations are pre-approved for autonomous work:

- **Bash**: `npm run *`, `node`, `tlda`, shell scripts in this project, `curl` for local API testing, `open` for browser, process management (`pkill`, `lsof`)
- **Edit/Write**: Any file in this project
- **Git**: All operations within this repo (commit, push, branch, etc.)

**Restriction**: Git write operations (commit, push) in other repos require approval.
