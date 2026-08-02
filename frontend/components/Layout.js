import React from 'react';
import Head from 'next/head';
import Navigation from './Navigation';

const Layout = ({ children, title = 'Rental Management System' }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>{title}</title>
        <meta name="description" content="Modern Rental/PG/Room Management System" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Navigation />

      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;