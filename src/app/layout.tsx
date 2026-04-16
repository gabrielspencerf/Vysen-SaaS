import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SEO_APP_NAME, SEO_DEFAULT_DESCRIPTION, getAppBaseUrl } from "./seo";
import { CsrfFetchBootstrap } from "@/components/security/csrf-fetch-bootstrap";

export const metadata: Metadata = {
  metadataBase: getAppBaseUrl(),
  title: {
    default: SEO_APP_NAME,
    template: "%s | Vysen",
  },
  description: SEO_DEFAULT_DESCRIPTION,
  applicationName: SEO_APP_NAME,
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon", type: "image/png" }],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
    shortcut: ["/icon"],
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: SEO_APP_NAME,
    title: SEO_APP_NAME,
    description: SEO_DEFAULT_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: SEO_APP_NAME,
    description: SEO_DEFAULT_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // #region agent log
  fetch("http://127.0.0.1:7883/ingest/008a175d-2d7a-4924-9b86-c0beafafbba5", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "49dad9",
    },
    body: JSON.stringify({
      sessionId: "49dad9",
      runId: "chunkload-pre-fix",
      hypothesisId: "H3",
      location: "src/app/layout.tsx:RootLayout",
      message: "RootLayout rendered on server",
      data: {},
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return (
    <html lang="pt-BR" className="antialiased" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {/* Microsoft Clarity */}
        {process.env.NEXT_PUBLIC_CLARITY_ID && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function(c,l,a,r,i,t,y){
                    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
                })(window, document, "clarity", "script", "${process.env.NEXT_PUBLIC_CLARITY_ID}");
              `,
            }}
          />
        )}
      </head>
      <body className="min-h-screen">
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=document.documentElement;try{var s=localStorage.getItem('ds-theme');var dark=s!=='light';t.classList.toggle('dark',dark);t.classList.toggle('light',!dark);t.setAttribute('data-theme',dark?'dark':'light');}catch(e){t.classList.add('dark');t.classList.remove('light');t.setAttribute('data-theme','dark');}})();`,
          }}
        />
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="dark"
          enableSystem={false}
        >
          <CsrfFetchBootstrap />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
