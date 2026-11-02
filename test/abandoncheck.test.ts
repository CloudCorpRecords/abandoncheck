import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkDepMaintenance } from "../src/abandoncheck.js";

/**
 * All tests are pure local computation over inline signal
 * objects: no filesystem and no network. The release and
 * commit band boundaries, the archived outright rule, each
 * deduction alone and combined, the score floor, the
 * verdict boundaries reachable under the pinned deduction
 * table, the never-scored open_issues signal, the exact
 * reason strings and their order, the signals echo with
 * nulls, and every validation path are each pinned.
 */

const good = {
  name: "example-dep",
  archived: false,
  last_release_days: 10,
  last_commit_days: 5,
  recent_commits_90d: 12,
  maintainer_count: 3,
  open_issues: 4,
};

describe("checkDepMaintenance — no adverse signals", () => {
  it("a fully healthy dependency scores 100, maintained, with the exact output shape", () => {
    assert.deepEqual(checkDepMaintenance(good), {
      name: "example-dep",
      verdict: "maintained",
      score: 100,
      signals: {
        archived: false,
        last_release_band: "fresh",
        last_commit_band: "active",
        recent_commits_90d: 12,
        maintainer_count: 3,
        open_issues: 4,
      },
      reasons: ["no adverse signals"],
    });
  });

  it("absent recent_commits_90d and maintainer_count apply no deduction", () => {
    const out = checkDepMaintenance({
      name: "example-dep",
      archived: false,
      last_release_days: 0,
      last_commit_days: 0,
    });
    assert.equal(out.score, 100);
    assert.equal(out.verdict, "maintained");
    assert.deepEqual(out.reasons, ["no adverse signals"]);
  });

  it("recent_commits_90d above 0 and maintainer_count of 2 or more apply no deduction", () => {
    const out = checkDepMaintenance({
      ...good,
      recent_commits_90d: 1,
      maintainer_count: 2,
    });
    assert.equal(out.score, 100);
    assert.deepEqual(out.reasons, ["no adverse signals"]);
  });
});

describe("checkDepMaintenance — release band boundaries", () => {
  const band = (days?: number) =>
    checkDepMaintenance({
      name: "d",
      archived: false,
      ...(days === undefined ? {} : { last_release_days: days }),
      last_commit_days: 0,
    }).signals.last_release_band;

  it("absent is unknown, 0 and 180 are fresh", () => {
    assert.equal(band(undefined), "unknown");
    assert.equal(band(0), "fresh");
    assert.equal(band(180), "fresh");
  });

  it("181 and 365 are aging", () => {
    assert.equal(band(181), "aging");
    assert.equal(band(365), "aging");
  });

  it("366 and 730 are stale", () => {
    assert.equal(band(366), "stale");
    assert.equal(band(730), "stale");
  });

  it("731 is dormant", () => {
    assert.equal(band(731), "dormant");
    assert.equal(band(10000), "dormant");
  });
});

describe("checkDepMaintenance — commit band boundaries", () => {
  const band = (days?: number) =>
    checkDepMaintenance({
      name: "d",
      archived: false,
      last_release_days: 0,
      ...(days === undefined ? {} : { last_commit_days: days }),
    }).signals.last_commit_band;

  it("absent is unknown, 0 and 90 are active", () => {
    assert.equal(band(undefined), "unknown");
    assert.equal(band(0), "active");
    assert.equal(band(90), "active");
  });

  it("91 and 180 are slowing", () => {
    assert.equal(band(91), "slowing");
    assert.equal(band(180), "slowing");
  });

  it("181 and 365 are quiet", () => {
    assert.equal(band(181), "quiet");
    assert.equal(band(365), "quiet");
  });

  it("366 is silent", () => {
    assert.equal(band(366), "silent");
    assert.equal(band(5000), "silent");
  });
});

describe("checkDepMaintenance — archived outright", () => {
  it("archived scores 0 and abandoned even with fully fresh signals", () => {
    const out = checkDepMaintenance({ ...good, archived: true });
    assert.equal(out.score, 0);
    assert.equal(out.verdict, "abandoned");
    assert.deepEqual(out.reasons, ["repository is archived"]);
    assert.equal(out.signals.archived, true);
    assert.equal(out.signals.last_release_band, "fresh");
    assert.equal(out.signals.last_commit_band, "active");
  });

  it("archived scores 0 with no other signals supplied and only the archived reason", () => {
    const out = checkDepMaintenance({ name: "gone", archived: true });
    assert.deepEqual(out, {
      name: "gone",
      verdict: "abandoned",
      score: 0,
      signals: {
        archived: true,
        last_release_band: "unknown",
        last_commit_band: "unknown",
        recent_commits_90d: null,
        maintainer_count: null,
        open_issues: null,
      },
      reasons: ["repository is archived"],
    });
  });

  it("archived ignores even the worst other signals (no other deduction applies)", () => {
    const out = checkDepMaintenance({
      name: "gone",
      archived: true,
      last_release_days: 9999,
      last_commit_days: 9999,
      recent_commits_90d: 0,
      maintainer_count: 0,
    });
    assert.equal(out.score, 0);
    assert.deepEqual(out.reasons, ["repository is archived"]);
  });
});

