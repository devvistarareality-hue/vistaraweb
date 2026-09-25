import './globals.css';
import './ui.css';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import ReduxProvider from '../components/ReduxProvider';
import BackgroundBubbles from '../components/BackgroundBubbles';
import ImpersonationBanner from '../components/ImpersonationBanner';

export const metadata = {
  title:       'Nexora',
  description: 'Nexora — sales, channel partners, accounts and people, in one system.',
  // Icons come from src/app/icon.png + apple-icon.png (Next hashes the URLs, so a
  // new mark is never served from a stale cache) and public/favicon.ico, which is
  // what Safari asks for by name and was 404ing — leaving the old icon in the tab.
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32 64x64', type: 'image/x-icon' },
      { url: '/nexora-icon.png', type: 'image/png', sizes: '256x256' },
    ],
    apple: '/nexora-icon.png',
    shortcut: '/favicon.ico',
  },
};

// Runs before first paint so the saved theme never flashes the other one.
const THEME_BOOT = `(function(){try{var t=localStorage.getItem('nx-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','light')}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <BackgroundBubbles />
        <ReduxProvider>
          <ImpersonationBanner />
          {children}
        </ReduxProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
