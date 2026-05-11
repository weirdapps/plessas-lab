#!/usr/bin/env python3
"""
Delete a single note from the agent-notes folder.

Arguments:
    --title: Note title to delete (required)

Usage:
    python delete-note.py --title "My Note"
"""

import argparse
import subprocess
import sys
from pathlib import Path

# OS guard — manage-apple-notes is macOS-only.
sys.path.insert(0, str(Path(__file__).parent))
from _platform import require_macos  # type: ignore[import]

require_macos("delete-note.py")

FOLDER = "agent-notes"

parser = argparse.ArgumentParser(description="Delete a note from agent-notes folder")
parser.add_argument("--title", required=True, help="Note title to delete")
args = parser.parse_args()

# Untrusted input is passed via osascript argv, never interpolated into the script source.
script = """
on run argv
    set folderName to item 1 of argv
    set theTitle to item 2 of argv
    tell application "Notes"
        if not (exists folder folderName) then
            return "Folder not found"
        end if
        try
            delete (first note of folder folderName whose name is theTitle)
            return "Deleted: " & theTitle
        on error
            return "Note not found: " & theTitle
        end try
    end tell
end run
"""

result = subprocess.run(
    ["osascript", "-e", script, FOLDER, args.title], capture_output=True, text=True
)
print(result.stdout.strip())
