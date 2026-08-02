const mongoose = require('mongoose');
const { Schema } = mongoose;
const { toJSONPlugin } = require('./plugins');

const receiptSchema = new Schema(
  {
    receiptNumber: { type: String, required: true, unique: true },
    payment: { type: Schema.Types.ObjectId, ref: 'Payment', required: true, unique: true },
    amountPaid: { type: Number, required: true },
    balanceRemaining: { type: Number, required: true },
    paymentDate: { type: Date, required: true },
  },
  { timestamps: true }
);

toJSONPlugin(receiptSchema);

module.exports = mongoose.model('Receipt', receiptSchema);
