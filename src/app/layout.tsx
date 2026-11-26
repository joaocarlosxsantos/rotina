import type { Metadata, Viewport } from "next";
import { Newsreader, Chivo, Silkscreen } from "next/font/google";
import { getDictionary, intlLocale } from "../lib/i18n";
import { getLocale } from "../lib/i18n-server";
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

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: t.meta.titleDefault,
      template: "%s | Rotina Pet",
    },
    description: t.meta.description,
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        { url: "/icon.svg", type: "image/svg+xml" },
        { url: "/favicon.ico", sizes: "48x48" },
      ],
      apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    },
    openGraph: {
      title: t.meta.titleDefault,
      description: t.meta.description,
      url: baseUrl,
      siteName: t.common.brandName,
      locale: intlLocale(locale).replace("-", "_"),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: t.common.brandName,
      description: t.meta.description,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    <html
      lang={intlLocale(locale)}
      className={`${newsreader.variable} ${chivo.variable} ${silkscreen.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
