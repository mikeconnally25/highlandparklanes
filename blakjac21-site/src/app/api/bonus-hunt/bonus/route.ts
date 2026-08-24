import { addBonus, verifyBonusHuntAdminToken } from "@/lib/bonus-hunt";
import type { BonusTier } from "@/lib/bonus-hunt";

export async function POST(request: Request) {
  if (!verifyBonusHuntAdminToken(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: string; betSize?: string | number | null; tier?: BonusTier };
  try {
    body = (await request.json()) as {
      name?: string;
      betSize?: string | number | null;
      tier?: BonusTier;
    };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = addBonus({
    name: body.name ?? "",
    betSize: body.betSize,
    tier: body.tier,
  });
  if (!result.accepted) {
    return Response.json(
      { error: result.reason ?? "Could not add bonus", state: result.state },
      { status: 400 },
    );
  }

  return Response.json(result.state);
}
