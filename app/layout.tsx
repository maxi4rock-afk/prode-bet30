import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PRODE BET30 Mundial 2026",
  description: "Participá gratis, hacé tus pronósticos y competí por premios.",

  openGraph: {
    title: "PRODE BET30 Mundial 2026",
    description: "Participá gratis, hacé tus pronósticos y competí por premios.",
    url: "https://prode-bet30.vercel.app",
    siteName: "PRODE BET30",
    images: [
      {
        url: "https://prode-bet30.vercel.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "PRODE BET30 Mundial 2026",
      },
    ],
    locale: "es_AR",
    type: "website",
  },

  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
