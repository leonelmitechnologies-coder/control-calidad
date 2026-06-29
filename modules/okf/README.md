# OKF module — Open Knowledge Format for MI MCPs + Developer Manual

[OKF (Open Knowledge Format)](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
is Google Cloud's vendor-neutral spec (v0.1, 2026-06) for representing curated knowledge as a
**directory of Markdown files with YAML frontmatter**, cross-linked into a graph. One required
frontmatter field: `type`. Reserved files: `index.md` (listing) + `log.md` (history). No SDK, no
runtime — "just files."

**Why MI uses it:** it's the standardized form of our existing "**data dictionary = #1 quality
factor**" rule (§14c/§14d). It makes an app's data model **portable + vendor-neutral**: any agent,
MCP, search index, or RAG pipeline can consume it without our SDK. OKF is the **producer** side;
your **MCP** is the **consumer** side — they compose (OKF does not replace MCP).

```
Developer Manual data dictionary ──okf-export.cjs──► OKF bundle (markdown) ──okf-mcp-tools──► MCP tools ──► agents
        (producer, §14d)                              (portable ground truth)    (consumer)
```

## Producer — emit a bundle (`okf-export.cjs`, Node stdlib, no deps)
```bash
node okf-export.cjs <dictionary-dir> <out-bundle-dir> \
  --db-kind "SQL Server Table" --app myapp --base-uri "mssql://MSSQL-PROD/MyDb"
```
- `<dictionary-dir>`: the per-domain `*.json` files (the §14d dictionary export, or
  `docs/developer-manual/seed/dictionary/`).
- Emits: `tables/<name>.md` per table (frontmatter: `type,title,description,resource,tags,timestamp`;
  body: column dictionary + FKs as **cross-links** + sample queries), plus reserved `index.md`
  (overview/listing) and `log.md` (regeneration history, appended each run).
- Regenerate it whenever the schema changes (wire into the §14d maintenance mandate / `db:push`).

See `sample-bundle/` for a generated, conformance-checked example (renders on GitHub).

## Consumer — serve it from your MCP (`okf-mcp-tools.ts`)
Drop into any `@modelcontextprotocol/sdk` server:
```ts
import { registerOkfTools } from "./okf-mcp-tools";
registerOkfTools(server, process.env.OKF_BUNDLE_DIR ?? "/data/okf-bundle");
```
Adds 3 read-only tools: `okf_list_concepts`, `okf_read_concept`, `okf_search`. Agents ground answers
in the bundle instead of guessing. (Apps that already have the §14d dev-manual MCP get `get_table`/
`find_field`/etc. — the OKF tools are the portable equivalent over the exported bundle; ship both or
either.)

## Conformance (what makes a bundle valid)
1. Every non-reserved `.md` has parseable YAML frontmatter with a **non-empty `type`**.
2. `index.md` / `log.md` are reserved (listing / history) — never concept docs.
3. Consumers are **permissive**: tolerate unknown types/keys, missing optional fields, and broken
   links (a broken link = not-yet-written knowledge, not an error).

## Keep it current (HARD RULE)
A bundle is only as good as its freshness — same mandate as §14d. Any schema/architecture change
re-runs `okf-export.cjs` in the same change. Stale bundle → agents confidently wrong.

## Nightly doc sweep (overnight) — keep everything in sync

`nightly-doc-sweep.cjs` is the per-app job that keeps your knowledge surfaces matching
the **current** app structure. Run it nightly (cron, or your always-on poller's daily tick):
```bash
node modules/okf/nightly-doc-sweep.cjs      # from the app repo root
```
It (1) **regenerates the OKF bundle + Developer Manual export** from the live data
dictionary, (2) **flags a stale User Manual / Changelog** when code changed after the last
docs edit, and (3) **recommends dependency/plugin upgrades** (`npm outdated`). It is
**recommend-only** — a dep/code upgrade is **Tier-1** (Agent Operating Constitution), so the
agent proposes to its owner and never auto-applies. Exit code 1 when action is needed (cron
alerts on it). Platform-wide, coolify-manager also runs an overnight sweep across managed
apps and posts a digest to #coolify-ops (see /stack §24).
