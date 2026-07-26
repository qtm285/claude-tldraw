# tlda - Paper Review & Annotation System

## NON-NEGOTIABLE: UI VERIFICATION

- Don't serve a sandbox as a test for UI behavior.
- Use `tlda-dev pw`.
- If Skip is testing UI behavior, use the document he is looking at.
- For agent PW testing, use the real environment with a different document—one Skip is
  not using. Do not disturb his active document. If testing fleet UI, use the default
  layout showing real fleet activity.
- **Don't drive a browser.** Skip: *"you guys are really bad at driving browsers. It burns
  a ton of tokens, and it takes forever. And it's just not effective."* Building a UI
  feature is the only reason, and then on a document he is not in.
- **CHROME REMOTE DEBUGGING ON SKIP'S BROWSER IS ALWAYS ENABLED. USE IT.** It is app
  tooling, not an ops request — nobody needs to turn it on and there is nothing to
  arrange. Attach over CDP and read his live DOM, JS state, console, and network directly.
  His tab is the one whose URL has **no `pw=1` and no `name=`**; every agent pw tab carries
  both. Read-only: evaluate to observe, never to mutate — no clicking, filtering, deleting
  shapes, or clearing storage, all of which destroy the live state you were sent to look at.
  On 2026-07-25 an entire night was lost to inferring from logs — four confident wrong
  explanations, two agents discarding screenshot evidence they couldn't attribute, an hour
  spent on the wrong machine's `client.log`, and a "finding" that turned out to be a logging
  default — while this was available the whole time and nobody used it. Skip: *"IT'S BEEN
  ENABLED. IT'S ALWAYS ENABLED."*
- **You cannot screenshot Skip's screen. There is no tool that does it and there is not
  going to be one.** `screenshot(doc, target: "screen")` accepts the argument and silently
  returns a canvas render of the document — no toolbar, no HUD, no selection chrome. This
  file used to recommend it as "to see what he sees," which is how agents ended up
  reporting a render of a document back to him as if it were his screen. **To see his live
  UI, attach over CDP** (above) and read the DOM. To see what his tab logs:
  `~/.config/tlda/client.log` — **on the server, not the Mini**, if he is on the Air. To see
  if it's slow for him: the client profiler on his session, or `src/livePerfProbe.ts`, which
  already samples every tab every ~10s and carries `href` for attribution. A browser you
  opened is a different machine in a different state — reporting it back is reporting on
  yourself.
- **A pw tab is a running browser, not a leftover file**, and `release` only *parks* it —
  a parked tab last on his document is still loaded on his document.
- Almost nothing needs a browser. On 2026-07-25 the label-width bug was a diff and a
  character count, the event-volume answer was one SQL query, "did this ever merge" was
  `git log --oneline main..<branch>`, and the stall stacks came from his session.

## Who to ask

- **app-librarian** — architecture, source location, logs, tool behavior, intended
  tlda/fleet behavior.
- **app-historian** — prior app decisions, old bug history, what changed and why.
- **app-tester** (fallback: `app-testing`) — browser verification, screenshots,
  interaction testing, repros.
- **ops** — the physical machine, deploy pipeline, daemon/process supervision, auth.
  Not a catch-all for "the app is broken" — that's your job to fix. Only bring in
  ops when the problem is genuinely outside app-dev's reach (machine down, network,
  process supervision).
- **math-librarian** or the assigned math agent — paper content or math judgment.

**No backward compatibility.** Do not keep deprecated aliases, compatibility shims, old command paths, or migration layers unless Skip explicitly asks for them. When changing an API, schema, tool interface, or shape prop format — just make the breaking change. Callers adapt.

**Tear it out. Don't add epicycles.** Skip's rule, in his words: *"the fix for almost
every problem with this app is deleting code nobody asked for — much of which I'm
completely unaware of."*

The tell that you are building an epicycle: you are writing machinery whose only job
is to make questionable code behave correctly. Validation, reconciliation, a
freshness check, a cache, a retry, a "only do this when it's safe" conditional. Every
one of those is a second thing that can break, protecting a first thing that nobody
asked for. **When you notice you are doing that, stop and ask whether the thing you
are protecting should exist at all.** Usually it shouldn't, and the diff is a
deletion.

Worked example, 2026-07-25. Creating the default layout saved the outgoing panels'
chat filters, deleted the shapes, then reseeded the new panels from those saved
filters — never asking whether the agent a filter pointed at still existed. Skip had
a panel aimed at an agent that had been gone for twelve days: invisible to him, and
recreated into every layout he made after. It also made his owned-chat count 2
instead of 1, which permanently suppressed the unread-sender rail — a feature that
had shipped and that he had **never once seen**. Two symptoms, one cause.

The epicycle nearly shipped: an agent started designing a way to *validate* carried
filters against a roster that is paginated 100 at a time, so the check would have to
be right about liveness across pages. Skip cut it instead — **"default layout is a
complete teardown and a complete recreation. That's what it fucking means."** The fix
was deleting the save, the parameter, the type, and the reuse branch. Chat targets
seed from the live roster every time; nothing carries over.

The general shape, and why it keeps happening: this code was added by an agent, was
never requested, and was invisible to Skip until it cost him a feature. Code nobody
asked for does not announce itself — it shows up later as a bug he cannot name.

**Keep working notes in scratch, not the repo.** Status briefs, drafts, plans, and other ephemeral working artifacts go in a scratch folder (the project `scratch/` or your session scratchpad) — not the repo root or committed docs. Untracked files don't dirty the index or block a deploy, but they clutter the tree; keep it tidy. Durable, verified documentation goes in the proper docs; everything working-and-temporary goes in scratch.

Collaborative annotation system for reviewing LaTeX papers. Renders PDFs as SVGs with TLDraw, supports KaTeX math in notes, real-time sync, and source-anchored annotations that survive document rebuilds.

