import type { Metadata, Viewport } from 'next';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Mirai — Live2D AI Companion',
    template: '%s · Mirai',
  },
  description:
    'A Live2D AI companion in the browser: streaming replies, real-time lip sync, emotion-driven expressions and voice, with zero-config fallbacks.',
  applicationName: 'Mirai',
  keywords: [
    'Live2D',
    'AI companion',
    'VTuber',
    'lip sync',
    'Next.js',
    'AI SDK',
    'text to speech',
  ],
  authors: [{ name: 'juliandavid0610', url: 'https://github.com/juliandavid0610' }],
  openGraph: {
    type: 'website',
    siteName: 'Mirai',
    title: 'Mirai — Live2D AI Companion',
    description:
      'Streaming LLM chat wired to a Live2D rig: real-time lip sync, emotion-driven expressions, and voice in and out.',
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mirai — Live2D AI Companion',
    description:
      'Streaming LLM chat wired to a Live2D rig: real-time lip sync, emotion-driven expressions, and voice in and out.',
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0b0a12',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  // The avatar stage swallows pointer gestures for head tracking; letting the
  // page pinch-zoom underneath it makes the whole layout feel broken on touch.
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* The Cubism Core and the sample rigs both come from these origins.
            Warming the connections shaves a visible chunk off first paint of
            the character. */}
        <link rel="preconnect" href="https://cubism.live2d.com" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
