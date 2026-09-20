from pathlib import Path
import subprocess


REPO = Path(__file__).resolve().parents[3]

SOURCE_EXTENSIONS = {
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".cjs",
    ".mjs",
    ".json",
    ".yml",
    ".yaml",
    ".toml",
}

IGNORED_FILES = {
    "package-lock.json",
}

C3 = chr(0x00C3)
C2 = chr(0x00C2)
E2 = chr(0x00E2)
F0 = chr(0x00F0)
REPLACEMENT = chr(0xFFFD)


def suspicious_reasons(text: str) -> list[str]:
    reasons = []

    if REPLACEMENT in text:
        reasons.append("replacement character U+FFFD")

    # UTF-8 bytes commonly decoded as Windows-1252 / Latin-1.
    if C3 in text:
        reasons.append("possible C3 mojibake")
    if C2 in text:
        reasons.append("possible C2 mojibake")

    # Typical smart punctuation / emoji corruption.
    if E2 + chr(0x20AC) in text:
        reasons.append("possible smart-punctuation mojibake")
    if F0 + chr(0x0178) in text or F0 + chr(0x009F) in text:
        reasons.append("possible emoji mojibake")

    # C1 controls should never appear in normal source text.
    if any(0x80 <= ord(ch) <= 0x9F for ch in text):
        reasons.append("C1 control character")

    return reasons


def test_repository_source_files_are_clean_utf8():
    tracked = subprocess.check_output(
        ["git", "-C", str(REPO), "ls-files"],
        text=True,
        encoding="utf-8",
    ).splitlines()

    problems = []

    for rel in tracked:
        file = REPO / rel

        if file.name in IGNORED_FILES:
            continue

        if file.suffix.lower() not in SOURCE_EXTENSIONS:
            continue

        try:
            text = file.read_text(encoding="utf-8")
        except UnicodeDecodeError as exc:
            problems.append(f"{rel}: invalid UTF-8 ({exc})")
            continue

        reasons = suspicious_reasons(text)

        if reasons:
            problems.append(
                f"{rel}: {', '.join(sorted(set(reasons)))}"
            )

    assert not problems, (
        "Possible text-encoding corruption detected:\n"
        + "\n".join(problems[:30])
    )
