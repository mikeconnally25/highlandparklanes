import { NextResponse } from "next/server";

const KICK_CLIENT_TOKEN =
  process.env.KICK_CLIENT_TOKEN?.trim() ||
  "e1393935a959b4020a4491574f6490129f678acdaa92760471263db43487f823";

/** Short-lived token for Kick's self-hosted Pusher-compatible chat gateway. */
export async function GET() {
  try {
    const res = await fetch("https://websockets.kick.com/viewer/v1/token", {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (compatible; Blakjac21Site/1.0; +https://kick.com/Blakjac21)",
        Referer: "https://kick.com/",
        Origin: "https://kick.com",
        "X-CLIENT-TOKEN": KICK_CLIENT_TOKEN,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Kick websocket token failed (${res.status})` },
        { status: 502 },
      );
    }

    const body = (await res.json()) as {
      data?: { token?: string };
      message?: string;
    };
    const token = body.data?.token?.trim();
    if (!token) {
      return NextResponse.json(
        { error: body.message ?? "Kick websocket token missing" },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        token,
        url: `wss://websockets.kick.com/viewer/v1/connect?token=${encodeURIComponent(token)}`,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to fetch Kick websocket token",
      },
      { status: 502 },
    );
  }
}
