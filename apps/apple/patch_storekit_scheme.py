#!/usr/bin/env python3
"""xcodegen has no declarative key for a scheme's StoreKit Configuration
(unlike Xcode's own scheme editor), so `xcodegen generate` can't set it and
wipes it on every regen. This patches it back into the Serasona scheme right
after generation — run via ./regenerate.sh rather than calling this directly.
"""
import re
from pathlib import Path

SCHEME = Path(__file__).parent / "Serasona.xcodeproj/xcshareddata/xcschemes/Serasona.xcscheme"
REFERENCE = (
    '      <StoreKitConfigurationFileReference\n'
    '         identifier = "Serasona/StoreKit/Products.storekit">\n'
    '      </StoreKitConfigurationFileReference>\n'
)

text = SCHEME.read_text()
if "StoreKitConfigurationFileReference" in text:
    print("patch_storekit_scheme: already present, nothing to do")
else:
    patched = re.sub(
        r'(allowLocationSimulation = "YES">\n)(\s*<BuildableProductRunnable)',
        lambda m: m.group(1) + REFERENCE + m.group(2),
        text,
        count=1,
    )
    if patched == text:
        raise SystemExit("patch_storekit_scheme: LaunchAction anchor not found — xcodegen's scheme template changed")
    SCHEME.write_text(patched)
    print("patch_storekit_scheme: added StoreKit Configuration to the Serasona scheme")
