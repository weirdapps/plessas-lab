---
description: Access and process Gmail messages
argument-hint: [operation: list|search|read|send|reply|forward|draft|profile]
allowed-tools: Skill(manage-gmail), Bash
---

<objective>
Delegate Gmail operations to the manage-gmail skill for: $ARGUMENTS

This routes to the specialized skill containing Gmail API patterns, authentication, and workflows.
</objective>

<process>
1. Use Skill tool to invoke manage-gmail skill
2. Pass user's request: $ARGUMENTS
3. Let skill handle the Gmail workflow
</process>

<success_criteria>
- Skill successfully invoked
- Gmail operation completed
- Results returned in JSON format
</success_criteria>
