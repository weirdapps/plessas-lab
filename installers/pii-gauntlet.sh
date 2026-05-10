#!/usr/bin/env bash
# pii-gauntlet.sh — verify no PII leaked into plessas-marketplace.
#
# TWO MODES:
#   --mode=ci      Scan only git-tracked files. Used by GitHub Actions to gate
#                  pushes. Any hit = FAIL = exit 1.
#   --mode=doctor  (default) Scan the entire working tree. Distinguishes tracked
#                  hits (FAIL — these would ship publicly) from gitignored hits
#                  (INFO — local-only, never pushed). Exit 1 only on tracked hits.
#
# Why two modes:
#   The CI mode is the actual safety gate.
#   The doctor mode helps the maintainer notice PII drift in their LOCAL files
#   before they accidentally `git add` something. It must NOT scare a teammate
#   running the script casually — "FAIL" on a gitignored file would teach them
#   to ignore the script entirely, defeating the point.
#
# Self-exclusion: this script contains the very patterns it searches for, so
# `--exclude=pii-gauntlet.sh` is essential to avoid self-match false positives.

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

MODE="doctor"
for arg in "$@"; do
  case "$arg" in
    --mode=ci)     MODE="ci" ;;
    --mode=doctor) MODE="doctor" ;;
    -h|--help)
      sed -n '2,18p' "$0"
      exit 0
      ;;
    *) echo "Unknown arg: $arg" >&2; exit 2 ;;
  esac
done

echo "=== PII Gauntlet (mode: $MODE) ==="
echo "Repo: $REPO_ROOT"
echo

FAIL=0
INFO=0

# Build the file list once. CI mode = tracked only. Doctor mode = working tree.
if [ "$MODE" = "ci" ]; then
  # Exclude self + auto-generated lockfiles at any depth (lockfiles contain SHAs / hashes that
  # collide with the 9-digit-ID regex but carry no PII risk).
  TRACKED=$(git ls-files \
    | grep -v '^installers/pii-gauntlet.sh$' \
    | grep -vE '(^|/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|Pipfile\.lock)$' \
    || true)
  TRACKED_TMP=$(mktemp)
  printf '%s\n' "$TRACKED" > "$TRACKED_TMP"
fi

# Helper: get the tracked-vs-untracked status of a file.
file_is_tracked() {
  git ls-files --error-unmatch "$1" >/dev/null 2>&1
}

scan_doctor() {
  local pattern="$1"
  grep -riE \
    --exclude-dir=.git \
    --exclude-dir=node_modules \
    --exclude-dir=dist \
    --exclude-dir=__pycache__ \
    --exclude-dir=.venv \
    --exclude-dir=venv \
    --exclude-dir=.remember \
    --exclude-dir=installers/deps \
    --exclude=pii-gauntlet.sh \
    --exclude=PII-GAUNTLET.md \
    --exclude=package-lock.json \
    --binary-files=without-match \
    "$pattern" . 2>/dev/null || true
}

scan_ci() {
  local pattern="$1"
  # Search only git-tracked files. xargs grep with -l would short-circuit but
  # we want line-level hits.
  if [ -s "$TRACKED_TMP" ]; then
    xargs -a "$TRACKED_TMP" -d '\n' grep -nE --binary-files=without-match "$pattern" 2>/dev/null || true
  fi
}

check() {
  local label="$1"
  local pattern="$2"
  local hits

  if [ "$MODE" = "ci" ]; then
    hits=$(scan_ci "$pattern")
    if [ -n "$hits" ]; then
      echo "FAIL [$label]:"
      echo "$hits" | head -20
      echo
      FAIL=1
    else
      echo "OK   [$label]"
    fi
    return
  fi

  # Doctor mode — separate tracked from gitignored.
  hits=$(scan_doctor "$pattern")
  if [ -z "$hits" ]; then
    echo "OK   [$label]"
    return
  fi

  local tracked_hits=""
  local untracked_hits=""
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    # line format: ./path/to/file:matched-text
    local path="${line%%:*}"
    path="${path#./}"
    if file_is_tracked "$path"; then
      tracked_hits+="$line"$'\n'
    else
      untracked_hits+="$line"$'\n'
    fi
  done <<< "$hits"

  if [ -n "$tracked_hits" ]; then
    echo "FAIL [$label]:                 (tracked — would ship publicly)"
    printf '%s' "$tracked_hits" | head -20
    echo
    FAIL=1
  fi
  if [ -n "$untracked_hits" ]; then
    echo "INFO [$label]:                 (gitignored / untracked — local-only)"
    printf '%s' "$untracked_hits" | head -10
    echo
    INFO=1
  fi
  if [ -z "$tracked_hits" ] && [ -z "$untracked_hits" ]; then
    echo "OK   [$label]"
  fi
}

# ---------------------------------------------------------------------------
# Patterns (shared between modes)
# ---------------------------------------------------------------------------

# Personal name (full forms — single-word "plessas" is the brand name, OK)
check "Full personal name (EN)" "Dimitris[[:space:]]+Plessas|Dimitrios[[:space:]]+Plessas"
check "Full personal name (GR)" "Δημήτριος[[:space:]]+Πλέσσας|ΠΛΕΣΣΑΣ[[:space:]]+ΔΗΜΗΤΡΙΟΣ"

# Personal emails
check "Personal email" "dimitrios\.plessas@|plessasdimitrios@|plessas@nbg\.gr|plessas@gmail|plessas@yahoo"

# Personal phone / address
check "Personal phone" "694[[:space:]]?9200878|6949200878"
check "Personal address" "174[[:space:]]+Syggrou|Συγγρού[[:space:]]+174"

# Greek tax IDs (9-digit standalone, with word boundaries)
check "9-digit ID pattern" "[^0-9][0-9]{9}[^0-9]"

# Peer names (NBG colleagues / direct reports / managers)
check "Peer/colleague names" "Volioti|Bitrou|Sioutis|Theofilidi|Θεοφιλίδη|Χριστίνα|Lygeros|Oikonomou|Maraveas|Xona|Petropoulou|Laspas|Koutra|Giemelou"

# Family names
check "Family names" "Kitrilaki|Κιτριλάκη"

# NBG-internal project names (case-insensitive but anchored)
check "Internal projects" "Διπλή κάρτα|\bdual[- ]card\b|IRIS[[:space:]]+pilot|ECB[[:space:]]+Digital[[:space:]]+Euro[[:space:]]+CfEI"

# External partners discussed in NBG-internal context
check "Partner names" "\bWorldline\b|\bHelvia\b|\bWealthyhood\b|\bFeedzai\b|\bMellon\b|\b11FS\b|\bNCR\b"

# Tax authority refs
check "Tax authority" "ΑΑΔΕ|ΑΦΜ|ΑΔΤ|ΑΜΚΑ"

# Personal source paths (specific to user's machine)
check "User-specific paths" "/Users/plessas|/SourceCode/claude-config|claude-config/shared-memory"

# Cleanup
[ "$MODE" = "ci" ] && rm -f "$TRACKED_TMP"

echo
if [ $FAIL -eq 0 ]; then
  if [ "$MODE" = "doctor" ] && [ $INFO -ne 0 ]; then
    echo "=== GAUNTLET PASS (with INFO on gitignored files — local-only, not in git) ==="
  else
    echo "=== GAUNTLET PASS ==="
  fi
  exit 0
else
  echo "=== GAUNTLET FAIL ==="
  if [ "$MODE" = "doctor" ]; then
    echo "Tracked PII detected. These files would ship publicly. Fix before committing."
  else
    echo "Fix the PII leaks above before any public push."
  fi
  exit 1
fi
