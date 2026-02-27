# do-and-show

## Purpose
Execute the requested change end-to-end (`do`), then provide concrete evidence (`show`) in the same response.

## Trigger
- User explicitly says: `do-and-show`, `해보고 보여줘`, `직접 실행하고 결과 보여줘`.
- Or the task naturally requires proof (edits + command output + diff summary).

## Workflow
1. Confirm target outcome and immediately implement it.
2. Run the minimum validation commands needed for confidence.
3. Collect evidence:
   - Changed files
   - Key diff summary
   - Test/build command results
4. Report in this exact order:
   - What was done
   - What evidence proves it
   - Remaining risks or not-run checks

## Output Contract
- Always include:
  - `Done`: short completion statement
  - `Show`: command(s) and pass/fail results
  - `Files`: explicit modified file list
- If something cannot be run, state that explicitly and why.

## Guardrails
- Do not stop at plan-only answers.
- Do not claim completion without runnable evidence.
- Keep evidence concise and relevant to the user request.
