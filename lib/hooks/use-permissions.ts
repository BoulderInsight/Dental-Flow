"use client";

import { useSession } from "next-auth/react";

export function usePermissions() {
  const session = useSession();
  const role = session?.data?.user?.role || "accountant";
  return {
    canWrite: role !== "accountant",
    canAdmin: role === "owner",
    role,
  };
}