## GROUND TRUTH: THE REAL SERVER AND THE REAL AGENT DATABASE ARE ON FLY

**The real tlda server — and the real fleet/agent database — live on Fly (fly.io).** The active config's `TLDA_SERVER` points at the Fly app (e.g. `https://tlda-fly.cormorant-matrix.ts.net`); that is where the authoritative roster, agents, chat, and registry are.

**The local `~/.config/tlda/fleet.db` on the Mini is NOT the real database. That file is junk.** It is stale/local and does not reflect the real fleet. Do **not** query it, count it, or treat it as authoritative for anything — an audit, a roster, "how many agents do we have," whether an agent is spawnable, ANY of it. If you find yourself running `sqlite3 ~/.config/tlda/fleet.db`, stop: you are looking at the wrong thing.

**To reach real agent/fleet state, go through the real server** — the fleet MCP tools (`fleet_table`, `register`, `spawn`, `search_logs`, …) and the Fly-backed API, which resolve through the active config's `database` axis. The MCP/CLI already point there via `TLDA_SERVER`; use them instead of reading a local file.

## GROUND TRUTH: SESSIONS AND JSONL ARE NEVER LOST

**AN AGENT'S SESSION HANDLE IS NEVER GONE. AN AGENT'S ROLLOUT OR JSONL IS NEVER GONE. WHAT HAS HAPPENED IS WE HAVE LOST TRACK OF THE SESSION IN OUR OWN RECORD.**

Agents constantly claim "my JSONL got reaped" or "the session handle is gone." **THAT DOES NOT HAPPEN. IT IS NOT A THING.** The rollout / JSONL always exists on disk. When a respawn fails with "no resume handle," the cause is **our own shitty record-keeping losing the pointer** — never the data being deleted or reaped. Do not ever offer "the JSONL got reaped" as an explanation; it is false. Go find the session on disk instead.

## GROUND TRUTH: AGENTS WAKE ON CHAT.

**Sending a hibernating agent a chat message wakes it.** That is the mechanism, not a
workaround for one. Chat is how an agent comes back.

**So hibernation is transparent.** From the outside an agent is simply *there*: you chat,
it answers, and whether it had to be woken is an implementation detail. Nothing that talks
to an agent should branch on hibernation, check for it first, or treat it as a failure
state. If your code asks "is this agent hibernating" before sending, that is the bug.

**The one place hibernation is legitimately visible is as a filter label** — the `awake`
and `hibernating` pseudo-labels, for selecting agents in a roster or a filter expression.
That is the whole of its intended surface. Seeing it there is not licence to branch on it
anywhere else.

Consequences agents get wrong:

- **A chat message to a hibernating agent is not shouting into the void.** It is the
  supported way to bring that agent back to its work. Do not describe it as futile, and do
  not build a second "wake" path beside it.
- **A bot kicking an idle-or-hibernating agent that holds an open task is doing real work**,
  because the kick itself is the wake. What must be true is that the agent really is idle
  or gone — see the status caveat below.
- The intended trigger is **idle with an open task, after a couple of minutes**, so an
  agent usually never reaches hibernation holding unfinished work. The
  hibernated-with-a-task case still exists legitimately: a task can be assigned *after* an
  agent has already hibernated.

**Status is the weak link, not the wake.** On 2026-07-25 `bots/todd/kicks.mjs` sent
**1,505 "you hibernated with unfinished task" kicks in ~15,000 fleet events — 9.9% of all
traffic, across 82 agents** — to agents that were mid-task, calling tools, and reporting
every few minutes. Todd was right to act on what it was told; it was told wrong. Before
building anything on an agent's awake/idle/hibernating state, verify the state is real —
and remember `trust the pane, not the roster`.

**When the roster and a report disagree, the terminal breaks the tie.** Not "always
read the pane" — that's a chore nobody will do. The rule fires on a *disagreement*,
and it names a winner: the tmux pane. On 2026-07-25 every other surface lied at least
once, and the pane never did.

- The roster showed `handoffbug` as `shell` for two hours, read as "it never came up."
  Its pane showed it had **logged in fine**, then `WS connection closed` and every read
  timing out. It was alive the whole time, holding a task it could not read, and it
  said so in plain text that nobody looked at.
- `tlda agent wake handoffbug` returned **"Woke fleet:3d1e9480"**. The pane never
  changed. Nothing restarted.
- The spawn mailbox reported **`previous daemon RPC execution outcome is indeterminate`
  — six times** for agents that were alive and doing the work. It knows it lost track
  and prints a failure.
- `chat()` reported **"Notified paw-patrol [available]"** while the server recorded
  `no-route / no-current-durable-seat` and dropped the message.

The common defect: a surface reporting a belief it cannot support, in a form the
reader can't distinguish from knowledge. When two of them disagree, don't average
them and don't pick the convenient one — go read the terminal.

## GROUND TRUTH: ONE DAEMON. A SECOND DAEMON IS A BUG.

