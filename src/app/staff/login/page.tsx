"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function StaffLoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Login failed");
      return;
    }

    if (data.user?.role !== "staff") {
      setError("This login is for staff only. Members use the member sign-in.");
      await fetch("/api/auth/logout", { method: "POST" });
      return;
    }

    router.push("/staff");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#121212] text-[#f0f0f0] flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <p className="text-xs uppercase tracking-[0.25em] text-[#888]">
          Highland Park Lanes · Staff
        </p>
        <h1 className="mt-3 text-2xl font-semibold">Staff sign in</h1>
        <p className="mt-2 text-sm text-[#aaa]">
          Validate and redeem member coupons at the desk.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-sm text-[#aaa]">Email</span>
            <input
              name="email"
              type="email"
              required
              defaultValue="staff@strikeclub.local"
              className="mt-1 w-full border border-[#333] bg-[#1a1a1a] px-3 py-2.5 outline-none focus:border-[#e8a317]"
            />
          </label>
          <label className="block">
            <span className="text-sm text-[#aaa]">Password</span>
            <input
              name="password"
              type="password"
              required
              className="mt-1 w-full border border-[#333] bg-[#1a1a1a] px-3 py-2.5 outline-none focus:border-[#e8a317]"
            />
          </label>

          {error && <p className="text-sm text-[#c45c3a]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#e8a317] py-3 font-semibold text-[#1a1008] hover:bg-[#f0c14b] disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Enter dashboard"}
          </button>
        </form>

        <p className="mt-6 text-sm text-[#888]">
          <Link href="/" className="hover:text-[#f0f0f0]">
            ← Back to Highland Park Lanes
          </Link>
        </p>
      </div>
    </main>
  );
}
