import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { getPartners, ensureDefaultPartners } from "@/lib/referrals/partners";

export async function GET() {
  const session = await getSessionOrDemo();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ensure default partners exist
  await ensureDefaultPartners();

  const partners = await getPartners();
  return NextResponse.json({ partners });
}
