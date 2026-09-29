// clipfix - undo what a terminal agent UI does to text on its way to the clipboard.
//
// The damage is deterministic, so the repair is too. Three things happen to a
// line of text between the model and the clipboard:
//
//   1. a bullet glyph is put in column 0        (⏺ ⎿ • │ └ ├ ✽ ❯)
//   2. every line is pushed right by a gutter   (2 spaces in Claude Code)
//   3. the renderer breaks the line to fit      (at a word for prose,
//                                                at an exact column for code)
//
// Nothing in this file rewrites content. Every character in the output is a
// character that was in the input; only whitespace and glyphs are removed.

const GLYPHS = "⏺⎿•∙●▪▶│└├─╭╰✽❯›";
const LEADING_GLYPHS = new RegExp(`^([ \\t]*)([${GLYPHS}]+)`, "u");
const ANSI = /\x1B\[[0-9;?]*[ -\/]*[@-~]/g;

// Chrome the UI prints that is not part of the text.
const UI_NOISE = [
  /^\s*(?:…|\.\.\.)\s*\+\d+\s+lines?\b.*$/,
  /^\s*\(ctrl\+\w.*\)\s*$/i,
  /^\s*⧉\s+Selected\s+\d+\s+lines?\b.*$/,
];

// A line that starts a new thing is never the continuation of the line above it.
const NEW_ITEM = /^\s*(?:[-*+]\s|\d+[.)]\s|#{1,6}\s|>\s|\||```|~~~)/;

// A block is only wide enough to have been wrapped by a terminal if it is this
// wide. Below it, equal-length lines are a coincidence (aligned code), not a
// column wrap.
const MIN_WRAP_WIDTH = 60;

/**
 * @param {string} text
 * @param {object} [options]
 * @param {"auto"|"prose"|"code"} [options.mode]  how to re-join broken lines
 * @param {boolean} [options.unwrap]   false keeps every line break
 * @param {boolean} [options.cmd]      fold backslash continuations into one line
 * @param {number}  [options.slack]    how far short of the wrap column a line
 *                                     may stop and still count as wrapped
 * @returns {{text: string, stats: object}}
 */
export function clean(text, options = {}) {
  const { mode = "auto", unwrap = true, cmd = false, slack = 12 } = options;
  const stats = { glyphs: 0, gutter: 0, noise: 0, joined: 0, prompts: 0 };

  // Trailing whitespace is kept for now: when a renderer wraps a line at a
  // space it leaves that space at the end of the line, and that space is the
  // only evidence that the two halves were separate words. It is trimmed once
  // the lines have been put back together.
  let lines = text.replace(ANSI, "").replace(/\r\n?/g, "\n").split("\n");

  const kept = lines.filter((l) => !UI_NOISE.some((re) => re.test(l)));
  if (kept.some((l) => l.trim() !== "")) {
    stats.noise = lines.length - kept.length;
    lines = kept;
  }

  // Replace each glyph with one space so the columns below it still line up;
  // the gutter step then takes the whole left margin off in one go.
  lines = lines.map((line) =>
    line.replace(LEADING_GLYPHS, (_m, indent, glyphs) => {
      stats.glyphs += 1;
      return indent + " ".repeat(glyphs.length);
    }),
  );

  lines = trimBlankEdges(lines);
  stats.gutter = dedent(lines);
  stats.prompts = stripPrompt(lines);

  if (unwrap) {
    const out = [];
    for (const block of blocks(lines)) {
      if (block.blank) out.push(...block.lines);
      else out.push(...unwrapBlock(block.lines, mode, slack, stats));
    }
    lines = out;
  }

  let result = trimBlankEdges(lines)
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n");
  if (cmd) result = result.replace(/[ \t]*\\\n[ \t]*/g, " ");
  return { text: result, stats };
}

function trimBlankEdges(lines) {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === "") start += 1;
  while (end > start && lines[end - 1].trim() === "") end -= 1;
  return lines.slice(start, end);
}

/** Remove the widest left margin every non-empty line shares. Mutates `lines`. */
function dedent(lines) {
  let margin = Infinity;
  for (const line of lines) {
    if (line.trim() === "") continue;
    margin = Math.min(margin, line.length - line.trimStart().length);
    if (margin === 0) break;
  }
  if (!Number.isFinite(margin) || margin === 0) return 0;
  for (let i = 0; i < lines.length; i += 1) lines[i] = lines[i].slice(margin);
  return margin;
}

/** Drop a shell prompt, but only when every line carries one. Mutates `lines`. */
function stripPrompt(lines) {
  const body = lines.filter((l) => l.trim() !== "");
  if (body.length === 0) return 0;
  const prompt = /^[$%>](?: |$)/;
  if (!body.every((l) => prompt.test(l))) return 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() !== "") lines[i] = lines[i].replace(prompt, "");
  }
  return body.length;
}

/** Split into runs of blank and non-blank lines. */
function blocks(lines) {
  const out = [];
  for (const line of lines) {
    const blank = line.trim() === "";
    const last = out[out.length - 1];
    if (last && last.blank === blank) last.lines.push(line);
    else out.push({ blank, lines: [line] });
  }
  return out;
}

function unwrapBlock(lines, mode, slack, stats) {
  if (lines.length < 2) return lines;

  const width = Math.max(...lines.map((l) => l.length));
  // A renderer that wraps code cuts at an exact column, so every line but the
  // last is the same length and the cut usually lands inside a token: those
  // must be re-joined with nothing. A renderer that wraps prose cuts at a word,
  // so the lengths vary: those must be re-joined with a space.
  const columnWrapped =
    mode === "code" ||
    (mode === "auto" && width >= MIN_WRAP_WIDTH && lines.slice(0, -1).every((l) => l.length === width));

  const out = [lines[0]];
  for (let i = 1; i < lines.length; i += 1) {
    const previous = lines[i - 1];
    const line = lines[i];
    const wrapped = columnWrapped ? previous.length === width : previous.length >= width - slack;

    if (wrapped && width >= MIN_WRAP_WIDTH && !NEW_ITEM.test(line) && !previous.trimEnd().endsWith("\\")) {
      const tail = out[out.length - 1];
      out[out.length - 1] = columnWrapped ? tail + gap(tail, line) + line : `${tail.trimEnd()} ${line.trimStart()}`;
      stats.joined += 1;
    } else {
      out.push(line);
    }
  }
  return out;
}

/**
 * What goes between two halves of a column wrap. Normally nothing - the cut
 * landed inside a token. But a cut that landed on a space leaves the space at
 * the end of the first half, and some terminals drop it instead; a second half
 * that starts with a long flag could not have come from a split token, so the
 * space is put back.
 */
function gap(before, after) {
  if (/[ \t]$/.test(before)) return "";
  return /^--\w/.test(after) ? " " : "";
}

/**
 * True if the text looks like something you would paste into a shell. Used to
 * keep the optional model pass away from anything executable.
 */
export function looksExecutable(text) {
  return /(^|\n)\s*(?:sudo|ssh|scp|rsync|curl|wget|git|gh|docker|kubectl|npm|pnpm|yarn|node|python3?|pip3?|brew|make|cargo|go|mvn|psql|mysql|aws|gcloud|az|terraform|systemctl|journalctl|chmod|chown|rm|mv|cp|cd|export)\s/.test(
    text,
  ) || /[|&]{1,2}\s|\$\(|`\w|--[a-z][\w-]*|^\s*```/m.test(text);
}
