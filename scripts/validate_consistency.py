#!/usr/bin/env python3
"""
plessas-lab Consistency Validator

Cross-file consistency checks for the plessas-lab plugins.
Run locally or in CI to catch stale references and YAML hazards.

Usage:
    python3 scripts/validate_consistency.py
    python3 scripts/validate_consistency.py --verbose
"""

import json
import re
import sys
from pathlib import Path

import yaml

VERBOSE = "--verbose" in sys.argv
ROOT = Path(__file__).resolve().parent.parent
PLUGINS_DIR = ROOT / "plugins"
SKIP_PARTS = {"__pycache__", "node_modules", ".venv", ".pytest_cache"}

errors: list[str] = []
warnings: list[str] = []


def error(msg: str) -> None:
    errors.append(msg)
    print(f"  \033[31m✗\033[0m {msg}")


def warn(msg: str) -> None:
    warnings.append(msg)
    if VERBOSE:
        print(f"  \033[33m!\033[0m {msg}")


def ok(msg: str) -> None:
    if VERBOSE:
        print(f"  \033[32m✓\033[0m {msg}")


def heading(msg: str) -> None:
    print(f"\n\033[1m{msg}\033[0m")


def _is_skipped(path: Path) -> bool:
    rel = path.relative_to(ROOT)
    return any(p.startswith(".") or p in SKIP_PARTS for p in rel.parts)


def check_manifests() -> None:
    heading("Plugin manifests")

    mp_path = ROOT / ".claude-plugin" / "marketplace.json"
    if not mp_path.exists():
        error("marketplace.json not found")
        return

    with open(mp_path) as f:
        marketplace = json.load(f)
    registered = {p["name"] for p in marketplace.get("plugins", [])}

    for plugin_dir in sorted(PLUGINS_DIR.iterdir()):
        if not plugin_dir.is_dir() or plugin_dir.name.startswith("_"):
            continue

        pjson = plugin_dir / ".claude-plugin" / "plugin.json"
        if not pjson.exists():
            error(f"{plugin_dir.name}: missing .claude-plugin/plugin.json")
            continue

        with open(pjson) as f:
            data = json.load(f)

        for field in ("name", "version", "description"):
            if field not in data:
                error(f"{plugin_dir.name}/plugin.json: missing '{field}'")

        name = data.get("name", plugin_dir.name)
        if name not in registered:
            error(f"{name}: not registered in marketplace.json")
        else:
            ok(f"{name}: manifest valid, registered in marketplace")

    for name in registered:
        if not (PLUGINS_DIR / name).is_dir():
            error(f"marketplace.json lists '{name}' but plugin directory missing")


def check_command_files() -> None:
    heading("Command files")

    for plugin_dir in sorted(PLUGINS_DIR.iterdir()):
        if not plugin_dir.is_dir() or plugin_dir.name.startswith("_"):
            continue

        cmd_dir = plugin_dir / "commands"
        if not cmd_dir.is_dir():
            warn(f"{plugin_dir.name}: no commands/ directory")
            continue

        md_files = list(cmd_dir.glob("*.md"))
        if not md_files:
            warn(f"{plugin_dir.name}: no command files in commands/")
        for cmd_file in md_files:
            with open(cmd_file) as f:
                first_line = f.readline().strip()
            if first_line != "---":
                error(f"{cmd_file.relative_to(ROOT)}: missing frontmatter")
            else:
                ok(f"{cmd_file.name}: frontmatter present")


def check_command_frontmatter_yaml() -> None:
    """Catch YAML hazards: argument-hint with brackets/pipes/colons must be quoted."""
    heading("Command frontmatter YAML safety")

    fm_pattern = re.compile(r"^---\n(.*?)\n---", re.DOTALL)

    for plugin_dir in sorted(PLUGINS_DIR.iterdir()):
        if not plugin_dir.is_dir() or plugin_dir.name.startswith("_"):
            continue
        cmd_dir = plugin_dir / "commands"
        if not cmd_dir.is_dir():
            continue
        for cmd_file in sorted(cmd_dir.glob("*.md")):
            content = cmd_file.read_text()
            m = fm_pattern.match(content)
            if not m:
                continue
            try:
                yaml.safe_load(m.group(1))
                ok(f"{cmd_file.relative_to(ROOT)}: YAML parses")
            except yaml.YAMLError as e:
                error(f"{cmd_file.relative_to(ROOT)}: YAML parse error: {e}")


def check_python_tools() -> None:
    heading("Python tools")

    for py_path in sorted(ROOT.rglob("*.py")):
        if _is_skipped(py_path):
            continue
        if py_path.name.startswith("test_"):
            continue
        try:
            compile(py_path.read_text(), str(py_path), "exec")
            ok(f"{py_path.relative_to(ROOT)}: valid syntax")
        except SyntaxError as e:
            error(f"{py_path.relative_to(ROOT)}: syntax error at line {e.lineno}")


def main() -> None:
    print("\033[1m\nplessas-lab — Consistency Validator\033[0m")
    print("=" * 52)

    check_manifests()
    check_command_files()
    check_command_frontmatter_yaml()
    check_python_tools()

    print("\n" + "=" * 52)
    if errors:
        print(f"\033[31m{len(errors)} error(s)\033[0m, {len(warnings)} warning(s)")
        sys.exit(1)
    print(f"\033[32mAll checks passed\033[0m ({len(warnings)} warning(s))")


if __name__ == "__main__":
    main()
