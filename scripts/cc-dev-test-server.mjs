#!/usr/bin/env node
/**
 * Manage the isolated Command Center Next test server.
 *
 *   node scripts/cc-dev-test-server.mjs start
 *   node scripts/cc-dev-test-server.mjs stop
 *
 * Binds DATABASE_URL to TEST_DATABASE_URL only. Refuses Production.
 */
import {
  ensureDevTestHttpBase,
  stopDevTestHttpBase,
} from "./lib/dev-test-server.mjs";

const cmd = process.argv[2] || "start";

async function main() {
  if (cmd === "stop") {
    await stopDevTestHttpBase();
    console.log("dev test server stopped");
    return;
  }
  if (cmd === "start") {
    const { baseUrl, host } = await ensureDevTestHttpBase();
    console.log(`started baseUrl=${baseUrl} host=${host}`);
    console.log("Leave this process idle or run tests in another terminal.");
    // Keep alive if run interactively as start command without unref-only child
    await new Promise(() => {});
  }
  console.error("Usage: node scripts/cc-dev-test-server.mjs start|stop");
  process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
