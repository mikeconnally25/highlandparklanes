import {
  ensureStakeSlotCatalog,
  getStakeSlotCatalog,
  getStakeSlotCatalogSummary,
  refreshStakeSlotCatalog,
  resolveAllowedStakeSlot,
} from "@/lib/stake-slots";
import { authorizeStreamerAdmin } from "@/lib/site-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const refresh = url.searchParams.get("refresh") === "1";

  if (refresh) {
    if (!(await authorizeStreamerAdmin(request))) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    await refreshStakeSlotCatalog(true);
  } else {
    // Auto full crawl every 10s when stale; otherwise just warm metadata
    ensureStakeSlotCatalog();
  }

  const summary = getStakeSlotCatalogSummary();
  const includeNames = url.searchParams.get("names") === "1";

  if (!includeNames) {
    return Response.json(summary);
  }

  const catalog = getStakeSlotCatalog();

  return Response.json({
    ...summary,
    slots: catalog.slots.map((slot) => ({
      name: slot.name,
      slug: slot.slug,
      sources: slot.sources,
    })),
  });
}

/** Manual check: POST { slotName } → whether !s would accept it */
export async function POST(request: Request) {
  let body: { slotName?: string };
  try {
    body = (await request.json()) as { slotName?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const slotName = body.slotName?.trim();
  if (!slotName) {
    return Response.json({ error: "slotName is required" }, { status: 400 });
  }

  const result = await resolveAllowedStakeSlot(slotName);
  if (!result.ok) {
    return Response.json({ allowed: false, reason: result.reason });
  }

  return Response.json({
    allowed: true,
    slot: {
      name: result.slot.name,
      slug: result.slot.slug,
      sources: result.slot.sources,
    },
  });
}
