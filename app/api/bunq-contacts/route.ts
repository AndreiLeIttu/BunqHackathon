import { NextResponse } from "next/server";
import { getBunqContacts } from "@/lib/bunq";

export async function GET() {
  try {
    const contacts = await getBunqContacts();
    return NextResponse.json({ contacts });
  } catch (error) {
    console.error("Contacts fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}
