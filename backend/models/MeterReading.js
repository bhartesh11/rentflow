const mongoose = require('mongoose');
const { Schema } = mongoose;
const { toJSONPlugin } = require('./plugins');

const meterReadingSchema = new Schema(
  {
    room: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    previousReading: { type: Number, required: true },
    currentReading: { type: Number, required: true },
    unitsConsumed: { type: Number, required: true },
    ratePerUnit: { type: Number, required: true },
    amount: { type: Number, required: true },
    readingMonth: { type: Date, required: true },
    billed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

meterReadingSchema.virtual('bill', { ref: 'Bill', localField: '_id', foreignField: 'meterReading', justOne: true });

toJSONPlugin(meterReadingSchema);

module.exports = mongoose.model('MeterReading', meterReadingSchema);
