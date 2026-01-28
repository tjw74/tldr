#!/bin/sh
# Build a Firefox-loadable package from the same source.
# Run from the project root. Output: tldr-firefox.xpi

set -e
cd "$(dirname "$0")"
OUT=tldr-firefox
rm -rf "$OUT" tldr-firefox.xpi
mkdir -p "$OUT"

cp manifest.firefox.json "$OUT/manifest.json"
cp background.js content.js popup.js popup.html styles.css "$OUT/"
cp -r icons "$OUT/"

cd "$OUT" && zip -r ../tldr-firefox.xpi . -x "*.DS_Store" && cd ..
rm -rf "$OUT"
echo "Built tldr-firefox.xpi — load as temporary add-on in about:debugging, or submit to addons.mozilla.org."
