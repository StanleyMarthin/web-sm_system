import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { MinScreenBlocker } from "@/components/min-screen-blocker";
import { CsrfFetchPatch } from "@/components/csrf-fetch-patch";
import "./globals.css";

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
    <html lang="id" suppressHydrationWarning>
      <body
        className="antialiased"
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <CsrfFetchPatch />
          <MinScreenBlocker />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
