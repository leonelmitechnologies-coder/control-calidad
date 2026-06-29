---
allowed-tools: Read, Write, Edit, Glob, Bash, AskUserQuestion, Task
argument-hint: ""
description: Prepare for /clear — capture a complete session handoff and tidy docs so the next session can pick up cold.
---

# /getreadytoclear — session handoff for MI Apps projects

When the user invokes this command, prepare the project so a fresh Claude Code session (the next session, after `/clear` or a context window flush) can resume work without losing context. Two outputs:

1. A **`SESSION_HANDOFF.md`** at the project root that captures what was decided, what's in-flight, and what to do next.
2. A **cleanup pass** on stale .md files so the next session isn't reading outdated rules.

The handoff file is the most important artifact — write it carefully. The cleanup is opportunistic.

## Workflow

Execute **in order**. Always confirm destructive operations.

### Step 0 — Preflight

Verify nothing dangerous is in flight:

```bash
git status                                  # uncommitted work present?
git stash list                              # stashes that might be lost?
ls .claude/scheduled_tasks.lock 2>/dev/null # scheduled task running?
```

If there's uncommitted work, ask: commit, stash, or note it in the handoff (so the next session knows where to resume).

### Step 1 — Capture session state for the handoff file

Pull data from the runtime:

```bash
# Git
git status --short
git log -5 --oneline
git branch --show-current
git stash list

# Test / build state (if recently run)
[ -f "test-results/.last-run.json" ] && cat test-results/.last-run.json | jq

# In-flight deploys (if on the MI Apps stack)
# Check Coolify's deploy queue for this app — adjust the slug
COOLIFY_API=http://localhost:8000/api/v1
[ -n "$COOLIFY_API_TOKEN" ] && curl -s -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$COOLIFY_API/applications/<uuid>/deployments?per_page=3" | jq

# Recent .claude/agents/* edits (if your project ships its own agents)
git log -10 --name-status -- .claude/ | head -30
```

### Step 2 — Read the conversation and extract decisions

Walk back through the current session in your head. Capture, in order:

- **Goal** — what the user asked for at the start of the session, in their words
- **Done** — concrete artifacts produced (file paths, commits, URLs)
- **Open** — what wasn't finished, with enough detail to resume
- **Decisions** — non-obvious choices made and why (e.g. "Chose Drizzle over Prisma because /stack §5 mandates it")
- **Surprises** — bugs found, gotchas hit, deviations from plan that future sessions need to know
- **Next steps** — the literal next 3-5 actions the next session should take

Be specific. "Need to fix the orders endpoint" is not actionable; "POST /api/orders fails validation when `notes` is null; the Zod schema needs `.nullable()` on line 47 of shared/schema.ts" is.

### Step 3 — Write SESSION_HANDOFF.md

