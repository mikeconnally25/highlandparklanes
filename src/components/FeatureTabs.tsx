"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { KICK_CHANNEL_URL } from "@/lib/kick";
import type { AdminSiteUser } from "@/lib/site-auth";
import { useSiteSession } from "@/hooks/useSiteSession";
import styles from "./FeatureTabs.module.css";

type PanelTabId = "social" | "accounts";

type SocialLink = {
  label: string;
  href: string;
  handle?: string;
};

type TabConfig =
  | {
      id: string;
      label: string;
      description: string;
      kind: "link";
      href: string;
      accent: "cyan" | "gold" | "live";
    }
  | {
      id: string;
      label: string;
      description: string;
      kind: "external";
      href: string;
      accent: "cyan" | "gold" | "live";
    }
  | {
      id: PanelTabId;
      label: string;
      description: string;
      kind: "panel";
      accent: "cyan" | "gold" | "live";
      adminOnly?: boolean;
    };

const STAKE_URL = "https://stake.com/?offer=blakjac21&c=c52feb0e28";

const TABS: TabConfig[] = [
  {
    id: "guessBalance",
    label: "Guess the Balance",
    description: "Call the balance live and climb the board.",
    kind: "link",
    href: "/guess-the-balance",
    accent: "gold",
  },
  {
    id: "giveaways",
    label: "Giveaways",
    description: "Enter with a chat keyword and spin the winner wheel.",
    kind: "link",
    href: "/giveaways",
    accent: "live",
  },
  {
    id: "leaderboard",
    label: "Leaderboard",
    description: "See who is wagering the most this month.",
    kind: "link",
    href: "/leaderboard",
    accent: "cyan",
  },
  {
    id: "rewards",
    label: "Rewards",
    description: "Streamer perks, codes, and community drops.",
    kind: "link",
    href: "/rewards",
    accent: "gold",
  },
  {
    id: "stake",
    label: "Stake",
    description: "Play with code blakjac21 and support the stream.",
    kind: "external",
    href: STAKE_URL,
    accent: "gold",
  },
  {
    id: "social",
    label: "Social Media",
    description: "Kick, X, and Discord — follow for stream updates.",
    kind: "panel",
    accent: "cyan",
  },
  {
    id: "accounts",
    label: "Kick Accounts",
    description: "Admin: Kick-verified accounts signed in on this site.",
    kind: "panel",
    accent: "gold",
    adminOnly: true,
  },
];

const PANEL_COPY: Record<
  Exclude<PanelTabId, "accounts">,
  { title: string; body: string; links?: SocialLink[] }
> = {
  social: {
    title: "Social Media",
    body: "Follow Blakjac21 across platforms for stream updates, highlights, and community posts.",
    links: [
      {
        label: "Kick",
        href: KICK_CHANNEL_URL,
        handle: "kick.com/Blakjac21",
      },
      {
        label: "X / Twitter",
        href: "https://x.com/21Blakjac",
        handle: "@21Blakjac",
      },
      {
        label: "Discord",
        href: "https://discord.gg/2VWu6RA7MF",
        handle: "discord.gg/2VWu6RA7MF",
      },
    ],
  },
};

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

