import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MinScreenBlocker } from "@/components/min-screen-blocker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stanley Marthin System",
  description: "Stanley Marthin System Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <MinScreenBlocker />
        {children}
      </body>
    </html>
  );
}
