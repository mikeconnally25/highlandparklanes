import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";
import { SiteSessionProvider } from "@/hooks/useSiteSession";
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
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: "Blakjac21 | Kick",
    description:
      "Gambling streams on Kick. Watch live when Blakjac21 is on, or the latest VOD when offline.",
    type: "website",
    images: [{ url: "/logo.png", width: 1024, height: 1024, alt: "Blakjac21" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <SiteSessionProvider>{children}</SiteSessionProvider>
      </body>
    </html>
  );
}
