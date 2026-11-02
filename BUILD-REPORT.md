# abandoncheck — Build Report

MCP Rebuild 1000, Batch 17. Original program build from the
packages-100 plan (cluster F #64), built from the spec in
`~/workspace/mcp-rebuild-100/specs-batch17/abandoncheck.md`
(read first). There is no external original; the tool surface
is the program's defined spec. Local build only — nothing
pushed or published.

Identity: repo `abandoncheck`, npm `@reneturcios/abandoncheck`,
MCP name `io.github.CloudCorpRecords/abandoncheck`, version
`0.1.0`, bin `abandoncheck` → `dist/cli.js`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json`, `server.json` (description "Judge whether a
  dependency is maintained, from factual signals: releases,
  commits, archival." — 92 chars, verified by count; npm entry
  carries `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/abandoncheck:0.1.0` carries **no**
  `version` field), `Dockerfile` (node:20-alpine two-stage,
  label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/abandoncheck"`),
  `tsconfig.json`, `.gitignore`, `LICENSE` (MIT, Copyright
  (c) 2026 Rene Turcios), `README.md` (fresh text),
  `CHANGELOG.md` (single 0.1.0 entry, 2026-10-27),
  `package-lock.json` (Route 3, see below)
- `src/index.ts`, `src/cli.ts` (`check --input <args.json>`
  where the file holds the full arguments object, `mcp`,
  `--version`; exit 2 usage / 1 runtime error, argument
  validation before any file read), `src/mcp.ts`,
  `src/types.ts`, `src/abandoncheck.ts` (core,
  `VERSION = "0.1.0"`, `formatPayload`)
