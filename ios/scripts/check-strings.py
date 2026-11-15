#!/usr/bin/env python3
"""Checks that every string the app shows exists in German and Turkish.

The app looks its strings up with L("English text") and Lf("English %@ text", …)
(see AISecretary/Support/L10n.swift), using the English text as the key. This
script collects those keys from the Swift sources and compares them with the
.strings files, so a string added in code cannot ship untranslated — and a
translation whose placeholders do not match the English cannot crash the app.

    python3 scripts/check-strings.py            # check; exit 1 on a problem
    python3 scripts/check-strings.py --keys     # print the keys found in code
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent / "AISecretary"
LANGUAGES = ["de", "tr"]

# L("…") or Lf("…", — a Swift string literal as the first argument.
CALL = re.compile(r'\bLf?\(\s*"((?:[^"\\]|\\.)*)"')
ENTRY = re.compile(r'^"((?:[^"\\]|\\.)*)"\s*=\s*"((?:[^"\\]|\\.)*)";\s*$')
PLACEHOLDER = re.compile(r'%(?:(\d+)\$)?(@|d|ld|lld)')


def keys_in_code():
    found = {}
    for path in sorted(ROOT.rglob("*.swift")):
        text = path.read_text(encoding="utf-8")
        for match in CALL.finditer(text):
            line = text.count("\n", 0, match.start()) + 1
            found.setdefault(match.group(1), f"{path.relative_to(ROOT)}:{line}")
    return found


def entries(language):
    path = ROOT / f"{language}.lproj" / "Localizable.strings"
    table, problems = {}, []
    if not path.exists():
        return table, [f"{path} is missing"]
    in_comment = False
    for number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if in_comment:
            in_comment = "*/" not in line
            continue
        if line.startswith("/*"):
            in_comment = "*/" not in line
            continue
        if not line or line.startswith("//"):
            continue
        match = ENTRY.match(line)
        if not match:
            problems.append(f"{path.name} ({language}) line {number}: not a \"key\" = \"value\"; line")
            continue
        key, value = match.groups()
        if key in table:
            problems.append(f"{language}: duplicate key {key!r}")
        table[key] = value
    return table, problems


def placeholders(text):
    """The placeholders of a format string, as a sorted list of (position, type)."""
    found = []
    for index, match in enumerate(PLACEHOLDER.finditer(text), 1):
        position = int(match.group(1)) if match.group(1) else index
        kind = "d" if match.group(2) in ("d", "ld", "lld") else "@"
        found.append((position, kind))
    return sorted(found)


def main():
    code = keys_in_code()
    if "--keys" in sys.argv:
        for key in code:
            print(key)
        return 0

    problems = []
    for language in LANGUAGES:
        table, issues = entries(language)
        problems += issues
        for key, where in code.items():
            if key not in table:
                problems.append(f"{language}: no translation for {key!r} ({where})")
            elif placeholders(key) != placeholders(table[key]):
                problems.append(f"{language}: placeholders differ for {key!r}: {table[key]!r}")
            elif not table[key].strip():
                problems.append(f"{language}: empty translation for {key!r}")
        for key in table:
            if key not in code:
                problems.append(f"{language}: {key!r} is translated but no longer used")

    for problem in problems:
        print(problem)
    print(f"{len(code)} strings in code; {len(problems)} problem(s)")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
