import test from "node:test";
import assert from "node:assert/strict";
import { polish } from "../src/llm.mjs";

const INPUT = "git push --force-with-lease\norigin master";

/** Stand in for ollama, returning whatever the fake model "said". */
function withModelSaying(answer, run) {
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ response: answer }), { status: 200 });
  return run().finally(() => {
    globalThis.fetch = real;
  });
}

test("a whitespace-only repair is accepted", async () => {
  const result = await withModelSaying("git push --force-with-lease origin master", () => polish(INPUT));
  assert.equal(result.used, true);
  assert.equal(result.text, "git push --force-with-lease origin master");
});

test("a model that drops a flag is ignored", async () => {
  const result = await withModelSaying("git push --force origin master", () => polish(INPUT));
  assert.equal(result.used, false);
  assert.equal(result.text, INPUT, "the deterministic text must survive untouched");
  assert.match(result.reason, /changed the text/);
});

test("a model that adds a friendly sentence is ignored", async () => {
  const result = await withModelSaying(`Here is the fixed text:\n${INPUT}`, () => polish(INPUT));
  assert.equal(result.used, false);
  assert.equal(result.text, INPUT);
});

test("a model that answers with nothing is ignored", async () => {
  const result = await withModelSaying("   ", () => polish(INPUT));
  assert.equal(result.used, false);
  assert.equal(result.text, INPUT);
  assert.match(result.reason, /nothing/);
});

test("a code fence around an otherwise faithful answer is tolerated", async () => {
  const result = await withModelSaying("```\ngit push --force-with-lease origin master\n```", () => polish(INPUT));
  assert.equal(result.used, true);
  assert.equal(result.text, "git push --force-with-lease origin master");
});

test("ollama being down is reported, not thrown", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("connect ECONNREFUSED");
  };
  try {
    const result = await polish(INPUT);
    assert.equal(result.used, false);
    assert.equal(result.text, INPUT);
    assert.match(result.reason, /unreachable/);
  } finally {
    globalThis.fetch = real;
  }
});
