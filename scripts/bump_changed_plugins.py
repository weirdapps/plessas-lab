#!/usr/bin/env python3
"""Patch-bump every plugin whose files changed since its version last changed.

check_version_bumps.py fails a push or PR that changes plugins/<name>/ without
raising that plugin's version, but it exempts Dependabot: a dependency update
under plugins/*/ cannot raise a version by itself. Those changes would then
never reach an installed copy, so weekly-plugin-bump.yml runs this to collect
them into one patch release: each such plugin goes up one patch version in its
plugin.json and in marketplace.json, and the marketplace version goes up once.

"Since its version last changed" is the newest commit that changed `version` in
that plugin's plugin.json. Any file under plugins/<name>/ changed after it
counts, the same tree check_version_bumps.py looks at.

Usage:
    python3 scripts/bump_changed_plugins.py --dry-run   # print the plan, write nothing
    python3 scripts/bump_changed_plugins.py             # write the bumps
"""

from __future__ import annotations  # `str | None` on the stock macOS python3 (3.9)

import json
import re
import subprocess
import sys
from pathlib import Path
from typing import NamedTuple

sys.path.insert(0, str(Path(__file__).resolve().parent))
from check_version_bumps import _git, _version  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
MARKETPLACE = ".claude-plugin/marketplace.json"
SEMVER = re.compile(r"(\d+)\.(\d+)\.(\d+)")


class Bump(NamedTuple):
    name: str
    old: str
    new: str
    since: str
    files: list[str]


def patch_bump(version: str) -> str:
    m = SEMVER.fullmatch(version)
    if not m:
        raise ValueError(f"version {version!r} is not MAJOR.MINOR.PATCH")
    major, minor, patch = m.groups()
    return f"{major}.{minor}.{int(patch) + 1}"


def _plugins(repo: Path) -> list[str]:
    return sorted(
        p.parent.parent.name
        for p in (repo / "plugins").glob("*/.claude-plugin/plugin.json")
        if not p.parent.parent.name.startswith("_")
    )


def last_version_change(repo: Path, name: str, head: str = "HEAD") -> str | None:
    """The newest commit at or before `head` that changed the plugin's version."""
    manifest = f"plugins/{name}/.claude-plugin/plugin.json"
    for sha in _git(repo, "log", "--format=%H", head, "--", manifest).split():
        try:
            parent = _git(repo, "rev-parse", "--verify", "--quiet", f"{sha}^").strip()
        except subprocess.CalledProcessError:
            return sha  # root commit: the plugin was born with this version
        if _version(repo, sha, name) != _version(repo, parent, name):
            return sha
    return None


def plan(repo: Path = ROOT, head: str = "HEAD") -> list[Bump]:
    bumps = []
    for name in _plugins(repo):
        since = last_version_change(repo, name, head)
        if since is None:
            continue
        diff = _git(
            repo, "diff", "-z", "--name-only", "--no-renames", since, head, "--", f"plugins/{name}/"
        )
        files = list(filter(None, diff.split("\0")))
        if files:
            old = _version(repo, head, name)
            assert old is not None  # _plugins() found its plugin.json
            bumps.append(Bump(name, old, patch_bump(old), since, files))
    return bumps


def _load(path: Path) -> dict:
    data: dict = json.loads(path.read_text(encoding="utf-8"))
    return data


def _dump(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _marketplace_version(data: dict) -> tuple[dict, str]:
    """The dict that holds the marketplace version: top level, or `metadata`."""
    holder = data if "version" in data else data.get("metadata", {})
    if "version" not in holder:
        raise ValueError(f"{MARKETPLACE} has no version at the top level or under metadata")
    return holder, holder["version"]


def apply(bumps: list[Bump], repo: Path = ROOT) -> tuple[str, str]:
    """Write the bumps. Returns the marketplace version (old, new)."""
    for b in bumps:
        path = repo / f"plugins/{b.name}/.claude-plugin/plugin.json"
        data = _load(path)
        data["version"] = b.new
        _dump(path, data)

    path = repo / MARKETPLACE
    data = _load(path)
    new_by_name = {b.name: b.new for b in bumps}
    for entry in data.get("plugins", []):
        if entry.get("name") in new_by_name and "version" in entry:
            entry["version"] = new_by_name[entry["name"]]
    holder, old = _marketplace_version(data)
    holder["version"] = patch_bump(old)
    _dump(path, data)
    return old, holder["version"]


def main(argv: list[str] | None = None, repo: Path = ROOT) -> int:
    args = sys.argv[1:] if argv is None else argv
    if args not in ([], ["--dry-run"]):
        print(__doc__, file=sys.stderr)
        return 2

    bumps = plan(repo)
    if not bumps:
        print("Nothing to bump: no plugin changed since its version last changed.")
        return 0

    for b in bumps:
        print(f"- {b.name}: {b.old} -> {b.new} ({len(b.files)} file(s) since {b.since[:7]})")
        for path in b.files[:10]:
            print(f"    {path}")
        if len(b.files) > 10:
            print(f"    ... and {len(b.files) - 10} more")

    if args == ["--dry-run"]:
        _, old = _marketplace_version(_load(repo / MARKETPLACE))
        print(f"- marketplace: {old} -> {patch_bump(old)}")
        print("Dry run: nothing written.")
        return 0

    old, new = apply(bumps, repo)
    print(f"- marketplace: {old} -> {new}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
