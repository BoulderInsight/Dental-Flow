type Action = "read" | "write" | "admin";

const ROLE_PERMISSIONS: Record<string, Action[]> = {
  owner: ["read", "write", "admin"],
  manager: ["read", "write"],
  accountant: ["read"],
};

export function canPerform(role: string, action: Action): boolean {
  return (ROLE_PERMISSIONS[role] || []).includes(action);
}

export function requireRole(session: { role: string }, action: Action): void {
  if (!canPerform(session.role, action)) {
    throw new PermissionError(session.role, action);
  }
}

export class PermissionError extends Error {
  constructor(
    public role: string,
    public action: string,
  ) {
    super(`Insufficient permissions: ${role} cannot ${action}`);
    this.name = "PermissionError";
  }
}
