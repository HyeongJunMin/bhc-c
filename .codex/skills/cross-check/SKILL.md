---
name: cross-check
description: Ask for a topic name, analyze all docs/discussions files containing that topic in the filename, and conclude which analysis is most correct and what direction is best.
---

# cross-check

## Trigger
- User says `cross-check`.
- User asks to compare multiple discussion notes and choose the best conclusion.

## Workflow
1. Ask the user:
- `주제이름은 뭐로할까요?`
2. Collect candidate files:
- Search `docs/discussions` for filenames containing the topic string.
- If none found, report no matches and stop.
3. Read all matched files and compare quality using this order:
- code evidence quality (file path + line references)
- logical consistency (claim vs evidence)
- reproducibility (can another engineer verify quickly)
- actionability (clear next steps)
4. Produce a final judgment:
- 가장 타당한 문서 1개
- 덜 타당한 문서들의 약점
- 통합 결론(최종 기술 방향)
5. If needed, update one target discussion file with consolidated conclusion.

## Output Contract
- Always include:
- matched file list
- best analysis file
- final recommended direction
- confidence and remaining uncertainty

## Rules
- Restrict scope to `docs/discussions/*`.
- Do not decide by model name (`codex`, `kimi`, `claude`) bias.
- Decide only by evidence quality and technical correctness.
