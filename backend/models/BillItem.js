const mongoose = require('mongoose');
const { Schema } = mongoose;
const { toJSONPlugin } = require('./plugins');

const billItemSchema = new Schema(
  {
    bill: { type: Schema.Types.ObjectId, ref: 'Bill', required: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

toJSONPlugin(billItemSchema);

module.exports = mongoose.model('BillItem', billItemSchema);
