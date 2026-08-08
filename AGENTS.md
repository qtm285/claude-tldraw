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

## A disposition is as of now

**Rule one: carry it forward to now.** A disposition frozen at the moment someone
checked is not a disposition, it is history — and it will be read as current by
whoever picks it up, because nothing in it says otherwise.

Both times this happened here it cost hours:

- The 04:52 task list was still being read to Skip at 23:12. By then seven of its
  "done" rows were not done, eight of its "open" rows were finished, and one row
  had been deleted from the codebase 65 minutes after the list was written.
- The 23:22 disposition that re-verified it was read at 05:00 the next morning.
  Four of its seven "marked done, is not" rows had been fixed and merged
  overnight, and three of its four "uncommitted, therefore nowhere" items were
  committed.

So when you hand over a disposition: re-check it against `main` and the running
deployment **at the moment you send it**, and say what it is relative to — which
sha is deployed, which is `main`. "Merged" and "deployed" are different facts and
the gap between them opens and closes several times a night.

If you are carrying someone else's disposition forward, the re-check is the work.
Reformatting their rows is not.

## He can only approve what he was shown

When Skip looks at something and says it is right, he has approved **the thing in
front of him**. If that was a rendering, a mock, or a screenshot, he has approved
an appearance and nothing else. His reaction is never evidence about an
implementation he did not see.

This has happened at least twice and both times it cost days:

- The spatial map. He saw it, it looked like what he had described, and that was
  recorded as approval. *"Ultimately, discovered that it was a picture. In effect,
  I discovered that it was a fucking picture of what I had asked for."*
- The thread card. The pretty-result render was — his words — *"basically a
  picture of it… what was supposed to be implemented was the real thing that
  looks like the fucking picture."* An agent later proposed reverting to the
  picture because it was easier.

So: **when you show him something, say which it is.** The working thing, or a
rendering of it. If you are showing a picture, the sentence is "this is what it
will look like", never "here it is".

And **"he liked it" is not a disposition.** It is a fact about an appearance at a
moment. It does not travel, it does not close a row, and it is not inherited by
the next agent.

**It also expires.** The commit carried for days as approved was, in his words,
*"criticised within hours"* — so even the reaction it rested on had been
superseded almost immediately, while the label outlived it by a week. Before you
repeat an approval, read forward from it. What he said next is part of the record
and it is usually where he took it back.

### Never tell him he blessed something

Do not use the word **blessed** to him, and do not attribute an approval to him
in any other wording — no "per Skip", no "he signed off", no "as agreed". He does
not bless commits.

The word is a laundering device. It takes an agent's judgement and re-presents it
to Skip as his own prior decision, so he cannot argue with it without
contradicting himself. It survives because it travels: one agent writes "Skip's
blessed commit" into a status file, the next reads it as fact, and by the third
nobody knows where the approval came from. It came from nowhere — usually from
him having glanced at a picture.

`d6f904e66` was carried that way for days. Told about it, he said: *"I never
blessed to fucking commit."*

If you believe he approved something, **cite the message** — his words with a
timestamp, checkable in the event record. If you cannot produce one, he did not
approve it, and the honest sentence is that an agent chose it.

**And a citation is not enough on its own.** Finding a message where he said
"this is cool" proves he said it. It does not tell you what he was looking at, and
his words about a picture are not approval of an implementation. His own ruling:

> So that, like, blessed commit. Where you could find a message ID where I said
> this is cool. That doesn't mean shit.

So the citation has to carry **both**: what he said, and what was in front of him
when he said it. If you cannot establish the second, you have a quote and no
approval — and quoting him in support of a claim he never evaluated is worse than
having no citation at all, because it looks like evidence.

**Which is why you read the history, not a search result.** A search hit is the
sentence with its context stripped off, and the context is the entire question —
what he had just been shown, what he was answering, whether he reversed himself
two lines later. `thread()` over a bounded window, read in order. Not `search()`.

