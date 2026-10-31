#!/bin/sh
# Re-download MingLi-Bench's data.json from upstream at the pinned commit, or
# (with --verify) check the vendored copy against it.
# Upstream: https://github.com/DestinyLinker/MingLi-Bench (MIT licence)
set -eu
COMMIT=b7433280fd86d7a7c27debbc47d0303c218f0bfd
SHA256=528240929b23859656bf7ec0c126da92e2523c2cf091b11f83c0e8e377412054
DIR="$(cd "$(dirname "$0")/.." && pwd)/data/mingli-bench"
URL="https://raw.githubusercontent.com/DestinyLinker/MingLi-Bench/$COMMIT/data/data.json"

sha() { shasum -a 256 "$1" 2>/dev/null | cut -d' ' -f1 || sha256sum "$1" | cut -d' ' -f1; }

if [ "${1:-}" = "--verify" ]; then
  got=$(sha "$DIR/data.json")
  [ "$got" = "$SHA256" ] && echo "data.json matches upstream $COMMIT" && exit 0
  echo "data.json does not match upstream ($got)" >&2; exit 1
fi

curl -fsSL "$URL" -o "$DIR/data.json.download"
got=$(sha "$DIR/data.json.download")
if [ "$got" != "$SHA256" ]; then
  echo "checksum mismatch: $got" >&2; rm -f "$DIR/data.json.download"; exit 1
fi
mv "$DIR/data.json.download" "$DIR/data.json"
echo "downloaded data.json from $COMMIT"
