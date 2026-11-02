/**
 * abandoncheck types.
 *
 * abandoncheck judges whether one dependency is maintained,
 * from caller-supplied factual signals only. The caller
 * supplies the dependency name, whether its repository is
 * archived, and optionally days since the last release and
 * last commit, commits in the last 90 days, the number of
 * active maintainers, and the open issue count. From that
 * data alone, as pure local computation, abandoncheck
 * reports:
 *
 *   - a verdict
 *   - a score from 0 to 100
 *   - the signal bands and echoed signal values
 *   - the reasons, one per deduction that applied
 *
 * The bands are pinned: the release band is "unknown",
 * "fresh", "aging", "stale", or "dormant"; the commit band
 * is "unknown", "active", "slowing", "quiet", or "silent".
 * The open issue count is reported but never scored.
 */

/** Band for days since the last release. */
export type ReleaseBand = "unknown" | "fresh" | "aging" | "stale" | "dormant";

/** Band for days since the last commit. */
export type CommitBand = "unknown" | "active" | "slowing" | "quiet" | "silent";

/** Maintenance verdict. */
export type Verdict = "maintained" | "at_risk" | "likely_abandoned" | "abandoned";

/** The echoed signals in a result. */
export interface AbandonSignals {
  /** Whether the dependency's repository is archived. */
  archived: boolean;
  /** Band derived from last_release_days. */
  last_release_band: ReleaseBand;
  /** Band derived from last_commit_days. */
  last_commit_band: CommitBand;
  /** Commits in the last 90 days, or null when not supplied. */
  recent_commits_90d: number | null;
  /** Number of active maintainers, or null when not supplied. */
  maintainer_count: number | null;
  /** Open issue count, or null when not supplied; never scored. */
  open_issues: number | null;
}

/** The maintenance verdict for one dependency. */
export interface AbandonCheckResult {
  /** Dependency name, echoed from the input. */
  name: string;
  /** Maintenance verdict. */
  verdict: Verdict;
  /** Score from 0 to 100. */
  score: number;
  /** Echoed signals and derived bands. */
  signals: AbandonSignals;
  /** One reason per deduction that applied, in deduction order. */
  reasons: string[];
}
