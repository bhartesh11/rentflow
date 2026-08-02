const mongoose = require('mongoose');
const { Schema } = mongoose;
const { toJSONPlugin } = require('./plugins');

const requestSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
      default: 'PENDING',
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
    },
    tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

toJSONPlugin(requestSchema);

module.exports = mongoose.model('Request', requestSchema);
