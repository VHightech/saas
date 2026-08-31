import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider"
import { ThemedToaster } from "@/components/themed-toaster"
import { IdleLogout } from "@/components/auth/IdleLogout"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import React from "react"


const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-outfit",
});

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Portale Acquambiente",
    description: "Area Riservata Clienti",
    // Niente SVG: si usano i PNG del pacchetto con l'ICO a chiudere.
    // I browser prendono il primo formato che sanno gestire, quindi i PNG
    // (più nitidi alle misure esatte) vengono serviti ai browser correnti e
    // l'ICO copre i più vecchi.
    icons: {
      icon: [
        { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
        { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
        { url: "/favicon.ico", sizes: "any" },
      ],
      // iOS ignora il canale alpha qui e compone la trasparenza sul NERO:
      // apple-touch-icon.png deve restare opaco (fondo bianco già incorporato).
      // Niente angoli arrotondati nel file: la maschera la applica iOS.
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    },
    // Etichetta sotto l'icona quando il portale viene aggiunto alla home su iOS.
    // Senza questo iOS userebbe il title ("Portale Acquambiente"), troncato.
    appleWebApp: { title: "Acquambiente" },
    manifest: "/site.webmanifest"
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${outfit.variable}`}>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <IdleLogout />
          <ThemedToaster />
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
