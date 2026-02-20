import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { calculateForecast } from "@/lib/finance/forecast";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get("months") || "6", 10);

    const forecast = await calculateForecast(
      session.practiceId,
      Math.min(months, 12)
    );

    return NextResponse.json(forecast);
  } catch (error) {
    console.error("Forecast error:", error);
    return NextResponse.json(
      { error: "Failed to generate forecast" },
      { status: 500 }
    );
  }
}
