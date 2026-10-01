"""Деплой скриптом: клон коммита, зеркалирование в каталог приложения, команда деплоя.

Запуск: cd agent && python -m pytest tests"""
import asyncio
import subprocess
from pathlib import Path

import pytest

from app import script
from app.config import settings
from app.jobs import Job


def git(cwd: Path, *args: str) -> str:
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


@pytest.fixture
def repo(tmp_path: Path) -> tuple[Path, list[str]]:
    """Репозиторий с двумя коммитами: второй удаляет old.txt и меняет deploy.sh."""
    src = tmp_path / "src"
    src.mkdir()
    git(src, "init", "-q", "-b", "main")
    git(src, "config", "user.email", "t@t")
    git(src, "config", "user.name", "t")
    (src / "old.txt").write_text("old")
    (src / "app.py").write_text("v1")
    (src / "deploy.sh").write_text('echo "==> deploy $SCALEFIELD_SHA"; cat app.py; echo; cat .env\n')
    git(src, "add", ".")
    git(src, "commit", "-qm", "one")
    first = git(src, "rev-parse", "HEAD")
    (src / "old.txt").unlink()
    (src / "app.py").write_text("v2")
    (src / "sub").mkdir()
    (src / "sub" / "x.txt").write_text("x")
    git(src, "add", "-A")
    git(src, "commit", "-qm", "two")
    second = git(src, "rev-parse", "HEAD")
    return src, [first, second]


@pytest.fixture
def apps(tmp_path: Path, monkeypatch) -> Path:
    root = tmp_path / "apps"
    root.mkdir()
    monkeypatch.setattr(settings, "APPS_ROOT", str(root))
    app = root / "myapp"
    app.mkdir()
    (app / ".env").write_text("SECRET=1")
    (app / "server-only.txt").write_text("stale")
    (app / "uploads").mkdir()
    (app / "uploads" / "a.jpg").write_text("img")
    return root


def run(spec: script.ScriptSpec) -> tuple[dict, list[str]]:
    job = Job("script", {})
    result = asyncio.run(script.run_script(spec, job))
    return result, job.lines


def test_deploys_latest_commit_and_keeps_server_files(repo, apps):
    src, (_, second) = repo
    result, lines = run(script.ScriptSpec(repo_url=f"file://{src}", ref="main", app_dir="myapp",
                                          command="bash deploy.sh", keep=["uploads/"]))
    app = apps / "myapp"
    assert result["ok"] and result["sha"] == second
    assert (app / "app.py").read_text() == "v2" and (app / "sub" / "x.txt").exists()
    assert (app / ".env").read_text() == "SECRET=1"            # .env живёт только на сервере
    assert (app / "uploads" / "a.jpg").exists()                 # keep
    assert not (app / "server-only.txt").exists()               # лишнее удалено
    assert not (app / ".git").exists()
    assert f"==> deploy {second}" in lines and "v2" in lines and "SECRET=1" in lines
    assert not (apps / ".builds" / "myapp").exists() or not any((apps / ".builds" / "myapp").iterdir())


def test_checks_out_exact_sha(repo, apps):
    src, (first, _) = repo
    result, _ = run(script.ScriptSpec(repo_url=f"file://{src}", ref="main", sha=first, app_dir="myapp", command="true"))
    assert result["ok"] and result["sha"] == first
    assert (apps / "myapp" / "app.py").read_text() == "v1"
    assert (apps / "myapp" / "old.txt").exists()


def test_failing_command_fails_the_job(repo, apps):
    src, _ = repo
    result, lines = run(script.ScriptSpec(repo_url=f"file://{src}", app_dir="myapp", command="echo boom; exit 3"))
    assert not result["ok"] and "boom" in lines
    assert "ERROR: deploy command exited with code 3" in lines


def test_token_is_not_logged(repo, apps):
    src, _ = repo
    _, lines = run(script.ScriptSpec(repo_url="https://x-access-token:SECRET@github.invalid/o/r.git", app_dir="myapp", command="true"))
    assert not any("SECRET" in line for line in lines)


@pytest.mark.parametrize("field,value", [("app_dir", "../etc"), ("ref", "main; rm -rf /"), ("sha", "zzz"), ("keep", ["../x"])])
def test_validation(field, value):
    spec = script.ScriptSpec(repo_url="file:///x", app_dir="myapp", command="true").model_copy(update={field: value})
    with pytest.raises(script.DeployError):
        script.validate(spec)
