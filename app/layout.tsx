import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yuki - Admin Console",
  description: "AI-first administrative console for DNCTimeTracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

