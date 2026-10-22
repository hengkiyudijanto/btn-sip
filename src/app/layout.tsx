import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'SIP - Sistem Informasi Penilaian Petugas',
    template: '%s | SIP',
  },
  description:
    'Sistem Informasi Penilaian Petugas frontliner — Teller, Customer Service, Security, Priority Banking.',
  applicationName: 'SIP',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="id" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-abu-50 text-abu-900">
        {children}
      </body>
    </html>
  );
}
