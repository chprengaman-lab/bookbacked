import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans, Oswald } from 'next/font/google';
import './globals.css';

const oswald = Oswald({
  variable: '--font-oswald',
  subsets: ['latin'],
  weight: ['600', '700'],
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: '--font-ibm-plex-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: '--font-ibm-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'BookBacked — Sportsbook-powered fantasy decisions',
  description:
    'Weekly fantasy football rankings, start/sit comparisons, and lineup optimization powered by sportsbook lines.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${oswald.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
