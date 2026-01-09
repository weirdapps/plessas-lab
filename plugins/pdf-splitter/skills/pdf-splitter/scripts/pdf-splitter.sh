#!/bin/zsh
# pdf-splitter.sh - Shell wrapper for pdf-splitter tool
SCRIPT_DIR="${0:a:h}"

if [ -f "${SCRIPT_DIR}/tools/dist/index.js" ]; then
  node "${SCRIPT_DIR}/tools/dist/index.js" "$@"
else
  npx tsx "${SCRIPT_DIR}/tools/src/index.ts" "$@"
fi
