/**
 * Mint an owner session cookie for HTTP regression suites.
 * Includes password_version (pv) from owner_accounts when a DB owner exists
 * so suites work after Auth Phase B removed legacy no-pv acceptance.
 *
 * @param {{ pv?: number | null, omitPv?: boolean }} [opts]
 *   - omitPv: true → legacy no-pv session
 *   - pv: explicit password_version (for stale/valid cases)
 *   - default: load current owner password_version from DATABASE_URL
 */
import { createHmac } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const COOKIE = "mcs_cc_session";

export async function mintOwnerTestCookie(opts = {}) {
  const secret = process.env.CC_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("CC_SESSION_SECRET missing");
  }

  const payload = {
    role: "owner",
    exp: Date.now() + 60 * 60 * 1000,
  };

  if (opts.omitPv === true) {
    // Legacy session without pv — intentionally omit.
  } else if (typeof opts.pv === "number" && Number.isInteger(opts.pv)) {
    payload.pv = opts.pv;
  } else {
    const url = process.env.DATABASE_URL?.trim();
    if (url) {
      try {
        const sql = neon(url);
        const rows = await sql`
          SELECT password_version
          FROM owner_accounts
          ORDER BY created_at ASC
          LIMIT 1
        `;
        const pv = rows[0]?.password_version;
        if (typeof pv === "number" && Number.isInteger(pv) && pv >= 1) {
          payload.pv = pv;
        }
      } catch {
        // owner_accounts may be absent in older environments
      }
    }
  }

  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${COOKIE}=${body}.${signature}`;
}
