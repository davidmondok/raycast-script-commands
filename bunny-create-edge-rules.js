#!/usr/bin/env node

// Required parameters:
// @raycast.schemaVersion 1
// @raycast.title bunny create edge rules
// @raycast.mode compact

// Optional parameters:
// @raycast.icon 🐰
// @raycast.argument1 { "type": "text", "placeholder": "www.example.com" }
// @raycast.argument2 { "type": "text", "placeholder": "is bedrock?", "optional": true }
// @raycast.needsConfirmation true

// Documentation:
// @raycast.author David
// @raycast.authorURL https://raycast.com/David

import createEdgeRules from './bunny.js';
import getBunnyApiKey from './bunny-key.js';

const hostname = process.argv.slice(2)[0];
const isBedrock = !!process.argv.slice(2)[1];
const pullzoneId = 3366834;

if (!hostname) {
  console.error("Error: Domain is required as a command-line argument.");
  process.exit(1);
}

const apiKey = getBunnyApiKey();

const response = await createEdgeRules(hostname, isBedrock, apiKey, pullzoneId);

console.log(JSON.stringify(response));

export default createEdgeRules;
