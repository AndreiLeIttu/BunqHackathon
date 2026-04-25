import { NextRequest, NextResponse } from "next/server";
import { sendAllRequests } from "@/lib/bunq";
import { SendRequestsPayload, SendRequestsResponse } from "@/types";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SendRequestsPayload;

    if (!body.splits || !Array.isArray(body.splits) || body.splits.length === 0) {
      return NextResponse.json({ error: "No splits provided" }, { status: 400 });
    }

    const results = await sendAllRequests(
      body.splits,
      body.currency || "EUR",
      body.restaurant_name || "Dinner",
      body.people
    );

    const response: SendRequestsResponse = {
      results,
      success_count: results.filter(
        (r) => r.status === "sent" || r.status === "mock"
      ).length,
      fail_count: results.filter((r) => r.status === "failed").length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Send requests error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send requests" },
      { status: 500 }
    );
  }
}
