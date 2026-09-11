#!/usr/bin/env node
/**
 * Simulates the public quote success path with a broken DATABASE_URL.
 * Asserts persistence failure cannot surface as a thrown error after "email sent".
 *
 * Usage:
 *   node scripts/test-phase2-quote-failopen.mjs
 */
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function simulateQuoteSuccessPath(data) {
  // Stand-in for successful Resend delivery.
  const emailSent = true;

  // Same contract as app/api/quote/route.js after() callback.
  const { safePersistQuoteLead } = await import(
    `../lib/cc/db/persist-quote-lead.js?failopen=${Date.now()}`
  );

  const persistResult = await safePersistQuoteLead(data);

  return {
    ok: emailSent === true,
    persistResult,
  };
}

async function main() {
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL =
    "postgresql://invalid:invalid@127.0.0.1:1/nonexistent?sslmode=require";

  let threw = false;
  let response;
  try {
    response = await simulateQuoteSuccessPath({
      fullName: "Fail Open Test",
      email: "failopen@example.com",
      city: "Manvel",
      propertyType: "Home",
      projectType: "TV Mounting",
      description: "Verify quote still succeeds when Neon is down.",
      contactMethod: "Email",
      preferredDate: "",
      photos: [
        {
          pathname: "quote-requests/failopen-test.jpg",
          contentType: "image/jpeg",
          size: 1000,
        },
      ],
    });
  } catch {
    threw = true;
  }

  if (previous === undefined || previous === null || previous === "") {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = previous;
  }

  if (threw) {
    throw new Error("FAIL: quote success path threw when DATABASE_URL was invalid");
  }
  if (!response?.ok) {
    throw new Error("FAIL: quote success path did not return ok");
  }
  if (response.persistResult?.ok === true) {
    throw new Error("FAIL: persistence should not report ok with invalid DATABASE_URL");
  }

  console.log(
    "PASS — quote remains ok:true with invalid DATABASE_URL; persistResult:",
    response.persistResult
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
