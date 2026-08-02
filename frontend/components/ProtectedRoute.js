import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

// Wrap a page's content with this to require login (and optionally a role).
const ProtectedRoute = ({ children, role }) => {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (!loading && role && user && user.role !== role) {
      router.push('/dashboard');
    }
  }, [loading, user, role, router]);

  if (loading || !user || (role && user.role !== role)) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        Loading...
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
