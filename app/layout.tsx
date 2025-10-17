import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import clsx from 'clsx';
import './globals.css';

export const metadata: Metadata = {
  title: 'Invoice Generator',
  description: 'Create polished invoices with ease in any currency.'
};

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="default" className={clsx(inter.variable)}>
      <body className="min-h-screen bg-slate-100 text-slate-900">{children}</body>
    </html>
  );
}
