'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode, useState, useEffect } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  // Evitar hidratación incorrecta durante SSR
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Durante SSR/build, renderizar children sin SessionProvider
  // Esto evita el error de useContext
  if (!mounted) {
    return <>{children}</>;
  }
  
  return (
    <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
      {children}
    </SessionProvider>
  );
}
