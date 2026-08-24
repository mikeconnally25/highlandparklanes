import {
  clearSlotRequests,
  removeSlotRequest,
  setHuntActive,
  setHuntTitle,
  verifyBonusHuntAdminToken,
} from "@/lib/bonus-hunt";

export async function POST(request: Request) {
  if (!verifyBonusHuntAdminToken(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    action?: "clear-requests" | "remove-request" | "set-active" | "set-title";
    id?: string;
    active?: boolean;
    title?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  switch (body.action) {
    case "clear-requests":
      return Response.json(clearSlotRequests());
    case "remove-request":
      if (!body.id) {
        return Response.json({ error: "id is required" }, { status: 400 });
      }
      return Response.json(removeSlotRequest(body.id));
    case "set-active":
      if (typeof body.active !== "boolean") {
        return Response.json({ error: "active must be a boolean" }, { status: 400 });
      }
      return Response.json(setHuntActive(body.active));
    case "set-title":
      return Response.json(setHuntTitle(body.title ?? ""));
    default:
      return Response.json({ error: "Unknown action" }, { status: 400 });
  }
}
