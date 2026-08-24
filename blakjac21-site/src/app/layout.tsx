import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";
import "./globals.css";

const display = Syne({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
});

const body = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Blakjac21 | Kick",
  description:
    "Official site for Blakjac21 — gambling streams live on Kick. Watch live or catch the latest VOD.",
  openGraph: {
    title: "Blakjac21 | Kick",
    description:
      "Gambling streams on Kick. Watch live when Blakjac21 is on, or the latest VOD when offline.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
