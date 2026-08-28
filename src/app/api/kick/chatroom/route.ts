import { NextResponse } from "next/server";
import { fetchChatroomMeta } from "@/lib/kick-chat";

export async function GET() {
  try {
    const meta = await fetchChatroomMeta();
    return NextResponse.json(meta, {
      headers: {
        // Chatroom id is stable; shorter cache keeps reconnects fresh after deploys.
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load chatroom" },
      { status: 502 },
    );
  }
}
