const mongoose = require('mongoose');
const { Schema } = mongoose;
const { toJSONPlugin } = require('./plugins');

const paymentSchema = new Schema(
  {
    amount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['CASH', 'UPI', 'BANK_TRANSFER', 'CARD'], required: true },
    paymentDate: { type: Date, default: Date.now },
    balance: { type: Number },
    notes: { type: String },
    bill: { type: Schema.Types.ObjectId, ref: 'Bill', default: null },
    tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  },
  { timestamps: true }
);

paymentSchema.virtual('receipt', { ref: 'Receipt', localField: '_id', foreignField: 'payment', justOne: true });

toJSONPlugin(paymentSchema);

module.exports = mongoose.model('Payment', paymentSchema);
