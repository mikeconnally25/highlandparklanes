import {
  loginAccount,
  registerAccount,
  SiteAuthError,
} from "@/lib/site-auth";

export async function POST(request: Request) {
  let body: {
    mode?: "register" | "login";
    username?: string;
    email?: string;
    password?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const mode = body.mode === "login" ? "login" : "register";

  try {
    if (mode === "login") {
      const user = await loginAccount({
        email: body.email ?? "",
        password: body.password ?? "",
      });
      return Response.json({ user });
    }

    const user = await registerAccount({
      username: body.username ?? "",
      email: body.email ?? "",
      password: body.password ?? "",
    });
    return Response.json({ user }, { status: 201 });
  } catch (err) {
    if (err instanceof SiteAuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Account request failed" }, { status: 500 });
  }
}
