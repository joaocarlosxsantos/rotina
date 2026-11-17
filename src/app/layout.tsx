import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rotina Pet — um passo de cada vez",
  description: "Cuide da sua rotina e do seu companheiro pixel.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
