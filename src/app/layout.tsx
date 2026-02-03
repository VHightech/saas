import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "sonner"

import { TenantProvider } from "@/components/tenant-provider"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"

const inter = Inter({ subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const tenantSlug = headersList.get("x-tenant-slug") || "acq"
  const supabase = await createClient()

  let title = "Portale Acquambiente"
  let icon = "/acq_favicon.ico"

  try {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, logo_url")
      .eq("slug", tenantSlug)
      .single()

    if (tenant) {
      if (tenant.name) title = tenant.name
      if (tenant.logo_url) icon = tenant.logo_url
    }
  } catch (e) {
    console.error("Error fetching tenant metadata:", e)
  }

  return {
    title,
    description: "Area Riservata Clienti",
    icons: {
      icon: icon
    }
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers()
  const tenantSlug = headersList.get("x-tenant-slug") || "acq"

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TenantProvider initialTenantSlug={tenantSlug}>
            {children}
            <Toaster richColors />
          </TenantProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
