import { NextResponse } from "next/server";
import { AuthError, signup } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const user = await signup({
      email: String(body.email || ""),
      password: String(body.password || ""),
      name: String(body.name || ""),
    });
    return NextResponse.json({ user });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }
}
