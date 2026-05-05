import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Versafic — AI Call Automation & Business Discovery',
  description:
    'Versafic AI answers every business call instantly, understands customer intent, books appointments automatically, and blocks spam callers.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://checkout.razorpay.com" />
        <link rel="preconnect" href="https://rzp.io" />
        <link rel="preconnect" href="https://backend-production-a176.up.railway.app" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
