import { neon } from "@neondatabase/serverless";

/**
 * Returns a Neon SQL tagged-template client, or null when DATABASE_URL is missing.
 * Callers must treat null as "persistence unavailable" — never throw into the quote path.
 */
export function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;

  try {
    return neon(url);
  } catch (error) {
    console.error("[cc/db] failed to create Neon client");
    return null;
  }
}

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL?.trim());
}
