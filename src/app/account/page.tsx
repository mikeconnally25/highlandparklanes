import type { Metadata } from "next";
import { AccountForm } from "@/components/AccountForm";
import { AccountHeader } from "@/components/AccountHeader";
import { AllAccountsCard } from "@/components/AllAccountsCard";
import { BrandLogo } from "@/components/BrandLogo";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Account | Blakjac21",
  description: "Create a Blakjac21 site account or sign in.",
};

export default function AccountPage() {
  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <BrandLogo size="sm" />
        <AccountHeader />
      </header>

      <main className={styles.main}>
        <p className={styles.eyebrow}>Account</p>
        <AccountForm />
        <AllAccountsCard />
      </main>

      <footer className={styles.footer}>
        <p className={styles.disclaimer}>
          For entertainment only. Gambling involves risk. Please play
          responsibly — 18+ / 21+ where required.
        </p>
      </footer>
    </div>
  );
}
