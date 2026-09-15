import { getSql } from "./client.js";
import {
  isValidWorkerStatus,
  isWorkerAssignable,
} from "../domain/worker-status.js";

function requireSql() {
  const sql = getSql();
  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return sql;
}

export async function getWorkerById(id) {
  const sql = requireSql();
  const rows = await sql`
    SELECT id, display_name, status, created_at, updated_at
    FROM workers
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
}

/**
 * @param {{ status?: "active" | "inactive" | "all", limit?: number }} [opts]
 */
export async function listWorkers({ status = "all", limit = 100 } = {}) {
  const sql = requireSql();
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

  if (status === "active" || status === "inactive") {
    return sql`
      SELECT id, display_name, status, created_at, updated_at
      FROM workers
      WHERE status = ${status}
      ORDER BY display_name ASC
      LIMIT ${safeLimit}
    `;
  }

  return sql`
    SELECT id, display_name, status, created_at, updated_at
    FROM workers
    ORDER BY
      CASE WHEN status = 'active' THEN 0 ELSE 1 END,
      display_name ASC
    LIMIT ${safeLimit}
  `;
}

/**
 * Create a Worker record (not an auth account).
 * @returns {{ ok: true, worker: object } | { ok: false, error: string }}
 */
export async function createWorker({ displayName, createdBy = "owner" }) {
  const sql = requireSql();
  void createdBy;

  const name = typeof displayName === "string" ? displayName.trim() : "";
  if (!name) {
    return { ok: false, error: "invalid_input" };
  }

  const rows = await sql`
    INSERT INTO workers (display_name, status)
    VALUES (${name}, 'active')
    RETURNING id, display_name, status, created_at, updated_at
  `;

  const worker = rows[0];
  if (!worker?.id) {
    return { ok: false, error: "create_failed" };
  }

  return { ok: true, worker };
}

/**
 * Set Worker active/inactive. Does not hard-delete. Does not clear Job assignments.
 * @returns {{ ok: true, worker: object } | { ok: false, error: string }}
 */
export async function updateWorkerStatus({ workerId, nextStatus }) {
  const sql = requireSql();

  if (typeof workerId !== "string" || workerId.trim().length < 1) {
    return { ok: false, error: "invalid_input" };
  }
  if (!isValidWorkerStatus(nextStatus)) {
    return { ok: false, error: "invalid_status" };
  }

  const existing = await getWorkerById(workerId);
  if (!existing) return { ok: false, error: "not_found" };

  if (existing.status === nextStatus) {
    return { ok: true, worker: existing };
  }

  const rows = await sql`
    UPDATE workers
    SET status = ${nextStatus}, updated_at = now()
    WHERE id = ${workerId}
    RETURNING id, display_name, status, created_at, updated_at
  `;

  const worker = rows[0];
  if (!worker) return { ok: false, error: "update_failed" };

  return { ok: true, worker };
}

export function assertWorkerAssignable(worker) {
  if (!worker) return { ok: false, error: "worker_not_found" };
  if (!isWorkerAssignable(worker.status)) {
    return { ok: false, error: "worker_inactive" };
  }
  return { ok: true };
}
