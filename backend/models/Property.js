const mongoose = require('mongoose');
const { Schema } = mongoose;
const { toJSONPlugin } = require('./plugins');

const propertySchema = new Schema(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    description: { type: String },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

propertySchema.virtual('rooms', { ref: 'Room', localField: '_id', foreignField: 'property' });

toJSONPlugin(propertySchema);

module.exports = mongoose.model('Property', propertySchema);
