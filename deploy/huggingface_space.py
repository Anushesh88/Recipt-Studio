"""Uploads the backend to a Hugging Face Docker Space (run by the GitHub Action
in .github/workflows/deploy-backend.yml).

A Space is its own repository whose README.md starts with settings; this copies
backend/ into a temporary folder, puts those settings on top of its README, and
uploads the lot, removing files that no longer exist. Needs HF_TOKEN (a write
token) and HF_SPACE ("your-name/receipt-studio-api") in the environment.
"""
import os
import shutil
import sys
import tempfile
from pathlib import Path

from huggingface_hub import HfApi

BACKEND = Path(__file__).resolve().parent.parent / "backend"
SKIP = shutil.ignore_patterns(".env", ".env.*", "*.db", "storage", ".venv", "__pycache__", "*.pyc",
                              ".pytest_cache", ".mypy_cache", ".ruff_cache", "*.egg-info", "tests")
SPACE_SETTINGS = """---
title: Receipt Studio API
emoji: 🧾
colorFrom: indigo
colorTo: yellow
sdk: docker
app_port: 8000
pinned: false
short_description: Backend for Receipt Studio (receipts and GST invoices)
---

"""
# Binary files go through Hugging Face's large-file storage
BINARY_EXTENSIONS = ("ttf", "otf", "woff", "woff2", "png", "jpg", "pdf")
GITATTRIBUTES = "".join(f"*.{ext} filter=lfs diff=lfs merge=lfs -text\n" for ext in BINARY_EXTENSIONS)


def stage(target: Path) -> None:
    """backend/ as the Space's files, in target."""
    shutil.copytree(BACKEND, target, ignore=SKIP)
    readme = target / "README.md"
    readme.write_text(SPACE_SETTINGS + readme.read_text(encoding="utf-8"), encoding="utf-8")
    (target / ".gitattributes").write_text(GITATTRIBUTES, encoding="utf-8")


def main() -> None:
    token, space = os.environ.get("HF_TOKEN"), os.environ.get("HF_SPACE")
    if not token or not space:
        sys.exit("Set the HF_TOKEN secret and the HF_SPACE variable in the GitHub repository settings.")
    with tempfile.TemporaryDirectory() as tmp:
        staged = Path(tmp) / "space"
        stage(staged)
        HfApi(token=token).upload_folder(
            repo_id=space,
            repo_type="space",
            folder_path=staged,
            commit_message=f"Deploy {os.environ.get('GITHUB_SHA', 'local')[:7]}",
            # Mirror backend/: files deleted there are deleted in the Space too
            # (the upload brings its own .gitattributes)
            delete_patterns="*",
        )
    print(f"Uploaded backend/ to https://huggingface.co/spaces/{space}")


if __name__ == "__main__":
    main()
