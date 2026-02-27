# /cross-check

When this command is called:

1. Ask:
- 주제이름은 뭐로할까요?

2. Find all discussion files under `docs/discussions` whose filename contains the topic text.

3. Compare all matched files by:
- evidence quality (code path + line refs)
- logical consistency
- reproducibility
- actionability

4. Return:
- matched files
- the most correct analysis
- why others are weaker
- final recommended technical direction
- confidence and open risks

Rules:
- Never pick by model brand (`codex`, `kimi`, `claude`).
- Pick by technical evidence only.
