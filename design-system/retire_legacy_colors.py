"""One-time migration of legacy green accents to the approved neutral ramp."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
replacements = {
    "#EAF6EF": "#FAF8F4", "#D5EBDD": "#E8E4DA", "#7CC49A": "#B9B3A6",
    "#177A4B": "#111111", "#11623B": "#2B2926", "#0F5132": "#111111",
    "#0A3622": "#111111", "#BEE2CD": "#E8E4DA",
    "#1E5631": "#111111", "#00FF94": "#F2EFE9", "#80DC4A": "#F2EFE9",
    "#00F8C5": "#DCE5FB", "#10B981": "#111111",
}
changed = []
paths = list((ROOT / "src").rglob("*")) + [ROOT / "design-system/tokens/serasona-tokens.css"]
for path in paths:
    if path.suffix not in {".tsx", ".ts", ".css"} or "test" in path.parts:
        continue
    before = path.read_text()
    after = before
    for old, new in replacements.items():
        after = after.replace(old, new).replace(old.lower(), new)
    after = after.replace("text-green-400", "text-foreground")
    if after != before:
        path.write_text(after)
        changed.append(str(path.relative_to(ROOT)))
print("Updated legacy accents in " + str(len(changed)) + " files.")
