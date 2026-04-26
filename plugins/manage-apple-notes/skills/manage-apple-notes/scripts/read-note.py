#!/usr/bin/env python3
"""
Read a note from the agent-notes folder. Returns the note body as HTML.

Arguments:
    --title: Note title to read (required)

Usage:
    python read-note.py --title "My Note"
"""
import argparse
import subprocess

FOLDER = "agent-notes"

parser = argparse.ArgumentParser(description="Read a note from agent-notes folder")
parser.add_argument("--title", required=True, help="Note title to read")
args = parser.parse_args()

# Untrusted input is passed via osascript argv, never interpolated into the script source.
script = '''
on run argv
    set folderName to item 1 of argv
    set theTitle to item 2 of argv
    tell application "Notes"
        if not (exists folder folderName) then
            return "Folder not found"
        end if
        try
            set n to first note of folder folderName whose name is theTitle
            return body of n
        on error
            return "Note not found: " & theTitle
        end try
    end tell
end run
'''

result = subprocess.run(
    ["osascript", "-e", script, FOLDER, args.title],
    capture_output=True, text=True
)
print(result.stdout.strip())
