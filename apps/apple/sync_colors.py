"""Generate every Apple target's color assets from the canonical Serasona kit."""
import json
from pathlib import Path

APPLE = Path(__file__).resolve().parent
SOURCE = APPLE.parents[1] / "design-system/tokens/native-colors.json"
palette = json.loads(SOURCE.read_text())
assert set(palette["light"]) == set(palette["dark"])

for target in ["Serasona", "SerasonaWatch", "SerasonaWidget", "SerasonaComplication"]:
    directory = APPLE / target / "Resources/Assets.xcassets/Colors"
    for name in palette["light"]:
        path = directory / (name + ".colorset") / "Contents.json"
        data = json.loads(path.read_text())
        for item in data["colors"]:
            is_dark = any(a.get("value") == "dark" for a in item.get("appearances", []))
            value = palette["dark" if is_dark else "light"][name]
            components = item["color"]["components"]
            for index, channel in enumerate(["red", "green", "blue"]):
                components[channel] = format(int(value[index * 2:index * 2 + 2], 16) / 255, ".8f")
        path.write_text(json.dumps(data, indent=2) + "\n")
print("Synchronized Bone and Signal colors across all four Apple targets.")
