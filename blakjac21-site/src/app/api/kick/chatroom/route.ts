import { NextResponse } from "next/server";
import { fetchChatroomMeta } from "@/lib/kick-chat";

export async function GET() {
  try {
    const meta = await fetchChatroomMeta();
    return NextResponse.json(meta, {
      headers: { "Cache-Control": "public, s-maxage=300" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load chatroom" },
      { status: 502 },
    );
  }
}
