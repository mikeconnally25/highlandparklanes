import type { Metadata } from "next";
import { HuntListOverlayWidget } from "@/components/HuntListOverlayWidget";
import styles from "../overlay.module.css";

export const metadata: Metadata = {
  title: "Hunt List Overlay | Blakjac21",
  description: "OBS browser source overlay for the live hunt list table.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function HuntListOverlayPage() {
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
      <HuntListOverlayWidget mode="obs" />
    </div>
  );
}