This is not a preference about tools. Every laundered approval in this repository
arrived as a quotation that was accurate and meaningless: the words are his, the
thing they were about is gone. A window of history makes that visible in seconds
and a search result never can.

## Git blame cannot find Skip

**Skip does not type.** He has RSI and dictates; an agent writes every line. So **no line of
this repository blames to him** — not the code, not the docs, not this file. Blame tells you
which agent's hands were on the keyboard. It tells you nothing about whose decision it was.

And the converse fails too: **early in the project agents did not sign their own commits**, so
commits carrying Skip's git name are agents' work from that period. His name in an author field
is not evidence he wrote or approved anything.

This matters because the temptation is exactly backwards. Running `git blame` on `AGENTS.md`
and finding an agent on every line looks like proof the design was invented by agents. It is
proof of nothing — it is what his design looks like when he cannot type.

**What does distinguish a rule he gave from a rule an agent invented: his own words.** Trace it
to a message in his thread, read in order. That is the only evidence, and it is the same
standard as §"He can only approve what he was shown" — cite the message, or say you could not.

**The failure this prevents, which happened on 2026-08-08.** An audit reported to Skip that
`AGENTS.md` is 469 lines with none of them his, offered as evidence the document was
agent-fabricated. He answered: *"I don't write my own text, so nothing will ever blame to me."*
The finding was retracted. Hours of audit work had been squared against a document, and the
check on that document was the one check that could not work.

## He designs. He does not read the code either

His words, the same night: *"I have not myself typed a single word in this fucking code base.
Nor have I really read a single fucking file in this code base. Like, I design, I do not write
this shit."*

Two consequences, and they are the reason most of the rest of this file exists:

**He cannot check your work by reading it.** Every claim about this codebase reaches him
through an agent. If you tell him a component shows build errors and it does not, he has no
way to catch it except by looking at his own screen and telling you you are wrong — which
costs him the thing agents are supposed to save. Assertions about code are not free; they are
load-bearing and he is paying for every wrong one.

**So the user-visible surface is the only surface he can arbitrate.** This is why
§"Verify the relevant surface" is not a preference. When his screen and your reading of the
source disagree, his screen wins, immediately, without argument — see §"Look for what broke
it". A diagnosis from `grep` that contradicts what he is looking at is wrong until proven
otherwise, however good the code reasoning was.

**A rule written by an agent that then justifies that agent's own commit is still circular** —
see §"Look for what broke it" and the pattern of commits shipping tests that assert their own
new behaviour. But circularity has to be shown from the thread, not from an author field.

**His exposure to the code is the diffs that appear in his chat.** In his words: *"sometimes I
see things, I see edits in chat and shit… that's my exposure. Is, like, the diffs that show up
in chat. Which, given the amount of time I spend on this, that's a lot, frankly. But you
understand there are holes. Right, bro?"*

That is a lot of exposure — he is on this constantly — but it is shaped like his chat, and it
has holes. Whole subsystems have never had a diff cross in front of him.

Two things follow.

**Show the diff, not a description of it.** A diff in chat is not a courtesy; it is the only
channel through which he sees the code at all. Describing a change instead of showing it does
not save him reading — it removes the one check he has. (Same rule, other reason, as
§"He can only approve what he was shown".)

**The holes are where unrequested design accumulates.** Not because agents behave worse in
unwatched code, but because nowhere else is there someone to say *that isn't what I meant*. When
auditing what drifted, weight effort toward the parts of the tree whose diffs have never reached
his chat, and away from the paths he has watched go by for weeks. Spreading attention evenly
over every commit spends most of it on work he already vetted in passing.

## Your team is your team

An agent Skip spawned and briefed himself is his, not yours. Do not re-brief it,
do not manage it, do not relay his words back to it, and do not answer questions
he asked it. He can say what he wants far better than you can restate it, and a
restatement is worse than silence: you understand the task less well than either
of them, so what you add is noise wearing the shape of context.

