"""
fill_glosses.py — Backfill [gloss needed] entries in hsk-N.md files using CC-CEDICT.

Usage: uv run fill_glosses.py
Run from anywhere; paths are resolved relative to this script's location.
"""

import re
import sys
from pathlib import Path
from unicodedata import normalize

SCRIPT_DIR = Path(__file__).parent
HSK_DIR = SCRIPT_DIR.parent
CEDICT_PATH = SCRIPT_DIR / "cedict.txt"

# CEDICT entry format:
#   Traditional Simplified [pin1 yin1] /gloss1/gloss2/.../
CEDICT_LINE = re.compile(
    r"^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+/(.+)/$"
)

# HSK vocab bullet needing a gloss (POS may be absent):
#   - 汉字 / 漢字 — hànzì — N — [gloss needed]
#   - 汉字 — hànzì — N — [gloss needed]
#   - 汉字 — hànzì — [gloss needed]          (no POS)
NEEDS_GLOSS = re.compile(
    r"^(- )(\S+(?:\s*/\s*\S+)?)\s+—\s+(\S+?)\s+—\s+(?:(\S+?)\s+—\s+)?\[gloss needed\](.*)$"
)


def normalize_pinyin(py: str) -> str:
    """Fold toned/numbered pinyin to lowercase ascii for matching."""
    # CEDICT uses numbered pinyin (pin1 yin1); our files use toned (pīnyīn).
    # Strip all combining accents, lowercase, remove digits and spaces.
    nfkd = normalize("NFKD", py)
    ascii_only = "".join(c for c in nfkd if ord(c) < 128)
    return re.sub(r"[\d\s]", "", ascii_only).lower()


def parse_cedict(path: Path) -> dict[str, list[tuple[str, str]]]:
    """Return {simplified: [(normalized_pinyin, gloss), ...]}."""
    lookup: dict[str, list[tuple[str, str]]] = {}
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            m = CEDICT_LINE.match(line)
            if not m:
                continue
            _trad, simp, pinyin, raw_glosses = m.groups()
            norm_py = normalize_pinyin(pinyin)
            # Take up to 3 glosses, trim each to 50 chars.
            glosses = [g.strip() for g in raw_glosses.split("/") if g.strip()][:3]
            short = ", ".join(g[:50] for g in glosses)
            lookup.setdefault(simp, []).append((norm_py, short))
    return lookup


def best_gloss(simp: str, entry_pinyin: str, lookup: dict) -> str | None:
    candidates = lookup.get(simp)
    if not candidates:
        return None
    norm_entry = normalize_pinyin(entry_pinyin)
    # Prefer pinyin match.
    for norm_py, gloss in candidates:
        if norm_py == norm_entry:
            return gloss
    # Fallback: first entry.
    return candidates[0][1]


def process_file(path: Path, lookup: dict) -> tuple[int, int]:
    """Return (filled, still_missing)."""
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    filled = 0
    missing = 0
    out = []
    for line in lines:
        m = NEEDS_GLOSS.match(line.rstrip("\n"))
        if m:
            prefix, simp_with_trad, pinyin, pos, rest = m.groups()
            simp = simp_with_trad.split("/")[0].strip()
            gloss = best_gloss(simp, pinyin, lookup)
            if gloss:
                pos_part = f"{pos} — " if pos else ""
                new_line = f"{prefix}{simp_with_trad} — {pinyin} — {pos_part}{gloss}{rest}\n"
                out.append(new_line)
                filled += 1
            else:
                out.append(line if line.endswith("\n") else line + "\n")
                missing += 1
        else:
            out.append(line if line.endswith("\n") else line + "\n")
    if filled:
        path.write_text("".join(out), encoding="utf-8")
    return filled, missing


def main() -> None:
    if not CEDICT_PATH.exists():
        print(f"ERROR: {CEDICT_PATH} not found. Run from pages/hsk/data/ after downloading cedict.txt.")
        sys.exit(1)

    print("Parsing CEDICT…", end=" ", flush=True)
    lookup = parse_cedict(CEDICT_PATH)
    print(f"{len(lookup):,} simplified entries loaded.")

    hsk_files = sorted(HSK_DIR.glob("hsk-*.md"))
    total_filled = total_missing = 0

    for path in hsk_files:
        filled, missing = process_file(path, lookup)
        total_filled += filled
        total_missing += missing
        status = f"filled {filled:>5}, still missing {missing:>4}"
        print(f"  {path.name}: {status}")

    print(f"\nTotal: {total_filled:,} filled, {total_missing:,} still missing.")
    if total_missing:
        print("Remaining [gloss needed] entries are rare proper nouns or very technical terms not in CEDICT.")


if __name__ == "__main__":
    main()