Use this template at the project root. Overwrite the previous handoff (it's history; older versions are in git):

```markdown
# Session Handoff — <date>

## Goal of this session
<one-paragraph summary in the user's voice>

## State on close
- Branch: <branch>
- Last commit: <sha> "<msg>"
- Working tree: <clean | dirty with N files>
- In-flight: <none | brief>

## Done
- <bullet — file path or commit sha + one-line description>
- <bullet>
- <bullet>

## Open / next session picks up here
1. <action> — <why> — <file:line if applicable>
2. <action>
3. <action>

## Decisions made (with rationale)
- **<decision>** — <why> — <reference to docs/stack section if relevant>

## Surprises + gotchas
- <thing that wasn't in the plan> — <what to know about it>

## Don't forget
- [ ] <thing the user mentioned but we didn't get to>
- [ ] <follow-up flagged for later>

## Useful refs
- /stack: https://apps.mi2.com.mx/stack#<section>
- Suggestions: https://suggestions.mi2.com.mx
- This project's CLAUDE.md: ./CLAUDE.md
- Memory entries created/updated: <list>

## How to verify the state on resume
```bash
<concrete commands the next session should run first to verify the state>
```
```

Make it tight. A new session reads this in 30 seconds and starts working.

### Step 4 — Inventory .md files

Find all markdown files in the project that might be stale:

```bash
find . -type f -name "*.md" \
  -not -path "./node_modules/*" \
  -not -path "./.git/*" \
  -not -path "./dist/*" \
  -not -path "./build/*" \
  -not -path "./drizzle/*" \
  -printf "%T@ %p\n" \
  | sort -rn \
  | awk '{print strftime("%Y-%m-%d", $1), $2}'
```

Bucket the results:
- **Active** (modified in last 14 days) — leave alone
- **Stale candidates** (>14 days, no recent activity) — review for relevance
- **Suspected duplicates** (similar names, similar content) — propose consolidation
- **Always preserve** — `README.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `SESSION_HANDOFF.md`, any file in `docs/` or `.github/`

### Step 5 — Propose cleanup

Show the user a structured list and use `AskUserQuestion` to get a decision:

```markdown
## Stale files (>14 days, recommend review)
- old-plan.md (last modified 2026-03-01) — looks superseded by ARCHITECTURE.md
- TODO.md (last modified 2026-02-15) — items appear in current GitHub issues

## Apparent duplicates
- DEPLOYMENT.md and deploy-notes.md cover the same content
- README.md and getting-started.md overlap significantly

## Suggested consolidations
- docs/api-v1.md + docs/api-v2.md → docs/api.md (with versioned sections)
```

For each candidate, ask: **delete**, **consolidate**, **keep as-is**, or **skip**.

### Step 6 — Execute cleanup (only after confirmation)

For deletions:
```bash
# Check for references before deleting
for f in <files-to-delete>; do
  echo "=== references to $f ==="
  grep -rn "$f" . --include="*.md" --include="*.ts" --include="*.tsx" --include="*.json" \
    --exclude-dir=node_modules --exclude-dir=.git \
    | grep -v "^Binary file" \
    | head
done
```

If there are references, fix them first (update or remove) — don't leave broken links.

Then delete or consolidate. For deletions: `git rm <file>` so the removal is tracked.

For consolidations: read the source files, write a merged version, then `git rm` the originals.

**Never** force a deletion the user didn't approve. **Never** delete `README.md`, `CLAUDE.md`, `ARCHITECTURE.md`, or any file the user flagged "always preserve."

### Step 7 — Commit the cleanup (if changes were made)

If you deleted or merged files, commit:

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore(docs): pre-clear cleanup

- removed stale: <list>
- consolidated: <list>

Done as part of /getreadytoclear preparation.
EOF
)"
```

**Don't push** unless the user explicitly asks. The user might want to review the diff first.

### Step 8 — Verify the handoff is complete

Read your own SESSION_HANDOFF.md back. Imagine you're a fresh Claude Code session opening this project for the first time. Can you answer:

1. What was the user trying to do?
2. Where did the previous session leave off?
3. What's the next concrete action?
4. Are there any landmines I should know about?

If any answer is "I can't tell from the handoff," revise.

### Step 9 — Final report

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Ready for /clear
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Handoff:      ✓ SESSION_HANDOFF.md written (X lines)
  Cleanup:      ✓ deleted N stale, consolidated M duplicates
  Working tree: ✓ clean
  Last commit:  <sha> "<msg>"
  Branch:       <branch>

Next session can resume by reading SESSION_HANDOFF.md and running:
  <the verify commands from the handoff>
```

## Important guidelines

- **The handoff file is the deliverable.** Cleanup is secondary; if you only have time for one of the two, do the handoff well.
- **Specificity beats brevity.** A 50-line handoff with file:line citations beats a 10-line bullet list of vague pointers.
- **Always confirm deletions** — `AskUserQuestion` per cleanup batch, not "I'll delete all these without asking."
- **Preserve git history.** Use `git rm` not plain `rm` so removals are tracked.
- **Check references before deleting.** Don't leave broken links in surviving docs.
- **Don't push** — the cleanup commit stays local until the user reviews and pushes themselves (or instructs you to push).
- **Memory updates.** If the project uses Claude Code's memory system, note in the handoff which memories were created/updated this session.

## Integration with the MI Apps platform

- **For Coolify-deployed apps**, also note in the handoff any **in-flight deploys** (recent deployment_uuids and their status). The next session shouldn't trigger duplicate deploys.
- **For projects that own agents** (mirror of /stack agents library), check whether `.claude/agents/` drifted from the canonical at `apps.mi2.com.mx/stack/agents/` and flag in the handoff.
- **For pending suggestions** — if this session opened a suggestion at https://suggestions.mi2.com.mx, note its id + status in the handoff so the next session can follow up.

## Customize for your project

- Replace the SSH targets in Step 1 with your project's actual host.
- Adjust the "always preserve" list in Step 4 — add any project-specific files (e.g. `RFC-0001.md`, `BRAND.md`).
- If your project uses a per-session tracker like `PROGRESS.md`, also update it (not just SESSION_HANDOFF.md).
