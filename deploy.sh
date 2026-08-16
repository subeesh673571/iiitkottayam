#!/usr/bin/env bash
#
# Upload the built site to the nginx document root.
#
#   ./deploy.sh user@server:/var/www/iiitkottayam
#   ./deploy.sh --dry-run user@server:/var/www/iiitkottayam
#
set -euo pipefail

DRY_RUN=""
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN="--dry-run"
  shift
fi

TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  echo "usage: $0 [--dry-run] user@server:/path/to/webroot" >&2
  exit 1
fi

cd "$(dirname "$0")"

echo "==> Building"
npm run build

if [[ ! -f dist/index.html ]]; then
  echo "Build produced no dist/index.html — refusing to deploy." >&2
  exit 1
fi

echo "==> Uploading to $TARGET"
# --delete removes files on the server that no longer exist in the build, so a
# deleted PDF actually disappears. --checksum avoids re-sending the ~400 MB of
# images every time just because timestamps changed (dist/ is ~2.4 GB, nearly
# all of it accumulated PDFs and photos).
rsync -avz --checksum --delete --human-readable $DRY_RUN \
  dist/ "$TARGET/"

if [[ -n "$DRY_RUN" ]]; then
  echo "==> Dry run only. Nothing was changed on the server."
else
  echo "==> Done."
fi
