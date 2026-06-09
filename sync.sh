#!/usr/bin/env bash
# Two-way sync between this folder and the GitHub repo.
# - Commits any local changes (so edits made here go up)
# - Pulls remote changes (so edits made on the repo come down)
# - Pushes
# Run from anywhere:  ./sync.sh   (or:  bash sync.sh)
set -e
cd "$(dirname "$0")"

if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -m "sync: local changes $(date '+%Y-%m-%d %H:%M')"
fi

git pull --rebase --autostash
git push
echo "✓ synced"
