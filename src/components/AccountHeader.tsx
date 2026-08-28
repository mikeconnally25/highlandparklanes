"use client";

import Link from "next/link";
import { useSiteSession } from "@/hooks/useSiteSession";
import styles from "./AccountHeader.module.css";

export function AccountHeader() {
  const { user, ready, isAdmin, signOut } = useSiteSession();

  if (!ready) {
    return <div className={styles.slot} aria-hidden />;
  }

  if (user) {
    return (
      <div className={styles.slot}>
        <span className={styles.username}>@{user.username}</span>
        {isAdmin ? <span className={styles.adminBadge}>Admin</span> : null}
        <button type="button" className={styles.ghostBtn} onClick={signOut}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className={styles.slot}>
      <Link className={styles.signIn} href="/account?mode=login">
        Sign in with Kick
      </Link>
      <Link className={styles.createBtn} href="/account">
        Create account
      </Link>
    </div>
  );
}
