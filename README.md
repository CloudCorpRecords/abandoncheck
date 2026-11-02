# abandoncheck

Every dependency in a tree was chosen at some point, often
years ago, and the question that matters later is a plain
one: is anyone still looking after this thing? abandoncheck
answers it without guessing. You supply the factual signals
you already have — whether the repository is archived, how
long since the last release and the last commit, how many
commits landed in the last 90 days, how many maintainers
are active, and how many issues sit open — and it returns a
verdict, a score, the bands those signals fall into, and
the exact reasons behind the number.

Nothing is fetched and nothing is inferred about the code
itself. An archived repository settles the question on its
own: the score is 0 and the verdict is `abandoned`, no
matter how fresh the other signals look. Otherwise the
score starts at 100 and loses points in a fixed order for
missing or stale release information, missing or stale
commit information, a silent last 90 days, and a thin
maintainer bench — never below 0. The open issue count is
echoed back in the signals and deliberately never scored:
a busy tracker can mean a popular project as easily as a
neglected one, and this tool sticks to signals that point
one way.

The bands make the score auditable at a glance. A release
180 days old or newer is `fresh`, then `aging` to 365,
`stale` to 730, and `dormant` beyond that; with no release
information the band is `unknown`. Commits run on a tighter
clock: `active` to 90 days, `slowing` to 180, `quiet` to
365, and `silent` beyond that. Scores of 80 and up read as
`maintained`, 50 and up as `at_risk`, anything above 0 as
`likely_abandoned`, and 0 as `abandoned`. When no deduction
applies at all, the single reason is "no adverse signals";
otherwise each reason names the deduction that fired, in
the order it was applied.

Malformed input — a missing, empty, or non-string `name`,
a missing or non-boolean `archived`, or any optional count
that is not an integer of at least 0 — is a validation
error naming the offending path, with no partial result.
Unknown extra fields are ignored. The computation is pure
and local: no network, no configuration, and no repository
is read or touched.

## CLI

```bash
npx @reneturcios/abandoncheck check --input args.json
npx @reneturcios/abandoncheck --version
```

`args.json` contains the full arguments object:

```json
{
  "name": "leftpad",
  "archived": false,
  "last_release_days": 45,
  "last_commit_days": 12,
  "recent_commits_90d": 18,
  "maintainer_count": 3,
  "open_issues": 27
}
```

The result is printed as JSON:

```json
{
  "name": "leftpad",
  "verdict": "maintained",
  "score": 100,
  "signals": {
    "archived": false,
    "last_release_band": "fresh",
    "last_commit_band": "active",
    "recent_commits_90d": 18,
    "maintainer_count": 3,
    "open_issues": 27
  },
  "reasons": ["no adverse signals"]
}
```

Absent optional signals echo as `null` in `signals`, and
their bands are `"unknown"`. Exit codes: `0` on success,
`1` on a runtime error (including an unreadable or invalid
input file, or invalid input), `2` on a usage error.

## MCP server

```bash
npx -y @reneturcios/abandoncheck mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "abandoncheck": {
      "command": "npx",
      "args": ["-y", "@reneturcios/abandoncheck", "mcp"]
    }
  }
}
```

### Tools

- `check_dep_maintenance` — Judge whether one dependency
  is maintained, from caller-supplied factual signals only.
  - `name` (string, required, non-empty) — dependency name
  - `archived` (boolean, required) — whether the
    dependency's repository is archived
  - `last_release_days` (integer, optional, at least 0) —
    days since the last release; omit if none
  - `last_commit_days` (integer, optional, at least 0) —
    days since the last commit; omit if unknown
  - `recent_commits_90d` (integer, optional, at least 0) —
    commits in the last 90 days
  - `maintainer_count` (integer, optional, at least 0) —
    number of active maintainers
  - `open_issues` (integer, optional, at least 0) — open
    issue count; reported, never scored

  Returns `{name, verdict, score, signals, reasons}`,
  where `signals` is `{archived, last_release_band,
  last_commit_band, recent_commits_90d, maintainer_count,
  open_issues}`.

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/abandoncheck
docker run --rm -v "$PWD:/w" ghcr.io/cloudcorprecords/abandoncheck check --input /w/args.json
```

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # tsx --test test/*.test.ts (pure local, no network)
npm run dev     # run the CLI from source
```

## License

MIT — Copyright (c) 2026 Rene Turcios
