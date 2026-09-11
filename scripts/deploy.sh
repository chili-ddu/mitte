#!/usr/bin/env bash
# 빌드 결과(dist)를 gh-pages 브랜치로 올린다. GitHub Pages 는 이 브랜치를 그대로 서빙한다.
# 사용: npm run deploy   (원격 origin, 저장소명 = base)
set -euo pipefail
cd "$(dirname "$0")/.."
REPO=$(basename -s .git "$(git remote get-url origin)")
VITE_BASE="/$REPO/" npx vite build
touch dist/.nojekyll
cd dist
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C .. config user.name)" -c user.email="$(git -C .. config user.email)" commit -q -m "deploy $(date +%F_%T)"
git push -f "$(git -C .. remote get-url origin)" gh-pages:gh-pages
cd .. && rm -rf dist/.git
OWNER=$(basename "$(dirname "$(git remote get-url origin)")")
echo "deployed: https://$OWNER.github.io/$REPO/"
