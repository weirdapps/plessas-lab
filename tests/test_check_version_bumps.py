"""Tests for scripts/check_version_bumps.py.

Each case builds a throwaway git repo, commits a base tree, commits a change on
top, and asks the check about base..head. Every rule is driven both ways: once
over a change that must trip it, once over one that must not.
"""

import importlib.util
import json
import subprocess
from pathlib import Path
from types import ModuleType

import pytest

SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "check_version_bumps.py"


def _load() -> ModuleType:
    spec = importlib.util.spec_from_file_location("cvb_under_test", SCRIPT)
    assert spec is not None and spec.loader is not None, f"cannot load {SCRIPT}"
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


cvb = _load()


@pytest.fixture
def repo(tmp_path, monkeypatch):
    # Keep the developer's own git config (signing, hooks, templates) out of it.
    monkeypatch.setenv("GIT_CONFIG_GLOBAL", str(tmp_path / "no-global-config"))
    monkeypatch.setenv("GIT_CONFIG_NOSYSTEM", "1")
    _git(tmp_path, "init", "-q")
    return tmp_path


def _git(repo: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(repo), *args], capture_output=True, text=True, check=True
    ).stdout.strip()


def _commit(repo: Path) -> str:
    _git(repo, "add", "-A")
    _git(repo, "-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-qm", "c")
    return _git(repo, "rev-parse", "HEAD")


def _write(repo: Path, rel: str, text: str = "x\n") -> None:
    path = repo / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)


def _plugin(repo: Path, name: str, version: str) -> None:
    _write(
        repo,
        f"plugins/{name}/.claude-plugin/plugin.json",
        json.dumps({"name": name, "version": version}),
    )


def _base(repo: Path) -> str:
    _plugin(repo, "alpha", "1.1.0")
    _write(repo, "plugins/alpha/skills/s/SKILL.md", "v1\n")
    _plugin(repo, "beta", "1.0.0")
    _write(repo, "README.md", "v1\n")
    return _commit(repo)


def test_change_without_bump_is_reported(repo):
    base = _base(repo)
    _write(repo, "plugins/alpha/skills/s/SKILL.md", "v2\n")
    head = _commit(repo)

    found = cvb.find_unbumped(base, head, repo)

    assert [(u.name, u.old, u.new) for u in found] == [("alpha", "1.1.0", "1.1.0")]
    assert found[0].files == ["plugins/alpha/skills/s/SKILL.md"]
    assert cvb.main([base, head], repo) == 1


def test_change_with_bump_passes(repo):
    base = _base(repo)
    _write(repo, "plugins/alpha/skills/s/SKILL.md", "v2\n")
    _plugin(repo, "alpha", "1.1.1")
    head = _commit(repo)

    assert cvb.find_unbumped(base, head, repo) == []
    assert cvb.main([base, head], repo) == 0


def test_version_going_backwards_is_reported(repo):
    base = _base(repo)
    _plugin(repo, "alpha", "1.0.9")
    head = _commit(repo)

    assert [u.name for u in cvb.find_unbumped(base, head, repo)] == ["alpha"]


def test_only_the_unbumped_plugin_is_reported(repo):
    base = _base(repo)
    _write(repo, "plugins/alpha/skills/s/SKILL.md", "v2\n")
    _plugin(repo, "alpha", "1.2.0")
    _write(repo, "plugins/beta/evals/case.md")
    head = _commit(repo)

    assert [u.name for u in cvb.find_unbumped(base, head, repo)] == ["beta"]


def test_changes_outside_plugin_trees_are_ignored(repo):
    base = _base(repo)
    _write(repo, "README.md", "v2\n")
    _write(repo, "plugins/_template/notes.md")
    _write(repo, "plugins/index.md")
    head = _commit(repo)

    assert cvb.find_unbumped(base, head, repo) == []


def test_added_and_removed_plugins_are_ignored(repo):
    base = _base(repo)
    _plugin(repo, "gamma", "0.1.0")
    _write(repo, "plugins/gamma/README.md")
    _git(repo, "rm", "-rq", "plugins/beta")
    head = _commit(repo)

    assert cvb.find_unbumped(base, head, repo) == []


@pytest.mark.parametrize(
    ("old", "new", "bumped"),
    [
        ("1.1.0", "1.1.1", True),
        ("1.1.9", "1.1.10", True),
        ("1.1.0", "1.1.0", False),
        ("1.1.1", "1.1.0", False),
        ("1.0.0", "1.0.0-rc1", True),
    ],
)
def test_bumped(old, new, bumped):
    assert cvb._bumped(old, new) is bumped


def test_main_argument_handling(repo, capsys):
    base = _base(repo)

    assert cvb.main([], repo) == 2
    assert cvb.main([""], repo) == 2
    assert cvb.main([cvb.NULL_SHA], repo) == 0
    assert cvb.main(["no-such-rev", base], repo) == 2
    assert "cannot diff" in capsys.readouterr().out
