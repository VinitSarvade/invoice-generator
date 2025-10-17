import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Invoice Generator',
  description: 'Create polished invoices with ease in any currency.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="default">
      <body>{children}</body>
    </html>
  );
}
