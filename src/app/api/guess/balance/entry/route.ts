import { addGuess, parseBalanceGuess } from "@/lib/guess-balance";

export async function POST(request: Request) {
  let body: { username?: string; message?: string; amount?: number };
  try {
    body = (await request.json()) as {
      username?: string;
      message?: string;
      amount?: number;
    };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const username = body.username?.trim();
  const message = body.message?.trim() ?? "";

  if (!username) {
    return Response.json({ error: "username is required" }, { status: 400 });
  }

  const amount =
    typeof body.amount === "number"
      ? body.amount
      : parseBalanceGuess(message);

  if (amount == null) {
    return Response.json({ error: "Could not parse balance guess" }, { status: 400 });
  }

  const result = addGuess({
    username,
    amount,
    rawMessage: message || String(amount),
  });

  if (!result.accepted) {
    return Response.json(
      { error: result.reason ?? "Guess rejected", state: result.state },
      { status: 409 },
    );
  }

  return Response.json(result.state);
}
