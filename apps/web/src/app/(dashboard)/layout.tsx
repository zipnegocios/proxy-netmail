'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ReactNode, useEffect, useState } from 'react';

const navItems = [
  { href: '/', label: 'Overview' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/monitor', label: 'Monitor' },
  { href: '/ssl', label: 'SSL' },
  { href: '/settings', label: 'Settings' },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check auth
    const auth = localStorage.getItem('proxy-netmail-auth');
    if (auth !== 'true') {
      router.push('/login');
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('proxy-netmail-auth');
    router.push('/login');
  };

  // Prevent hydration issues
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-xl font-bold">proxy-netmail</h1>
          <p className="text-xs text-gray-400 mt-1">Mail Proxy Management</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-4 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-gray-800 text-white font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-800">
          <Button
            variant="ghost"
            className="w-full text-gray-400 hover:text-white"
            onClick={handleLogout}
          >
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-gray-50">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
