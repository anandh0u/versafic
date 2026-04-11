'use client';

import Script from 'next/script';
import HomePage from '../page';

export default function LoginPage() {
  return (
    <>
      <HomePage />
      <Script id="versafic-open-login-modal" strategy="afterInteractive">
        {`
window.setTimeout(() => {
  try {
    if (typeof window.openLogin === 'function') {
      window.openLogin();
    }
  } catch (error) {
    console.error('Failed to open login modal', error);
  }
}, 120);
`}
      </Script>
    </>
  );
}
