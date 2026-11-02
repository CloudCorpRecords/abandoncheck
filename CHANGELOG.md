# Changelog

## 0.1.0 (2026-10-27)

- Initial release: `check_dep_maintenance` MCP tool and
  `check` CLI command judging whether one dependency is
  maintained, from caller-supplied factual signals only.
- Pinned bands: release band `unknown` / `fresh` (<= 180)
  / `aging` (<= 365) / `stale` (<= 730) / `dormant`
  (> 730); commit band `unknown` / `active` (<= 90) /
  `slowing` (<= 180) / `quiet` (<= 365) / `silent` (> 365).
- Pinned scoring: an archived repository scores 0 outright
  with verdict `abandoned`; otherwise deductions apply in
  a fixed order for release recency, commit recency, zero
  commits in the last 90 days, and zero or one maintainer,
  with the score floored at 0. `open_issues` is reported
  but never scored.
- Pinned verdicts by score: >= 80 `maintained`, >= 50
  `at_risk`, >= 1 `likely_abandoned`, 0 `abandoned`, with
  one exact reason string per deduction that applied, in
  deduction order, or "no adverse signals" when none did.
- Path-naming validation errors for malformed input,
  including the required `name` and `archived` fields and
  integer >= 0 checks for every optional count.
