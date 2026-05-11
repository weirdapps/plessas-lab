#!/usr/bin/env python3
"""
Attach an image from the clipboard to an existing note.

Saves the clipboard image to a temporary file and attaches it to the specified note.
Optionally adds a label above the image.

Arguments:
    --title: Note title to attach the image to (required)
    --label: Optional label to display above the image (e.g., "screenshot.png")

Usage:
    # Attach clipboard image to a note
    python attach-clipboard-image.py --title "My Note"

    # Attach with a label
    python attach-clipboard-image.py --title "My Note" --label "screenshot.png"
"""

import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path

# OS guard — manage-apple-notes is macOS-only.
sys.path.insert(0, str(Path(__file__).parent))
from _platform import require_macos

require_macos("attach-clipboard-image.py")

FOLDER = "agent-notes"

parser = argparse.ArgumentParser(description="Attach clipboard image to a note")
parser.add_argument("--title", required=True, help="Note title to attach image to")
parser.add_argument("--label", help="Optional label to display above the image")
args = parser.parse_args()

# tempfile.mkstemp creates a uniquely-named file atomically with O_EXCL and mode 0600.
# Replaces the previous fixed /tmp/clipboard_image_temp.png path, which was vulnerable
# to symlink attacks (a local attacker could pre-create the path as a symlink to
# arbitrary files and the AppleScript write would clobber the target).
fd, temp_image_path = tempfile.mkstemp(suffix=".png", prefix="clipboard_image_")
os.close(fd)

try:
    # Untrusted input (paths, titles, labels) is passed via osascript argv, never
    # interpolated into the script source — closes the AppleScript injection vector.
    save_script = """
    on run argv
        set imagePath to item 1 of argv
        try
            set theFile to (POSIX file imagePath)
            set theImage to the clipboard as «class PNGf»
            set fileRef to open for access theFile with write permission
            write theImage to fileRef
            close access fileRef
            return "success"
        on error errMsg
            return "error: " & errMsg
        end try
    end run
    """
    result = subprocess.run(
        ["osascript", "-e", save_script, temp_image_path], capture_output=True, text=True
    )
    if result.returncode != 0 or "error:" in result.stdout:
        error_msg = result.stderr.strip() or result.stdout.strip()
        print(
            f"Error: Could not save clipboard image. Make sure you have an image copied to clipboard.\n{error_msg}"
        )
        sys.exit(1)

    if not os.path.exists(temp_image_path) or os.path.getsize(temp_image_path) == 0:
        print("Error: No image found in clipboard or failed to save.")
        sys.exit(1)

    if args.label:
        label_script = """
        on run argv
            set folderName to item 1 of argv
            set theTitle to item 2 of argv
            set theLabel to item 3 of argv
            tell application "Notes"
                try
                    set theNote to the first note in folder folderName whose name is theTitle
                    set currentBody to the body of theNote
                    set the body of theNote to currentBody & "<div><b>" & theLabel & "</b></div>"
                    return "label_added"
                on error errMsg
                    return "error: " & errMsg
                end try
            end tell
        end run
        """
        result = subprocess.run(
            ["osascript", "-e", label_script, FOLDER, args.title, args.label],
            capture_output=True,
            text=True,
        )
        if "error:" in result.stdout:
            print(f"Warning: Could not add label: {result.stdout}")

    attach_script = """
    on run argv
        set folderName to item 1 of argv
        set theTitle to item 2 of argv
        set imagePath to item 3 of argv
        tell application "Notes"
            try
                set theNote to the first note in folder folderName whose name is theTitle
                set theAttachment to POSIX file imagePath
                tell theNote
                    make new attachment with data theAttachment
                end tell
                return "Attached image to: " & theTitle
            on error errMsg
                return "error: " & errMsg
            end try
        end tell
    end run
    """
    result = subprocess.run(
        ["osascript", "-e", attach_script, FOLDER, args.title, temp_image_path],
        capture_output=True,
        text=True,
    )
    output = result.stdout.strip()
    if "error:" in output:
        print(f"Error: {output}")
        sys.exit(1)
    else:
        print(output)
finally:
    try:
        os.remove(temp_image_path)
    except OSError:
        pass
