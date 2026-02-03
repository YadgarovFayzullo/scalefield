import type { Metadata } from "next";
import { Geist, Geist_Mono, DM_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Scalefield - Scale Your SaaS Without Limits",
  description:
    "Build, deploy, and scale your SaaS applications with ease. Focus on what matters while we handle the infrastructure.",
  openGraph: {
    title: "Scalefield - Scale Your SaaS Without Limits",
    description:
      "Build, deploy, and scale your SaaS applications with ease. Focus on what matters while we handle the infrastructure.",
    url: "https://scalefield.com",
    siteName: "Scalefield",
    images: [
      {
        url: "/scalefield.svg",
        width: 1200,
        height: 630,
        alt: "Scalefield",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Scalefield - Scale Your SaaS Without Limits",
    description:
      "Build, deploy, and scale your SaaS applications with ease. Focus on what matters while we handle the infrastructure.",
    images: ["/scalefield.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={dmSans.variable} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon/favicon.ico" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/favicon/apple-touch-icon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon/favicon-16x16.png"
        />
        <link rel="manifest" href="/favicon/site.webmanifest" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider defaultTheme="light" storageKey="scalefield-theme">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
