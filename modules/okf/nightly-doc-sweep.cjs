#!/usr/bin/env node
/**
 * nightly-doc-sweep.cjs — the overnight doc sweep an MI app/agent runs nightly to
 * keep its knowledge surfaces in sync with the CURRENT app structure:
 *   • Developer Manual (§14d) + OKF bundle (§23)  — regenerate from the live schema
 *   • User Manual (§17a) + Changelog (§17b)        — flag if stale vs recent code changes
 *   • Dependencies / plugins                       — recommend upgrades (do NOT auto-apply)
 *
 * Recommend-only by design: a dependency or code upgrade is Tier-1 per the Agent
 * Operating Constitution (apps.mi2.com.mx/mibots) — the agent PROPOSES to its owner.
 * Wire into a nightly cron / the always-on poller's daily tick.
 *
 * Usage:  node nightly-doc-sweep.cjs            # from the app repo root
 * Env:    DICT_DIR (default docs/developer-manual/seed/dictionary),
 *         OKF_OUT  (default docs/okf),  DB_KIND, APP_NAME, BASE_URI (for okf-export)
 * Exit:   0 = all fresh; 1 = action recommended (drift or upgrades) — cron can alert on it.
 */
const { execSync } = require("node:child_process");
const fs = require("node:fs"), path = require("node:path");

const APP = process.env.APP_NAME || path.basename(process.cwd());
const DICT_DIR = process.env.DICT_DIR || "docs/developer-manual/seed/dictionary";
const OKF_OUT = process.env.OKF_OUT || "docs/okf";
const out = { app: APP, ts: new Date().toISOString(), actions: [] };
const sh = (c) => { try { return execSync(c, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch (e) { return (e.stdout || "").toString().trim(); } };

// 1. Regenerate the OKF bundle from the data dictionary (keeps OKF + dev-manual export current)
if (fs.existsSync(DICT_DIR)) {
  const exporter = path.join(__dirname, "okf-export.cjs");
  if (fs.existsSync(exporter)) {
    const before = fs.existsSync(OKF_OUT) ? sh(`find ${OKF_OUT} -name '*.md' | xargs md5sum 2>/dev/null | md5sum`) : "";
    sh(`node ${exporter} ${DICT_DIR} ${OKF_OUT} --app ${APP} ${process.env.DB_KIND ? `--db-kind "${process.env.DB_KIND}"` : ""} ${process.env.BASE_URI ? `--base-uri "${process.env.BASE_URI}"` : ""}`);
    const after = fs.existsSync(OKF_OUT) ? sh(`find ${OKF_OUT} -name '*.md' | xargs md5sum 2>/dev/null | md5sum`) : "";
    if (before !== after) out.actions.push("OKF bundle regenerated — schema/dictionary changed; commit the updated bundle.");
  }
} else {
  out.actions.push(`No data dictionary at ${DICT_DIR} — add the §14d Developer Manual module so OKF can be generated.`);
}

// 2. Doc freshness: did code change after the last User Manual / Changelog edit?
const lastEditOf = (glob) => sh(`git log -1 --format=%ct -- ${glob} 2>/dev/null`) || "0";
const lastCode = sh(`git log -1 --format=%ct -- 'server' 'src' 'shared' 'app' 2>/dev/null`) || "0";
if (Number(lastCode) > Number(lastEditOf("'docs/**' 'CHANGELOG.md'")) ) {
  out.actions.push("Code changed after the last docs/Changelog edit — review User Manual (§17a) + add a Changelog entry (§17b).");
}
if (!fs.existsSync("CHANGELOG.md") && !sh(`git ls-files 'changelog*' 'CHANGELOG*'`)) {
  out.actions.push("No Changelog found — add one (§17b).");
}

// 3. Dependency / plugin upgrade recommendations (recommend-only)
if (fs.existsSync("package.json")) {
  const outdated = sh(`npm outdated --json || true`);
  try {
    const o = JSON.parse(outdated || "{}");
    const ups = Object.entries(o).map(([n, d]) => ({ pkg: n, cur: d.current, latest: d.latest,
      major: (parseInt(d.latest) || 0) > (parseInt(d.current) || 0) }));
    if (ups.length) {
      out.upgrades = ups;
      const majors = ups.filter((u) => u.major).length;
      out.actions.push(`${ups.length} dependency upgrade(s) available (${majors} major) — RECOMMEND to owner; do not auto-apply (Tier-1).`);
    }
  } catch { /* npm outdated returns non-JSON when clean */ }
}

console.log(JSON.stringify(out, null, 2));
if (out.actions.length) {
  console.error(`\n[nightly-doc-sweep] ${APP}: ${out.actions.length} item(s) need attention:`);
  out.actions.forEach((a) => console.error("  • " + a));
  process.exit(1);          // cron / poller alerts on non-zero
}
console.error(`[nightly-doc-sweep] ${APP}: all knowledge surfaces fresh ✅`);
