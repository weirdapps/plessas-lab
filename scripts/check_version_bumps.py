#!/usr/bin/env python3
"""Fail when files under plugins/<name>/ change but that plugin's version does not.

Claude Code runs an installed plugin from a copy at
~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/, and `/plugin update`
refreshes that copy only when `version` in plugin.json changes. A commit that
edits a plugin and leaves its version alone therefore never reaches anyone who
already has it installed, and installed_plugins.json then records the new
commit SHA over files that were never re-copied.

Every file under plugins/<name>/ counts, evals and tests included, because the
whole directory is what gets copied. One version, one tree.

Usage:
    python3 scripts/check_version_bumps.py BASE [HEAD]
    python3 scripts/check_version_bumps.py origin/master    # before pushing
"""

from __future__ import annotations  # `str | None` on the stock macOS python3 (3.9)

import json
import re
import subprocess
import sys
from pathlib import Path
from typing import NamedTuple

ROOT = Path(__file__).resolve().parent.parent
NULL_SHA = "0" * 40
DOTTED_INTS = re.compile(r"\d+(\.\d+)*")


class Unbumped(NamedTuple):
    name: str
    old: str
    new: str
    files: list[str]


def _git(repo: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(repo), *args], capture_output=True, text=True, check=True
    ).stdout


def _version(repo: Path, rev: str, name: str) -> str | None:
    """The plugin's version at `rev`, or None when plugin.json does not exist there."""
    try:
        raw = _git(repo, "show", f"{rev}:plugins/{name}/.claude-plugin/plugin.json")
    except subprocess.CalledProcessError:
        return None
    return str(json.loads(raw).get("version"))


def _bumped(old: str, new: str) -> bool:
    """Changed, and not backwards: an older version may still have a cache
    directory on disk holding that version's old files."""
    if new == old:
        return False
    if DOTTED_INTS.fullmatch(old) and DOTTED_INTS.fullmatch(new):
        return tuple(map(int, new.split("."))) > tuple(map(int, old.split(".")))
    return True


def find_unbumped(base: str, head: str = "HEAD", repo: Path = ROOT) -> list[Unbumped]:
    changed: dict[str, list[str]] = {}
    # -z: NUL-separated and never quoted, so a non-ASCII filename cannot come
    # back wrapped in quotes with octal escapes.
    diff = _git(repo, "diff", "-z", "--name-only", "--no-renames", base, head, "--", "plugins/")
    for path in filter(None, diff.split("\0")):
        parts = path.split("/")
        # plugins/<name>/<file...>; `_`-prefixed directories are not plugins.
        if len(parts) > 2 and not parts[1].startswith("_"):
            changed.setdefault(parts[1], []).append(path)

    unbumped = []
    for name, files in sorted(changed.items()):
        old, new = _version(repo, base, name), _version(repo, head, name)
        if old is None or new is None:
            continue  # plugin added or removed: no installed copy to go stale
        if not _bumped(old, new):
            unbumped.append(Unbumped(name, old, new, files))
    return unbumped


def main(argv: list[str] | None = None, repo: Path = ROOT) -> int:
    args = sys.argv[1:] if argv is None else argv
    if len(args) not in (1, 2) or not args[0]:
        print(__doc__, file=sys.stderr)
        return 2
    base, head = args[0], args[1] if len(args) == 2 else "HEAD"
    if base == NULL_SHA:
        print("The push created the branch, so there is no previous tip to compare against.")
        return 0

    try:
        unbumped = find_unbumped(base, head, repo)
    except subprocess.CalledProcessError as exc:
        print(f"::error::cannot diff {base}..{head}: {exc.stderr.strip()}")
        return 2

    for u in unbumped:
        print(
            f"::error file=plugins/{u.name}/.claude-plugin/plugin.json::{u.name}: "
            f"{len(u.files)} file(s) changed but its version is {u.new} (was {u.old}). "
            "Raise it in plugin.json and in marketplace.json, or installed copies never update."
        )
        for path in u.files[:10]:
            print(f"    {path}")
        if len(u.files) > 10:
            print(f"    ... and {len(u.files) - 10} more")
    if not unbumped:
        print(f"No plugin changed without a version bump in {base}..{head}.")
    return 1 if unbumped else 0


if __name__ == "__main__":
    sys.exit(main())
