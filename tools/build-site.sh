#!/usr/bin/env bash
# Cloudflare Pages build: copies only the public website into dist/, so the database, tests, tools and
# drafts are never published. In Cloudflare: build command "bash tools/build-site.sh", output "dist".
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist
mkdir dist
cp ./*.html robots.txt sitemap.xml dist/
cp -r css js images dist/
echo "Built dist/ with $(find dist -type f | wc -l) files"
