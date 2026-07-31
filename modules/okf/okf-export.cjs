#!/usr/bin/env node
/**
 * okf-export.cjs — emit an OKF (Open Knowledge Format v0.1) bundle from a
 * Developer Manual (§14d) data dictionary.
 *
 * OKF (Google Cloud, 2026-06): a directory of Markdown files + YAML frontmatter,
 * each file a "concept", cross-linked into a graph. One required frontmatter
 * field: `type`. Reserved files: index.md (listing) + log.md (history).
 * Spec: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md
 *
 * This turns our existing data dictionary (the "#1 quality factor" §14c/§14d) into
 * a portable, vendor-neutral bundle any agent / MCP / tool can consume — not just
 * our own MCP. Producer-side; the MCP serves it (see okf-mcp-tools.ts).
 *
 * Usage:
 *   node okf-export.cjs <dictionary-dir> <out-bundle-dir> [--db-kind "SQL Server"] [--app NAME] [--base-uri URI]
 *   # <dictionary-dir> holds the per-domain *.json files (server dictionary export
 *   #   or docs/developer-manual/seed/dictionary/). No deps — stdlib only.
 */
const fs = require("fs");
const path = require("path");

function arg(flag, def) {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : def;
}
const [dictDir, outDir] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!dictDir || !outDir) {
  console.error(
    "usage: node okf-export.cjs <dictionary-dir> <out-bundle-dir> [--db-kind X] [--app NAME] [--base-uri URI]",
  );
  process.exit(2);
}
const DB_KIND = arg("--db-kind", "SQL Table");
const APP = arg("--app", "app");
const BASE_URI = arg("--base-uri", ""); // e.g. mssql://MSSQL-PROD/BinManager  → resource = BASE_URI + "/" + table
const now = new Date().toISOString();

const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
function fm(obj) {
  // minimal YAML frontmatter writer
  const esc = (v) => (/[:#"'\n]/.test(String(v)) ? JSON.stringify(String(v)) : v);
  const lines = ["---"];
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    if (Array.isArray(v)) lines.push(`${k}: [${v.map(esc).join(", ")}]`);
    else lines.push(`${k}: ${esc(v)}`);
  }
  lines.push("---", "");
  return lines.join("\n");
}

// ---- load dictionary domains ----
const files = fs.readdirSync(dictDir).filter((f) => f.endsWith(".json"));
if (!files.length) {
  console.error(`no *.json dictionary files in ${dictDir}`);
  process.exit(1);
}
const domains = files.map((f) => ({
  file: f,
  ...JSON.parse(fs.readFileSync(path.join(dictDir, f), "utf8")),
}));

// build a name→slug index for cross-links (FK references)
const tableSlug = {};
for (const d of domains) for (const t of d.tables || []) tableSlug[t.name] = slug(t.name);
const linkFor = (name) =>
  tableSlug[name] ? `[${name}](/tables/${tableSlug[name]}.md)` : `\`${name}\``;

fs.mkdirSync(path.join(outDir, "tables"), { recursive: true });
let conceptCount = 0;

for (const d of domains) {
  for (const t of d.tables || []) {
    conceptCount++;
    const cols = t.columns || [];
    const frontmatter = fm({
      type: DB_KIND,
      title: t.name,
      description: (t.purpose || "").split("\n")[0].slice(0, 200),
      resource: BASE_URI ? `${BASE_URI}/${t.name}` : undefined,
      tags: [d.domainKey || slug(d.title || "domain"), APP].filter(Boolean),
      timestamp: now,
      columns: cols.length,
    });
    const cell = (v) =>
      String(v == null ? "" : v)
        .replace(/\|/g, "\\|")
        .replace(/\n/g, " ");
    const colRows = cols
      .map((c) => {
        // turn an FK "references X" note into a real OKF cross-link in the body
        const refs = c.references
          ? cell(c.references).replace(/\b([a-z_][a-z0-9_]+)\b/gi, (m) =>
              tableSlug[m] ? linkFor(m) : m,
            )
          : "—";
        return `| ${cell(c.name)} | ${cell(c.type)} | ${c.nullable ? "yes" : "no"} | ${cell(c.meaning)} | ${refs} | ${cell(c.allowedValues) || "—"} | ${cell(c.notes)} |`;
      })
      .join("\n");
    const fks = (t.foreignKeys || []).length
      ? t.foreignKeys
          .map(
            (fk) =>
              `- ${fk.column || fk.from || "?"} → ${linkFor(fk.references || fk.to || fk.table || "?")}`,
          )
          .join("\n")
      : "none";
    const queries =
      (t.sampleQueries || []).map((q) => `- ${q.description}: \`${q.sql}\``).join("\n") || "—";
    const body = [
      `# ${t.name}`,
      "",
      t.purpose || "",
      "",
      "| Field | Type | Nullable | Meaning | Relationships | Allowed values | Notes |",
      "|---|---|---|---|---|---|---|",
      colRows,
      "",
      `**Foreign keys:** ${fks}`,
      "",
      `**Sample queries:**`,
      queries,
      "",
    ].join("\n");
    fs.writeFileSync(path.join(outDir, "tables", `${slug(t.name)}.md`), frontmatter + body);
  }
}

// ---- reserved: index.md (progressive-disclosure listing) ----
const indexBody = [
  `# ${APP} — knowledge bundle (OKF)`,
  "",
  `> Open Knowledge Format v0.1 bundle generated from the ${APP} Developer Manual data dictionary on ${now}.`,
  `> ${conceptCount} concept(s) across ${domains.length} domain(s). Each \`tables/*.md\` is a concept; this is ground truth — answer from it, don't guess.`,
  "",
  "## Concepts",
  ...domains.flatMap((d) => [
    `### ${d.title || d.domainKey}`,
    ...(d.tables || []).map(
      (t) =>
        `- [${t.name}](/tables/${slug(t.name)}.md) — ${(t.purpose || "").split("\n")[0].slice(0, 90)}`,
    ),
    "",
  ]),
].join("\n");
fs.writeFileSync(
  path.join(outDir, "index.md"),
  fm({ type: "Index", title: `${APP} knowledge bundle`, timestamp: now }) + indexBody,
);

// ---- reserved: log.md (chronological history) ----
const logPath = path.join(outDir, "log.md");
const entry = `- ${now} — regenerated from data dictionary (${conceptCount} concepts, ${domains.length} domains).`;
const log = fs.existsSync(logPath)
  ? fs.readFileSync(logPath, "utf8")
  : fm({ type: "Log", title: `${APP} bundle history`, timestamp: now }) + `# Update log\n\n`;
fs.writeFileSync(logPath, log.trimEnd() + "\n" + entry + "\n");

console.log(
  `OKF bundle written to ${outDir}: ${conceptCount} concepts, ${domains.length} domains, + index.md + log.md`,
);
