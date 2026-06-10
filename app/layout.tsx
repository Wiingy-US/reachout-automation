import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digital PR Outreach — MVP",
  description:
    "Single-session email generation & quality check tool. Prompt + data facts in → personalised pitch emails out → quality verdict out → AppScript-ready CSV out.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
