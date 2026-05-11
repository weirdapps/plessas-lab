"""Platform compatibility helpers for manage-apple-notes scripts.

manage-apple-notes drives Apple's Notes.app via osascript (AppleScript),
which only exists on macOS. This module enforces that constraint with a
friendly stderr message instead of letting subprocess raise
FileNotFoundError on Linux/Windows.
"""

import sys


def require_macos(script_name: str = "this script") -> None:
    """Exit cleanly with a friendly message if not running on macOS.

    Call at the top of any script in this plugin, before any subprocess
    call to ``osascript``. On Darwin this is a no-op. On any other
    platform, prints a one-line explanation to stderr and exits 1 — so
    the calling agent (or shell) sees a clear "this is macOS only"
    message rather than a Python traceback or "command not found".
    """
    if not sys.platform.startswith("darwin"):
        sys.stderr.write(
            f"manage-apple-notes is macOS-only — {script_name} requires the "
            f"Notes.app and osascript, neither of which exist on "
            f"{sys.platform}.\n"
            f"This plugin works on macOS. On Linux/Windows, skip it or run "
            f"on a Mac.\n"
        )
        sys.exit(1)
