import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import { AppProviders } from '@/providers/app-providers'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-inter',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  // 400 for figures sitting in body-weight text, 600 for titles and stat values.
  weight: ['400', '600'],
  display: 'swap',
  variable: '--font-playfair',
})

export const metadata: Metadata = {
  title: {
    default: 'Bitar Fashion — Inventory',
    template: '%s · Bitar Fashion',
  },
  description: 'Bitar Fashion is a fashion store that sells clothes and accessories.',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F7F5F0' },
    { media: '(prefers-color-scheme: dark)', color: '#121110' },
  ],
}

/**
 * Applies the stored theme before first paint. Without this the page would
 * render light and then flip, and the markup would disagree with the DOM.
 */
const themeScript = `(function(){try{var s=localStorage.getItem('bitar-fashion:ui:v1');var t=s&&JSON.parse(s).state&&JSON.parse(s).state.theme;if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}var e=document.documentElement;e.classList.toggle('dark',t==='dark');e.style.colorScheme=t}catch(e){}})()`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <AppProviders>
          {children}
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </AppProviders>
      </body>
    </html>
  )
}
