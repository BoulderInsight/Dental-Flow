import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";

interface AuditEvent {
  practiceId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export async function logAuditEvent(event: AuditEvent) {
  try {
    await db.insert(auditLog).values({
      practiceId: event.practiceId,
      userId: event.userId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId ?? null,
      oldValue: event.oldValue ?? null,
      newValue: event.newValue ?? null,
    });
  } catch (error) {
    // Audit logging should never break the main flow
    console.error("Audit log error:", error);
  }
}
