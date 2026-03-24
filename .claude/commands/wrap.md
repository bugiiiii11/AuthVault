---
description: Check session state -- auto-detect dirty files, commit & push if needed, update docs if stale
---

Check the current state of work and wrap up anything that needs it. Safe to call anytime -- mid-session, after a chunk of work, or at session end. If nothing needs doing, say so and stop.

## Step 1 -- Assess current state (do all in parallel)

Run these commands in parallel:
- `git status -sb` -- working tree status
- `git diff --stat` -- unstaged changes
- `git diff --cached --stat` -- staged changes
- `git rev-list origin/main..HEAD --count 2>/dev/null || echo "0"` -- unpushed commits

Read:
- `handoff.md` -- is the current session documented? Is "What To Do Next" accurate?

## Step 2 -- Report and act

Present a brief status check:

## Wrap Check

### Repo Status
| Branch | Uncommitted | Unpushed | Action needed |
|--------|-------------|----------|---------------|
| <branch> | <files or "clean"> | <count or 0> | <yes/no> |

**Handoff status:** <up to date / needs session N section / stale>

Then handle each issue:

### Code changes (commit & push)
- If there are uncommitted changes:
  - Show the changed files
  - Ask: "Want me to commit & push?"
  - If yes, follow standard git commit protocol, then push to origin
  - Treat commit & push as one action unless user says otherwise
- Do NOT auto-commit -- always ask first

### Documentation updates
- If handoff.md needs updating, invoke `/doc-update`
- If this was a discussion/analysis session (no code), still update "What To Do Next" if priorities changed

### "What To Do Next" check
- Compare "What To Do Next" against what was done this session
- Flag completed items and suggest new ones
- Ask the user before making changes

## Rules

- Always ask before committing, pushing, or modifying docs
- If everything is clean and up to date, just say "All wrapped. Nothing to do." and stop
- Keep it brief
- This skill can be called multiple times safely (idempotent)
