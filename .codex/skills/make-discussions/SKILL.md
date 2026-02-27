---
name: make-discussions
description: Create a discussion note under docs/discussions by asking for topic, key, and work item id, then naming the file {topic}_{key}_{modelName}.md and filling root-cause analysis content.
---

# make-discussions

## Trigger
- User says `make-discussions`.
- User asks to create a discussion note with topic/key/work-item metadata.

## Workflow
1. Ask exactly these 3 questions in Korean:
- `주제이름은 뭐로할까요?`
- `key는 뭐로할까요?`
- `일감번호는 뭐로할까요?`
2. Determine `modelName`:
- Codex/OpenAI session: `codex`
- Claude/Anthropic session: `claude`
- Kimi/Moonshot session: `kimi`
- If unclear: use `codex`
3. Run:
- `bash scripts/make-discussion-note.sh "<topic>" "<key>" "<work_id>" "<modelName>"`
4. Immediately edit the created file and fill all sections with concrete content from the current thread:
- `배경`: user symptom summary
- `쟁점`: what is disputed
- `선택지`: at least 2 alternatives
- `결정`: chosen conclusion
- `근거`: concrete code-level evidence (file paths and line refs)
- `후속 작업`: actionable next steps
5. Return:
- created file path
- filename tokens (`topic`, `key`, `modelName`)

## Rules
- Output location must be `docs/discussions/`.
- Filename must be `{topic}_{key}_{modelName}.md`.
- Preserve user topic/key text in filename (sanitize only path separators/control chars).
- `work_id` must be written in the file body even though it is not part of the filename.
- Do not finish with empty headings; analysis content is mandatory.
