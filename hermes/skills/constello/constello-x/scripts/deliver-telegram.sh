#!/usr/bin/env bash
# Deliver a folder of X/Twitter screenshots to Telegram as a single ZIP *document*.
#
# CRITICAL: uses sendDocument, never sendPhoto. Telegram's photo path re-encodes to
# JPEG and caps the long edge (~1280px), which destroys the tweet legibility the
# by-hand reading depends on. sendDocument ships the original PNG bytes intact (zip
# is lossless). See the project memory note: constello-image-delivery-uncompressed.
#
# Env:
#   TELEGRAM_BOT_TOKEN   (required)
#   TELEGRAM_CHAT_ID     (required)
#
# Usage: deliver-telegram.sh <shots-dir> [caption]
set -euo pipefail

# Load box-local secrets if present (no-op on the laptop). Lets this run standalone.
ENV_FILE="${CONSTELLO_ENV_FILE:-$HOME/.config/constello/scrapers.env}"
[ -f "$ENV_FILE" ] && . "$ENV_FILE"

DIR="${1:?usage: deliver-telegram.sh <shots-dir> [caption]}"
: "${TELEGRAM_BOT_TOKEN:?set TELEGRAM_BOT_TOKEN}"
# Destination: an explicit chat id, else hermes's own home channel (so shots land
# in the same place hermes delivers cron output — no separate config needed).
CHAT="${TELEGRAM_CHAT_ID:-${TELEGRAM_HOME_CHANNEL:-}}"
[ -n "$CHAT" ] || { echo "set TELEGRAM_CHAT_ID (or TELEGRAM_HOME_CHANNEL)" >&2; exit 1; }
# Forum-topic support: deliver into the same thread hermes uses, if any.
THREAD="${TELEGRAM_MESSAGE_THREAD_ID:-${TELEGRAM_HOME_CHANNEL_THREAD_ID:-}}"
THREAD_ARG=()
[ -n "$THREAD" ] && THREAD_ARG=(-F "message_thread_id=$THREAD")

shots=$(find "$DIR" -maxdepth 1 -name '*.png' | wc -l | tr -d ' ')
CAPTION="${2:-X profile capture ($shots shots)}"
[ "$shots" -gt 0 ] || { echo "no PNG shots in $DIR" >&2; exit 1; }

ZIP="$(mktemp -d)/$(basename "$DIR").zip"
# -j flatten paths, -q quiet. Zip's deflate is lossless → the PNGs stay byte-identical.
zip -j -q "$ZIP" "$DIR"/*.png

SIZE=$(wc -c < "$ZIP")
if [ "$SIZE" -gt $((50 * 1024 * 1024)) ]; then
  echo "warning: $ZIP is $((SIZE / 1024 / 1024)) MB, over Telegram's 50 MB sendDocument cap — lower MAX_SHOTS or split." >&2
fi

# Document path only. -f makes curl fail loudly on a non-2xx response.
curl -fsS \
  -F chat_id="$CHAT" \
  "${THREAD_ARG[@]}" \
  -F document=@"$ZIP" \
  -F caption="$CAPTION" \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument" >/dev/null

echo "delivered $ZIP -> Telegram chat $CHAT${THREAD:+ (thread $THREAD)} (as document, $shots shots)"
