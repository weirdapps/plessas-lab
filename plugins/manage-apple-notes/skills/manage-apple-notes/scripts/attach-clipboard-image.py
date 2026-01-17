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
import subprocess
import sys
import tempfile
import os

FOLDER = "agent-notes"

parser = argparse.ArgumentParser(description="Attach clipboard image to a note")
parser.add_argument("--title", required=True, help="Note title to attach image to")
parser.add_argument("--label", help="Optional label to display above the image")
args = parser.parse_args()

def escape_applescript(s):
    """Escape string for AppleScript double-quoted string."""
    return s.replace('\\', '\\\\').replace('"', '\\"')

# Create a temporary file for the clipboard image
temp_dir = tempfile.gettempdir()
temp_image_path = os.path.join(temp_dir, "clipboard_image_temp.png")

# Save clipboard image to temp file using AppleScript
save_clipboard_script = f'''
try
    set theFile to (POSIX file "{temp_image_path}")
    set theImage to the clipboard as «class PNGf»
    set fileRef to open for access theFile with write permission
    write theImage to fileRef
    close access fileRef
    return "success"
on error errMsg
    return "error: " & errMsg
end try
'''

result = subprocess.run(["osascript", "-e", save_clipboard_script], capture_output=True, text=True)
if result.returncode != 0 or "error:" in result.stdout:
    error_msg = result.stderr.strip() or result.stdout.strip()
    print(f"Error: Could not save clipboard image. Make sure you have an image copied to clipboard.\n{error_msg}")
    sys.exit(1)

# Verify the image file was created
if not os.path.exists(temp_image_path) or os.path.getsize(temp_image_path) == 0:
    print("Error: No image found in clipboard or failed to save.")
    sys.exit(1)

title = escape_applescript(args.title)

# If label is provided, add it to the note body first
if args.label:
    label = escape_applescript(args.label)
    add_label_script = f'''
    tell application "Notes"
        try
            set theNote to the first note in folder "{FOLDER}" whose name is "{title}"
            set currentBody to the body of theNote
            set the body of theNote to currentBody & "<div><b>{label}</b></div>"
            return "label_added"
        on error errMsg
            return "error: " & errMsg
        end try
    end tell
    '''
    result = subprocess.run(["osascript", "-e", add_label_script], capture_output=True, text=True)
    if "error:" in result.stdout:
        print(f"Warning: Could not add label: {result.stdout}")

# Attach the image to the note
attach_script = f'''
tell application "Notes"
    try
        set theNote to the first note in folder "{FOLDER}" whose name is "{title}"
        set theAttachment to POSIX file "{temp_image_path}"
        tell theNote
            make new attachment with data theAttachment
        end tell
        return "Attached image to: {title}"
    on error errMsg
        return "error: " & errMsg
    end try
end tell
'''

result = subprocess.run(["osascript", "-e", attach_script], capture_output=True, text=True)
output = result.stdout.strip()

# Clean up temp file
try:
    os.remove(temp_image_path)
except:
    pass

if "error:" in output:
    print(f"Error: {output}")
    sys.exit(1)
else:
    print(output)