describe("checkDepMaintenance — each deduction alone", () => {
  const base = {
    name: "d",
    archived: false,
    last_release_days: 10,
    last_commit_days: 5,
    recent_commits_90d: 3,
    maintainer_count: 4,
  };

  it("no release information supplied deducts 30", () => {
    const { last_release_days: _drop, ...rest } = base;
    const out = checkDepMaintenance(rest);
    assert.equal(out.score, 70);
    assert.deepEqual(out.reasons, ["no release information supplied"]);
  });

  it("last release over 730 days ago deducts 40", () => {
    const out = checkDepMaintenance({ ...base, last_release_days: 731 });
    assert.equal(out.score, 60);
    assert.deepEqual(out.reasons, ["last release over 730 days ago"]);
  });

  it("last release over 365 days ago deducts 25", () => {
    const out = checkDepMaintenance({ ...base, last_release_days: 366 });
    assert.equal(out.score, 75);
    assert.deepEqual(out.reasons, ["last release over 365 days ago"]);
  });

  it("last release over 180 days ago deducts 10", () => {
    const out = checkDepMaintenance({ ...base, last_release_days: 181 });
    assert.equal(out.score, 90);
    assert.deepEqual(out.reasons, ["last release over 180 days ago"]);
  });

  it("a release at exactly 180 / 365 / 730 days takes the lower deduction of its band edge", () => {
    assert.equal(checkDepMaintenance({ ...base, last_release_days: 180 }).score, 100);
    assert.equal(checkDepMaintenance({ ...base, last_release_days: 365 }).score, 90);
    assert.equal(checkDepMaintenance({ ...base, last_release_days: 730 }).score, 75);
  });

  it("no commit information supplied deducts 15", () => {
    const { last_commit_days: _drop, ...rest } = base;
    const out = checkDepMaintenance(rest);
    assert.equal(out.score, 85);
    assert.deepEqual(out.reasons, ["no commit information supplied"]);
  });

  it("last commit over 365 days ago deducts 20", () => {
    const out = checkDepMaintenance({ ...base, last_commit_days: 366 });
    assert.equal(out.score, 80);
    assert.deepEqual(out.reasons, ["last commit over 365 days ago"]);
  });

  it("last commit over 180 days ago deducts 10", () => {
    const out = checkDepMaintenance({ ...base, last_commit_days: 181 });
    assert.equal(out.score, 90);
    assert.deepEqual(out.reasons, ["last commit over 180 days ago"]);
  });

  it("a commit at exactly 180 / 365 days takes the lower deduction of its band edge", () => {
    assert.equal(checkDepMaintenance({ ...base, last_commit_days: 90 }).score, 100);
    assert.equal(checkDepMaintenance({ ...base, last_commit_days: 180 }).score, 100);
    assert.equal(checkDepMaintenance({ ...base, last_commit_days: 365 }).score, 90);
  });

  it("no commits in the last 90 days deducts 15", () => {
    const out = checkDepMaintenance({ ...base, recent_commits_90d: 0 });
    assert.equal(out.score, 85);
    assert.deepEqual(out.reasons, ["no commits in the last 90 days"]);
  });

  it("no active maintainers deducts 20", () => {
    const out = checkDepMaintenance({ ...base, maintainer_count: 0 });
    assert.equal(out.score, 80);
    assert.deepEqual(out.reasons, ["no active maintainers"]);
  });

  it("single maintainer deducts 10", () => {
    const out = checkDepMaintenance({ ...base, maintainer_count: 1 });
    assert.equal(out.score, 90);
    assert.deepEqual(out.reasons, ["single maintainer"]);
  });
});

