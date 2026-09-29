import test from "node:test";
import assert from "node:assert/strict";
import { clean, looksExecutable } from "../src/clean.mjs";

const fix = (text, options) => clean(text, options).text;

// The paragraph that started all this, exactly as the terminal hands it over.
const CLAUDE_PROSE = [
  "⏺ The working directory is /Volumes/Dev/ai, a non-git folder on an external volume, and this session starts with no task in flight — just a request for a",
  "  paragraph of prose, which needs no file reads, no searches, and no tool calls at all. So here is that paragraph: plain text of the kind you asked for,",
  "  written in straightforward English, kept short because you prefer concision over padding.",
].join("\n");

test("a wrapped prose answer comes back as one paragraph", () => {
  const out = fix(CLAUDE_PROSE);
  assert.equal(out.split("\n").length, 1);
  assert.ok(!out.startsWith(" "));
  assert.ok(out.startsWith("The working directory is /Volumes/Dev/ai,"));
  assert.ok(out.includes("for a paragraph of prose"), "the wrap must be healed with a single space");
  assert.ok(!out.includes("  "), "no double spaces left behind");
});

test("the gutter is stripped from a command block so it pastes and runs", () => {
  const input = ["  git fetch --all --prune", "  git rebase origin/master", "  git push --force-with-lease"].join("\n");
  assert.equal(fix(input), "git fetch --all --prune\ngit rebase origin/master\ngit push --force-with-lease");
});

test("a command the renderer cut at a fixed column is re-joined with nothing", () => {
  const command =
    "ssh dave@homelab 'journalctl -u caddy --since \"2026-09-10 08:00\" --no-pager --output=short-iso | grep -i error'";
  const width = 70;
  const input = [command.slice(0, width), command.slice(width)].map((l) => `  ${l}`).join("\n");
  assert.equal(fix(input), command);
});

test("short lines of equal length are left alone (aligned code is not a wrap)", () => {
  const input = ["  const alpha = 1;", "  const gamma = 2;"].join("\n");
  assert.equal(fix(input), "const alpha = 1;\nconst gamma = 2;");
});

test("a list keeps one item per line", () => {
  const input = [
    "⏺ Three things need to happen before the deploy can go out to the production cluster today:",
    "  - fetch the new certificate from 1Password and put it in the secret store, then restart",
    "    the ingress so it picks the new chain up",
    "  - bump the image tag",
  ].join("\n");
  const out = fix(input).split("\n");
  assert.equal(out.length, 3);
  assert.ok(out[1].startsWith("- fetch the new certificate"));
  assert.ok(out[1].endsWith("the ingress so it picks the new chain up"), "the item's own wrap is healed");
  assert.equal(out[2], "- bump the image tag");
});

test("a shell prompt is dropped only when every line carries one", () => {
  assert.equal(fix("  $ brew update\n  $ brew upgrade"), "brew update\nbrew upgrade");
  assert.equal(fix("  $ brew update\n  ==> Downloading"), "$ brew update\n==> Downloading");
});

test("an explicit backslash continuation survives, and --cmd folds it", () => {
  const input = ["  docker run --rm \\", "    -v $PWD:/src \\", "    alpine sh"].join("\n");
  assert.equal(fix(input), "docker run --rm \\\n  -v $PWD:/src \\\n  alpine sh");
  assert.equal(fix(input, { cmd: true }), "docker run --rm -v $PWD:/src alpine sh");
});

test("--keep-breaks strips the margin and touches nothing else", () => {
  const out = fix(CLAUDE_PROSE, { unwrap: false });
  assert.equal(out.split("\n").length, 3);
  assert.ok(!out.split("\n").some((l) => l.startsWith(" ")));
});

test("interface chrome is dropped", () => {
  const input = ["⏺ Read(src/app.ts)", "  ⎿  Read 240 lines", "     … +12 lines (ctrl+o to expand)"].join("\n");
  assert.equal(fix(input), "Read(src/app.ts)\n   Read 240 lines");
});

test("chrome is kept when it is the only thing on the clipboard", () => {
  assert.equal(fix("… +12 lines (ctrl+o to expand)"), "… +12 lines (ctrl+o to expand)");
});

test("cleaning twice changes nothing the second time", () => {
  for (const sample of [CLAUDE_PROSE, "  $ ls -la\n  $ pwd", "  plain text"]) {
    const once = fix(sample);
    assert.equal(fix(once), once, `not idempotent for: ${sample}`);
  }
});

test("no character other than whitespace and the glyph is ever removed", () => {
  const skeleton = (s) => s.replace(/\s+/g, "").replace(/[⏺⎿]/g, "");
  const samples = [
    CLAUDE_PROSE,
    "⏺ Read(src/app.ts)\n  ⎿  Read 240 lines",
    "  git rebase --onto origin/master feature/x~3 feature/x",
    "  const alpha = 1;\n  const gamma = 2;",
  ];
  for (const sample of samples) {
    assert.equal(skeleton(fix(sample)), skeleton(sample), `content changed for: ${sample}`);
  }
});

test("looksExecutable spots the things that must not reach a model", () => {
  assert.ok(looksExecutable("git push --force-with-lease"));
  assert.ok(looksExecutable("cat foo | grep bar"));
  assert.ok(looksExecutable("ssh box 'uptime'"));
  assert.ok(!looksExecutable("The working directory is a folder on an external volume."));
});

// The command that found this: 232 characters, wrapped by the renderer at
// column 140, which is where the space before --tolerance sits.
const ARTISAN =
  'php artisan woda:reconcile-payments --gateway=stripe --account="acct_dummy_00000000" ' +
  '--from="2026-08-01 00:00:00" --to="2026-08-31 23:59:59" --tolerance=0.02 ' +
  "--report=/tmp/reconcile-august.csv --notify=finance@example.test --dry-run";

test("a wrap that landed on a space keeps the space", () => {
  const at = ARTISAN.indexOf(" --tolerance") + 1;
  const input = [`  ${ARTISAN.slice(0, at)}`, `  ${ARTISAN.slice(at)}`].join("\n");
  assert.equal(fix(input), ARTISAN);
});

test("a wrap that landed on a space survives a terminal that drops the space", () => {
  const at = ARTISAN.indexOf(" --tolerance");
  const input = [`  ${ARTISAN.slice(0, at)}`, `  ${ARTISAN.slice(at + 1)}`].join("\n");
  assert.equal(fix(input), ARTISAN);
});

test("a wrap inside a token is still joined with nothing", () => {
  const command =
    "ssh dave@homelab.local 'journalctl -u caddy --since \"2026-09-10 08:00\" --no-pager --output=short-iso'";
  const at = command.indexOf("-pager");
  const input = [`  ${command.slice(0, at)}`, `  ${command.slice(at)}`].join("\n");
  assert.equal(fix(input), command);
});
