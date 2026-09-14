import './globals.css';
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

export default function RootLayout({ children }) {
  return (
    <html lang="en">
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
