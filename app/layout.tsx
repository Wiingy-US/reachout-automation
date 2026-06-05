import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digital PR Outreach — MVP",
  description:
    "Single-session email generation & quality check tool. PDF in → personalised pitch emails out → quality verdict out → AppScript-ready CSV out.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
