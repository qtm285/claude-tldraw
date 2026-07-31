# tlda developer guidance

tlda is a collaborative paper-reading and annotation system. It renders
versioned LaTeX and Markdown documents on a tldraw canvas, keeps annotations
anchored to source, and gives people and agents the same project, chat, search,
history, and source-editing surfaces.

This file contains repository-specific contribution rules. Product and system
facts belong in the documentation linked below. Personal workflow preferences,
machine-specific operations, incident history, and old implementation plans do
not belong here.

## Work on the requested behavior

- Make the smallest change that satisfies the current request.
- Preserve unrelated work in a dirty checkout.
- Do not introduce new defaults, routing, onboarding, layout, synchronization,
  or visibility behavior as a side effect.
- Read the full current path before editing it. A surprising function is
  evidence that more of the system remains to be read, not evidence that the
  shipped behavior is wrong.
- Comments and historical tests describe prior implementations. They are not
  product authority.
- Prefer deleting an unnecessary path to adding validation, reconciliation,
  retries, caches, or compatibility around it.
- This project does not preserve deprecated aliases or compatibility shims
  unless a current requirement explicitly needs them.

## Check ambiguity before and after

Most rejected work here was not built carelessly. It was built after an agent
resolved an unspecified point by deciding, then verified the result against its
own decision. The result matches the decision, so looking at it proves nothing.

**Before implementing.** List the points the request does not settle. For each
one, search the requester's own prior messages before asking — these features
have usually been specified already, more than once, and re-asking is its own
failure. If a point is genuinely unsettled, stop and ask. An unspecified point
is a stop, not a judgement call.

**After implementing.** Check the result against the requester's words, quoted,
not against what you set out to build. "Did my change take effect" and "is this
what was asked for" produce the same evidence and only the second is the work.
Ask what else the change did: a filter removed also reveals what it was hiding.

Do not hand back work that visibly fails the request and ask for a check. A
review is for a judgement call that is genuinely the requester's, not for
finding defects the author could have found.

## Verify the relevant surface

The user-visible surface is authoritative for user-visible behavior. Builds,
tests, logs, database rows, and source inspection are diagnostics.

- Verify a CLI change with the real command.
- Verify a document change on the relevant rendered document.
- Verify a UI change in the real application environment on a document that is
  not in active use.
- Use `tlda-dev pw` only when browser interaction is required. Do not serve a
  substitute sandbox and report it as the application.
- When supported automation cannot exercise the behavior, state the exact
  missing proof rather than manufacturing a proxy.
- Typecheck the solution with `tsc -b --force`; the root `tsconfig.json` does
  not typecheck its references through `tsc -p`.
- Inspect the bundle named by `dist/index.html` when checking shipped frontend
  code. Other bundles and source maps are not proof of what the browser loads.

Tests are appropriate for failures that can be both silent and destructive,
such as lost history, dropped communication, or stored document state diverging
from visible state. A passing suite does not replace direct verification.

## Product invariants

The product and authority model is documented in
[Current architecture](docs/current-main-architecture.md). When changing it:

- Preserve voice and pointer parity; primary controls must work without a
  keyboard.
- Keep the document visually primary. Do not add prominence or controls that
  were not requested.
- Preserve the same interaction and layout rules at narrow and wide viewport
  sizes rather than adding a separate phone mode.
- Retain the document and version carried by references, chat, search, history,
  and source editing.
- Keep routine infrastructure delivery out of ordinary conversation. Surface
  failures that change what a participant can expect.

## Implementation invariants

### Use tldraw-native state and interaction

- One custom shape is one visual unit. Put its state in shape props rather than
  coordinating hidden shapes or metadata.
- Use tldraw's event helpers and selection model instead of bypassing its
  capture-phase interaction system.
- Register every custom shape on both sides: the client shape utility under
  `src/shapes/` and the matching schema in `server/lib/sync-rooms.mjs`.
- Client props and server schema fields must match exactly.
- Match the layout and visual weight of neighboring controls before adding one.

### Preserve authority boundaries

- Put reconnect-safe document state in Yjs. Use transient signals only when a
  missed signal is self-correcting.
- Route machine-local files, terminals, and sessions through the owning daemon.
  A missing route fails rather than falling back to a server-local path.
