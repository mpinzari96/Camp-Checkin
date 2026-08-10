# Loop Engineering Kit — Setup

Drop these into the root of your `camp-checkin` project (the folder with `package.json`).
They layer on top of the app you already have; nothing here changes app behavior — it
changes how you and the agents work.

## What goes where
```
camp-checkin/
├─ docs/
│  ├─ DESIRED_OUTCOME.md   ← the north star; agents read this every task
│  └─ LOOP_WORKFLOW.md     ← how to run the build→review→fix loop
├─ .cursor/rules/
│  ├─ 00-always.mdc        ← always-applied standards (the contract)
│  ├─ 10-supabase.mdc      ← auto-applies to DB/realtime/server files
│  └─ 20-frontend.mdc      ← auto-applies to UI files
└─ .claude/skills/
   ├─ supabase-migration/SKILL.md   ← builder: safe DB migrations
   ├─ realtime-feature/SKILL.md     ← builder: live+optimistic features
   └─ pre-ship-review/SKILL.md      ← reviewer: independent pass, PASS/FAIL
```

## First-time setup (5 minutes)
1. Copy the four folders above into your project root (merge with any existing `docs/`).
2. Commit them so they're versioned with the code:
   `git add docs .cursor .claude && git commit -m "Add loop-engineering kit"`
3. Open the project in Cursor. The `.cursor/rules/*.mdc` are picked up automatically.
4. Skim `docs/DESIRED_OUTCOME.md` and edit anything that doesn't match your intent —
   this file is the single source of truth the agents defer to, so it should read the
   way *you* think about the app.

## Daily use
- Start a task with the template in `docs/LOOP_WORKFLOW.md` (Builder prompt).
- When it says it's done, open a second Cursor chat and paste the Reviewer prompt.
- Feed the verdict back to the Builder to fix. Approve when it PASSes.
- Any time you correct the same thing twice, add it to `DESIRED_OUTCOME.md` or a rule.

## How this delivers what you asked for
- **"Skills accordingly"** → three skills that encode your repeatable jobs (migrate,
  build a live feature, review) so you don't re-explain the steps.
- **"Agents checking each other's work"** → the Builder/Reviewer loop run as two Cursor
  chats on **different models**, so you get two different engines' blind spots. The
  reviewer works from a concrete invariant checklist and is told not to trust the
  author's framing. (See docs/LOOP_WORKFLOW.md.)
- **"So I don't have to keep prompting"** → rules auto-enforce standards, the outcome doc
  carries intent between sessions, and the loop template turns each task into one prompt
  plus an approval instead of a back-and-forth.
- **"Give it the desired outcome to work with along the way"** → `DESIRED_OUTCOME.md` is
  that contract; every rule and skill points back to it.

## A note on expectations
Cursor doesn't run fully autonomous agents that supervise each other with zero input —
what it does well is exactly this: strong standing rules, reusable skills, and a
disciplined Builder/Reviewer loop. Run it as **two Cursor chats on different models**
(the efficient default); reach for a different-tool reviewer only for high-stakes
changes that need maximum independence. That combination is what actually reduces your
prompting, and it's more reliable than a hands-off "swarm" because you keep a fast
approval gate where it matters (plans and final sign-off) and automate around it.
