#!/usr/bin/env node
import { main, UsageError, HELP } from "../src/cli.mjs";

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  if (error instanceof UsageError || error?.code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") {
    process.stderr.write(`clipfix: ${error.message}\n\n`);
    process.stderr.write(HELP);
    process.exitCode = 2;
  } else {
    process.stderr.write(`clipfix: ${error?.message ?? error}\n`);
    process.exitCode = 1;
  }
}
