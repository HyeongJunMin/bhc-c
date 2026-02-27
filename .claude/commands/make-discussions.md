# /make-discussions

When this command is called:

1. Ask the user exactly these 3 questions in Korean.
- 주제이름은 뭐로할까요?
- key는 뭐로할까요?
- 일감번호는 뭐로할까요?

2. Resolve `modelName` for filename:
- Claude session: `claude`
- Codex/OpenAI session: `codex`
- Kimi session: `kimi`
- If unknown: `claude`

3. Create the file with:
- `bash scripts/make-discussion-note.sh "<topic>" "<key>" "<work_id>" "<modelName>"`

4. Immediately fill the created markdown with real analysis from the current conversation:
- 배경
- 쟁점
- 선택지(2개 이상)
- 결정
- 근거(코드 파일/라인 포함)
- 후속 작업

5. Confirm the created path and show:
- topic
- key
- work_id
- modelName

Constraints:
- Always create under `docs/discussions/`.
- Filename format: `{topic}_{key}_{modelName}.md`.
- Do not leave section bodies empty.
