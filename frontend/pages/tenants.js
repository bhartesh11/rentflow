import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import api from '../lib/api';

const statusStyles = {
  ACTIVE: 'bg-green-100 text-green-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  VACATED: 'bg-gray-100 text-gray-600',
};

const idProofLabels = {
  AADHAAR: 'Aadhaar',
  PAN: 'PAN',
  PASSPORT: 'Passport',
  VOTER_ID: 'Voter ID',
  DRIVING_LICENSE: 'Driving License',
};

// The API returns document paths like /uploads/id-proofs/xyz.jpg; the file server
// lives at the API host, not under /api, so strip that suffix to build a viewable link.
const fileServerBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

const TenantsContent = () => {
  const [tenants, setTenants] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [editingOccupantsId, setEditingOccupantsId] = useState(null);
  const [occupantsValue, setOccupantsValue] = useState('1');
  const [exporting, setExporting] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get('/tenants');
      setTenants(data.tenants);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleApprove = async (id) => {
    try {
      await api.put(`/tenants/${id}/approve`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this tenant?')) return;
    try {
      await api.delete(`/tenants/${id}`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSaveOccupants = async (id) => {
    try {
      await api.put(`/tenants/${id}`, { occupantsCount: occupantsValue });
      setEditingOccupantsId(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleSelected = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => (prev.length === tenants.length ? [] : tenants.map((t) => t.id)));
  };

  const handleCopyInviteLink = async () => {
    const link = `${window.location.origin}/join`;
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      window.prompt('Copy this invite link:', link);
    }
  };

  const handleExport = async (format) => {
    if (selectedIds.length === 0) {
      setError('Select at least one tenant to export');
      return;
    }
    setExporting(true);
    setError('');
    try {
      const { data } = await api.get('/tenants/export', {
        params: { ids: selectedIds.join(','), format },
        responseType: 'blob',
      });
      const blob = new Blob([data], {
        type: format === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/pdf',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tenants-export.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tenants</h1>
          <p className="text-gray-600 mt-2">Approve applications and manage tenants</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleCopyInviteLink}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50">
            {linkCopied ? 'Link copied!' : '🔗 Copy Tenant Invite Link'}
          </button>
          <button onClick={() => handleExport('xlsx')} disabled={exporting || selectedIds.length === 0}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
            Export XLS ({selectedIds.length})
          </button>
          <button onClick={() => handleExport('pdf')} disabled={exporting || selectedIds.length === 0}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
            Export PDF ({selectedIds.length})
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 -mt-6 mb-6">
        Share the invite link with new tenants so they can register themselves at <code>/join</code> — their application shows up below as PENDING for you to approve.
        Select tenants below (checkbox) to export their details as XLS or PDF, e.g. for police / society verification.
      </p>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error}</div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading tenants...</p>
      ) : tenants.length === 0 ? (
        <p className="text-gray-500">No tenants yet.</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input type="checkbox" checked={tenants.length > 0 && selectedIds.length === tenants.length} onChange={toggleSelectAll} />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Occupants</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Proof</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tenants.map((t) => (
                <React.Fragment key={t.id}>
                  <tr>
                    <td className="px-4 py-4">
                      <input type="checkbox" checked={selectedIds.includes(t.id)} onChange={() => toggleSelected(t.id)} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button onClick={() => setExpandedId(expandedId === t.id ? null : t.id)} className="text-gray-900 hover:text-blue-600 font-medium">
                        {t.fullName}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <div>{t.email}</div>
                      <div>{t.mobileNumber}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {t.assignedRoom ? `${t.assignedRoom.roomNumber} (${t.assignedRoom.property?.name})` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {editingOccupantsId === t.id ? (
                        <span className="inline-flex items-center gap-1">
                          <input type="number" min="1" value={occupantsValue} onChange={(e) => setOccupantsValue(e.target.value)}
                            className="w-14 border border-gray-300 rounded-md px-1 py-0.5 text-sm" />
                          <button onClick={() => handleSaveOccupants(t.id)} className="text-green-600 hover:text-green-800 text-xs">Save</button>
                          <button onClick={() => setEditingOccupantsId(null)} className="text-gray-500 hover:text-gray-700 text-xs">✕</button>
                        </span>
                      ) : (
                        <button
                          onClick={() => { setEditingOccupantsId(t.id); setOccupantsValue(String(t.occupantsCount || 1)); }}
                          className="text-gray-700 hover:text-blue-600"
                        >
                          {t.occupantsCount || 1} {(t.occupantsCount || 1) === 1 ? 'person' : 'people'} ✎
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {t.idProofType ? (
                        <div>
                          <div>{idProofLabels[t.idProofType] || t.idProofType}: {t.idProofNumber}</div>
                          {t.idProofDocument && (
                            <a
                              href={`${fileServerBase}${t.idProofDocument}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800"
                            >
                              View document
                            </a>
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusStyles[t.status]}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-3">
                      {t.status === 'PENDING' && (
                        <button onClick={() => handleApprove(t.id)} className="text-green-600 hover:text-green-800">Approve</button>
                      )}
                      <button onClick={() => setExpandedId(expandedId === t.id ? null : t.id)} className="text-blue-600 hover:text-blue-800">
                        {expandedId === t.id ? 'Hide' : 'Details'}
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="text-red-600 hover:text-red-800">Remove</button>
                    </td>
                  </tr>
                  {expandedId === t.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-2 text-sm text-gray-700">
                          <div><span className="font-medium text-gray-500">Address:</span> {t.address || '-'}</div>
                          <div><span className="font-medium text-gray-500">Occupation:</span> {t.occupation || '-'}</div>
                          <div><span className="font-medium text-gray-500">Emergency Contact:</span> {t.emergencyContact || '-'}</div>
                          <div><span className="font-medium text-gray-500">Aadhaar Number:</span> {t.aadhaarNumber || '-'}</div>
                          <div><span className="font-medium text-gray-500">PAN:</span> {t.pan || '-'}</div>
                          <div><span className="font-medium text-gray-500">Security Deposit:</span> {t.securityDeposit != null ? `₹${t.securityDeposit.toLocaleString('en-IN')}` : '-'}</div>
                          <div><span className="font-medium text-gray-500">Joining Date:</span> {t.joiningDate ? new Date(t.joiningDate).toLocaleDateString('en-IN') : '-'}</div>
                          <div><span className="font-medium text-gray-500">Occupants in Room:</span> {t.occupantsCount || 1}</div>
                          <div><span className="font-medium text-gray-500">Tenant ID:</span> {t.id}</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

const TenantsPage = () => (
  <ProtectedRoute role="OWNER">
    <Layout title="Tenants - Rental Management System">
      <TenantsContent />
    </Layout>
  </ProtectedRoute>
);

export default TenantsPage;
