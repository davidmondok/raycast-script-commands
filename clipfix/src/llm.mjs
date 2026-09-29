// Optional second pass: let a small local model decide where the line breaks
// belong, when the deterministic rules in clean.mjs are not sure.
//
// The model is never trusted. Its answer is accepted only if it is the input
// with different whitespace - same characters, same order. A model that drops a
// flag, changes a path or invents a word fails that check and its answer is
// thrown away. This makes the pass safe by construction: the worst a bad model
// can do is nothing.

export const DEFAULT_MODEL = process.env.CLIPFIX_MODEL ?? "s1-mini-nothink:latest";
export const DEFAULT_HOST = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";

const SYSTEM = `You repair text copied out of a terminal. The terminal broke long lines to fit its width.

Join the lines that the terminal broke apart. Keep the line breaks that the author meant: between paragraphs, between list items, between separate commands, and inside code.

Rules you must not break:
- Never add, remove or change a word, a character, a flag, a path or punctuation.
- Only add or remove spaces and newlines.
- Reply with the repaired text and nothing else. No explanation, no code fence.`;

/** The signature that a repair must preserve: every non-whitespace character, in order. */
const skeleton = (text) => text.replace(/\s+/g, "");

/**
 * @returns {Promise<{text: string, used: boolean, reason?: string}>}
 */
export async function polish(text, { model = DEFAULT_MODEL, host = DEFAULT_HOST, timeoutMs = 20000 } = {}) {
  let response;
  try {
    response = await fetch(`${host}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        system: SYSTEM,
        prompt: text,
        stream: false,
        think: false,
        options: { temperature: 0, num_ctx: 8192 },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    return { text, used: false, reason: `ollama unreachable at ${host} (${error.message})` };
  }

  if (!response.ok) {
    return { text, used: false, reason: `ollama returned ${response.status} ${await response.text()}` };
  }

  const body = await response.json();
  const candidate = (body.response ?? "").replace(/^```[\w]*\n?|\n?```$/g, "").trim();

  if (candidate === "") return { text, used: false, reason: "model returned nothing" };
  if (skeleton(candidate) !== skeleton(text)) {
    return { text, used: false, reason: `${model} changed the text, not just the line breaks - answer discarded` };
  }
  return { text: candidate, used: true };
}
