import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";
import { getSessionUser } from "@/lib/auth";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "staff") redirect("/staff");

  return (
    <div className="lane-bg min-h-screen">
      <header className="flex items-center justify-between border-b border-wood/40 px-6 py-4 md:px-10">
        <Link
          href="/app"
          className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-amber-soft"
        >
          Highland Park Lanes
        </Link>
        <div className="flex items-center gap-5">
          <Link
            href="/app/history"
            className="text-sm text-muted hover:text-cream transition-colors"
          >
            History
          </Link>
          <span className="hidden sm:inline text-sm text-muted">{user.name}</span>
          <LogoutButton />
        </div>
      </header>
      <div className="px-6 py-10 md:px-10">{children}</div>
    </div>
  );
}
