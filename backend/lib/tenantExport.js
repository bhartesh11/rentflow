const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const idProofLabels = {
  AADHAAR: 'Aadhaar',
  PAN: 'PAN',
  PASSPORT: 'Passport',
  VOTER_ID: 'Voter ID',
  DRIVING_LICENSE: 'Driving License',
};

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-IN');
}

function roomLabel(tenant) {
  if (!tenant.assignedRoom) return '-';
  const propertyName = tenant.assignedRoom.property?.name || '';
  return `${tenant.assignedRoom.roomNumber}${propertyName ? ` (${propertyName})` : ''}`;
}

// Builds an .xlsx workbook buffer with one row per tenant, covering the fields
// typically requested for tenant / police verification records.
async function buildTenantsXlsx(tenants) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Tenants');

  sheet.columns = [
    { header: 'Full Name', key: 'fullName', width: 24 },
    { header: 'Mobile Number', key: 'mobileNumber', width: 16 },
    { header: 'Email', key: 'email', width: 26 },
    { header: 'Permanent Address', key: 'address', width: 32 },
    { header: 'Occupation', key: 'occupation', width: 18 },
    { header: 'ID Proof Type', key: 'idProofType', width: 16 },
    { header: 'ID Proof Number', key: 'idProofNumber', width: 20 },
    { header: 'Aadhaar Number', key: 'aadhaarNumber', width: 18 },
    { header: 'PAN', key: 'pan', width: 14 },
    { header: 'Emergency Contact', key: 'emergencyContact', width: 18 },
    { header: 'Room / Property', key: 'room', width: 26 },
    { header: 'Occupants in Room', key: 'occupantsCount', width: 16 },
    { header: 'Joining Date', key: 'joiningDate', width: 14 },
    { header: 'Status', key: 'status', width: 12 },
  ];
  sheet.getRow(1).font = { bold: true };

  tenants.forEach((t) => {
    sheet.addRow({
      fullName: t.fullName,
      mobileNumber: t.mobileNumber,
      email: t.email,
      address: t.address || '-',
      occupation: t.occupation || '-',
      idProofType: idProofLabels[t.idProofType] || '-',
      idProofNumber: t.idProofNumber || '-',
      aadhaarNumber: t.aadhaarNumber || '-',
      pan: t.pan || '-',
      emergencyContact: t.emergencyContact || '-',
      room: roomLabel(t),
      occupantsCount: t.occupantsCount || 1,
      joiningDate: fmtDate(t.joiningDate),
      status: t.status,
    });
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// Streams a PDF report (one tenant per block) directly to the given writable
// response stream, suitable for handing to police / society verification.
function buildTenantsPdf(tenants, res) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(res);

  doc.fontSize(16).text('Tenant Verification Report', { align: 'center' });
  doc.fontSize(9).fillColor('#666').text(`Generated on ${new Date().toLocaleString('en-IN')}`, { align: 'center' });
  doc.moveDown(1.5);
  doc.fillColor('#000');

  tenants.forEach((t, idx) => {
    if (idx > 0) doc.moveDown(1);
    doc.fontSize(13).font('Helvetica-Bold').text(`${idx + 1}. ${t.fullName}`);
    doc.font('Helvetica').fontSize(10);

    const rows = [
      ['Mobile Number', t.mobileNumber],
      ['Email', t.email],
      ['Permanent Address', t.address || '-'],
      ['Occupation', t.occupation || '-'],
      ['ID Proof', t.idProofType ? `${idProofLabels[t.idProofType] || t.idProofType}: ${t.idProofNumber || '-'}` : '-'],
      ['Aadhaar Number', t.aadhaarNumber || '-'],
      ['PAN', t.pan || '-'],
      ['Emergency Contact', t.emergencyContact || '-'],
      ['Room / Property', roomLabel(t)],
      ['Occupants in Room', String(t.occupantsCount || 1)],
      ['Joining Date', fmtDate(t.joiningDate)],
      ['Status', t.status],
    ];

    rows.forEach(([label, value]) => {
      doc.text(`${label}: `, { continued: true }).font('Helvetica-Bold').text(value).font('Helvetica');
    });

    doc.moveTo(doc.x, doc.y + 6).lineTo(555, doc.y + 6).strokeColor('#ddd').stroke();
    doc.moveDown(0.5);
  });

  doc.end();
}

module.exports = { buildTenantsXlsx, buildTenantsPdf };
