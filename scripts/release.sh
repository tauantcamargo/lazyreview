#!/bin/bash
set -euo pipefail

# Usage: ./scripts/release.sh [patch|minor|major]
VERSION_TYPE="${1:-patch}"

echo "Running tests..."
pnpm test --run

echo "Building..."
pnpm build

echo "Bumping version ($VERSION_TYPE)..."
npm version "$VERSION_TYPE"

echo "Pushing..."
git push && git push --tags

echo "Done! NPM publish will be triggered by the tag push."
