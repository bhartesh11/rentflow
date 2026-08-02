import React from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';

const Navigation = () => {
  const { user, logout } = useAuth();

  const ownerLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/properties', label: 'Properties' },
    { href: '/rooms', label: 'Rooms' },
    { href: '/tenants', label: 'Tenants' },
    { href: '/bills', label: 'Bills' },
  ];

  const tenantLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/bills', label: 'My Bills' },
  ];

  const links = user ? (user.role === 'OWNER' ? ownerLinks : tenantLinks) : [];

  return (
    <nav className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/">
                <span className="text-xl font-bold text-blue-600">RentalManager</span>
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link href="/" className="text-gray-500 hover:text-gray-700 inline-flex items-center px-1 pt-1 text-sm font-medium">
                Home
              </Link>
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-gray-500 hover:text-gray-700 inline-flex items-center px-1 pt-1 text-sm font-medium"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center">
            <div className="hidden sm:ml-6 sm:flex sm:items-center gap-2">
              {user ? (
                <>
                  <span className="text-sm text-gray-600 px-3">Hi, {user.name || user.email}</span>
                  <button
                    onClick={logout}
                    className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium">
                    Login
                  </Link>
                  <Link href="/join" className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
                    Join
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
