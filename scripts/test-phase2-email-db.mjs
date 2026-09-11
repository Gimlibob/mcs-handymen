#!/usr/bin/env node
/**
 * Production E2E: upload private photo → POST /api/quote → verify Neon row.
 * Uses live Resend + Blob on www.mcshandymen.com (Phase 2 persistence).
 */
import nextEnv from "@next/env";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { upload } from "@vercel/blob/client";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const BASE = process.env.PHASE2_E2E_BASE_URL || "https://www.mcshandymen.com";
const marker = String(Date.now());
const email = `phase2-e2e-${marker}@example.com`;

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL required to verify persistence");
  }

  const bytes = readFileSync(new URL("../public/images/phase2-test.jpg", import.meta.url));
  const file = new File([bytes], "phase2-test.jpg", { type: "image/jpeg" });
  const pathname = `quote-requests/phase2-e2e-${marker}.jpg`;

  console.log("Uploading private blob via production handleUploadUrl…");
  const blob = await upload(pathname, file, {
    access: "private",
    handleUploadUrl: `${BASE}/api/blob/upload`,
    contentType: "image/jpeg",
  });

  console.log("Blob pathname:", blob.pathname);

  const payload = {
    fullName: "Phase2 E2E Customer",
    email,
    city: "Manvel",
    citySelection: "Manvel",
    propertyType: "Home",
    projectType: "TV Mounting",
    projectTypeSelection: "TV Mounting",
    description:
      "Phase 2 E2E test submission. Please ignore — verifying Command Center lead persistence after quote email.",
    contactMethod: "Email",
    preferredDate: "",
    photos: [
      {
        pathname: blob.pathname,
        contentType: blob.contentType || "image/jpeg",
        size: bytes.length,
      },
    ],
  };

  console.log("POST /api/quote …");
  const response = await fetch(`${BASE}/api/quote`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const bodyText = await response.text();
  console.log("Quote status:", response.status, bodyText);

  if (!response.ok) {
    throw new Error(`Quote API failed: ${response.status} ${bodyText}`);
  }

  // after() persistence is async — poll Neon briefly.
  const sql = neon(process.env.DATABASE_URL);
  let rows = [];
  for (let attempt = 1; attempt <= 12; attempt++) {
    await new Promise((r) => setTimeout(r, 1500));
    rows = await sql`
      SELECT l.id, l.email, l.status, l.source, p.blob_pathname
      FROM leads l
      JOIN lead_photos p ON p.lead_id = l.id
      WHERE l.email = ${email}
      ORDER BY l.created_at DESC
      LIMIT 1
    `;
    if (rows.length > 0) break;
    console.log(`Waiting for Neon row (attempt ${attempt}/12)…`);
  }

  if (rows.length === 0) {
    throw new Error("Quote returned ok but lead was not found in Neon");
  }

  console.log("PASS — email path ok + Neon lead:", JSON.stringify(rows[0], null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
