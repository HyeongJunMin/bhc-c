#!/usr/bin/env python3
import json
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]

GDD_EN = "docs/GDD.md"
GDD_KR = "docs/GDD_kr.md"
PHYS_EN = "docs/Physics-Spec.md"
PHYS_KR = "docs/Physics-Spec_kr.md"
INPUT_EN = "docs/Input-Schema.md"
INPUT_KR = "docs/Input-Schema_kr.md"
SCHEMA = "schemas/shot-input-v1.json"


def git_changed_files() -> list[str]:
    cmd = ["git", "diff", "--name-only", "HEAD~1...HEAD"]
    out = subprocess.check_output(cmd, cwd=ROOT, text=True)
    return [line.strip() for line in out.splitlines() if line.strip()]


def parse_schema_version_from_schema() -> str:
    data = json.loads((ROOT / SCHEMA).read_text(encoding="utf-8"))
    props = data.get("properties", {})
    ver = props.get("schemaVersion", {}).get("const")
    if not ver:
        raise ValueError(f"Cannot find schemaVersion const in {SCHEMA}")
    return ver


def parse_schema_version_from_doc(path: str) -> str:
    text = (ROOT / path).read_text(encoding="utf-8")
    m = re.search(r"`schemaVersion`\s*:\s*`([^`]+)`", text)
    if not m:
        raise ValueError(f"Cannot find schemaVersion line in {path}")
    return m.group(1)


def pair_rule(changed: set[str], a: str, b: str, errors: list[str]) -> None:
    if (a in changed) ^ (b in changed):
        errors.append(f"Language pair sync violated: change both `{a}` and `{b}`.")


def main() -> int:
    args = sys.argv[1:]
    changed_files: list[str]

    if args:
        changed_files = args
    else:
        try:
            changed_files = git_changed_files()
        except Exception as e:
            print(f"[spec-guard] Failed to detect changed files from git: {e}")
            print("[spec-guard] Pass changed file paths as CLI args.")
            return 2

    changed = set(changed_files)
    errors: list[str] = []

    # Rule 1: GDD change requires dependent docs/schema change
    if GDD_EN in changed or GDD_KR in changed:
        deps = {PHYS_EN, PHYS_KR, INPUT_EN, INPUT_KR, SCHEMA}
        if not (changed & deps):
            errors.append(
                "GDD changed but none of dependent docs/schema changed: "
                "`docs/Physics-Spec*.md`, `docs/Input-Schema*.md`, `schemas/shot-input-v1.json`."
            )

    # Rule 2: schema change requires both Input-Schema docs update
    if SCHEMA in changed:
        if INPUT_EN not in changed or INPUT_KR not in changed:
            errors.append(
                f"`{SCHEMA}` changed, but both `{INPUT_EN}` and `{INPUT_KR}` must be updated."
            )

    # Rule 3: language pair sync
    pair_rule(changed, GDD_EN, GDD_KR, errors)
    pair_rule(changed, PHYS_EN, PHYS_KR, errors)
    pair_rule(changed, INPUT_EN, INPUT_KR, errors)

    # Rule 4: schemaVersion consistency (always checked for safety)
    try:
        schema_ver = parse_schema_version_from_schema()
        doc_ver_en = parse_schema_version_from_doc(INPUT_EN)
        doc_ver_kr = parse_schema_version_from_doc(INPUT_KR)
        if not (schema_ver == doc_ver_en == doc_ver_kr):
            errors.append(
                "schemaVersion mismatch: "
                f"schema={schema_ver}, input-doc-en={doc_ver_en}, input-doc-kr={doc_ver_kr}"
            )
    except Exception as e:
        errors.append(str(e))

    if errors:
        print("[spec-guard] FAILED")
        for i, err in enumerate(errors, start=1):
            print(f"{i}. {err}")
        return 1

    print("[spec-guard] OK")
    if changed_files:
        print(f"[spec-guard] checked files: {len(changed_files)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
