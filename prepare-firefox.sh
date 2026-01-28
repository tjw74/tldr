#!/bin/sh
# Build a Firefox-loadable package from the same source.
# Run from the project root. Output: terse-firefox.xpi

set -e
cd "$(dirname "$0")"
OUT=terse-firefox
rm -rf "$OUT" terse-firefox.xpi
mkdir -p "$OUT"

cp manifest.firefox.json "$OUT/manifest.json"
cp background.js content.js popup.js popup.html styles.css "$OUT/"
cp -r icons "$OUT/"

cd "$OUT" && zip -r ../terse-firefox.xpi . -x "*.DS_Store" && cd ..
rm -rf "$OUT"
echo "Built terse-firefox.xpi — load as temporary add-on in about:debugging, or submit to addons.mozilla.org."
