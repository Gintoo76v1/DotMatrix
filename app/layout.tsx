import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DotMatrix Studio',
  description: 'Nadeldrucker Emulator — Dot-Matrix Print Effect',
  icons: { icon: '/favicon.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&family=Outfit:wght@300;400;500;600;700&family=Roboto:wght@300;400;500;700&family=Open+Sans:wght@400;500;600;700&family=Fira+Code:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="preload" href="/assets/fonts/JetBrainsMono-Regular.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="stylesheet" href="/styles/main.css" />
      </head>
      <body className="dark-mode">{children}</body>
    </html>
  );
}
