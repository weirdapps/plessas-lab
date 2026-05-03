---
description: "Use the nano-banana skill to create a NBG themed infographic"
argument-hint: "[command] [options]"
allowed-tools: Skill(manage-nano-banana), Skill(manage-youtube), Bash
---

<objective>
Delegate graphics creation to the manage-nano-banana skill.
Delegate presentation or document creation to manage-google-workspace skill.

User request: $ARGUMENTS
</objective>

<process>
Rules for the infographics creation
1. The primary purpose of the infographic is to explain the content directly and easily.
2. Do not create fancy representations. Keep them informative and interesting.
3. Keep everything clean, modern, and impressive.
4. Use Accent color: #007b85(only for highlights, lines, and design details)
5. Keep the background either White (#FFFFFF) or Transparent
6. Use Roboto font for the text.
7. Follow these constraints exactly, but feel free to design the content creatively.
8. Unless asked differently by the user, the infographic must be landscape.
</process>

<success_criteria>

- Command executed successfully
- Clear output shown to user
</success_criteria>
