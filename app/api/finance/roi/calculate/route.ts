import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import {
  calculateRealEstateROI,
  calculatePracticeAcquisitionROI,
  calculateEquipmentROI,
} from "@/lib/finance/roi-calculator";

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { dealType, inputs } = body;

    if (!dealType || !inputs) {
      return NextResponse.json(
        { error: "dealType and inputs required" },
        { status: 400 }
      );
    }

    let result;

    switch (dealType) {
      case "real_estate":
        result = calculateRealEstateROI(inputs);
        break;
      case "practice_acquisition":
        result = calculatePracticeAcquisitionROI(inputs);
        break;
      case "equipment":
        result = calculateEquipmentROI(inputs);
        break;
      default:
        return NextResponse.json(
          { error: `Unknown deal type: ${dealType}` },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("ROI calculation error:", error);
    return NextResponse.json(
      { error: "Failed to calculate ROI" },
      { status: 500 }
    );
  }
}
