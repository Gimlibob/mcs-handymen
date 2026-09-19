/**
 * Launch a local Next.js process bound to the isolated Neon development DB.
 *
 * Uses TEST_DATABASE_URL only (via db-write-safety). Never falls back to
 * Production DATABASE_URL from .env.local.
 *
 * Existing process.env.DATABASE_URL is overridden for the child only.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import {
  assertSafeTestDatabaseUrl,
  isProductionDatabaseHost,
  loadLocalEnv,
} from "./db-write-safety.mjs";

const DEFAULT_PORT = 3010;
const MARKER_PATH = join(process.cwd(), ".mcs-cc-test-server.json");

/** @type {{ child: import('node:child_process').ChildProcess, baseUrl: string, host: string } | null} */
let managed = null;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function readMarker() {
  if (!existsSync(MARKER_PATH)) return null;
  try {
    return JSON.parse(readFileSync(MARKER_PATH, "utf8"));
  } catch {
    return null;
  }
}

function writeMarker(payload) {
  writeFileSync(MARKER_PATH, JSON.stringify(payload, null, 2), "utf8");
}

function clearMarker() {
  try {
    unlinkSync(MARKER_PATH);
  } catch {
    // ignore
  }
}

async function portFree(port) {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => {
      srv.close(() => resolve(true));
    });
    srv.listen(port, "127.0.0.1");
  });
}

async function waitForHttp(baseUrl, timeoutMs = 120_000) {
  const start = Date.now();
  let lastErr = "";
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/login`, {
        signal: AbortSignal.timeout(3000),
        redirect: "manual",
      });
      if (res.status > 0) return;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    await sleep(800);
  }
  throw new Error(`Dev test server did not become ready at ${baseUrl}: ${lastErr}`);
}

async function probeBase(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/login`, {
      signal: AbortSignal.timeout(2500),
      redirect: "manual",
    });
    return res.status > 0;
  } catch {
    return false;
  }
}

/**
 * Ensure an HTTP base URL whose Next process uses the development TEST DB.
 *
 * @returns {Promise<{ baseUrl: string, host: string, managed: boolean }>}
 */
export async function ensureDevTestHttpBase() {
  loadLocalEnv();
  const { url, host } = assertSafeTestDatabaseUrl({ allowEnvLoad: false });
  if (isProductionDatabaseHost(host)) {
    throw new Error("REFUSED: database writes are not allowed against Production.");
  }

  if (managed?.baseUrl) {
    return { baseUrl: managed.baseUrl, host: managed.host, managed: true };
  }

  const port = Number(process.env.MCS_CC_TEST_PORT || DEFAULT_PORT);
  const baseUrl = `http://127.0.0.1:${port}`;

  // Trust explicit matrix env when host matches development.
  const trustedBase = process.env.CC_TEST_BASE?.trim();
  const trustedHost = process.env.MCS_CC_TEST_SERVER_HOST?.trim();
  if (trustedBase && trustedHost === host && (await probeBase(trustedBase))) {
    console.log(`HTTP_TEST_BASE=${trustedBase} (trusted env) DB_HOST=${host}`);
    return { baseUrl: trustedBase, host, managed: false };
  }

  // Reuse prior managed server from another test process (marker + live port).
  const marker = readMarker();
  if (
    marker?.host === host &&
    marker?.baseUrl &&
    (await probeBase(marker.baseUrl))
  ) {
    process.env.CC_TEST_BASE = marker.baseUrl;
    process.env.MCS_CC_TEST_SERVER_HOST = host;
    console.log(`HTTP_TEST_BASE=${marker.baseUrl} (reuse marker) DB_HOST=${host}`);
    return { baseUrl: marker.baseUrl, host, managed: false };
  }

  const free = await portFree(port);
  if (!free) {
    throw new Error(
      `REFUSED: port ${port} is in use without a matching development test-server marker. ` +
        `Stop that process or set MCS_CC_TEST_PORT to a free port.`
    );
  }

  const nextBin = join(
    process.cwd(),
    "node_modules",
    "next",
    "dist",
    "bin",
    "next"
  );

  const child = spawn(
    process.execPath,
    [nextBin, "dev", "-p", String(port), "-H", "127.0.0.1"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: url,
        MCS_CC_TEST_SERVER_HOST: host,
        PORT: String(port),
      },
      // ignore stdio so Windows parent test processes can exit (piped
      // stdout/stderr keep the parent alive even after child.unref()).
      stdio: "ignore",
      windowsHide: true,
      detached: process.platform !== "win32",
    }
  );

  child.unref();

  try {
    await waitForHttp(baseUrl);
  } catch (error) {
    try {
      process.kill(child.pid, "SIGTERM");
    } catch {
      // ignore
    }
    clearMarker();
    throw new Error(
      `${error instanceof Error ? error.message : error}\n(boot log unavailable with stdio ignore)`
    );
  }

  writeMarker({
    pid: child.pid,
    port,
    baseUrl,
    host,
    startedAt: new Date().toISOString(),
  });

  managed = { child, baseUrl, host };
  process.env.MCS_CC_TEST_SERVER_HOST = host;
  process.env.CC_TEST_BASE = baseUrl;

  console.log(`HTTP_TEST_BASE=${baseUrl} DB_HOST=${host} (managed next dev)`);
  return { baseUrl, host, managed: true };
}

export async function stopDevTestHttpBase() {
  const marker = readMarker();
  if (marker?.pid) {
    try {
      process.kill(marker.pid, "SIGTERM");
    } catch {
      // ignore
    }
    await sleep(400);
    try {
      process.kill(marker.pid, "SIGKILL");
    } catch {
      // ignore
    }
  }
  if (managed?.child?.pid) {
    try {
      process.kill(managed.child.pid, "SIGTERM");
    } catch {
      // ignore
    }
  }
  managed = null;
  clearMarker();
}

/** For suites: get BASE, ensuring managed server is up. */
export async function resolveHttpTestBase() {
  const { baseUrl } = await ensureDevTestHttpBase();
  return baseUrl;
}
