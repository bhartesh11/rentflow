import React from 'react';
import Layout from '../components/Layout';

const HomePage = () => {
  return (
    <Layout title="Home - Rental Management System">
      <div className="text-center py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Rental Management System</h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          A modern, professional solution for managing properties, rooms, tenants, and payments.
        </p>
        
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-xl font-semibold mb-2">Property Management</h3>
            <p className="text-gray-600">Create and manage your properties with ease. Add rooms, set rent, and track occupancy.</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-xl font-semibold mb-2">Tenant Management</h3>
            <p className="text-gray-600">Register tenants, manage their details, and track their payment history.</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-xl font-semibold mb-2">Billing & Payments</h3>
            <p className="text-gray-600">Generate monthly bills, record payments, and maintain payment history.</p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default HomePage;