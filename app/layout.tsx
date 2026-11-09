import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/cormorant-garamond/400.css'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/cormorant-garamond/700.css'
import '@fontsource/cormorant-garamond/400-italic.css'
import '@fontsource/cormorant-garamond/700-italic.css'
import { AppProviders } from '@/providers/app-providers'
import './globals.css'
import './operations.css'

export const metadata: Metadata = {
  title: {
    default: 'Bitar Fashion Inventory',
    template: '%s · Bitar Fashion',
  },
  description: 'Bitar Fashion is a fashion store that sells clothes and accessories.',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8F8F6' },
    { media: '(prefers-color-scheme: dark)', color: '#090a0b' },
  ],
}

/**
 * Applies the stored theme before first paint. Without this the page would
 * render light and then flip, and the markup would disagree with the DOM.
 */
const themeScript = `(function(){try{var p=localStorage.getItem('bitar:user-preferences:v1');var pref=p&&JSON.parse(p).theme;var t=pref==='light'||pref==='dark'?pref:null;if(!t){var s=localStorage.getItem('bitar-fashion:ui:v1');t=s&&JSON.parse(s).state&&JSON.parse(s).state.theme}if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}var e=document.documentElement;e.classList.toggle('dark',t==='dark');e.style.colorScheme=t}catch(e){}})()`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
