import './globals.css';
import './ui.css';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import ReduxProvider from '../components/ReduxProvider';

export const metadata = {
  title:       'Nexora',
  description: 'Nexora — sales, channel partners, accounts and people, in one system.',
  icons: {
    icon: '/nexora-icon.png',
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
        <ReduxProvider>
          {children}
        </ReduxProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
