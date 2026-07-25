import Link from "next/link";
import { getSessionUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getSessionUser();
  const primaryHref =
    user?.role === "staff" ? "/staff" : user ? "/app" : "/signup";
  const primaryLabel = user
    ? user.role === "staff"
      ? "Staff dashboard"
      : "My coupon"
    : "Join Highland Park Lanes";

  return (
    <main className="lane-bg min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <span className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-amber-soft">
          Highland Park Lanes
        </span>
        <nav className="flex items-center gap-5 text-sm text-muted">
          {user ? (
            <Link href={primaryHref} className="hover:text-cream transition-colors">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="hover:text-cream transition-colors">
                Sign in
              </Link>
              <Link
                href="/staff/login"
                className="hover:text-cream transition-colors"
              >
                Staff
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="relative flex-1 flex flex-col justify-end md:justify-center px-6 pb-16 pt-10 md:px-10 md:pb-24 min-h-[78vh]">
        <div
          className="hero-glow pointer-events-none absolute inset-x-0 top-8 mx-auto h-64 w-[min(90%,42rem)] rounded-full bg-amber/25 blur-3xl"
          aria-hidden
        />
        <div className="relative max-w-3xl">
          <h1 className="brand-rise font-[family-name:var(--font-display)] text-[clamp(3rem,11vw,7rem)] leading-[0.9] tracking-wide text-cream">
            Highland Park Lanes
          </h1>
          <p className="cta-rise mt-5 max-w-md text-lg text-muted md:text-xl">
            Members get 3 free games of bowling every week. Sign up once — your
            coupon refreshes Mondays.
          </p>
          <div className="cta-rise mt-8 flex flex-wrap gap-3">
            <Link
              href={primaryHref}
              className="inline-flex items-center justify-center bg-amber px-7 py-3.5 text-base font-semibold text-lane-deep hover:bg-amber-soft transition-colors"
            >
              {primaryLabel}
            </Link>
            {!user && (
              <Link
                href="/login"
                className="inline-flex items-center justify-center border border-wood-light/50 px-7 py-3.5 text-base text-cream hover:border-amber/60 transition-colors"
              >
                I already have an account
              </Link>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
