#!/usr/bin/env node
import nextEnv from "@next/env";
import { get, list } from "@vercel/blob";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  assert(process.env.BLOB_READ_WRITE_TOKEN, "BLOB_READ_WRITE_TOKEN missing");
  const listed = await list({ prefix: "quote-requests/", limit: 1 });
  assert(listed.blobs?.length > 0, "no blobs in private store");
  const blob = listed.blobs[0];
  const result = await get(blob.pathname, { access: "private" });
  assert(result?.statusCode === 200 && result?.stream, "private get failed");
  console.log("PASS — private blob fetch works");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