- Run at most one daemon for a named environment on one machine.
- Keep local-checkout and browser edits on the revision-checked source
  transaction boundary. Preserve the separate Git fetch/push semantics of linked
  remotes.

### Names and labels are one namespace

A friendly name is a label with a unique living occupant. That is the only
difference between them: both are strings an agent answers to, and the
uniqueness constraint over living agents applies to names alone.

- **Uniqueness is a database constraint** — a partial unique index, which is how
  "one living agent per name" is expressible at all:

  ```sql
  CREATE UNIQUE INDEX idx_agents_live_name
  ON agents(friendly_name) WHERE dead = 0 AND friendly_name IS NOT NULL
  ```

  A second living holder of a name is unrepresentable. Do not add a code check
  beside it; a parallel check drifts and the index is the one that wins.
- **The index covers names against names only.** A label is a string inside the
  row's `labels` JSON array rather than a row of its own, so no index or CHECK
  can see it. Label-against-living-name is therefore enforced in code, in
  `checkNameAvailable`, and only there. Expressing it as a constraint means
  materialising the namespace as its own table — one row per name and per label,
  with a partial unique index over living name rows.
- **It is an error to set an invalid label**, rejected at write and loudly. A
  label that cannot be addressed must not become a filter that quietly matches
  nothing. `checkNameAvailable` is that gate — unavailable-to-you has one gate
  and one error shape, whether the reason is an unaddressable string, a reserved
  routing label (`here`, `away`, `awake`, `hibernating`, `dead`, `human`), or a
  name a living agent already occupies. Add a reason there rather than a path
  beside it. The response is identical programmatically; the **message names
  which of the three it is**, because the next action differs — hyphenate the
  string, choose a non-reserved word, or message the agent holding the name.
- **Addressability is the filter grammar's rule**, not a matter of taste: a
  token is a maximal run of characters that are not whitespace or `& | ! ( )`.
  A string containing one of those still stores, then returns zero matches with
  no error from `roster`, `chat(to:)`, `thread`, and `search`, while a panel
  filter keeps matching because it hands the leaf straight to the evaluator. Do
  not impose a stricter charset because it looks tidier.
- **Known gap, deliberate:** NBSP (U+00A0) and U+2028 are unaddressable — the
  tokenizer splits on JS `/\s/`, which matches them — but a SQL `GLOB` class
  covers only ASCII whitespace. Enumerating unicode whitespace in a constraint
  is ugly enough to be mis-edited later, and an ugly constraint that gets broken
  is worse than a plain one with a written-down gap. This is the gap.

Label membership is **lexical**: a filter over history asks who held the label
at each event's timestamp, joining `label_history` spans, while live delivery
recomputes membership per event. That asymmetry is deliberate and it is the more
expensive thing to build. Making history read current membership would be
dynamic scope, and the same query would return different history depending on
when it ran. `delegate`'s `mint.labels` exists so a label can be set before the
agent's first tool call, which is what puts its whole backlog inside the span.

### The authorization gate is a fence, not a wall

The authorization gate exists so an agent does not casually change something it
has no business changing. It is a small friction. Authority over the target, or
contact with it, is enough to pass. It is not a security boundary and must not
be built into one.

The rules, in order of how often they are broken:

- **Do not gate reads.** Not leniently — not at all. Any agent may read any
  agent's subscriptions, tasks, inbox, or panes.
- **Do not add a gate to make something safer.** Tightening one is a product
  change, not a cleanup, and it needs to be asked for.
- **Do not duplicate a gate across layers.** The fence belongs in the MCP layer,
  because that is where agents act. A copy in an HTTP route or WS handler is not
  defence in depth; defence in depth is a security posture and this is not
  security. Delete the copy.
- **Do not make a gate enforceable.** Gates resolve the caller from a
  client-supplied field such as `msg.caller`, while the socket carries a real
  identity at `ws._tldaAgentId` that the gate never reads. Any agent passes by
  naming the delegator. This is a fact about what these gates are, not a bug to
  fix. Wiring them to the socket identity would convert a coordination guard
  into the wall this section forbids.

Security lives at the network layer — bearer tokens and the tailnet, in
`server/lib/auth.mjs`. That is what protects Skip's data from the outside world,
and it is a different mechanism with different rules. So is the filesystem
permission-profile system in
[Permissions implementation contract](docs/permissions-implementation-contract.md).
Neither is in scope when this section says "gate".

