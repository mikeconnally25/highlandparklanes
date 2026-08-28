import type { Metadata } from "next";
import { BonusOverlayWidget } from "@/components/BonusOverlayWidget";
import styles from "./overlay.module.css";

export const metadata: Metadata = {
  title: "Bonus List Overlay | Blakjac21",
  description: "OBS browser source overlay for the live bonus hunt list.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function BonusHuntOverlayPage() {
  return (
    <div className={styles.page}>
      <style>{`
        html, body {
          background: transparent !important;
        }
        body::before,
        body::after {
          display: none !important;
        }
      `}</style>
      <BonusOverlayWidget mode="obs" />
    </div>
  );
}
