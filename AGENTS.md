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
- [Hosting tlda](docs/hosting.md) covers serving and network boundaries.
- [Fly deployment](docs/live-deploy.md) is the live release runbook.
- [Permissions implementation contract](docs/permissions-implementation-contract.md)
  defines internal grant resolution and persistence.
- [Fleet chat artifact contract](docs/fleet-chat-artifacts.md) defines shared
  file materialization and rendering.

Exact CLI and MCP arguments come from `tlda --help` and the running MCP schemas.
Do not duplicate evolving call signatures here.