This is original intent that drifted, not a new policy. The code already says
so, at `server/lib/task-lifecycle.mjs`:

> Coordination guard, not a security boundary. Active temporary delegation
> markers intentionally grant manager cleanup authority.

and at `mcp-server/fleet-tools.mjs`, in `requireManager()`:

> `return null; // No permission gating — any agent can do anything`

**The shape of the system, in one example.** An agent may `kill-session`,
`send-key`, `mark-dead`, `rename`, and `retract` another agent with no gate at
all — while the gate that prompted this section stopped it from *listing* that
agent's subscriptions. If you are about to add a gate, check which end of that
sentence you are working on.

#### The marker pattern

An agent that does not start with authority over something obtains it by citing
the authorization. This is the friction, and it is why the gate is not a lock —
the way through is documented and reachable by any agent.

- **Declare it.** An agent cannot hand work to, or give instructions to, an
  agent working on something unrelated — unless that agent messaged it in the
  last day, which counts as being in contact. To go anyway, it says so in the
  message: it writes `cross-lane-ok:` and states who authorized it. Nothing
  verifies that claim, and nothing is meant to. Having to stop and name the
  authorization is the entire mechanism. In code this is `crossLaneBlock` in
  `shared/task-role-routing.mjs`, and the refusal text teaches the marker at
  the moment it refuses.
- **Cite it.** To close a task that was marked as needing Skip's approval, an
  agent passes the ID of the message where he approved it. This one is checked:
  the event is looked up and its sender confirmed human. In code, `approval_id`.

Follow this pattern when a new action needs a fence. Do not invent a second
mechanism beside it, and do not replace a marker with a permission check.

#### Limits that are not gates

Some checks look like authorization and are not. They stay, and removing them in
the name of this section is a regression:

- Event-loop protection — the 100-task cap on `POST /api/tasks/retire`; 500 was
  measured at ~350ms of synchronous SQLite blocking the loop.
- Query-cost caps — `store-agents-by-ids` at 20, the `my-task` limits, the
  `subscribe-filter` window.
- Expensive-query avoidance — the label short-circuit in
  `server/lib/fleet-store.mjs`, measured at ~230ms per event over ~1300 agents.
- Fail-closed query semantics — an unmatched name in `fleet-search` yields an
  impossible id, so a typo returns nothing rather than the whole corpus.
- Path containment, cross-environment daemon isolation, and the daemon's
  `validateTmuxOwner` pane-ownership check, which enforces because the daemon
  owns its ledger rather than trusting a message field.

The test: a gate asks *who is calling*. These ask *how expensive is this*, *which
file is it*, or *which machine owns it*.

## Repository workflow

- Temporary plans and reports belong under `scratch/`, not in the repository
  root or durable documentation.
- Feature work belongs in its assigned worktree. Do not move or stash another
  contributor's changes to make a checkout clean.
- Do not deploy a branch or worktree. Live deployments use committed `main`
  through the documented wrapper.
- Use `tlda server start`, `tlda server stop`, and `tlda server status` for a
  local server. Do not background `server/unified-server.mjs` directly.
- Do not use `tlda build` to bypass source-change detection.

## Documentation boundaries

- [Using tlda](docs/using-tlda.md) is the user reference, including project
  linking, Markdown, agents, permissions, and local configuration.
- [Current architecture](docs/current-main-architecture.md) describes the
  running system and authority boundaries.
- [Identity and labeling](docs/identity-and-labeling.md) describes the one
  namespace of names and labels, which history tables are folds over events and
  which are the record, and where the namespace rule is enforced. Read it before
  changing anything about names, labels, runtime status, or the three history
  tables.
- [Hosting tlda](docs/hosting.md) covers serving and network boundaries.
- [Fly deployment](docs/live-deploy.md) is the live release runbook.
- [Permissions implementation contract](docs/permissions-implementation-contract.md)
  defines internal grant resolution and persistence.
- [Fleet chat artifact contract](docs/fleet-chat-artifacts.md) defines shared
  file materialization and rendering.

Exact CLI and MCP arguments come from `tlda --help` and the running MCP schemas.
Do not duplicate evolving call signatures here.
