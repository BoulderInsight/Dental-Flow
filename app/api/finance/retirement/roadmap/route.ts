import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { generateRoadmapSuggestions } from "@/lib/finance/retirement-roadmap";

export async function GET() {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roadmap = await generateRoadmapSuggestions(session.practiceId);
    if (!roadmap) {
      return NextResponse.json(
        { error: "No retirement profile found. Set up your profile first." },
        { status: 404 }
      );
    }

    return NextResponse.json(roadmap);
  } catch (error) {
    console.error("Retirement roadmap error:", error);
    return NextResponse.json(
      { error: "Failed to generate retirement roadmap" },
      { status: 500 }
    );
  }
}
