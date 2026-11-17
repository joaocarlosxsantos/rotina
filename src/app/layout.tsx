import type { Metadata, Viewport } from "next";
import { Newsreader, Chivo, Silkscreen } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const chivo = Chivo({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const silkscreen = Silkscreen({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-pixel",
  display: "swap",
});

const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#315e43" },
    { media: "(prefers-color-scheme: dark)", color: "#141c17" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "Rotina Pet — Caderno de hábitos com um companheiro pixel",
    template: "%s | Rotina Pet",
  },
  description: "Cuide da sua rotina diária, ganhe pontos e mantenha seu companheiro pixel feliz.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "48x48" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Rotina Pet — Caderno de hábitos com um companheiro pixel",
    description: "Cuide da sua rotina diária, ganhe pontos e mantenha seu companheiro pixel feliz.",
    url: baseUrl,
    siteName: "Rotina Pet",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rotina Pet",
    description: "Cuide da sua rotina diária, ganhe pontos e mantenha seu companheiro pixel feliz.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${newsreader.variable} ${chivo.variable} ${silkscreen.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
