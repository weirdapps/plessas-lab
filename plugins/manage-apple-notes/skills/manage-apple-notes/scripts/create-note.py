#!/usr/bin/env python3
"""
Create a new note in the agent-notes folder.

Supports HTML formatting in the body. Creates the folder if it doesn't exist.
Title is automatically formatted as an <h1> header.

Arguments:
    --title: Note title (required)
    Body content is read from stdin (HTML format)

Usage:
    cat << 'EOF' | python create-note.py --title "My Note"
    <div>Content here</div>
    EOF
"""

import argparse
import subprocess
import sys
from pathlib import Path

# OS guard — manage-apple-notes is macOS-only.
sys.path.insert(0, str(Path(__file__).parent))
from _platform import require_macos

require_macos("create-note.py")

FOLDER = "agent-notes"

parser = argparse.ArgumentParser(description="Create a note in agent-notes folder")
parser.add_argument("--title", required=True, help="Note title")
args = parser.parse_args()

body = sys.stdin.read().strip()

# Remove common shell escape artifacts (like \! from bash history expansion)
body = body.replace("\\!", "!")

# Untrusted input is passed via osascript argv, NOT interpolated into the script source.
# This prevents an AppleScript injection where a crafted title/body could escape the
# quoted string and run `do shell script`.
script = """
on run argv
    set folderName to item 1 of argv
    set theTitle to item 2 of argv
    set theBody to item 3 of argv
    tell application "Notes"
        if not (exists folder folderName) then
            make new folder with properties {name:folderName}
        end if
        make new note at folder folderName with properties {body:"<h1>" & theTitle & "</h1><br>" & theBody}
        return "Created: " & theTitle
    end tell
end run
"""

result = subprocess.run(
    ["osascript", "-e", script, FOLDER, args.title, body], capture_output=True, text=True
)
print(result.stdout.strip() if result.returncode == 0 else f"Error: {result.stderr}")
