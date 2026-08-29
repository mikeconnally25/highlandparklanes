"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminSiteUser } from "@/lib/site-auth";
import { useSiteSession } from "@/hooks/useSiteSession";
import styles from "./AllAccountsCard.module.css";

function formatWhen(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "—";
  return new Date(parsed).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function initials(username: string): string {
  const parts = username.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function AllAccountsCard({
  defaultOpen = true,
  embedded = false,
}: {
  defaultOpen?: boolean;
  embedded?: boolean;
}) {
  const { isAdmin, ready } = useSiteSession();
  const [open, setOpen] = useState(defaultOpen);
  const [users, setUsers] = useState<AdminSiteUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/account/users", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = (await res.json()) as {
        users?: AdminSiteUser[];
        error?: string;
      };
      if (!res.ok) {
        setError(
          data.error === "Unauthorized"
            ? "Sign in with the admin Kick account to view linked accounts"
            : (data.error ?? "Could not load accounts"),
        );
        setUsers([]);
        return;
      }
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch {
      setError("Could not reach server");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready || !isAdmin || !open) return;
    void loadUsers();
  }, [ready, isAdmin, open, loadUsers]);

  if (!ready || !isAdmin) return null;

  return (
    <section
      className={embedded ? styles.wrapEmbedded : styles.wrap}
      aria-label="Linked Kick accounts"
    >
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Linked Kick accounts
        <span className={styles.chevron} data-open={open || undefined} />
      </button>

      {open ? (
        <div className={styles.panel}>
          <p className={styles.summary}>
            {loading
              ? "Loading accounts…"
              : `${users.length.toLocaleString()} Kick account${users.length === 1 ? "" : "s"} linked on this site`}
          </p>

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          {!loading && !error && users.length === 0 ? (
            <p className={styles.empty}>No Kick accounts have signed in yet.</p>
          ) : null}

          {!error && users.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Account</th>
                    <th scope="col">Created</th>
                    <th scope="col">Last login</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className={styles.userCell}>
                          {user.profilePicture ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              className={styles.avatar}
                              src={user.profilePicture}
                              alt=""
                              width={28}
                              height={28}
                            />
                          ) : (
                            <span className={styles.avatarFallback}>
                              {initials(user.username)}
                            </span>
                          )}
                          <span>
                            <span className={styles.username}>
                              @{user.username}
                              {user.isAdmin ? (
                                <span className={styles.adminBadge}>Admin</span>
                              ) : null}
                            </span>
                            <span className={styles.kickId}>
                              Kick ID {user.kickUserId}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className={styles.mono}>{formatWhen(user.createdAt)}</td>
                      <td className={styles.mono}>
                        {formatWhen(user.lastLoginAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
