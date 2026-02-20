import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { requireRole, PermissionError } from "@/lib/auth/permissions";
import { previewWriteBack } from "@/lib/qbo/write-back";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionOrDemo();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      requireRole(session, "write");
    } catch (e) {
      if (e instanceof PermissionError) {
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 }
        );
      }
      throw e;
    }

    const { searchParams } = new URL(request.url);

    const sinceDate = searchParams.get("sinceDate")
      ? new Date(searchParams.get("sinceDate")!)
      : undefined;

    const onlyHighConfidence =
      searchParams.get("onlyHighConfidence") !== "false"; // default true

    const categoriesParam = searchParams.get("categories");
    const categories = categoriesParam
      ? categoriesParam.split(",").filter(Boolean)
      : undefined;

    const preview = await previewWriteBack(session.practiceId, {
      sinceDate,
      onlyHighConfidence,
      categories,
    });

    return NextResponse.json(preview);
  } catch (error) {
    console.error("Write-back preview error:", error);
    return NextResponse.json(
      { error: "Failed to generate write-back preview" },
      { status: 500 }
    );
  }
}
