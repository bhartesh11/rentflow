const mongoose = require('mongoose');
const { Schema } = mongoose;
const { toJSONPlugin } = require('./plugins');

const billSchema = new Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    room: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    billingMonth: { type: Date, required: true },
    rent: { type: Number, required: true },
    electricityCharges: { type: Number },
    waterCharges: { type: Number },
    maintenance: { type: Number },
    otherCharges: { type: Number },
    discounts: { type: Number },
    previousDue: { type: Number },
    totalAmount: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'PARTIAL', 'OVERDUE'],
      default: 'PENDING',
    },
    meterReading: { type: Schema.Types.ObjectId, ref: 'MeterReading', default: null, unique: true, sparse: true },
  },
  { timestamps: true }
);

billSchema.virtual('items', { ref: 'BillItem', localField: '_id', foreignField: 'bill' });
billSchema.virtual('payments', { ref: 'Payment', localField: '_id', foreignField: 'bill' });

toJSONPlugin(billSchema);

module.exports = mongoose.model('Bill', billSchema);