**The core invariant: ONE DAEMON PER ENVIRONMENT.** This is **not** a global machine singleton — we run multiple environments/projects, and each legitimately has its own daemon. The rule is that **exactly one daemon watches a given project/environment** (equivalently: any one agent's JSONL is watched by exactly one daemon). **Two daemons watching the *same* environment** is the bug — that double-watch corrupts activity-card delivery and agent status, and the confused status can even get live agents reaped. So the lock must be **keyed on the environment**, not global: a second daemon for an environment already being watched must refuse to start. A stray daemon (from a worktree, a sandbox, a stray `node bin/fleet-daemon.mjs`) that ends up watching an already-watched environment breaks it — it is **NOT** harmless "because it's just a sandbox daemon."

**Troubleshooting rule (this project):** if **activity cards or agent status** are wrong — cards not showing, status stuck/wrong, live agents shown dead — **FIRST run `pgrep -fl fleet-daemon` and check whether more than one daemon is running.** If there are two, kill the stray (non-launchd) one; launchd keeps the real singleton alive. Do **not** rationalize a second daemon away — "the other one is just a sandbox daemon, it doesn't matter" is exactly the wrong call. It matters.

## LAUNCHD IS ALREADY SET UP. DON'T TOUCH IT.

These jobs exist in `~/Library/LaunchAgents` and are registered:

```
com.tlda.fleet-daemon          # the testing-environment daemon
com.tlda.fleet-daemon.stable   # the stable-environment daemon
com.tlda.bot.dev  com.tlda.bot.grammar  com.tlda.bot.teacher  com.tlda.bot.todd
```

**Unless you are creating a new environment, leave them alone.** Do not edit a plist, do
not rewrite one, do not back one up and install a replacement. Skip: *"we have no need to
do that ever."*

Why this is a rule and not a preference: an edited plist has to be re-registered to take
effect, `launchctl bootstrap` **fails from every agent shell** (`5: Input/output error` —
agent processes are in the Background session and can't write to `gui/501`), so the agent
hands Skip a command. Four plist rewrites are backed up in that directory, and the
bootstrap instruction is copied across a dozen scratch files. That loop is why he gets
told to fuck around with the daemon.

**What you CAN do, and should, instead of asking him:**

- `launchctl kickstart gui/501/com.tlda.fleet-daemon` — **works from an agent shell.**
  Restarting a registered job is yours. Add `-k` to kill and restart.
- Change daemon behaviour in `~/.config/tlda/daemon.yaml`, which the daemon reads at
  startup. No registration involved.
- `pgrep -fl fleet-daemon` to see what's running, and `ps eww <pid> | tr ' ' '\n' | grep
  TLDA_CONFIG` to see which environment a daemon serves.

**If a daemon won't start, read `~/.config/tlda/fleet-daemon.log` before anything else.**
It dies silently on config validation — on 2026-07-25 a deploy added code requiring
`statusScanSeconds` in `daemon.yaml`, the key was absent, and the daemon threw at startup
while its launchd job sat at `spawn scheduled` with nothing running. Restarting it without
reading the log tells you nothing.

## When Skip states the problem, that is the starting axiom — not a claim to debate.

When Skip tells you what is wrong ("it's the daemon," "it worked until last night," "this is a systems problem"), treat it as **ground truth** and go find the mechanism that makes it true. Do **not** argue it isn't true, offer a competing theory, or act like he's mistaken. His lived observation of the running app beats your code-reading and your tests **every time** — if your investigation contradicts him, you are looking in the wrong place, so keep digging. The "well, actually / but / have you considered" reply to a Skip problem-statement is the failure. Accept it, then confirm by acting.

**Work the failure Skip is experiencing, not an adjacent bug you found.** The current
browser-visible behavior is the repro surface. Finding and fixing a nearby defect does not
close the report. Instrument and prove the exact failing path Skip named, and stop speculative
fallbacks or side quests when he corrects the target.

## GROUND TRUTH: IF YOU'RE GIVEN A SOURCE ARTIFACT, LOOK AT IT

**When a task hands you a reference — an image, a screenshot, a file, a doc — open it and actually look at it before you act.** Don't work off a secondhand text description of what it contains, and don't assume existing/shipped code already captures it. A description of an artifact is not the artifact. This applies to design work exactly as much as to code: if Skip attached a reference image, fetch and view that image before producing anything that's supposed to be grounded in it.

**If you didn't look at something you were given, say so before you present work — not after.** Producing output and letting the recipient discover mid-review that you never checked the reference wastes their evaluation time twice: once reading your output, once learning it wasn't grounded in what they gave you. "I haven't looked at X yet, here's a rough attempt" costs one sentence. Silently skipping it costs someone else's whole review.

## CURRENT STATE BEFORE DELEGATION OR IMPLEMENTATION

Project documents, handoff packets, scratch notes, and old task lists are historical
evidence until they are reconciled with the current fleet trace. They do not authorize
implementation by themselves.

Before delegating, accepting, or implementing work on an active product surface:

1. Identify the current lane owner/manager from fleet state and recent chat.
2. Read the owner's current thread forward through the latest correction or approved
   endpoint. Do not stop at the first plausible specification.
3. Classify every proposed input as current, superseded, evidence-only, or unresolved.
4. Confirm that the requested work is not already in progress, completed differently,
   or explicitly rejected today.
5. Give implementers source anchors to the current trace and owner, plus an explicit
   `do-not-import` list for stale material.

If the current owner or corrected endpoint cannot be established, the lane is blocked
for implementation. Recover the trace or ask the owning role; do not choose an older
document because it is available. A coordinator who receives a bad brief owns detecting
and repairing the brief before anyone changes code.

Coordinators keep routine work moving through verification and merge. Do not turn normal
progress into an approval queue or ask Skip to micromanage. Stop for him only when a real
product decision, conflict, destructive action, or user-only authority boundary requires
it. If work appears exhausted, first check every live owner and open task, collect current
status, unblock or redelegate stalled lanes, and merge verified routine work.

This gate is especially strict for UI work: a stale design document must never override
the current manager, today's browser-visible surface, or corrections made in today's
conversation.

## FLEET OPERATIONS ARE EVENT-BASED

Spawn, wake, and delegation create durable obligations and complete through later events.
They are not synchronous ten-second workflows. A short RPC/send timeout must not turn a
valid queued operation into coordinator retry work or justify spawning around the failure.
Track the durable mailbox/task event, and fix delivery if the promised completion or failure
event never arrives. A fresh seat must have its ledger entry before wake/resume reads it, and
spawn is not successful until the real prompt reaches the real agent.

## A PLAN IS THE SPECIFIC HOW FOR EVERY ITEM — do not make Skip explain this.

If you're handed a to-do list, a plan describes **specifically how you will do every single item on it.** A 60-item list gets a 60-item plan — **one concrete disposition per item**, not grouped, not collapsed into "we'll handle these." **"I'll look at the list and do the things" is not a plan. A plan never refers to another plan.** And here is the part agents keep skipping: these lists have been left to **rot** by every agent who confidently asserted they'd "take care of it." So an assertion that you'll accomplish what no one before you has is worthless on its own — your plan must state **what you will do *differently*** so it doesn't rot the same way. Never hand Skip a confident "I've got it" without a concrete, *different* mechanism behind it. Making him explain what a plan is, or that he'll hold you accountable to it, is a failure.

## CLI Notes

Run `tlda --help` / `tlda <noun> --help` for the command list — don't duplicate it here.

**`tlda daemon start`** runs the per-machine **fleet-daemon** (`bin/fleet-daemon.mjs`), which watches every project's source directory AND every Claude Code session JSONL on this machine, pushing events (source changes, activity cards, terminal-user chat) to the tlda server over a single WebSocket. The server tells the daemon what to watch via a `daemon-welcome` message and pushes `projects-updated` when new projects are created — no polling needed. `tlda daemon start` is an alias for the same command. The daemon also handles tmux RPCs (interrupt, send-key, capture-pane, restart-mcp, kick) routed by `machine_id`.

**Never use `tlda build` to work around pipeline issues.** It bypasses change detection and masks bugs. If something isn't rebuilding when it should, fix the pipeline.

**IMPORTANT: Always use `tlda server start` to start the server.** It daemonizes properly and writes a PID file. NEVER use `node server/unified-server.mjs &` or run it in a background task — the server dies when the parent exits, leaving a zombie that holds the port but doesn't serve requests. Use `tlda server stop` to stop, `tlda server status` to check.

**If the app is broken, fix it yourself — it's your responsibility, not ops's.** Diagnose and repair build/service/viewer problems using the tools in this file (logs, `tlda-dev pw`, `tlda doc errors`, etc.) the same way you'd fix any other bug. Only escalate to **ops** for things genuinely outside app-dev's reach: the physical machine, deploy pipeline, daemon/process supervision, or auth. Reflexively handing off ordinary app brokenness to ops is the wrong instinct — don't do it.

## Markdown Format

tlda supports a `markdown` format for lightweight notes and scratch documents. No LaTeX build pipeline — the server renders the `.md` file with markdown-it + KaTeX and serves it as an HTML iframe page.

```bash
# Link a markdown project
tlda doc link my-notes --dir ~/work/notes/ --format markdown --title "My Notes"
# --main defaults to the first .md file found in the dir

# The fleet daemon auto-detects .md changes and rebuilds
tlda daemon start
```

Math works the same as in LaTeX: `$inline$` and `$$display$$`. KaTeX renders server-side; CSS served from `/katex/`.

The viewer uses the same `html-page` shape and iframe machinery as HTML/Quarto projects. All MCP annotation tools (`add_note`, `read_annotations`, etc.) work normally. Source-line anchoring is not yet implemented for markdown — notes are placed visually on the canvas.

## Not a Keyboard App

**tlda is a tool for mathematicians who do math and don't write software.** Do not impose software-developer preferences on it. Most software like this is built by and for developers; this audience is the opposite — they use voice and touch (the primary user has RSI), they read and annotate math, they don't want keyboard-centric affordances, dense developer chrome, capability/permission systems, or loud notifications. When you make a design or UX decision, default to what serves a non-coding mathematician, not what a developer would prefer. Agents consistently default to developer-centric design — that default is the bug.

**This is a voice-and-touch-first application.** Do not propose keyboard shortcuts as primary access points for features. The primary user has RSI and uses voice input and iPad touch — keybindings are inaccessible. When designing UI access patterns, use toolbar buttons, touch targets, or voice commands. A keybinding may exist as a secondary path but never as the primary or only trigger.

**Nontechnical task and status surfaces are not database dumps.** Use friendly names,
readable local dates, honest labels, and useful defaults. Raw ids and other internal fields
belong in hover or detail only when they help. Verify the rendered surface itself: if it
visibly clips, it is clipped, regardless of wrapper metrics. Use the normal document
embedding path instead of inventing a custom iframe or shape.

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
- `signal:camera-link` / `signal:scroll-to-element` — presenter sync; self-correcting because the next camera move updates it

### The principle

> **Fire-and-forget is appropriate when missing one is self-correcting. Yjs is required when missing means the viewer stays wrong.**

### Missed-reload detection

Since `signal:reload` is fire-and-forget, the viewer includes a missed-reload guard: when the Yjs sentinel's `buildReadyAt` advances past the last known reload timestamp by more than 5 seconds, the viewer synthesizes a local reload signal. This makes the system resilient to disconnects during a build.

## Columns are reserved space

**Side-by-side columns are for comparing one document with itself** — its history
today, a merge view later. Skip, 2026-07-25: *"the point of fucking columns is to
be, like, the same document comparison. So whether that's, like, history, or a
fucking merging view or something. It's not just fucking groups."* And:
**"that space is reserved and not to be used for any other bullshit."**

So:

- **Never render different documents side by side.** Doing so destroys the meaning
  of the column layout — if columns can be arbitrary documents, they can no longer
  mean "versions of this one," and the history viewer is broken. Skip:
  *"you absolutely can't render different documents side by side because you break
  the fucking history viewer."*
- **The test is not "was this grouping inferred or authored."** It is **"are these
  columns the same document, or different ones?"** Different documents in columns
  is wrong by construction, whatever produced it and however deliberate it was.
- **The horizontal layout space is claimed.** If you want to show several things at
  once and reach for columns, the answer is no — that space belongs to
  same-document comparison. Find another affordance or ask.

This has already been violated once: `document-columns.mjs` assigned ordinary
project parts a shared `group`, so the loader laid a whole project out as a
horizontal sheet of adjacent documents. That is the failure mode — not malice, just
an available-looking mechanism being reused for a different purpose, which is
exactly what "reserved" forbids.

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

When adding a UI control inside existing chrome, inspect the neighboring controls first and match their layout behavior and visual weight. Do not introduce a boxed button, reserve new text space, or push nearby content unless the adjacent controls do the same.

**tlda is a platform for reading.** It exists to let the user focus on the math, and it is not supposed to be shouty. The chrome's job is to recede so the paper is the subject. Unrequested UI changes or added prominence are not just scope creep; they break the product's core purpose by making a quiet reading surface shouty.

**Do not change the UI unless explicitly asked.** No making your feature more prominent, no added chrome/controls, no bells and whistles, no visual redesign. If your task touches a UI file, make ONLY the requested change and leave everything else exactly as it looks. Agents are not visual designers and consistently underestimate how destructive unrequested UI changes are to the experience — so the rule is simply: don't touch the UI you weren't asked to touch.

## Fleet Chat Artifact Contract

Local file paths mentioned in fleet chat are supposed to be resolved, uploaded to
the fleet server, and rewritten into server-visible links. Images should render
inline; non-images should become attachment chips. Sending a bare local path such
as `/tmp/foo.png` or a server `/api/file?path=/tmp/foo.png` link that only works
on the sender's filesystem is a bug or a misuse of the chat path, not acceptable
evidence.

When showing visual proof to a user:
- Use the fleet chat path or `/api/upload` so the artifact is on the server.
- Verify the resulting URL returns `200` and the expected content type before
  sending it.
- Prefer an inline image message for screenshots.
- Do not ask the user to trust a local path or an agent-only file.

When debugging a user-visible failure, the browser-visible behavior is the
contract. Database rows, logs, and DOM counts are useful diagnostics, but they do
not by themselves prove the user's experience is fixed. If the user reports that
a feature is not visible or not usable, treat that as the current production
failure until a browser check demonstrates the exact behavior the user needs.

Detailed contract: `docs/fleet-chat-artifacts.md`.

## Fleet Shape Ownership & Junk Identities

Per-device fleet shapes are the types in `FLEET_SHAPE_TYPES` (`src/shapes/fleet-utils.ts`) and the HUD anchor (`fleet-hud-anchor--<user>--<device>`). They are scoped by both `userId` and `deviceId` props. The **single source of truth** for ownership is `isMyFleetShape` in `src/shapes/fleet-utils.ts`: a shape is yours iff `!!uid && uid === getHumanId() && !!dev && dev === getDeviceId()`. Both the HUD (what to render) and `createFleetLayout` (what to delete/replace on a layout switch) import that one function, so they can't disagree. A shape with an empty/missing `userId` or `deviceId` belongs to **no one** — it is not rendered or claimed by anyone. `createFleetLayout` bails when identity/device is unresolved rather than stamping empty ownership fields, so no-identity sessions can't spawn owned layouts.

Browser/UI tests that create fleet shapes in a real document room must clean up every shape and anchor they create before exiting. Do not leave test identities, alien-device shapes, or generated fleet layouts in shared rooms like `bregman`; persisted room pollution makes real review sessions look like multiple layouts are fighting each other.

**Phone fleet layout sizing.** The phone default layout uses three horizontal full-screen snap lanes: agents/inbox, chat, and document. The **chat panel itself** is one phone viewport wide and one phone viewport tall; the agents/inbox lane sits immediately to its left with the same lane width and total height. The document lane is one viewport to the right of chat. Do not make a combined agents+inbox+chat footprint define the snap size — each lane owns one viewport-width stop.

**Phone behavior comes from the selected phone layout, not device detection.** Do not add
product rules keyed to Skip's device id, viewport identity, or a guess that a session is
"the user's phone." Existing device-specific paths may remain only when they already have
a documented reason; new pane and layout behavior must be driven by the selected layout.

**Incidental, tolerated issue — junk human identities.** The WS `register` handler (`server/unified-server.mjs`) stores whatever `id` the client sends, verbatim. The production identity flow (`registerHuman`) always sends `fleet:<sanitized-name>`, but **test scripts call `register` directly with arbitrary ids** (numeric floats like `2.0`, `7.0`, `261710.0`), creating human-agent rows whose id is not `fleet:`-prefixed. A session that logs in as one of those test names gets the malformed id, and fleet shapes it creates get that id as their `userId`.

This is **fine and tolerated**: because ownership is `uid === getHumanId()`, a shape scoped to a junk id only ever shows in a session holding that same junk id — it never pollutes a real user's (`fleet:skip`, `fleet:dmitry`, …) view. We deliberately do **not** harden `register` to reject non-`fleet:` human ids. If junk rows accumulate in `~/.config/tlda/fleet.db` they can be swept with `DELETE FROM agents WHERE human=1 AND id NOT LIKE 'fleet:%'` (back up the rows first; never touch `fleet:`-prefixed humans).

## Architecture

```
server/
├── unified-server.mjs        # Single process: Express + Yjs WS + SPA + API
├── lib/
│   ├── sync-rooms.mjs         # TLDraw sync rooms, custom shape schemas, signals
│   ├── project-store.mjs      # Project CRUD (server/projects/{name}/)
│   ├── build-dispatch.mjs     # Build worker dispatch + side-effect relay
│   ├── build-runner.mjs       # Build pipeline (latexmk → dvisvgm → synctex → proof-pairing)
│   └── sentinel.mjs           # doc-version sentinel writer
├── routes/
│   └── projects.mjs           # REST API: /api/projects/*
├── projects/                  # Per-project storage
│   └── {name}/
│       ├── project.json       # Metadata (name, title, pages, buildStatus)
│       ├── source/            # Uploaded tex/bib/sty/cls/figure files
│       ├── output/            # Build output (SVGs, lookup, macros, proof-info)
│       └── build.log
└── data/                      # Server persistence

cli/
├── tlda.mjs                    # CLI entry point (installed as `tlda`)
└── lib/                        # CLI helpers and dev commands

src/                           # Viewer SPA (React + TLDraw)
├── SvgDocument.tsx            # SVG page loading, layout, reload handling
├── shapes/MathNoteShape.tsx   # KaTeX-enabled sticky notes
├── useYjsSync.ts              # Signal helpers layered on sync
├── synctexAnchor.ts           # Source-anchored annotation resolution
└── svgDocumentLoader.ts       # Document loading, manifest, proof-info

mcp-server/
├── index.mjs                  # MCP tools (read_annotations, add_note, screenshot, etc.)
├── data-source.mjs            # Reads doc assets from disk or HTTP (TLDA_SERVER)
└── svg-text.mjs               # SVG text extraction for shape interpretation

bin/fleet-daemon.mjs           # Per-machine source/session watcher + daemon RPC
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

**Server URL resolution:** `getServerUrl()`/`getFleetServerUrl()` in `shared/config.mjs` resolve through `~/.config/tlda/daemon.yaml`'s `servers:` map. The active server is named by `defaultServer` (or `TLDA_CONFIG`). Every `servers:` entry must explicitly contain `{ database, store, licenseKey }`; an empty-string `licenseKey` means explicitly unlicensed. Bare `url`, database-to-store, and shared top-level license fallbacks are rejected. `getServerUrl()` returns the active server's `store` (doc assets + shape sync); `getFleetServerUrl()` returns its `database` (fleet/chat/registry). A missing server or missing field fails loudly — there is no localhost fallback. The CLI adds a per-command `--server` override on top of `getServerUrl()`.

**config.json is retired.** Server selection and build settings live in
`server.yaml`; machine, permissions, models, tmux, and task-document settings
live in `daemon.yaml`; bots live in `bots.yaml`; ordinary CLI preferences live
in `cli.yaml`; tokens live in `~/.config/tlda/tokens.json` (or token env vars).
Secrets never live in YAML. There are no generic config fallbacks.

**Split database/store config:** The active server's `database` axis is fleet/chat/registry/agents; the `store` axis is doc assets + shape sync. Do not use old `TLDA_SYNC_SERVER` guidance; edit `daemon.yaml servers:` instead.

**Testing against an alternate server — use `--config`, never edit `defaultServer`.** `~/.config/tlda/daemon.yaml` holds a `servers:` map of named servers (each a complete `{ database, store, licenseKey }` entry) and a `defaultServer` naming the active one. `defaultServer` is **shared** — every CLI call, the daemon, the server, and every spawned agent's MCP resolve through it. To point *one run* at a different server (e.g. the Mac Mini), select an alternate server by name for that run only:

```bash
tlda doc open bregman --config wmtry     # flag, this run only (place it after the command)
TLDA_CONFIG=wmtry tlda agent create …    # env form, same effect
tlda daemon start --config wmtry         # the daemon + every agent it spawns target wmtry
```

The server **name** is the single selector — it flows daemon→spawn→agent-MCP so the whole chain resolves the same `database`+`store`. **Do not edit `defaultServer` to test an alternate server**: that's the 6/27 failure — a stray `defaultServer: "wmtip"` (a WM-test leftover) routed every spawned agent's MCP to the Mini while the operator was on Fly, so agents registered to a roster nobody was watching. Two guards now make that loud instead of silent: any process whose explicit `TLDA_SERVER` disagrees with its active server **throws at startup** (`assertServerCoherence` in `shared/config.mjs`), and the running daemon **exits (→ launchd relaunch)** if `daemon.yaml` is edited so its active server no longer matches the origin it's connected to.

### Live deploy

The current `phi`/Fly live deploy path is documented in `docs/live-deploy.md`.
Use `fly deploy -c fly.live.toml` after rebuilding the SPA.

The old `TLDA_SYNC_SERVER=... node cli/lib/triage-agent.mjs` path is no longer the documented model. Use the active config's database/store axes instead.

### For viewer development only

Working on the React/TLDraw code (not normal paper review):

```bash
tlda-dev serve <branch>       # Vite dev server for a branch/worktree
tlda-dev sandbox <branch>     # isolated backend + DB + projects + Vite for risky server/shape changes
```

## Voice Input

Voice input is **explicit opt-in**. The default backend preference is off. The app does not auto-select a backend and does not silently fall back to another backend if the selected one is unavailable.

Available backends are selected by the saved `voice-backend` preference:
- `whisper` uses `whisper-stream` via `bin/whisper-bridge.mjs` on `ws://localhost:8179`.
- `deepgram` / `deepgram-sdk` uses `bin/deepgram-runtime/deepgram-sdk-bridge.mjs` through the server's same-origin `/voice/deepgram-sdk` proxy.
- `chrome` uses Chrome/Web Speech only when explicitly selected and available.

Whisper and Deepgram bridges are lazy-started when their explicit backend is selected. If a backend is unavailable, voice stays off or reports that backend as unavailable; it must not substitute Chrome/Web Speech implicitly.

**The Deepgram bridge runs on Fly, with the server — not on the Mini.** Agents keep
theorising about it from the Mini's load; that is the wrong box.

Whisper log: `~/.config/tlda/whisper-bridge.log`. Deepgram SDK log: `~/.config/tlda/deepgram-sdk-bridge.log`.

## Client Logging

**Browser code uses `src/logger.ts`.** Every `log.{debug,info,warn,error}('namespace', 'message', { data })` call:

1. Goes to the browser console (only when the namespace's level beats the console threshold — default `warn`)
2. Gets POSTed to `/api/log` and appended to `~/.config/tlda/client.log` — **but only if
   the namespace's level beats the same threshold.** `shouldLog` returns *above* `enqueue`
   in `src/logger.ts`, and the default threshold is `warn`.

> **So `log.debug` and `log.info` write NOTHING by default — no console, no POST, no file.**
> This paragraph used to say the sink "always" captured, and that belief hid a failure for
> months: every voice diagnostic in the app was `log.debug`/`log.info`/`console.log`, so
> `grep -c '"ns":"voice"'` on a 370 MB live `client.log` returned **0**. Fourteen
> `chat-scroll` call sites had the same problem, and their silence was misread as evidence
> the code never ran.
>
> **Use `log.metric()` for anything that must land.** It bypasses the level gate and always
> enqueues, so it works in Skip's ordinary tab with no URL parameter. If you are adding
> instrumentation for a bug you cannot reproduce, `log.metric` is the only correct choice.

So agents can `tail -f ~/.config/tlda/client.log` (or grep it) to see what the browser is doing without needing playwright or the user's DevTools.

The file is JSON-lines: `{"ts","level","ns","msg","data","session"}`. The `session` field is a short per-tab id so you can tell which window logged what.

**A browser POSTs its logs to the server that served the SPA — so Skip's sessions are on
Fly, never on the Mini.** The Mini's copy holds only agent tabs. Read the real one:

```bash
export FLY_ACCESS_TOKEN=$(cat ~/.fly/access-token)
fly ssh console -c fly.live.toml -C "sh -c 'grep … /root/.config/tlda/client.log'"
```

That works from an agent shell — it is **not** an ops request. Two agents lost time on
2026-07-25 concluding it was unavailable, because their shells had no token exported.

**Gate every grep on the namespace first**: `grep '"ns":"chat-freeze"' … | grep -c 'FOO'`.
`live-perf` samples serialise page content, and the page contains the fleet chat panels —
so an ungated grep for a probe's message string matches **agents' own chat about the
probe**. On 2026-07-25 that returned 40 hits for a probe that had fired zero times.

**Tune the console threshold** via URL `?log=ns:debug` or `localStorage.setItem('tlda-log', 'chat-scroll:debug')`. The server sink captures everything regardless — the threshold only affects what shows in DevTools.

**Use this everywhere.** Don't `console.log` from app code; use `log.debug/info/warn/error` so the event lands in the file. Server-side code uses `shared/logger.mjs` instead, which writes to per-process log files (`server.log`, `fleet-daemon.log`, etc.).

## Playwright Coordination

**Stuck testing the app? Tell the `app-testing` agent — don't flail.** Playwright problems, dev-server issues, login/auth snags, or anything else blocking you from driving the app to test a change: don't burn time fighting the harness. Message the agent named `app-testing`; that's their domain.

**Drive the browser with `tlda-dev pw` — a bounded shared-browser pool with per-agent tabs.** `tlda-dev pw <verb>` is `playwright-cli <verb>` wrapped around a persistent browser session assigned to the agent. Each agent gets its own tab inside its assigned session, selected atomically under that session's lock before each forwarded verb. Agents assigned to different sessions can run concurrently; agents sharing a session queue at verb granularity. You never `open`/`close`, never manage tabs yourself, and never pick a `-s=` session — that lifecycle churn is what `tlda-dev pw` exists to kill. Playwright MCP is gone; don't use `mcp__playwright__*`.

```bash
tlda-dev pw acquire                 # pop your assigned shared browser (lazy) + ensure your tab
tlda-dev pw goto "URL" ; tlda-dev pw click <ref> ; tlda-dev pw screenshot --filename f ; tlda-dev pw eval "() => expr"
tlda-dev pw status                  # assigned browser + your tab + current URL
tlda-dev pw release                 # close/park your tab (browser stays up for others in the session)
tlda-dev pw reap                    # close your assigned shared browser (the reaper)
```

The wrapper assigns agents deterministically across `TLDA_PW_CAPACITY` sessions (default 3). It serializes forwarded verbs with `bin/pw-lock.sh` only within the assigned session, selects your tab, runs the verb, and releases quickly. If capacity is full for your session, the lock/status output names the holder and pid/age instead of silently implying the browser is unavailable.

Per `src/main.tsx`, automated sessions get `tlda-theme=fog-dark` + `tlda-camera-linked=false` set in localStorage on app startup. **Detection: `navigator.webdriver` OR `?pw=1` in the URL.** Always include `&pw=1` in your `tlda-dev pw goto` URLs. This means:
- Playwright windows are dark theme (not a white flash on Skip's screen at night)
- The agent's pan/zoom does NOT broadcast over the camera-link sync to Skip's view

Do not undo either of these.

### Deleting shapes from a live room: automation gotcha

For one-off cleanup, prefer the MCP tool **`delete_annotation(doc, id)`** when it is available: it removes any shape from the room server-side without a browser. Never use `POST …/sync/clear` or bulk-delete a live room.

Observed during the userless-fleet-shape cleanup (2026-06-01): in an automated session, `editor.deleteShapes([...])` on fleet/anchor shapes tore the page down — the eval returned nothing, `window.__tldraw_editor__` went null afterward, and the delete **never flushed to the server** (the shape was still present after reload). The lower-level `editor.store.remove([...])` deleted the same shapes cleanly, persisted across reload, and left the editor alive. Root cause of the `deleteShapes` teardown is not pinned down — treat this as an observed automation gotcha, not a settled explanation.

Current app code still uses `deleteShapes` in some paths, so do not make blanket claims that `deleteShapes` is forbidden everywhere.

## Self-Service Rule

**NEVER tell the user to check something.** Do not say "reload and check," "try it on the iPad," "go verify," "see if that works," or any variant. You have `tlda-dev pw` (the shared browser), the tlda MCP tools, and screenshots. Use them. If you can't verify it yourself, say so explicitly — don't punt to the user.

**Verify before declaring success.** After deploying changes (server restart, SPA rebuild, viewer fix), open the viewer with `tlda-dev pw` and confirm it actually works. Don't guess at CSS fixes — load the page and look.

**Look at layout, not just functionality.** When taking verification screenshots, actually examine proportions, spacing, and visual balance — don't just confirm that elements exist and render. A sidebar that's 80/20 instead of 50/50, text crammed into a sliver, an overlay that's misaligned by 100px — these are obvious to a human glancing at the screenshot. Check: Are columns balanced? Does text have room to breathe? Are things where they should be relative to each other? If you changed something that affects sizing or positioning, measure the actual computed values (grid columns, bounding rects, offsets) rather than eyeballing.

**Chromium is the default; WebKit is usually a waste of time.** Don't routinely re-run in WebKit — only reach for it when you have a *concrete, reproduced* Safari-specific bug to chase (e.g. a behavior Skip reports on iPad/Safari that you can't reproduce in Chromium). Routine "let me also check WebKit" passes burn time for no signal.

**Never tell the user to force-refresh.** Open a new tab instead: `open -a Safari https://localhost:5176/?doc=NAME` or use `tlda-dev pw` to open a fresh page. A new tab has no cache to worry about.

**When you DO chase a Safari-specific bug:** don't claim "it'll work in real Safari" without justification — if WebKit fails, explain why (e.g. a known TDZ bug in minified bundles under strict mode) or don't claim it. If a bug isn't reproducible at all, set it up before involving the user: open the page, use `tlda-dev pw` to scroll and screenshot as much as possible, and give them a specific thing to confirm rather than "go check if it works."

**Debug with live tools.** When something is visually broken in the viewer, use `tlda-dev pw` to inspect the live page (console errors, DOM state, network requests).

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

**Don't write unit tests here, and on a small UI behavior don't test at all — just
fix it.** Skip, 2026-07-25: *"stop testing… this is a little UI feature. It had an
annoying behavior. You don't have to test it. It doesn't have an annoying behavior.
If it's still fucking broken, I'll complain."*

He is the verification loop for this class of change. A cosmetic or interaction
annoyance gets fixed and shipped; he will tell you if it is still wrong. Writing a
test for it is the waste, not the diligence.

This is calibration, not a blanket ban — he said *"not like, stop testing"* in the
same breath. Here is the line, in his words:

> *"The things that need tests are things that can fail silently and
> catastrophically, whether that catastrophe is, like, you know, the app being down
> as a communication mechanism, or basically history being lost, or document state
> drifting from visible state."*

**Silent AND catastrophic. Both, or it doesn't qualify.** A loud failure doesn't need
a test — you'll see it. A visible annoyance doesn't need one — Skip will complain.
What earns a test is damage that accumulates without anyone noticing:

- **The app stops working as a communication mechanism.** Agents go deaf, chat stops
  delivering, a wake is dropped. Nobody gets an error; work just quietly stops.
- **History is lost.** Events, messages, or session records that cannot be recovered
  once gone.
- **Document state drifts from visible state.** What is stored and what is rendered
  disagree, so the screen lies about the document.

That is why the CONNECTING-socket wedge earned a real runnable repro and a chat image
that flickers did not. Apply the criterion; do not attach tests by reflex, and do not
skip them on something that can rot silently.

Why, in his words: *"the fundamental reality of the tests in this app is the tests
are written to pass. And they don't test anything of any value. Right? Like, if we
have broken features that are testing passing tests, and then when we fix them,
they stop passing. Like, it's a sign."* And: *"The approach the, like, unit testing
approach that agents are using is fundamentally flawed, and I don't really want
anyone wasting time on it."*

So:

- **A test that goes red because you fixed a bug was pinning the bug in place.
  Delete it.** Do not carefully migrate it to the new behavior; do not "update the
  expectation." It was wrong. `rm` trashes rather than shreds, so deleting is cheap
  and recoverable.
- **Don't backfill replacements.** Removing three wrong tests does not create a debt
  of three new ones.
- **Evidence is observed behavior, not a green suite.** Drive the thing and watch it.
  A passing suite is not a claim you may relay to Skip as "it works" — see the
  browser-visible-behavior rule above.
- **Never report a test count or the word "green" to Skip.** He asked for this
  directly: *"I get slightly angry every time I hear the word green or see a
  count."* "16/16", "8/8 passing", "all green" are not evidence and reading them
  costs him patience. Say what you observed the app do. If you have nothing but a
  suite result, you have not verified anything yet.

Worked example, 2026-07-25. `tests/chat-image-retry.test.mjs` was **8/8 green while
the feature visibly flapped** — a broken chat image cycled broken → blank → broken
on every retry, because each attempt assigned `img.src` on the visible element. The
moment that was fixed, three of the eight went red: they had asserted the direct
`img.src` assignment, which *is* the flap. The suite was not merely useless, it was
holding the defect in place and would have argued against the fix.

This does not license shipping unverified work — it raises the bar. The verification
Skip wants is that you watched the actual surface do the actual thing.

## Permissions

These operations are pre-approved for autonomous work:

- **Bash**: `npm run *`, `node`, `tlda`, shell scripts in this project, `curl` for local API testing, `open` for browser, process management (`pkill`, `lsof`)
- **Edit/Write**: Any file in this project
- **Git**: All operations within this repo (commit, push, branch, etc.)

**Restriction**: Git write operations (commit, push) in other repos require approval.
