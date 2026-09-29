// clipfix - make text copied out of a terminal agent pasteable again.

import { execFile } from "node:child_process";
import { fstatSync } from "node:fs";
import { parseArgs } from "node:util";
import { promisify } from "node:util";
import { clean, looksExecutable } from "./clean.mjs";
import { polish, DEFAULT_MODEL, DEFAULT_HOST } from "./llm.mjs";

const run = promisify(execFile);

export class UsageError extends Error {}

export const HELP = `clipfix - make text copied out of a terminal agent pasteable again

Strips the bullet glyph and the left gutter that Claude Code, Codex and friends
put in front of every line, then puts the lines the renderer broke back
together. Prose comes out as paragraphs; commands come out runnable.

USAGE
  clipfix [options]              fix the clipboard in place
  cat file | clipfix             read stdin, write stdout
  pbpaste | clipfix | pbcopy     the same thing the long way

OPTIONS
  -c, --clipboard      read and write the clipboard, even with stdin attached
      --stdin          read stdin, write stdout, even with no pipe
  -n, --dry-run        print the result, leave the clipboard alone
  -d, --diff           print what changed to stderr as well
      --prose          re-join broken lines with a space (force)
      --code           re-join broken lines with nothing (force)
      --cmd            also fold "\\" line continuations into one line
      --keep-breaks    only strip glyphs and the gutter, keep every line break
      --slack N        how far short of the wrap column a line may stop and
                       still count as wrapped (default 12)

      --llm            let a local model decide the line breaks. Its answer is
                       used only if it changed whitespace and nothing else.
      --model NAME     ollama model for --llm (default ${DEFAULT_MODEL})
      --force-llm      run --llm on text that looks like a shell command
                       (refused by default)

  -q, --quiet          no summary on stderr
  -h, --help           this text

The model pass needs ollama at ${DEFAULT_HOST}. Set CLIPFIX_MODEL or OLLAMA_HOST
to change either default.
`;

const OPTIONS = {
  clipboard: { type: "boolean", short: "c" },
  stdin: { type: "boolean" },
  "dry-run": { type: "boolean", short: "n" },
  diff: { type: "boolean", short: "d" },
  prose: { type: "boolean" },
  code: { type: "boolean" },
  cmd: { type: "boolean" },
  "keep-breaks": { type: "boolean" },
  slack: { type: "string" },
  llm: { type: "boolean" },
  model: { type: "string" },
  "force-llm": { type: "boolean" },
  quiet: { type: "boolean", short: "q" },
  help: { type: "boolean", short: "h" },
};

export async function main(argv) {
  const { values } = parseArgs({ args: argv, options: OPTIONS, allowPositionals: false });

  if (values.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (values.prose && values.code) throw new UsageError("--prose and --code contradict each other");
  if (values.clipboard && values.stdin) throw new UsageError("--clipboard and --stdin contradict each other");

  const slack = values.slack === undefined ? 12 : Number(values.slack);
  if (!Number.isInteger(slack) || slack < 0) throw new UsageError(`--slack wants a whole number, got "${values.slack}"`);

  const fromStdin = values.stdin || (!values.clipboard && stdinIsRedirected());
  const input = fromStdin ? await readStdin() : await readClipboard();
  if (input.trim() === "") {
    process.stderr.write("clipfix: nothing to fix\n");
    return 1;
  }

  const mode = values.prose ? "prose" : values.code ? "code" : "auto";
  const result = clean(input, { mode, unwrap: !values["keep-breaks"], cmd: values.cmd, slack });
  let text = result.text;
  let note = "";

  if (values.llm) {
    if (looksExecutable(text) && !values["force-llm"]) {
      note = " (model skipped: looks executable, --force-llm to override)";
    } else {
      const polished = await polish(text, { model: values.model });
      if (polished.used) {
        text = polished.text;
        note = ` (${values.model ?? DEFAULT_MODEL})`;
      } else {
        note = ` (model not used: ${polished.reason})`;
      }
    }
  }

  if (fromStdin || values["dry-run"]) process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
  else await writeClipboard(text);

  if (!values.quiet) {
    const { glyphs, gutter, noise, joined, prompts } = result.stats;
    const parts = [];
    if (glyphs) parts.push(`${glyphs} glyph${glyphs === 1 ? "" : "s"}`);
    if (gutter) parts.push(`${gutter}-space gutter`);
    if (prompts) parts.push(`${prompts} prompt${prompts === 1 ? "" : "s"}`);
    if (noise) parts.push(`${noise} ui line${noise === 1 ? "" : "s"}`);
    if (joined) parts.push(`${joined} break${joined === 1 ? "" : "s"} rejoined`);
    const where = fromStdin || values["dry-run"] ? "" : ", clipboard updated";
    process.stderr.write(`clipfix: ${parts.length ? parts.join(", ") : "nothing to strip"}${where}${note}\n`);
  }

  if (values.diff) {
    process.stderr.write(`\n--- before\n${input}\n--- after\n${text}\n`);
  }
  return 0;
}

/**
 * True when stdin is a pipe or a file, i.e. someone sent us text. A terminal, a
 * closed stdin and the /dev/null a launcher hands a script all say false, so
 * running under Raycast reads the clipboard instead of waiting for input that
 * never comes.
 */
function stdinIsRedirected() {
  try {
    const stat = fstatSync(0);
    return stat.isFIFO() || (stat.isFile() && stat.size > 0) || stat.isSocket();
  } catch {
    return false;
  }
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  // The stream stays referenced after EOF on a pipe that is never closed, which
  // would hold the process open. Let go of it.
  process.stdin.pause();
  process.stdin.unref?.();
  return Buffer.concat(chunks).toString("utf8");
}

async function readClipboard() {
  const { stdout } = await run("pbpaste", [], { maxBuffer: 32 * 1024 * 1024 });
  return stdout;
}

async function writeClipboard(text) {
  const child = execFile("pbcopy");
  child.stdin.end(text);
  await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`pbcopy exited ${code}`))));
  });
}
