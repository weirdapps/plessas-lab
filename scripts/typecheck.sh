#!/usr/bin/env bash
# Typecheck every TypeScript package in the marketplace.
#
# Each plugin ships its own package.json / tsconfig.json / node_modules rather
# than living in a workspace, so there is no single `tsc -b` that covers them.
# This walks them in a fixed order and fails on the first package that does not
# compile. Pass --install to resolve dependencies first (what CI does); omit it
# locally when node_modules is already present.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Keep this list in sync with the npm entries in .github/dependabot.yml.
PACKAGES=(
  "plugins/manage-gmail/skills/manage-gmail/scripts"
  "plugins/manage-nano-banana/skills/manage-nano-banana/tools"
  "plugins/manage-youtube/skills/manage-youtube/tools"
  "plugins/manage-youtube/skills/manage-youtube/tools/playlist-tools"
)

INSTALL=0
[ "${1:-}" = "--install" ] && INSTALL=1

failed=()
for pkg in "${PACKAGES[@]}"; do
  echo "==> $pkg"
  (
    cd "$REPO_ROOT/$pkg"
    if [ "$INSTALL" -eq 1 ]; then
      # Lockfiles are committed in this repo, so `npm ci` installs exactly what
      # is pinned instead of re-resolving the graph.
      npm ci --no-audit --no-fund --loglevel=error
    fi
    npx --no-install tsc --noEmit
  ) || failed+=("$pkg")
done

if [ ${#failed[@]} -gt 0 ]; then
  echo
  echo "Typecheck failed in: ${failed[*]}"
  exit 1
fi

echo
echo "Typecheck passed in ${#PACKAGES[@]} packages."