- `test/abandoncheck.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (publish-container `IMAGE = ghcr.io/cloudcorprecords/abandoncheck`,
  smoke-test server-name assertion `abandoncheck`)

Plus the parity fixture at
`harness/fixtures/abandoncheck-tools-original.json`, labelled
as a program spec from the packages-100 plan cluster F #64.

## Tools implemented (1)

- `check_dep_maintenance` — arguments: `name` (string,
  required, non-empty), `archived` (boolean, required),
  `last_release_days` (integer, optional, >= 0),
  `last_commit_days` (integer, optional, >= 0),
  `recent_commits_90d` (integer, optional, >= 0),
  `maintainer_count` (integer, optional, >= 0), and
  `open_issues` (integer, optional, >= 0; reported, never
  scored). Required is exactly `["name", "archived"]`.

  Bands are pinned: `last_release_band` is "unknown" when
  absent, "fresh" <= 180, "aging" <= 365, "stale" <= 730,
  "dormant" > 730; `last_commit_band` is "unknown" when
  absent, "active" <= 90, "slowing" <= 180, "quiet" <= 365,
  "silent" > 365.

  Scoring is pinned: an archived dependency scores 0
  outright with verdict "abandoned" and no other deduction
  applies. Otherwise the score starts at 100 and deductions
  apply in the pinned order — release (absent -30, > 730
  -40, > 365 -25, > 180 -10), commit (absent -15, > 365
  -20, > 180 -10), `recent_commits_90d` present and 0 (-15),
  `maintainer_count` present (0 -> -20, 1 -> -10) — floored
  at 0. `open_issues` never affects the score. Verdict by
  score: >= 80 "maintained", >= 50 "at_risk", >= 1
  "likely_abandoned", 0 "abandoned".

  Returns `{name, verdict, score, signals, reasons}`, where
  `signals` is `{archived, last_release_band,
  last_commit_band, recent_commits_90d, maintainer_count,
  open_issues}` echoing the supplied values (absent optional
  signals echo as null; the two bands are always strings),
  and `reasons` carries one exact spec string per deduction
  that applied, in deduction order, or `["no adverse
  signals"]` when none did.

  The fixture literal
  (`harness/fixtures/abandoncheck-tools-original.json`) and
  the `src/mcp.ts` literal are identical, with no `$schema`
  and no `additionalProperties` — confirmed by the parity
  run below.

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server` with an
  explicit inputSchema literal exactly matching the
  fixture, per the standing fleet rule (no McpServer/zod
  schema conversion). Every `tools/call` is validated by
  the core itself, so the MCP and CLI paths share one
  validation implementation; the core takes the full
  arguments object.
- Validation is path-naming and total: a missing, empty, or
  non-string `name`; a missing or non-boolean `archived`;
  or any of the five optional counts present but not an
  integer >= 0 throws an Error naming the offending path
  and produces no partial result (MCP: `isError`; CLI:
  exit 1). Unknown extra fields are ignored; a non-object
  top-level argument is treated as {}.

## Verification (foreground, this session)

- `npm test` (`tsx --test test/*.test.ts`): **58 tests,
  58 pass, 0 fail** — both band tables at every boundary
  (release 180/181, 365/366, 730/731 plus absent/0; commit
  90/91, 180/181, 365/366 plus absent/0); archived outright
  (score 0 and verdict "abandoned" with fresh signals, with
  no signals, and with the worst signals, only the archived
  reason ever present); each deduction alone with its exact
  score and exact reason string (release absent / over 730 /
  over 365 / over 180, commit absent / over 365 / over 180,
  zero recent commits, zero maintainers, single maintainer)
  plus the band-edge lower-deduction checks at exactly
  180/365/730 and 90/180/365; deductions combined with
  reasons in the pinned order; the floor at 0; verdict
  boundaries at score exactly 80 ("maintained") and 50
  ("at_risk"), 75 and 45 just below them, 5 as the bottom
  of the >= 1 band, and 0 ("abandoned"); a large
  `open_issues` value proven not to affect score, verdict,
  or reasons; the signals echo with nulls for absent
  optional signals and exact values including zeros; and
  every validation path (missing/empty/non-string `name`,
  missing/non-boolean `archived`, each of the five optional
  counts negative / fractional / string / boolean / null /
  array / object plus 0 valid, non-object top-level treated
  as {}, unknown extras ignored, no partial result).
- `npx tsc --noEmit` → exit 0; `npm run build` produced
  `dist/` with all 15 outputs.
- `dist/cli.js --version` → `0.1.0`; unknown command exits
  2 with usage; `check` with no `--input` exits 2;
  `check --input <missing file>` exits 1 naming the file;
  `check --input <valid file>` exits 0 and prints the
  hand-checked maintained result (score 100, bands
  fresh/active, reasons ["no adverse signals"]) for the
  input `{"name": "leftpad", "archived": false,
  "last_release_days": 45, "last_commit_days": 12,
  "recent_commits_90d": 18, "maintainer_count": 3,
  "open_issues": 27}`; `check --input <invalid file>`
  (`open_issues: -3`) exits 1 with
  `open_issues must be an integer >= 0`.
- Parity: `harness/parity.py` vs
  `harness/fixtures/abandoncheck-tools-original.json` →
  **PASS, parity 100.0, identical_tools 1/1** (run with
  the rebuild path as an absolute path; the harness does
  not expand a `~` inside the quoted stdio command
  string). Report saved under `parity-out/`.

## Lockfile status

`package-lock.json` generated clean via Route 3 (in the
build directory with no `node_modules` present, offline
`npm install --package-lock-only --ignore-scripts
--offline`), verified: parses, name
`@reneturcios/abandoncheck`, **128 package entries**.
Resolved versions match the sibling reference tree
(`@modelcontextprotocol/sdk` 1.32.2, `zod` 3.25.76,
`tsx` 4.23.15, `typescript` 5.9.3, `@types/node`
20.19.43, `qs` 6.17.0). The subsequent offline
`npm install --ignore-scripts --offline`, build, tests,
and parity all ran against this lockfile's tree.

## Gaps / honest notes

- **Pinned judgement calls** (each with a dedicated
  test where applicable): (1) verdict boundary at score
  exactly 1 is unreachable under the pinned deduction
  table — every deduction is a multiple of 5 and the
  maximum total non-archived deduction is 40+20+15+20 =
  95, so the minimum reachable non-archived score is 5
  and a non-archived 0 is also unreachable; the >= 1 band
  is therefore pinned at its reachable bottom (score 5,
  "likely_abandoned"), the 0 boundary is pinned via the
  archived rule (score exactly 0, "abandoned"), and the
  reachable boundaries 80 and 50 are pinned exactly, with
  75 and 45 just below them; (2) the score floor at 0 is
  likewise exercised through the archived outright rule,
  the only path that reaches 0; (3) absent
  `recent_commits_90d` / `maintainer_count` apply no
  deduction (the spec scopes those deductions to values
  "present"); (4) unknown extra fields are ignored rather
  than rejected (the spec does not forbid them); (5) a
  non-object top-level arguments value is treated as an
  empty object, so it fails as `name is required`;
  (6) error-message wording follows the fleet's
  path-naming pattern (e.g. `archived must be a boolean`,
  `last_release_days must be an integer >= 0`). No other
  spec ambiguity was found in the core behaviour.
- Container build not exercised locally; the
  publish-container workflow smoke-tests the image at
  publish time.
- Nothing pushed or published; this is a local build only.
