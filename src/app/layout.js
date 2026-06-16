import './globals.css';
import ReduxProvider from '../components/ReduxProvider';

export const metadata = {
  title:       'Vistara ERP',
  description: 'Vistara Group Enterprise Resource Planning',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ReduxProvider>
          {children}
        </ReduxProvider>
      </body>
    </html>
  );
}
