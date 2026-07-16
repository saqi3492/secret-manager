import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Secret Manager",
  description: "Securely store and share project secrets with your team",
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
