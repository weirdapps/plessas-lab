"""Tests for scripts/bump_changed_plugins.py.

Each case builds a throwaway git repo with a marketplace.json and two plugins,
commits history on top, and asks what the weekly bump would do. Every rule is
driven both ways: once over history that must bump, once over one that must not.
"""

import importlib.util
import json
import subprocess
from pathlib import Path
from types import ModuleType

import pytest

SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "bump_changed_plugins.py"


def _load() -> ModuleType:
    spec = importlib.util.spec_from_file_location("bcp_under_test", SCRIPT)
    assert spec is not None and spec.loader is not None, f"cannot load {SCRIPT}"
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


bcp = _load()


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


def _json(repo: Path, rel: str) -> dict:
    data: dict = json.loads((repo / rel).read_text())
    return data


def _plugin(repo: Path, name: str, version: str) -> None:
    _write(
        repo,
        f"plugins/{name}/.claude-plugin/plugin.json",
        json.dumps({"name": name, "version": version, "description": "d"}, indent=2) + "\n",
    )


def _marketplace(repo: Path, nested: bool = False) -> None:
    data: dict = {"name": "m"}
    if nested:
        data["metadata"] = {"version": "1.2.1"}
    else:
        data["version"] = "2.2.1"
    data["plugins"] = [
        {"name": "alpha", "version": "1.1.0", "source": "./plugins/alpha"},
        {"name": "beta", "version": "1.0.0", "source": "./plugins/beta"},
    ]
    _write(repo, bcp.MARKETPLACE, json.dumps(data, indent=2) + "\n")


def _base(repo: Path, nested: bool = False) -> str:
    _marketplace(repo, nested)
    _plugin(repo, "alpha", "1.1.0")
    _write(repo, "plugins/alpha/skills/s/SKILL.md", "v1\n")
    _plugin(repo, "beta", "1.0.0")
    _write(repo, "plugins/_template/notes.md")
    _write(repo, "README.md", "v1\n")
    return _commit(repo)


def test_nothing_changed_nothing_to_bump(repo, capsys):
    _base(repo)
    _write(repo, "README.md", "v2\n")
    _write(repo, "plugins/_template/notes.md", "v2\n")
    _commit(repo)

    assert bcp.plan(repo) == []
    assert bcp.main([], repo) == 0
    assert "Nothing to bump" in capsys.readouterr().out
    assert _json(repo, bcp.MARKETPLACE)["version"] == "2.2.1"


def test_changed_plugin_is_planned_from_its_last_version_change(repo):
    _base(repo)
    _write(repo, "plugins/alpha/skills/s/SKILL.md", "v2\n")
    _plugin(repo, "alpha", "1.1.1")
    bumped = _commit(repo)  # a bump commit: its own changes are already shipped
    _write(repo, "plugins/alpha/package-lock.json", "{}\n")
    _commit(repo)

    found = bcp.plan(repo)

    assert [(b.name, b.old, b.new, b.since) for b in found] == [("alpha", "1.1.1", "1.1.2", bumped)]
    assert found[0].files == ["plugins/alpha/package-lock.json"]


def test_a_plugin_bumped_after_its_last_change_is_left_alone(repo):
    _base(repo)
    _write(repo, "plugins/alpha/skills/s/SKILL.md", "v2\n")
    _commit(repo)
    _plugin(repo, "alpha", "1.1.1")
    _commit(repo)

    assert bcp.plan(repo) == []


def test_description_edit_is_not_a_version_change(repo):
    _base(repo)
    _write(repo, "plugins/beta/README.md")
    _commit(repo)
    manifest = "plugins/beta/.claude-plugin/plugin.json"
    data = _json(repo, manifest)
    data["description"] = "mentions version 9.9.9 in prose"
    _write(repo, manifest, json.dumps(data, indent=2) + "\n")
    _commit(repo)

    found = bcp.plan(repo)

    assert [b.name for b in found] == ["beta"]
    assert sorted(found[0].files) == [manifest, "plugins/beta/README.md"]


def test_apply_writes_plugin_and_marketplace_versions(repo, capsys):
    _base(repo)
    _write(repo, "plugins/beta/evals/case.md")
    _commit(repo)

    assert bcp.main([], repo) == 0

    assert _json(repo, "plugins/beta/.claude-plugin/plugin.json")["version"] == "1.0.1"
    assert _json(repo, "plugins/alpha/.claude-plugin/plugin.json")["version"] == "1.1.0"
    market = _json(repo, bcp.MARKETPLACE)
    assert market["version"] == "2.2.2"
    assert {p["name"]: p["version"] for p in market["plugins"]} == {
        "alpha": "1.1.0",
        "beta": "1.0.1",
    }
    out = capsys.readouterr().out
    assert "- beta: 1.0.0 -> 1.0.1" in out
    assert "- marketplace: 2.2.1 -> 2.2.2" in out
    # After the bump is committed, the next run finds nothing.
    _commit(repo)
    assert bcp.plan(repo) == []


def test_marketplace_version_under_metadata(repo):
    _base(repo, nested=True)
    _write(repo, "plugins/alpha/skills/s/SKILL.md", "v2\n")
    _commit(repo)

    assert bcp.main([], repo) == 0

    market = _json(repo, bcp.MARKETPLACE)
    assert market["metadata"]["version"] == "1.2.2"
    assert "version" not in market


def test_dry_run_writes_nothing(repo, capsys):
    _base(repo)
    _write(repo, "plugins/alpha/skills/s/SKILL.md", "v2\n")
    _commit(repo)

    assert bcp.main(["--dry-run"], repo) == 0

    assert _git(repo, "status", "--porcelain") == ""
    out = capsys.readouterr().out
    assert "- alpha: 1.1.0 -> 1.1.1" in out
    assert "- marketplace: 2.2.1 -> 2.2.2" in out
    assert "Dry run" in out


@pytest.mark.parametrize(
    ("old", "new"),
    [("1.1.0", "1.1.1"), ("1.1.9", "1.1.10"), ("0.1.1", "0.1.2")],
)
def test_patch_bump(old, new):
    assert bcp.patch_bump(old) == new


@pytest.mark.parametrize("bad", ["1.0", "1.0.0-rc1", "v1.0.0", ""])
def test_patch_bump_rejects_non_semver(bad):
    with pytest.raises(ValueError):
        bcp.patch_bump(bad)


def test_main_argument_handling(repo):
    _base(repo)

    assert bcp.main(["--bogus"], repo) == 2
    assert bcp.main(["--dry-run", "extra"], repo) == 2
