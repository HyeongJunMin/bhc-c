# AGENTS.md

## Spec Sync Rules (Mandatory)

When any spec document changes, related documents must be updated in the same task.

### Trigger Files
- `docs/GDD.md`
- `docs/GDD_kr.md`
- `docs/Physics-Spec.md`
- `docs/Physics-Spec_kr.md`
- `docs/Input-Schema.md`
- `docs/Input-Schema_kr.md`
- `schemas/shot-input-v1.json`

### Required Behavior
1. If `docs/GDD.md` or `docs/GDD_kr.md` changes:
- Also review and update as needed:
  - `docs/Physics-Spec.md`
  - `docs/Physics-Spec_kr.md`
  - `docs/Input-Schema.md`
  - `docs/Input-Schema_kr.md`
  - `schemas/shot-input-v1.json`

2. If `schemas/shot-input-v1.json` changes:
- Must update both:
  - `docs/Input-Schema.md`
  - `docs/Input-Schema_kr.md`

3. Language-pair sync is mandatory:
- English and Korean pairs must be updated together:
  - `docs/GDD.md` <-> `docs/GDD_kr.md`
  - `docs/Physics-Spec.md` <-> `docs/Physics-Spec_kr.md`
  - `docs/Input-Schema.md` <-> `docs/Input-Schema_kr.md`

4. Version consistency is mandatory:
- `schemaVersion` in `schemas/shot-input-v1.json` must match both Input-Schema docs.

### Execution Checklist (Every spec-related task)
- Identify impacted trigger files.
- Apply edits to all required linked files.
- Run `python3 scripts/ci/spec_guard.py <changed_files...>` before finishing.
- Report exactly which linked files were updated.

## Implementation Handoff Rule (Mandatory)
- For implementation tasks, read `docs/Execution-Backlog.md` first and pick the smallest executable task unit.
- Follow `docs/Task-Workflow.md` for per-task commit/push policy and commit message format.
- Commit messages must use Korean for human-readable descriptions (title/body), while keeping IDs/paths/commands as-is.
- In session output, always report:
  1. selected task ID
  2. done/not done
  3. validation command results
  4. next recommended task ID

## Approval Rule (Mandatory)
- Do not edit code files before explicit user approval.
- For analysis/questions/planning requests, provide findings and plan only.
- Start file edits only after the user clearly requests implementation (for example: "수정해", "적용해", "바꿔").

## Mandatory Commit Granularity
- Exactly one micro task per commit.
- Commit title must use the exact micro task ID (for example, `[PHY-AXIS-001A] ...`).
- Never bundle multiple micro tasks in one commit.
- Before commit, update `docs/Execution-Status.md` for that single task only.

## Skills
A skill is a set of local instructions to follow that is stored in a `SKILL.md` file.

### Available skills
- do-and-show: Execute requested work end-to-end and present concrete evidence (diff/test output) in the same response. (file: /Users/minhyeongjun/IdeaProjects/bhc/.codex/skills/do-and-show/SKILL.md)

### How to use skills
- Trigger rules: If the user says `do-and-show` (or equivalent like `해보고 보여줘`), this skill must be used for that turn.
- Read only the minimum part of `SKILL.md` needed to execute the workflow.
- Keep evidence concise: changed files, key command results, and residual risks only.
