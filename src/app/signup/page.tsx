"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Signup failed");
      return;
    }

    router.push("/app");
    router.refresh();
  }

  return (
    <main className="lane-bg min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-3xl tracking-wide text-amber-soft"
        >
          Highland Park Lanes
        </Link>
        <h1 className="mt-8 text-2xl font-semibold text-cream">Create your account</h1>
        <p className="mt-2 text-muted">
          Get a weekly coupon for 3 free games.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-sm text-muted">Name</span>
            <input
              name="name"
              required
              className="mt-1 w-full border border-wood-light/40 bg-lane-mid/80 px-3 py-2.5 text-cream outline-none focus:border-amber"
            />
          </label>
          <label className="block">
            <span className="text-sm text-muted">Email</span>
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full border border-wood-light/40 bg-lane-mid/80 px-3 py-2.5 text-cream outline-none focus:border-amber"
            />
          </label>
          <label className="block">
            <span className="text-sm text-muted">Password</span>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              className="mt-1 w-full border border-wood-light/40 bg-lane-mid/80 px-3 py-2.5 text-cream outline-none focus:border-amber"
            />
          </label>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber py-3 font-semibold text-lane-deep hover:bg-amber-soft disabled:opacity-60 transition-colors"
          >
            {loading ? "Creating…" : "Join Highland Park Lanes"}
          </button>
        </form>

        <p className="mt-6 text-sm text-muted">
          Already a member?{" "}
          <Link href="/login" className="text-amber-soft hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
