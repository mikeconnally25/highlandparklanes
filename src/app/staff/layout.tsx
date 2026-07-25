import { LogoutButton } from "@/components/LogoutButton";
import { getSessionUser } from "@/lib/auth";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  return (
    <div className="min-h-screen bg-[#121212] text-[#f0f0f0]">
      {user?.role === "staff" ? (
        <header className="flex items-center justify-between border-b border-[#2a2a2a] px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#888]">
              Highland Park Lanes
            </p>
            <h1 className="text-lg font-semibold">Staff dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#aaa]">{user.name}</span>
            <LogoutButton redirectTo="/staff/login" />
          </div>
        </header>
      ) : null}
      {children}
    </div>
  );
}