function KickAccountsPanel() {
  const [users, setUsers] = useState<AdminSiteUser[]>([]);
  const [loading, setLoading] = useState(true);
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
    void loadUsers();
  }, [loadUsers]);

  return (
    <div className={styles.accountsPanel}>
      <p className={styles.panelTitle}>Kick-verified accounts</p>
      <p className={styles.panelBody}>
        Accounts that signed in and linked through Kick OAuth on this site.
        Admin only.
      </p>

      {loading ? (
        <p className={styles.accountsStatus}>Loading accounts…</p>
      ) : null}

      {error ? (
        <p className={styles.accountsError} role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error ? (
        <p className={styles.accountsStatus}>
          {users.length.toLocaleString()} Kick-verified account
          {users.length === 1 ? "" : "s"}
        </p>
      ) : null}

      {!loading && !error && users.length === 0 ? (
        <p className={styles.accountsEmpty}>
          No Kick accounts have signed in yet.
        </p>
      ) : null}

      {!error && users.length > 0 ? (
        <ul className={styles.accountsList}>
          {users.map((user) => (
            <li key={user.id} className={styles.accountRow}>
              {user.profilePicture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={styles.accountAvatar}
                  src={user.profilePicture}
                  alt=""
                  width={36}
                  height={36}
                />
              ) : (
                <span className={styles.accountAvatarFallback}>
                  {initials(user.username)}
                </span>
              )}
              <span className={styles.accountMeta}>
                <span className={styles.accountName}>
                  @{user.username}
                  {user.isAdmin ? (
                    <span className={styles.accountAdminBadge}>Admin</span>
                  ) : null}
                  <span className={styles.accountVerified}>Kick verified</span>
                </span>
                <span className={styles.accountDetails}>
                  Kick ID {user.kickUserId} · Joined {formatWhen(user.createdAt)}{" "}
                  · Last login {formatWhen(user.lastLoginAt)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function FeatureTabs() {
  const { isAdmin, ready } = useSiteSession();
  const [openTab, setOpenTab] = useState<PanelTabId | null>(null);

  const visibleTabs = useMemo(
    () =>
      TABS.filter((tab) => {
        if (tab.kind !== "panel" || !tab.adminOnly) return true;
        return ready && isAdmin;
      }),
    [ready, isAdmin],
  );

  useEffect(() => {
    if (openTab === "accounts" && !(ready && isAdmin)) {
      setOpenTab(null);
    }
  }, [openTab, ready, isAdmin]);

  function toggleTab(id: PanelTabId) {
    setOpenTab((current) => (current === id ? null : id));
  }

  return (
    <section
      id="features"
      className={styles.wrap}
      aria-label="Site feature menu"
    >
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Menu</p>
        <p className={styles.lead}>
          Pick a card to jump into giveaways, guesses, and more.
        </p>
      </div>

      <nav aria-label="Site features">
        <ul className={styles.grid}>
          {visibleTabs.map((tab) => {
            if (tab.kind === "link") {
              return (
                <li key={tab.id}>
                  <Link
                    className={styles.card}
                    href={tab.href}
                    data-accent={tab.accent}
                  >
                    <span className={styles.cardLabel}>{tab.label}</span>
                    <span className={styles.cardDesc}>{tab.description}</span>
                    <span className={styles.cardAction}>Open</span>
                  </Link>
                </li>
              );
            }

            if (tab.kind === "external") {
              return (
                <li key={tab.id}>
                  <a
                    className={styles.card}
                    href={tab.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-accent={tab.accent}
                  >
                    <span className={styles.cardLabel}>{tab.label}</span>
                    <span className={styles.cardDesc}>{tab.description}</span>
                    <span className={styles.cardAction}>Visit</span>
                  </a>
                </li>
              );
            }

            const panelId = tab.id;
            const isOpen = openTab === panelId;

            return (
              <li key={panelId}>
                <button
                  type="button"
                  id={`tab-${panelId}`}
                  className={styles.card}
                  data-accent={tab.accent}
                  data-selected={isOpen || undefined}
                  aria-expanded={isOpen}
                  aria-controls={`panel-${panelId}`}
                  onClick={() => toggleTab(panelId)}
                >
                  <span className={styles.cardLabel}>{tab.label}</span>
                  <span className={styles.cardDesc}>{tab.description}</span>
                  <span className={styles.cardAction}>
                    {isOpen ? "Close" : "Select"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {openTab === "accounts" ? (
        <div
          id="panel-accounts"
          className={styles.panel}
          role="region"
          aria-labelledby="tab-accounts"
        >
          <KickAccountsPanel />
        </div>
      ) : null}

      {openTab && openTab !== "accounts" ? (
        <div
          id={`panel-${openTab}`}
          className={styles.panel}
          role="region"
          aria-labelledby={`tab-${openTab}`}
        >
          <p className={styles.panelTitle}>{PANEL_COPY[openTab].title}</p>
          <p className={styles.panelBody}>{PANEL_COPY[openTab].body}</p>
          {PANEL_COPY[openTab].links?.length ? (
            <ul className={styles.socialList}>
              {PANEL_COPY[openTab].links.map((link) => (
                <li key={link.label}>
                  <a
                    className={styles.socialLink}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className={styles.socialLabel}>{link.label}</span>
                    {link.handle ? (
                      <span className={styles.socialHandle}>{link.handle}</span>
                    ) : null}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
