import './globals.css';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import ReduxProvider from '../components/ReduxProvider';

export const metadata = {
  title:       'Vistara ERP',
  description: 'Vistara Group Enterprise Resource Planning',
  icons: {
    icon: '/vistara-logo.png',
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
