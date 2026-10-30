#!/bin/bash
# Regenerates Serasona.xcodeproj from project.yml and re-applies the one thing
# xcodegen can't express declaratively: the Serasona scheme's StoreKit
# Configuration file, needed so Xcode simulates purchases against
# Serasona/StoreKit/Products.storekit instead of hitting App Store Connect.
set -euo pipefail
export USER="${USER:-amitmehta}"
export LOGNAME="${LOGNAME:-amitmehta}"
cd "$(dirname "$0")"
xcodegen generate
python3 patch_storekit_scheme.py
