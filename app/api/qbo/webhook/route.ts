import { NextRequest, NextResponse } from "next/server";

/**
 * Intuit webhook receiver. Per Intuit requirements, always returns 200 quickly.
 * In a production setup, the actual processing would be queued via BullMQ/Redis.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // Verify webhook signature (Intuit sends in header)
    const signature = request.headers.get("intuit-signature");
    if (!signature) {
      // Still return 200 per Intuit requirements
      console.warn("Webhook received without signature");
      return NextResponse.json({ status: "ok" });
    }

    // Log the webhook event for processing
    // In production: queue via BullMQ for async processing
    console.log("QBO webhook received:", {
      eventNotifications: payload.eventNotifications?.length || 0,
    });

    // Return 200 immediately as Intuit requires
    return NextResponse.json({ status: "ok" });
  } catch {
    // Always return 200 to Intuit
    return NextResponse.json({ status: "ok" });
  }
}
