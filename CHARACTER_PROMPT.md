# Prompt: draw a Code Critter character

Paste everything below the line into any AI, with your character described where marked.
Save the answer as `~/.claude/code-critter/characters/<name>/character.json`
(Windows: `%USERPROFILE%\.claude\code-critter\characters\<name>\character.json`), then run `/pet reload`.
If the pet lists errors, paste them back to the AI and ask it to fix exactly those rows.

Inside Claude Code, `/pet create <description>` does all of this for you.

---

You are drawing a pixel-art character for the Code Critter desk pet. Answer with ONE JSON object and nothing else.

Character to draw: <DESCRIBE YOUR CHARACTER HERE, e.g. "a small orange cat with a white belly">

## Format (schemaVersion 1)

```json
{
  "schemaVersion": 1,
  "name": "lowercase-with-dashes",
  "author": "your name",
  "license": "CC0-1.0",
  "size": 24,
  "palette": { "o": "#3b2314", "b": "#b5723a" },
  "states": {
    "idle":  { "fps": 2, "frames": [ ["24 strings of 24 characters"], ["..."] ] },
    "work":  { "fps": 4, "frames": [ ["..."], ["..."] ] },
    "sleep": { "fallbackTo": "idle" }
  }
}
```

## Hard rules (a validator rejects anything else)

1. `size` is 16, 24 or 32. Use 24 unless told otherwise. Every frame is exactly `size` strings and every string is exactly `size` characters. Count them.
2. `.` is transparent. Every other character must be a one-character key in `palette`, valued `#rrggbb`. At most 16 colours.
3. `name` is 1-32 characters of `a-z`, `0-9` and `-`.
4. `idle` is required, with 2 to 4 frames. Every other state is optional: give it 1 to 8 frames, or `{ "fallbackTo": "<a state that has frames>" }`, or leave it out.
5. `fps` is above 0 and at most 10.
6. Keep the feet on the same row in every frame of a state (within 2 rows), and the character centred.
7. Original characters only: no existing brands, mascots or copyrighted characters.

## States the pet acts out

Only `idle` is needed. A state left out falls back as shown, so draw the ones that matter to your character.

| State | When | Falls back to |
| --- | --- | --- |
| `idle` | at rest | required |
| `think` | Claude is thinking | `idle` |
| `work` | Claude runs a tool | `idle` |
| `read`, `write`, `type`, `search`, `clone` | reading files, editing, running commands, searching the web, starting a subagent | `work` |
| `happy` | a turn finished | `idle` |
| `sleep` | nothing for ten minutes | `idle` |
| `tired` | the context window is nearly full | `idle` |
| `sad` | neglected for a long while | `idle` |
| `petted`, `eat` | you pressed Pet or Feed | `idle` |
| `copy` | you ran a slash command | `idle` |
| `squash`, `wipe`, `hat` | you ran `/compact`, `/clear`, `/model` | `copy` |

## How to draw reliably

- Draw frame 1 of `idle` first, with a dark outline colour, one or two body colours and one highlight. Keep shapes chunky: 2 or more pixels wide.
- Make every later frame by COPYING frame 1 and changing only a few rows (blink: the eye row; bob: shift the head rows down one; work: move the arm rows). Do not redraw from scratch.
- Before answering, re-count every row. A row that is not exactly `size` characters is the most common mistake.