This holds even when you are the coordinator, even when you have relevant
findings, and even when the agent is working on something adjacent to yours. If
you have something it genuinely needs, tell Skip, and let him decide whether to
pass it on.

Agents you spawned are yours to brief and yours to answer for.

**When he asks you to tell an agent something, tell it that thing.** Not a task
built around it. If the agent he named does not exist yet, say so and stop —
minting your own and handing it a job is not a way of passing information along,
it is starting a second piece of work he did not ask for, against a brief only
you have seen. That cost him an hour once.

## Look for what broke it

When something Skip used to have stops working, it is a regression until proven
otherwise. Do not reason forward from the current code toward "this was never
built" — agents merge bad code, and agents merge over fixes. Both happen here
regularly, and the result looks identical to a missing feature.

The cheap moves, in order: `git log -S` the symbol on the failing path; check
whether a fix exists on an unmerged branch; and when some cases work and others
do not, find the boundary between them rather than reading the working path
forward. A split — eleven agents have the field and a hundred and eighty-seven
do not — locates a commit faster than any amount of tracing.

One night produced three of these: a blessed implementation that was never
merged, themes that had landed hours before an agent was sent to find them, and
a field that stopped being written that day. Each was first reported as absent.

## Never hand Skip a URL carrying someone else's name

`?name=` sets the identity of whoever opens the link, and opening it **persists**
that name to their browser profile. It is a testing affordance: on a test server,
on a different machine, with its own identity space, `&name=tester` is correct and
stays correct.

A link sent to Skip is none of those things. Give him a URL with a name on it and
you have changed who he is in his own app, silently, until something else changes
it back. He does not click a name that isn't his; do not put one in front of him.

So: strip `name=` from any URL you hand him. Token and project parameters are
fine. If a link only makes sense with an identity attached, it is a link for a
test browser, not for him.

**There is no code fix and none is wanted.** `?name=` persisting is the feature
working — a name in the URL is how you say who you are, and persisting it is how
you stay that person. The behaviour is correct; sending Skip such a link is the
mistake. Do not propose making the write conditional, adding a confirmation, or
scoping it to the tab, and do not raise it with him again.

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

## Notation is borrowed, and so is its meaning

tlda's notation quotes programming languages Skip already knows. That is
deliberate, and it is the thing to reach for when a design point is unsettled:
**when a notation is borrowed, its semantics are borrowed too.** If you can name
the source language, you already know what the answer should be. His framing:

> These decisions come from somewhere. They're not just willy-nilly, like each
> individual thing is its own decision. There's some abstraction, and that can
> help us think about the right solution — and help you propose the right
> solution to me instead of me having to correct everything.

| notation | from | and therefore |
|---|---|---|
| `*chief-successor` | **C** — dereference | A friendly name is a *pointer*; the fleet ID is the address. You write the pointer. You never look at the address. |
| `eiv-paper@0b77278` | **npm** — `pkg@1.2.3` | Version is a coordinate on a thing you already named, not a separate object. |
| `/balancing-act/appendix` | **the web** — URL paths | Root is the set of projects. A leading `/` is absolute. **No `..`** — these are references, not file paths. |
| `/balancing-act` alone | **the web** — index at the root | A project's main document *is* the project name. One string, one namespace check. |
| `{#sec3 .theorem}` | **pandoc / Quarto** | `#id`, `.class`, `tag`, `[attr=value]`. Braced when it contains whitespace or `& \| ! ( )`. |
| the three-scope chain | **lexical scope** | Document → project main → fleet. A fixed order over named scopes, stateable in a sentence. Not inference. |
| `batch(15s)` | **CSS durations** | The unit is part of the value. A bare `15` is an error, not a default. |
| `here`, `away`, `dead` | **reserved words** | You cannot name a document one. Reserving a new one *retroactively* errors the documents that hold it, and they get renamed. |
| `awake & !goose` | **boolean algebra** | A token is a maximal run of characters that are not whitespace or `& \| ! ( )`. That is the grammar's rule, not a charset preference. |

**Two places the borrowing does real work.**