describe("checkDepMaintenance — deductions combined, order, and floor", () => {
  it("reasons follow the pinned deduction order for the worst non-archived signals", () => {
    const out = checkDepMaintenance({
      name: "d",
      archived: false,
      last_release_days: 800,
      last_commit_days: 400,
      recent_commits_90d: 0,
      maintainer_count: 0,
    });
    // 100 - 40 - 20 - 15 - 20 = 5, the minimum reachable non-archived score.
    assert.equal(out.score, 5);
    assert.equal(out.verdict, "likely_abandoned");
    assert.deepEqual(out.reasons, [
      "last release over 730 days ago",
      "last commit over 365 days ago",
      "no commits in the last 90 days",
      "no active maintainers",
    ]);
  });

  it("absent-information reasons come before activity and maintainer reasons", () => {
    const out = checkDepMaintenance({
      name: "d",
      archived: false,
      recent_commits_90d: 0,
      maintainer_count: 1,
    });
    // 100 - 30 - 15 - 15 - 10 = 30.
    assert.equal(out.score, 30);
    assert.equal(out.verdict, "likely_abandoned");
    assert.deepEqual(out.reasons, [
      "no release information supplied",
      "no commit information supplied",
      "no commits in the last 90 days",
      "single maintainer",
    ]);
  });

  it("mid-range deductions combine additively", () => {
    const out = checkDepMaintenance({
      name: "d",
      archived: false,
      last_release_days: 400,
      last_commit_days: 200,
      recent_commits_90d: 2,
      maintainer_count: 1,
    });
    // 100 - 25 - 10 - 0 - 10 = 55.
    assert.equal(out.score, 55);
    assert.equal(out.verdict, "at_risk");
    assert.deepEqual(out.reasons, [
      "last release over 365 days ago",
      "last commit over 180 days ago",
      "single maintainer",
    ]);
  });

  it("the score never goes below 0 (archived is the floor case)", () => {
    const out = checkDepMaintenance({
      name: "d",
      archived: true,
      last_release_days: 9999,
      last_commit_days: 9999,
      recent_commits_90d: 0,
      maintainer_count: 0,
    });
    assert.equal(out.score, 0);
    assert.ok(out.score >= 0);
  });
});

describe("checkDepMaintenance — verdict boundaries", () => {
  const base = {
    name: "d",
    archived: false,
    last_release_days: 10,
    last_commit_days: 5,
    recent_commits_90d: 3,
    maintainer_count: 4,
  };

  it("score exactly 80 is maintained", () => {
    const out = checkDepMaintenance({ ...base, maintainer_count: 0 });
    assert.equal(out.score, 80);
    assert.equal(out.verdict, "maintained");
  });

  it("score 75 (just below 80) is at_risk", () => {
    const out = checkDepMaintenance({ ...base, last_release_days: 400 });
    assert.equal(out.score, 75);
    assert.equal(out.verdict, "at_risk");
  });

  it("score exactly 50 is at_risk", () => {
    // -40 (release over 730) - 10 (single maintainer) = -50.
    const out = checkDepMaintenance({
      ...base,
      last_release_days: 900,
      maintainer_count: 1,
    });
    assert.equal(out.score, 50);
    assert.equal(out.verdict, "at_risk");
  });

  it("score 45 (just below 50) is likely_abandoned", () => {
    // -40 (release over 730) - 15 (no commits in 90d) = -55 -> 45.
    const out = checkDepMaintenance({
      ...base,
      last_release_days: 900,
      recent_commits_90d: 0,
    });
    assert.equal(out.score, 45);
    assert.equal(out.verdict, "likely_abandoned");
  });

  it("score 5, the minimum reachable non-archived score, is likely_abandoned (the >= 1 band)", () => {
    // Every deduction is a multiple of 5 and the maximum total
    // non-archived deduction is 40+20+15+20 = 95, so scores of
    // exactly 1 (and non-archived 0) are unreachable under the
    // pinned table; 5 pins the bottom of the >= 1 band.
    const out = checkDepMaintenance({
      name: "d",
      archived: false,
      last_release_days: 731,
      last_commit_days: 366,
      recent_commits_90d: 0,
      maintainer_count: 0,
    });
    assert.equal(out.score, 5);
    assert.equal(out.verdict, "likely_abandoned");
  });

  it("score exactly 0 is abandoned (via the archived rule)", () => {
    const out = checkDepMaintenance({ ...base, archived: true });
    assert.equal(out.score, 0);
    assert.equal(out.verdict, "abandoned");
  });
});

