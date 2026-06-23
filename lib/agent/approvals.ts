/**
 * In-memory human-approval registry (human-in-the-loop bonus).
 *
 * The agent pauses before persisting the final summary and emits an
 * `approval_required` event. The UI resolves it via POST /api/agent/approve,
 * which calls `resolveApproval`. If no decision arrives within the timeout the
 * approval auto-approves so unattended demos never hang.
 */

interface PendingApproval {
  resolve: (decision: "approved" | "rejected") => void;
  timer: ReturnType<typeof setTimeout>;
}

declare global {
  // eslint-disable-next-line no-var
  var __pendingApprovals: Map<string, PendingApproval> | undefined;
}

const registry: Map<string, PendingApproval> =
  globalThis.__pendingApprovals ?? (globalThis.__pendingApprovals = new Map());

export function waitForApproval(
  approvalId: string,
  timeoutMs = 120_000,
): Promise<"approved" | "rejected" | "timeout"> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      registry.delete(approvalId);
      resolve("timeout");
    }, timeoutMs);

    registry.set(approvalId, {
      resolve: (decision) => {
        clearTimeout(timer);
        registry.delete(approvalId);
        resolve(decision);
      },
      timer,
    });
  });
}

export function resolveApproval(
  approvalId: string,
  decision: "approved" | "rejected",
): boolean {
  const pending = registry.get(approvalId);
  if (!pending) return false;
  pending.resolve(decision);
  return true;
}
