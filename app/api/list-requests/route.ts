import { NextResponse } from "next/server";
import { listRequestInquiries } from "@/lib/bunq";

export async function GET() {
  try {
    const requests = await listRequestInquiries();
    return NextResponse.json({ requests });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch requests" },
      { status: 500 }
    );
  }
}