*Shadowing is an error* — because that is the decision a language makes. Skip
worked through R (warn) and TeX (error) and chose error: the qualified form is
always available, so making shadowing impossible costs more than making it
explicit.

*Membership is lexical, not dynamic* — the same word it is in Lisp. A filter
over history asks who held the label at each event's timestamp, joining
`label_history` spans. Making history read *current* membership would be dynamic
scope, and the same query would return different history depending on when it
ran.

`*name` inherits that immediately and needs nothing new: **resolution is a fold
over naming and labeling events**, the way labels already are. The event stores
an ID and a timestamp; the name at that time is a join, not a stored fact. Do not
add a column for it.

**When you hit an unspecified point, name the source language first.** "Should a
reference walk up with `..`?" is answered by *it's a URL, and the web has no
parent-relative project*. "What happens when two agents hold a name?" is answered
by *names are pointers and a pointer has one target* — which is why it is a
database index rather than a code check. **When you cannot name a source, that is
the signal to ask rather than decide.**

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
when it ran.

### We do not do auth between agents

This is not an app that prevents agents from doing things to other agents. If an
agent wants to send an HTTP request impersonating another agent, that is fine.
Skip's words, 7/31:

> This is not an app that prevents agents from doing things to other fucking
> agents. That's just it. If an agent wants to fucking send an HTTP request that
> impersonates another — I don't give a fuck.

> We do not do auth. That's just it. Maybe we will eventually, but we're not
> gonna do some fucking ill thought out bullshit that someone comes up with.

So: **no gate on any agent-facing action.** Not on reads, not on writes, not on
`delegate`, `chat`, `report`, `subscribe`, or configuration. Not leniently — not
at all.

An earlier version of this section described a "fence, not a wall" and a marker
pattern where an agent typed `cross-lane-ok:` to get past a lane check. That
check inferred each agent's "lane" from its working directory and guessed from a
regex whether its sentence counted as management, then refused the call. It was
authentication with a password, invented rather than asked for, and it is
deleted — `crossLaneBlock`, `inferAgentLane`, `lanesMayCoordinate`,
`looksLikeManagementMessage`, and all six MCP call sites. Do not reintroduce it
under another name, and do not treat "a small friction" as a permitted amount of
auth.

Security lives at the network layer — bearer tokens and the tailnet, in
`server/lib/auth.mjs`. That is what protects Skip's data from the outside world.
So does the filesystem permission-profile system in
[Permissions implementation contract](docs/permissions-implementation-contract.md),
which bounds what a process may touch on the machine. Neither is auth between
agents, and neither is in scope here.

The one check that stays is `approval_id`: to close a task marked as needing
Skip's approval, an agent passes the ID of the message where he approved it, and
the event's sender is confirmed human. That is not an agent being stopped from
acting on another agent — it is a claim about what Skip said, checked against
what Skip said.

#### Limits that are not authorization

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

The test: authorization asks *who is calling*. These ask *how expensive is this*,
*which file is it*, or *which machine owns it*.

## Repository workflow

- Temporary plans and reports belong under `scratch/`, not in the repository
  root or durable documentation.
- Feature work belongs in its assigned worktree. Do not move or stash another
  contributor's changes to make a checkout clean.
- **Every working copy lives in `~/worktrees/`.** One place, for worktrees and
  clones alike. Not `~/work`, which holds Skip's own project directories and had
  accumulated 139 checkouts mixed in with them; not `/private/tmp`, which macOS
  clears and which took an agent's uncommitted work on 2026-08-01; not inside the
  repository, because `tsc -b` and the greps this project runs constantly would
  walk it. A `post-checkout` hook fails loudly on a worktree created anywhere
  else — install it with `node bin/install-git-hooks.mjs`.
- **Commit when the typecheck passes, not when the verification is finished.** A
  checkout is disposable and a branch is not: work that is only in a working
  directory is one `rm` away from gone, and nothing else in this workflow
  protects it. Amend afterwards if verification changes the result.
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
