#!/usr/bin/env python3
"""
List all notes in the agent-notes folder.

Returns note titles, one per line.

Usage:
    python list-notes.py
"""

import subprocess
import sys
from pathlib import Path

# OS guard — manage-apple-notes is macOS-only.
sys.path.insert(0, str(Path(__file__).parent))
from _platform import require_macos

require_macos("list-notes.py")

FOLDER = "agent-notes"

script = f"""
tell application "Notes"
    if not (exists folder "{FOLDER}") then
        make new folder with properties {{name:"{FOLDER}"}}
    end if
    set noteList to ""
    repeat with n in notes of folder "{FOLDER}"
        set noteList to noteList & name of n & linefeed
    end repeat
    return noteList
end tell
"""

result = subprocess.run(["osascript", "-e", script], capture_output=True, text=True)
print(result.stdout.strip() or "No notes found.")
