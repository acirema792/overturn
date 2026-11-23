#!/usr/bin/env bash
# Builds the site with the Firebase web config from .env.production.local
# (git-ignored) and publishes dist/ to the gh-pages branch. The Firebase web
# config is public by design (it ships in every Firebase web app); it is kept
# out of the main branch anyway, and App Check protects the project.
set -euo pipefail
cd "$(dirname "$0")/.."
test -f .env.production.local || { echo "missing .env.production.local (see .env.example)"; exit 1; }
npm run build
touch dist/.nojekyll
remote="$(git remote get-url origin)"
tmp="$(mktemp -d)"
cp -r dist/. "$tmp/"
cd "$tmp"
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C "$OLDPWD" config user.name)" -c user.email="$(git -C "$OLDPWD" config user.email)" commit -q -m "Deploy $(git -C "$OLDPWD" rev-parse --short HEAD)"
git push -q -f "$remote" gh-pages
echo "pushed gh-pages ($(git -C "$OLDPWD" rev-parse --short HEAD))"
