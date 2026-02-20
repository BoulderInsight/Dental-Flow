import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { getOnboardingChecklist } from "@/lib/onboarding/checklist";

export async function GET() {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const checklist = await getOnboardingChecklist(session.practiceId);
    return NextResponse.json({ steps: checklist });
  } catch (error) {
    console.error("Onboarding checklist error:", error);
    return NextResponse.json(
      { error: "Failed to load checklist" },
      { status: 500 }
    );
  }
}
