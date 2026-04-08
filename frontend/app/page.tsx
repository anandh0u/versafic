'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      // If logged in, go to dashboard
      router.push('/dashboard');
    } else {
      // If not logged in, go to login
      router.push('/login');
    }
  }, [router]);

  return (
    <main style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f1629 0%, #0c1220 100%)',
      color: 'white',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '16px' }}>
          Versafic
        </div>
        <p>Loading...</p>
      </div>
    </main>
  );
}
