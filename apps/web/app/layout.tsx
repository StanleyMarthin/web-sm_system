import type { Metadata } from "next";
import { JetBrains_Mono, Lexend_Deca } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { MinScreenBlocker } from "@/components/min-screen-blocker";
import { CsrfFetchPatch } from "@/components/csrf-fetch-patch";
import "./globals.css";

const lexendDeca = Lexend_Deca({
  variable: "--font-lexend-deca",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["500", "600"],
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
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${lexendDeca.variable} ${jetBrainsMono.variable} antialiased`}
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
