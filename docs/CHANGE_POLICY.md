# Spec Change Policy (MVP)

## Purpose
Prevent silent drift between `GDD`, `Physics-Spec`, and `Input-Schema`.

## Source of Truth
- Product behavior: `docs/GDD.md`, `docs/GDD_kr.md`
- Shot input contract: `schemas/shot-input-v1.json`
- Human-readable contract guide: `docs/Input-Schema.md`, `docs/Input-Schema_kr.md`
- Physics implementation rules: `docs/Physics-Spec.md`, `docs/Physics-Spec_kr.md`

## Mandatory Sync Rules
1. If `docs/GDD.md` or `docs/GDD_kr.md` changes, at least one of these must also change:
- `docs/Physics-Spec.md`
- `docs/Physics-Spec_kr.md`
- `docs/Input-Schema.md`
- `docs/Input-Schema_kr.md`
- `schemas/shot-input-v1.json`

2. If `schemas/shot-input-v1.json` changes, both must change:
- `docs/Input-Schema.md`
- `docs/Input-Schema_kr.md`

3. Language pair sync is mandatory:
- If `docs/GDD.md` changes, `docs/GDD_kr.md` must also change (and vice versa).
- If `docs/Physics-Spec.md` changes, `docs/Physics-Spec_kr.md` must also change (and vice versa).
- If `docs/Input-Schema.md` changes, `docs/Input-Schema_kr.md` must also change (and vice versa).

4. Schema version consistency:
- `schemas/shot-input-v1.json` `schemaVersion` const value must match:
  - `docs/Input-Schema.md` line: ``schemaVersion`: `x.y.z``
  - `docs/Input-Schema_kr.md` line: ``schemaVersion`: `x.y.z``

## Enforcement
- CI must run `scripts/ci/spec_guard.py` on pull requests.
- Any violation must fail CI and block merge.