describe("checkDepMaintenance — open_issues is reported, never scored", () => {
  it("a very large open_issues value does not change score, verdict, or reasons", () => {
    const small = checkDepMaintenance({ ...good, open_issues: 0 });
    const large = checkDepMaintenance({ ...good, open_issues: 1000000 });
    assert.equal(large.score, small.score);
    assert.equal(large.score, 100);
    assert.equal(large.verdict, "maintained");
    assert.deepEqual(large.reasons, ["no adverse signals"]);
    assert.equal(large.signals.open_issues, 1000000);
  });

  it("open_issues does not rescue or worsen a bad score", () => {
    const out = checkDepMaintenance({
      name: "d",
      archived: false,
      last_release_days: 900,
      last_commit_days: 5,
      recent_commits_90d: 3,
      maintainer_count: 4,
      open_issues: 999999,
    });
    assert.equal(out.score, 60);
    assert.equal(out.verdict, "at_risk");
  });
});

describe("checkDepMaintenance — signals echo", () => {
  it("absent optional signals echo as null and their bands are unknown", () => {
    const out = checkDepMaintenance({ name: "bare", archived: false });
    assert.deepEqual(out.signals, {
      archived: false,
      last_release_band: "unknown",
      last_commit_band: "unknown",
      recent_commits_90d: null,
      maintainer_count: null,
      open_issues: null,
    });
    // Only the two absent-information deductions apply.
    assert.equal(out.score, 55);
    assert.deepEqual(out.reasons, [
      "no release information supplied",
      "no commit information supplied",
    ]);
  });

  it("supplied optional signals echo their exact values, including zeros", () => {
    const out = checkDepMaintenance({
      name: "d",
      archived: false,
      last_release_days: 200,
      last_commit_days: 100,
      recent_commits_90d: 0,
      maintainer_count: 0,
      open_issues: 0,
    });
    assert.deepEqual(out.signals, {
      archived: false,
      last_release_band: "aging",
      last_commit_band: "slowing",
      recent_commits_90d: 0,
      maintainer_count: 0,
      open_issues: 0,
    });
  });

  it("the name is echoed exactly", () => {
    assert.equal(
      checkDepMaintenance({ name: "@scope/pkg-2", archived: false }).name,
      "@scope/pkg-2",
    );
  });
});

describe("checkDepMaintenance — validation", () => {
  const throws = (args: unknown, message: string) =>
    assert.throws(() => checkDepMaintenance(args), { message });

  it("name missing is an error naming name", () => {
    throws({}, "name is required");
    throws({ archived: false }, "name is required");
  });

  it("a non-object top-level argument is treated as {} and fails on name", () => {
    throws(null, "name is required");
    throws([], "name is required");
    throws("dep", "name is required");
    throws(42, "name is required");
    throws(undefined, "name is required");
  });

  it("name empty or non-string names name", () => {
    throws({ name: "", archived: false }, "name must be a non-empty string");
    throws({ name: 42, archived: false }, "name must be a non-empty string");
    throws({ name: null, archived: false }, "name must be a non-empty string");
    throws({ name: ["x"], archived: false }, "name must be a non-empty string");
    throws({ name: true, archived: false }, "name must be a non-empty string");
  });

  it("archived missing is an error naming archived", () => {
    throws({ name: "d" }, "archived is required");
  });

  it("archived non-boolean names archived", () => {
    throws({ name: "d", archived: "false" }, "archived must be a boolean");
    throws({ name: "d", archived: 0 }, "archived must be a boolean");
    throws({ name: "d", archived: 1 }, "archived must be a boolean");
    throws({ name: "d", archived: null }, "archived must be a boolean");
    throws({ name: "d", archived: [] }, "archived must be a boolean");
  });

  const countKeys = [
    "last_release_days",
    "last_commit_days",
    "recent_commits_90d",
    "maintainer_count",
    "open_issues",
  ] as const;

  for (const key of countKeys) {
    it(`${key} must be an integer >= 0 when present`, () => {
      for (const bad of [-1, -100, 1.5, 0.5, "3", true, false, null, [], {}]) {
        throws(
          { name: "d", archived: false, [key]: bad },
          `${key} must be an integer >= 0`,
        );
      }
    });

    it(`${key} of 0 is valid`, () => {
      const out = checkDepMaintenance({ name: "d", archived: true, [key]: 0 });
      assert.equal(out.score, 0);
    });
  }

  it("unknown extra fields are ignored (pinned judgement call)", () => {
    const out = checkDepMaintenance({
      ...good,
      stars: 12345,
      language: "rust",
    });
    assert.equal(out.score, 100);
    assert.equal(out.verdict, "maintained");
  });

  it("no partial result is produced on invalid input", () => {
    assert.throws(() =>
      checkDepMaintenance({ name: "d", archived: false, open_issues: -1 }),
    );
  });
});
