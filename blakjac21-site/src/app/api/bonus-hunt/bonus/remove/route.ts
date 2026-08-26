import {
  clearBonuses,
  removeBonus,
} from "@/lib/bonus-hunt";
import { authorizeStreamerAdmin } from "@/lib/site-auth";

export async function POST(request: Request) {
  if (!(await authorizeStreamerAdmin(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string; all?: boolean };
  try {
    body = (await request.json()) as { id?: string; all?: boolean };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.all) {
    return Response.json(clearBonuses());
  }

  if (!body.id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  return Response.json(removeBonus(body.id));
}
