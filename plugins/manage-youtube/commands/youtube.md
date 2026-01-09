---
description: Access YouTube content - search, get channel info, retrieve videos, transcripts
argument-hint: [search query, channel handle, or video URL]
allowed-tools: Skill(manage-youtube)
---

<objective>
Delegate YouTube content access tasks to the manage-youtube skill for: $ARGUMENTS

This routes to a specialized skill containing prebuilt CLI tools for:
- Searching YouTube videos
- Getting channel information
- Retrieving videos from channels
- Extracting video transcripts
- Getting video details
</objective>

<process>
1. Use Skill tool to invoke manage-youtube skill
2. Pass user's request: $ARGUMENTS
3. Let skill handle the operation using appropriate CLI tools
</process>

<success_criteria>
- Skill successfully invoked
- Appropriate tool selected and executed
- Results returned in requested format (JSON or human-readable)
</success_criteria>
