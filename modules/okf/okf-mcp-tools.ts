// okf-mcp-tools.ts — serve an OKF (Open Knowledge Format v0.1) bundle through MCP.
//
// This is the CONSUMER side: drop these 3 tools into any MI MCP server
// (@modelcontextprotocol/sdk) so agents can ground answers in a curated OKF bundle
// — the "#1 quality factor" data dictionary, portable + vendor-neutral. Pair with
// okf-export.cjs (producer). The bundle is just a directory of markdown files; no DB,
// no SDK to read it. Spec: https://github.com/GoogleCloudPlatform/knowledge-catalog
//
// Wire-up (in your MCP's buildServer()):
//   import { registerOkfTools } from "./okf-mcp-tools";
//   registerOkfTools(server, process.env.OKF_BUNDLE_DIR ?? "/data/okf-bundle");
//
// [EDIT] nothing required — it's domain-agnostic; the bundle carries the domain.
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const asText = (o: unknown) => ({ content: [{ type: "text" as const, text: typeof o === "string" ? o : JSON.stringify(o, null, 2) }] });

function listMd(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".md")) out.push(p);
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return out;
}
function parseFrontmatter(txt: string): Record<string, string> {
  if (!txt.startsWith("---")) return {};
  const end = txt.indexOf("\n---", 3);
  if (end < 0) return {};
  const fm: Record<string, string> = {};
  for (const line of txt.slice(3, end).split("\n")) {
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (m) fm[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return fm;
}

export function registerOkfTools(server: any, bundleDir: string) {
  // bundle-relative path "/tables/x.md" → filesystem path
  const resolve = (rel: string) => path.join(bundleDir, rel.replace(/^\//, ""));

  server.registerTool("okf_list_concepts",
    { description: "List every concept in the OKF knowledge bundle (the curated data dictionary / ground truth). Returns each concept's bundle path, type, title, description. Call this first.", inputSchema: {} },
    async () => {
      const items = listMd(bundleDir)
        .filter((p) => !/(^|\/)(index|log)\.md$/.test(p.slice(bundleDir.length)))
        .map((p) => {
          const fm = parseFrontmatter(fs.readFileSync(p, "utf8"));
          return { path: "/" + path.relative(bundleDir, p).split(path.sep).join("/"), type: fm.type, title: fm.title, description: fm.description };
        });
      return asText({ count: items.length, concepts: items });
    });

  server.registerTool("okf_read_concept",
    { description: "Read one OKF concept document by its bundle-relative path (e.g. '/tables/orders.md'). Returns the full markdown (frontmatter + body) — answer from this, don't guess.", inputSchema: { path: z.string().describe("bundle-relative path, e.g. /tables/orders.md") } },
    async ({ path: rel }: { path: string }) => {
      const fp = resolve(rel);
      if (!fp.startsWith(bundleDir) || !fs.existsSync(fp)) return asText({ error: `concept '${rel}' not found — call okf_list_concepts for valid paths` });
      return asText(fs.readFileSync(fp, "utf8"));
    });

  server.registerTool("okf_search",
    { description: "Full-text search the OKF bundle (concept titles, descriptions, and bodies). Use to find which concept covers a field/term/entity.", inputSchema: { query: z.string() } },
    async ({ query }: { query: string }) => {
      const q = query.toLowerCase();
      const hits = listMd(bundleDir).map((p) => {
        const txt = fs.readFileSync(p, "utf8");
        const fm = parseFrontmatter(txt);
        const n = (txt.toLowerCase().match(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
        return n ? { path: "/" + path.relative(bundleDir, p).split(path.sep).join("/"), type: fm.type, title: fm.title, matches: n } : null;
      }).filter(Boolean).sort((a: any, b: any) => b.matches - a.matches);
      return asText({ query, results: hits });
    });
}
