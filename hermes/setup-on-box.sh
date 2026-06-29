#!/usr/bin/env bash
# Install the Constello scrapers + hermes skills on the always-on box.
#
# Idempotent-ish: safe to re-run. Installs OS deps (Ubuntu/apt), the Pinterest
# capture deps, the Twitter tool deps, and links the two hermes skills into
# ~/.hermes/skills/. Prints the manual follow-ups it can't do for you (secrets).
#
# Run from the repo root on the box:
#   CONSTELLO_TWITTER_DIR=~/twitter-preservation bash hermes/setup-on-box.sh
#
# Env it reads:
#   CONSTELLO_TWITTER_DIR   where the twitter-preservation repo lives on the box
#                           (rsync it up first; it's local-only with secrets)
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PIN_DIR="$REPO/apps/pinterest-capture"
TW_DIR="${CONSTELLO_TWITTER_DIR:-$HOME/twitter-preservation}"
SKILLS_SRC="$REPO/hermes/skills/constello"
SKILLS_DST="$HOME/.hermes/skills/constello"

say() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

say "OS packages (apt)"
if command -v apt-get >/dev/null; then
  sudo apt-get update -y
  # xvfb: virtual display for headed Chrome. zip: bundle shots. curl: Telegram delivery.
  sudo apt-get install -y xvfb zip curl ca-certificates
  if ! command -v google-chrome >/dev/null && ! command -v google-chrome-stable >/dev/null; then
    echo "Installing google-chrome-stable…"
    curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | sudo gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list >/dev/null
    sudo apt-get update -y
    sudo apt-get install -y google-chrome-stable
  fi
else
  echo "non-apt system — install manually: xvfb, zip, curl, google-chrome-stable" >&2
fi

say "Pinterest capture deps (node)"
if command -v node >/dev/null; then
  ( cd "$PIN_DIR" && npm install )
else
  echo "node not found — install Node >=20, then: (cd $PIN_DIR && npm install)" >&2
fi

say "Twitter tool deps (uv)"
if [ -d "$TW_DIR" ]; then
  if command -v uv >/dev/null; then
    ( cd "$TW_DIR" && uv sync )
  else
    echo "uv not found — install from https://astral.sh/uv, then: (cd $TW_DIR && uv sync)" >&2
  fi
else
  echo "twitter-preservation not at $TW_DIR — rsync it up, then re-run (or set CONSTELLO_TWITTER_DIR)." >&2
fi

say "Link hermes skills"
mkdir -p "$HOME/.hermes/skills"
ln -sfn "$SKILLS_SRC" "$SKILLS_DST"
echo "linked $SKILLS_DST -> $SKILLS_SRC"

say "Manual follow-ups (secrets + one-time logins)"
cat <<EOF
These can't be scripted — do them once on the box:

  Twitter
    • rsync the X session cookie up:  $TW_DIR/.context/x-cookies.txt
    • export CONSTELLO_ADMIN_PASSWORD (matches Vercel ADMIN_PASSWORD)
    • export CONSTELLO_TWITTER_DIR=$TW_DIR

  Pinterest
    • export CONSTELLO_PINTEREST_DIR=$PIN_DIR
    • export TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (delivery target)
    • for private/own boards: seed the login once — copy the laptop's
      $PIN_DIR/.chrome-profile/ up, or log in via a remote-display session.

  Put the exports in the hermes env (e.g. ~/.hermes/.env or the service's
  environment) so the skills see them. Then in hermes:
    /constello-x <handle>
    /constello-pinterest <board-url>
EOF
