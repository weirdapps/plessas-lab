---
description: Access and manage Apple Notes (list, create, read, delete)
argument-hint: "[operation: list|create|read|delete] [title] [content]"
allowed-tools: Skill(manage-apple-notes), Bash
---

# Apple Notes Command

<objective>
Execute Apple Notes operations via the manage-apple-notes skill for: $ARGUMENTS

Routes to the specialized skill containing AppleScript-based workflows for note management within the `agent-notes` folder.
</objective>

<operations>
| Operation | Arguments | Example |
|-----------|-----------|---------|
| list | none | `/apple-notes list` |
| create | title, content | `/apple-notes create "Meeting Notes" "Action items..."` |
| read | title | `/apple-notes read "Meeting Notes"` |
| delete | title | `/apple-notes delete "Old Note"` |
</operations>

<process>
1. Parse the operation from: $ARGUMENTS
2. Use Skill tool to invoke apple-notes skill
3. Execute the appropriate script based on operation:
   - `list` → `python scripts/list-notes.py`
   - `create` → `cat << 'EOF' | python scripts/create-note.py --title "Title"\n<content>\nEOF`
   - `read` → `python scripts/read-note.py --title "Title"`
   - `delete` → `python scripts/delete-note.py --title "Title"`
4. Return results to user
</process>

<destructive_operations>
The `delete` operation removes a note permanently — Apple Notes does not move
deleted notes to a recoverable trash for AppleScript-driven deletes. Always
confirm with the user before invoking `delete`, quoting the exact note title
back to them. Do not delete based on inferred intent from prior turns.
</destructive_operations>

<success_criteria>

- Operation completed successfully
- Clear feedback provided to user
- For create: Note visible in Apple Notes app
- For read: Full HTML content returned
- For list: All notes in agent-notes folder shown
- For delete: User confirmed the exact title before execution
</success_criteria>
