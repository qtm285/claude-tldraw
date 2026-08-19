# Old-path inventory — instructions that point at things which are not there

`pm-sync` kept a fuller working copy of this under that name in their **agent scratchpad**,
not in the repository, and they hibernated on handoff — so it is not reachable from here.
This is the repo-durable one, started 2026-08-19 so the entries below survive the agent
that found them. If pm-sync's copy resurfaces, merge rather than replace: theirs has the
deletion manifest, the nineteen callers, and the instrument log.

Every entry here is one family: **a written instruction that points at something which
does not exist.** They cost hours each because they are indistinguishable from good
instructions until you go looking.

---

## 1. A warning comment deleted with the code it guarded

`297baba9a` ("Send the words in the fan-out", `accept-path-daemon-push`, 2026-08-18 20:01)
fixed the source-room fan-out carrying paths without bytes, and wrote a twelve-line comment
above the fix saying exactly why the payload must carry `content`: **two consumers, and only
one of them reads `blobs`.**

The old-sync strip rewrote that block on its own branch. The comment went with the code, so
nothing on the strip said not to do it — and the same defect was written again and found a
second time, independently, hours later.

**The rule:** a comment that exists to stop someone re-introducing a defect is load-bearing.
When you rewrite the block it guards, the comment moves with the rewrite or the guard is
gone. A diffstat that deletes an explanatory block and adds no replacement is the tell.

Same family as `AGENTS.md` §"A revert is not done until the control goes too".

## 2. A verification command must be run against a known-good subject before it is trusted

Handed over as the check for whether the fan-out fix had landed:

```sh
git show <branch>:server/routes/projects.mjs | grep -A6 acceptedSourceMutationHandler | grep -c content
```

It returned **0** on the branch where the fix had just landed — and **0 on
`accept-path-daemon-push`, which carries `297baba9a` and is indisputably fixed.** The fix
builds `changedFiles` about forty lines above the payload and passes the variable, so
`grep -A6` cannot see it. The command could not have returned anything else on any correct
branch.

**The rule:** before trusting a check, run it against a subject you already know satisfies
it. If the known-good subject fails the check, the instrument is broken, not the world.
This is `pm-sync`'s positive-control-on-the-zero rule pointed at the checker rather than at
the code — and it is the same disease as the bug it was checking for: a grep that finds the
field name on both ends and tells you nothing.

The instrument that does answer it:

```sh
git show <branch>:server/routes/projects.mjs | grep -n "changedFiles\|files: changed.map"
```

## 3. `applyAcceptedBundleEffects` — a deferral to a symbol that exists nowhere

`bin/source-manifest-contract-test.mjs`'s header defers its own re-derivation until
*"`applyAcceptedBundleEffects` (accept-path-daemon-push) lands on `main`"*.

**That symbol does not exist.** Not on `main`, not on `accept-path-daemon-push`, not on
`old-sync-deletion-land`. Its only occurrence in 1414 tracked files is the sentence
deferring to it. It was never built, or it was renamed in transit and the header was not.

Anyone who reads that header waits forever, and reads the file's silence as *not yet due*
rather than *not running at all*. **Not guessed at — whoever knows what it became should
write the name in here.**

---

# Standing checks this run added

- **A sweep takes no directory argument.** Whole tree, tests included. Four scope misses on
  2026-08-18 and a fifth on 2026-08-19 were all directory-bounded sweeps. The fifth found two
  dead files in `test/` that four separate `bin/`-bounded sweeps had never looked at.
- **Both controls, every run.** A positive control proving the instrument finds what exists,
  and a negative control proving a zero is reachable. A clean sweep means the negative
  control still returns zero — otherwise the instrument may have broken silently between
  runs and "clean" means "blind".
- **Run the file, do not classify it.** Whether a file dies at import is answered by running
  it. A regex over its imports is a guess that agrees with the truth often enough to be
  trusted wrongly.

# Red on `main` and invisible, found by this sweep

Not strip damage. These were already failing where nobody was looking:

- **`bin/source-room-daemon-test.mjs`** errors at its corrupt-revision block — it edits
  `revisions/<id>/snapshot.json`, and `source-lifecycle.mjs:308` says *"Nothing writes that
  shape any more."* It throws ENOENT rather than failing, so **everything after that block
  has never run on `main`**, including a `duplicate-render` block that turns out to be
  intermittently failing. Repointed on `old-sync-deletion-land`; still open on `main`.
- **`test/project-parts-push-live-render.test.mjs`** — three of six subtests fail
  **identically on `main` and on the branch**, including *"a chat reference makes a file a
  member; sitting beside the paper does not"*. That is Skip's membership rule. The file was
  dead at import on the branch, so the repoint did not cause it; the failures are `main`'s.
- **`test/linked-remote-divergence.test.mjs`** cannot reach its assertions on `main` at all
  (fails in setup), so `main`'s behaviour on those promises is currently unestablished.
