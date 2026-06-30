#!/usr/bin/env bash
# Capture a public X/Twitter profile on the box and deliver the shots to Telegram as
# a document (uncompressed). Runs the headed browser under Xvfb by default.
#
# This is the *screenshot* path — the surface a reading is drawn from. The text
# archive (pull.sh → gallery-dl → admin ingest) is separate and complementary: run
# pull.sh for the constellation's identity/archive, this for the read material.
#
# Env:
#   CONSTELLO_X_DIR   path to apps/x-capture (has capture-box.mjs)
#   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID   delivery target (see deliver-telegram.sh)
#   capture-box.mjs knobs: ZOOM, VIEWPORT_WIDTH/HEIGHT, DEVICE_SCALE_FACTOR, HEADLESS, ...
#   XVFB_RES          virtual screen for the headed run (default 1920x1080x24)
#
# Usage: capture-and-deliver.sh <handle|url>
set -euo pipefail

# Load box-local secrets/paths if present (no-op on the laptop, where this file
# doesn't exist) so the skill runs regardless of how hermes sets its env.
ENV_FILE="${CONSTELLO_ENV_FILE:-$HOME/.config/constello/scrapers.env}"
[ -f "$ENV_FILE" ] && . "$ENV_FILE"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HANDLE="${1:?usage: capture-and-deliver.sh <handle|url>}"
X_DIR="${CONSTELLO_X_DIR:?set CONSTELLO_X_DIR to <repo>/apps/x-capture}"

RUN=(node "$X_DIR/capture-box.mjs" "$HANDLE")

# Headed Chrome needs a display → wrap in Xvfb unless HEADLESS was requested.
h="$(printf '%s' "${HEADLESS:-false}" | tr '[:upper:]' '[:lower:]')"
if [ "$h" != "true" ] && [ "$h" != "new" ] && [ "$h" != "1" ]; then
  command -v xvfb-run >/dev/null || { echo "xvfb-run not found — apt install xvfb, or set HEADLESS=new" >&2; exit 1; }
  RUN=(xvfb-run -a -s "-screen 0 ${XVFB_RES:-1920x1080x24}" "${RUN[@]}")
fi

# Run capture; tee so the user sees progress, and pull the OUTDIR line it emits last.
OUT="$("${RUN[@]}" | tee /dev/stderr | sed -n 's/^OUTDIR=//p' | tail -1)"
[ -n "$OUT" ] || { echo "capture produced no OUTDIR — did it fail to launch?" >&2; exit 1; }

exec "$HERE/deliver-telegram.sh" "$OUT" "X: $HANDLE"
