import {
  authorizeStreamerAdmin,
  flushSiteUsersPersist,
  listSiteUsers,
} from "@/lib/site-auth";

export async function GET(request: Request) {
  if (!(await authorizeStreamerAdmin(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await listSiteUsers();
  await flushSiteUsersPersist();

  return Response.json(
    {
      users,
      total: users.length,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
