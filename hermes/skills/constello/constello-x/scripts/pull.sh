#!/usr/bin/env bash
# Pull a public X/Twitter handle into Constello (scrape newest posts + push).
#
# Thin wrapper around the twitter-preservation tool's `constello-x` command, which
# scrapes via gallery-dl (session cookie lives in that repo's .context/) and POSTs
# the normalized TwitterData to the Constello admin ingest route. Identical to the
# laptop path — just invoked here on the box.
#
# Env:
#   CONSTELLO_TWITTER_DIR     path to the twitter-preservation repo on the box
#   CONSTELLO_ADMIN_PASSWORD  matches Vercel ADMIN_PASSWORD (constello-x reads it directly)
#
# Usage: pull.sh <handle> [constellation-id]
set -euo pipefail

# Load box-local secrets/paths if present (no-op on the laptop, where this file
# doesn't exist) so the skill runs regardless of how hermes sets its env.
ENV_FILE="${CONSTELLO_ENV_FILE:-$HOME/.config/constello/scrapers.env}"
[ -f "$ENV_FILE" ] && . "$ENV_FILE"

DIR="${CONSTELLO_TWITTER_DIR:?set CONSTELLO_TWITTER_DIR to the twitter-preservation repo on this box}"
HANDLE="${1:?usage: pull.sh <handle> [constellation-id]}"
shift || true

EXTRA=()
if [ "${1:-}" != "" ]; then
  EXTRA=(--constellation-id "$1")
fi

cd "$DIR"
exec uv run constello-x "$HANDLE" "${EXTRA[@]}"
