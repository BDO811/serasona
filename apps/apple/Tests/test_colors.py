import colorsys
import json
from pathlib import Path
import unittest

APPLE = Path(__file__).resolve().parents[1]
PALETTE = json.loads((APPLE.parents[1] / "design-system/tokens/native-colors.json").read_text())

class SharedColorTests(unittest.TestCase):
    def test_every_target_has_the_entire_shared_palette(self):
        for target in ["Serasona", "SerasonaWatch", "SerasonaWidget", "SerasonaComplication"]:
            root = APPLE / target / "Resources/Assets.xcassets/Colors"
            self.assertEqual({p.parent.stem for p in root.glob("*/Contents.json")}, set(PALETTE["light"]))

    def test_all_generated_light_and_dark_colors_match_the_canonical_source(self):
        for target in ["Serasona", "SerasonaWatch", "SerasonaWidget", "SerasonaComplication"]:
            root = APPLE / target / "Resources/Assets.xcassets/Colors"
            for name in PALETTE["light"]:
                for item in json.loads((root / (name + ".colorset") / "Contents.json").read_text())["colors"]:
                    mode = "dark" if any(a.get("value") == "dark" for a in item.get("appearances", [])) else "light"
                    actual = "".join(format(round(float(item["color"]["components"][channel]) * 255), "02X") for channel in ["red", "green", "blue"])
                    self.assertEqual(actual, PALETTE[mode][name], (target, mode, name))

    def test_retired_green_or_orange_and_teal_brand_colors_cannot_return(self):
        for mode in ["light", "dark"]:
            for name, value in PALETTE[mode].items():
                rgb = tuple(int(value[i:i + 2], 16) / 255 for i in [0, 2, 4])
                hue, saturation, _ = colorsys.rgb_to_hsv(*rgb)
                self.assertFalse(85 <= hue * 360 <= 175 and saturation > .18, (mode, name, value))
                self.assertNotIn(value, {"C2410C", "0D6A76", "52CFE0", "FF8A4C"})

if __name__ == "__main__":
    unittest.main()
