const PDFDocument = require('pdfkit');

function inr(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Streams a formatted invoice PDF for a single bill directly to the response.
// `bill` must include tenant, room (with property), meterReading, and payments.
function buildBillPdf(bill, res) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(res);

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text('Rent Invoice', { align: 'left' });
  doc.fontSize(10).font('Helvetica').fillColor('#555')
    .text(`Invoice #: ${bill.invoiceNumber}`)
    .text(`Billing Month: ${new Date(bill.billingMonth).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`)
    .text(`Due Date: ${new Date(bill.dueDate).toLocaleDateString('en-IN')}`)
    .text(`Status: ${bill.paymentStatus}`);
  doc.fillColor('#000');
  doc.moveDown(1);

  // Tenant / property block
  doc.fontSize(12).font('Helvetica-Bold').text('Billed To');
  doc.fontSize(10).font('Helvetica')
    .text(bill.tenant?.fullName || '-')
    .text(bill.tenant?.mobileNumber || '')
    .text(bill.tenant?.email || '');
  doc.moveDown(0.5);
  doc.fontSize(12).font('Helvetica-Bold').text('Property / Room');
  doc.fontSize(10).font('Helvetica')
    .text(`${bill.room?.property?.name || ''}`)
    .text(`Room ${bill.room?.roomNumber || ''}${bill.room?.floor ? ` (Floor ${bill.room.floor})` : ''}`);
  doc.moveDown(1);

  // Charges table
  doc.fontSize(12).font('Helvetica-Bold').text('Charges');
  doc.moveDown(0.3);

  const rows = [
    ['Rent', bill.rent],
    ['Electricity Charges', bill.electricityCharges],
    ['Water Charges', bill.waterCharges],
    ['Maintenance', bill.maintenance],
    ['Other Charges', bill.otherCharges],
    ['Previous Due', bill.previousDue],
    ['Discounts', bill.discounts != null ? -bill.discounts : null],
  ].filter(([, v]) => v != null && v !== 0);

  const startX = doc.x;
  rows.forEach(([label, value]) => {
    doc.fontSize(10).font('Helvetica').text(label, startX, doc.y, { continued: true, width: 300 });
    doc.text(inr(value), { align: 'right' });
  });

  if (bill.meterReading) {
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#555')
      .text(`Electricity: ${bill.meterReading.previousReading} -> ${bill.meterReading.currentReading} units (` +
        `${bill.meterReading.unitsConsumed} units used @ Rs. ${bill.meterReading.ratePerUnit}/unit)`);
    doc.fillColor('#000');
  }

  doc.moveTo(startX, doc.y + 8).lineTo(545, doc.y + 8).strokeColor('#333').stroke();
  doc.moveDown(0.6);

  doc.fontSize(12).font('Helvetica-Bold').text('Total Amount', startX, doc.y, { continued: true, width: 300 });
  doc.text(inr(bill.totalAmount), { align: 'right' });
  doc.font('Helvetica');
  doc.moveDown(1.5);

  // Payments
  if (bill.payments && bill.payments.length > 0) {
    doc.fontSize(12).font('Helvetica-Bold').text('Payments Received');
    doc.font('Helvetica').fontSize(10);
    bill.payments.forEach((p) => {
      doc.text(
        `${new Date(p.paymentDate).toLocaleDateString('en-IN')} - ${inr(p.amount)} (${p.paymentMethod})`
      );
    });
    doc.moveDown(1);
  }

  doc.fontSize(8).fillColor('#888').text('This is a system-generated invoice.', { align: 'center' });

  doc.end();
}

module.exports = { buildBillPdf };
