import { execFileSync } from 'node:child_process';

// Bunny API key: never hardcode it. Uses BUNNY_API_KEY if set, else reads it from 1Password.
const OP_REFERENCE = 'op://gfwxldpkxbav5lqggcvsvsqszq/24of62d4jkeaspoc377uwn4c5e/credential';

export default function getBunnyApiKey() {
  if (process.env.BUNNY_API_KEY) {
    return process.env.BUNNY_API_KEY.trim();
  }

  try {
    return execFileSync('op', ['read', OP_REFERENCE, '--account', 'wodahq'], { encoding: 'utf8' }).trim();
  } catch {
    console.error('Error: set BUNNY_API_KEY or unlock 1Password (op read failed).');
    process.exit(1);
  }
}
