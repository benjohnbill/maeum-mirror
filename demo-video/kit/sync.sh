#!/usr/bin/env bash
# Copy the scripts that Windows tools run into the media folder.
# Windows node.exe and AutoHotkey read them from there, not from the repo.
# The repo is the source: edit here, run sync.sh, never edit the copies.
# Usage: kit/sync.sh MEDIA_DIR [SCENE_DIR...]
#   kit/sync.sh /mnt/c/Users/benjohnbill/Videos/herz-demo herz
set -euo pipefail
KIT=$(cd "$(dirname "$0")" && pwd)
D=${1:?usage: sync.sh MEDIA_DIR [SCENE_DIR...]}; shift
cp -v "$KIT"/*.ahk "$D"/
for s in "$@"; do cp -v "$s"/*.mjs "$D"/; done
