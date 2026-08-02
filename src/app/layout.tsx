import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "VoteWise — Africa's Most Trusted Election Management Platform",
  description:
    "VoteWise is a cloud platform that enables ANY organization — universities, companies, churches, NGOs, cooperatives, associations, trade unions, clubs — to create, manage, conduct, and monitor secure elections from a single trusted control room. Encrypted voting, audit trails, live results.",
  keywords: [
    "election platform", "election management", "electronic voting", "VoteWise",
    "secure voting", "organization elections", "Africa elections",
    "association voting", "cooperative elections", "church elections",
    "university elections", "company elections", "NGO elections",
  ],
  authors: [{ name: "VoteWise" }],
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png", sizes: "64x64" },
      { url: "/logo-votewise.png", type: "image/png", sizes: "1024x1024" },
    ],
    apple: [{ url: "/logo-votewise.png", sizes: "1024x1024", type: "image/png" }],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#15803d",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className="overflow-x-hidden">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} antialiased bg-background text-foreground overflow-x-hidden`}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
          <Toaster />
          <SonnerToaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
