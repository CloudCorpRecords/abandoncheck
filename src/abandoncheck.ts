/**
 * abandoncheck core: judge whether one dependency is
 * maintained, from caller-supplied factual signals only.
 *
 *   checkDepMaintenance(args) -> { name, verdict, score, signals, reasons }
 *
 * Bands (pinned):
 *   last_release_band from last_release_days:
 *     absent -> "unknown"; <= 180 -> "fresh";
 *     <= 365 -> "aging"; <= 730 -> "stale"; > 730 -> "dormant".
 *   last_commit_band from last_commit_days:
 *     absent -> "unknown"; <= 90 -> "active";
 *     <= 180 -> "slowing"; <= 365 -> "quiet"; > 365 -> "silent".
 *
 * Score (pinned): start at 100, apply deductions in this
 * order, floor at 0:
 *   1. archived -> the score is 0 outright (no other
 *      deduction applies).
 *   2. last_release_days absent -> -30; > 730 -> -40;
 *      > 365 -> -25; > 180 -> -10; otherwise -0.
 *   3. last_commit_days absent -> -15; > 365 -> -20;
 *      > 180 -> -10; otherwise -0.
 *   4. recent_commits_90d present and == 0 -> -15.
 *   5. maintainer_count present: == 0 -> -20; == 1 -> -10.
 * open_issues never affects the score.
 *
 * Verdict (pinned): archived -> "abandoned"; otherwise by
 * score: >= 80 -> "maintained"; >= 50 -> "at_risk";
 * >= 1 -> "likely_abandoned"; 0 -> "abandoned".
 *
 * Reasons (pinned): one string per deduction that actually
 * applied, in deduction order, using the exact forms in
 * the spec. When no deduction applied, ["no adverse signals"].
 *
 * Validation is strict and path-naming: any malformed input
 * throws an Error naming the offending path and no partial
 * result is produced. Unknown extra fields are ignored;
 * a non-object top-level argument is treated as {}.
 */
import type {
  AbandonCheckResult,
  CommitBand,
  ReleaseBand,
  Verdict,
} from "./types.js";

export const VERSION = "0.1.0";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function releaseBand(days: number | undefined): ReleaseBand {
  if (days === undefined) return "unknown";
  if (days <= 180) return "fresh";
  if (days <= 365) return "aging";
  if (days <= 730) return "stale";
  return "dormant";
}

function commitBand(days: number | undefined): CommitBand {
  if (days === undefined) return "unknown";
  if (days <= 90) return "active";
  if (days <= 180) return "slowing";
  if (days <= 365) return "quiet";
  return "silent";
}

function optionalCount(
  raw: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = raw[key];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${key} must be an integer >= 0`);
  }
  return value;
}

/** Judge whether one dependency is maintained. */
export function checkDepMaintenance(args: unknown): AbandonCheckResult {
  const raw: Record<string, unknown> = isRecord(args) ? args : {};

  if (raw.name === undefined) throw new Error("name is required");
  if (typeof raw.name !== "string" || raw.name.length === 0) {
    throw new Error("name must be a non-empty string");
  }
  const name = raw.name;

  if (raw.archived === undefined) throw new Error("archived is required");
  if (typeof raw.archived !== "boolean") {
    throw new Error("archived must be a boolean");
  }
  const archived = raw.archived;

  const lastReleaseDays = optionalCount(raw, "last_release_days");
  const lastCommitDays = optionalCount(raw, "last_commit_days");
  const recentCommits90d = optionalCount(raw, "recent_commits_90d");
  const maintainerCount = optionalCount(raw, "maintainer_count");
  const openIssues = optionalCount(raw, "open_issues");

  const signals = {
    archived,
    last_release_band: releaseBand(lastReleaseDays),
    last_commit_band: commitBand(lastCommitDays),
    recent_commits_90d: recentCommits90d ?? null,
    maintainer_count: maintainerCount ?? null,
    open_issues: openIssues ?? null,
  };

  if (archived) {
    return {
      name,
      verdict: "abandoned",
      score: 0,
      signals,
      reasons: ["repository is archived"],
    };
  }

  let score = 100;
  const reasons: string[] = [];

  // 2. Release recency.
  if (lastReleaseDays === undefined) {
    score -= 30;
    reasons.push("no release information supplied");
  } else if (lastReleaseDays > 730) {
    score -= 40;
    reasons.push("last release over 730 days ago");
  } else if (lastReleaseDays > 365) {
    score -= 25;
    reasons.push("last release over 365 days ago");
  } else if (lastReleaseDays > 180) {
    score -= 10;
    reasons.push("last release over 180 days ago");
  }

  // 3. Commit recency.
  if (lastCommitDays === undefined) {
    score -= 15;
    reasons.push("no commit information supplied");
  } else if (lastCommitDays > 365) {
    score -= 20;
    reasons.push("last commit over 365 days ago");
  } else if (lastCommitDays > 180) {
    score -= 10;
    reasons.push("last commit over 180 days ago");
  }

  // 4. Recent commit activity.
  if (recentCommits90d !== undefined && recentCommits90d === 0) {
    score -= 15;
    reasons.push("no commits in the last 90 days");
  }

  // 5. Maintainer count.
  if (maintainerCount !== undefined && maintainerCount === 0) {
    score -= 20;
    reasons.push("no active maintainers");
  } else if (maintainerCount !== undefined && maintainerCount === 1) {
    score -= 10;
    reasons.push("single maintainer");
  }

  if (score < 0) score = 0;

  let verdict: Verdict;
  if (score >= 80) verdict = "maintained";
  else if (score >= 50) verdict = "at_risk";
  else if (score >= 1) verdict = "likely_abandoned";
  else verdict = "abandoned";

  return {
    name,
    verdict,
    score,
    signals,
    reasons: reasons.length > 0 ? reasons : ["no adverse signals"],
  };
}

/** Render a payload as the JSON text block MCP clients show. */
export function formatPayload(payload: unknown): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
}
