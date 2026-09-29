# clipfix

Make text copied out of a terminal agent pasteable again.

Claude Code, Codex and every other TUI agent put a bullet glyph and a two-space
gutter in front of the text and break long lines to fit the window. Copy that
and you get this:

```
⏺ The working directory is /Volumes/Dev/ai, a non-git folder on an external volume, and this session starts with no task in flight — just a
  request for a paragraph of prose, which needs no file reads, no searches, and
  no tool calls at all.
```

Paste it into a document and the paragraph is in pieces. Paste a command and the
leading spaces, or a line the renderer cut in half, stop it from running.
`clipfix` puts it back:

```
The working directory is /Volumes/Dev/ai, a non-git folder on an external volume, and this session starts with no task in flight — just a request for a paragraph of prose, which needs no file reads, no searches, and no tool calls at all.
```

## Install

```bash
ln -sf "$PWD/bin/clipfix.mjs" ~/.local/bin/clipfix
```

No dependencies. The symlink points into this directory, so `clipfix` needs the
`/Volumes/Dev` volume mounted.

### Hotkey

The Raycast script command `fix-clipboard.sh` sits at the top level of the
`woda-script-commands` repo, next to this folder. Raycast does not scan
subfolders, so it must stay there. Add the repo in **Raycast → Extensions →
Script Commands → Add Script Directory** and give it a hotkey.
`⌥⇧V` works well: next to `⌘V`, hard to hit by accident.

- **Fix Clipboard** - repair whatever was copied. For `\` continuations, run
  `clipfix --cmd` in a terminal.

## Use

```bash
clipfix                  # fix the clipboard in place
clipfix -n               # print the result, leave the clipboard alone
clipfix --cmd            # also fold "\" continuations into one line
clipfix --keep-breaks    # only strip the glyph and the gutter
cat notes.txt | clipfix  # stdin -> stdout
clipfix -c               # the clipboard, even with a pipe attached
```

The source is the clipboard unless stdin is a pipe or a file. `-c` and `--stdin`
say so outright, which is what the Raycast scripts do: a launcher hands a script
an empty stdin, and guessing there would read the wrong thing.

`clipfix --help` lists every option.

## How it decides where a line break belongs

The damage is deterministic, so the repair is too. Nothing here rewrites
content: every character in the output was in the input, and only whitespace and
the UI's own glyphs are ever removed.

1. **Glyphs** (`⏺ ⎿ • │ └ ✽ ❯`) are replaced with a space, so the columns under
   them still line up.
2. **The gutter** - the widest left margin every line shares - is removed. Any
   indentation deeper than that is real and survives, so code keeps its shape.
3. **Broken lines** are re-joined, and the width of the block says how:

   - A renderer that wraps **prose** breaks at a word, so the line lengths in
     the block vary. Those get re-joined **with a space**.
   - A renderer that wraps **code** cuts at an exact column, so every line but
     the last is the same length and the cut usually lands inside a token
     (`--no-` / `pager`). Those get re-joined **with nothing**.

   A cut that landed on a space is the awkward case: the renderer leaves that
   space at the end of the first half, so trailing whitespace is kept until
   after the re-join. When a terminal drops it instead, a second half that
   starts with a long flag (`--tolerance`) could not have come from a split
   token, so the space is put back.

   A line is only treated as wrapped if it reaches within `--slack` characters
   (12) of the widest line in its block, and the block is at least 60 characters
   wide. A short line ends a paragraph, a list item or a command, and is left
   alone. `--prose` and `--code` force the choice; `--keep-breaks` skips the
   step.

A `$ ` prompt is dropped only when every line carries one, so a copied session
transcript keeps its output intact.

## The `--llm` flag, and why it is off

`clipfix --llm` sends the text to a local ollama model and lets it decide the
line breaks. **Its answer is used only if it changed whitespace and nothing
else** - same characters, same order. A model that drops a flag, rewrites a path
or invents a word fails that check and its answer is thrown away. The worst a
bad model can do here is nothing.

That gate is not theoretical. On the paragraph above:

| engine | time | result |
| --- | --- | --- |
| the rules in `clean.mjs` | 0.04 s | correct |
| `s1-mini-nothink` (484 MB) | 0.7 s | lower-cased the text, turned an em dash into a comma, cut the last sentence - **discarded** |
| `gemma4:26b` (17 GB) | 27 s | correct |

A small model is not accurate enough and a big one is far too slow for a key
press. Use `--llm` when the rules genuinely cannot tell, not by default. It
refuses to touch anything that looks executable unless you add `--force-llm`.

`CLIPFIX_MODEL` and `OLLAMA_HOST` change the defaults.

## Limits

- Two consecutive lines of code that happen to be the same length, wider than 60
  characters, are read as a column wrap and joined. `--prose` or `--keep-breaks`
  gets around it.
- If a terminal both drops the space it wrapped on *and* the second half does
  not start with a long flag, the space cannot be recovered - there is nothing
  left in the text that says it was ever there.
- A terminal that copies soft-wrapped lines without a newline (Ghostty, iTerm2
  in some modes) hands over text with no damage to repair. `clipfix` leaves it
  alone.
- Inside Claude Code itself, `/copy` picks a single block off the transcript
  without the gutter. This tool is for everything that has already been copied
  the normal way.

## Test

```bash
npm test
```
