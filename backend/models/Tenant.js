const mongoose = require('mongoose');
const { Schema } = mongoose;
const { toJSONPlugin } = require('./plugins');

const tenantSchema = new Schema(
  {
    fullName: { type: String, required: true },
    photo: { type: String },
    mobileNumber: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String },
    aadhaarNumber: { type: String },
    pan: { type: String },
    kycDocuments: { type: [String], default: [] },
    emergencyContact: { type: String },
    occupation: { type: String },
    joiningDate: { type: Date },
    occupantsCount: { type: Number, default: 1 },
    securityDeposit: { type: Number },
    idProofType: {
      type: String,
      enum: ['AADHAAR', 'PAN', 'PASSPORT', 'VOTER_ID', 'DRIVING_LICENSE'],
      default: null,
    },
    idProofNumber: { type: String },
    idProofDocument: { type: String },
    status: { type: String, enum: ['ACTIVE', 'VACATED', 'PENDING'], default: 'PENDING' },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    assignedRoom: { type: Schema.Types.ObjectId, ref: 'Room', default: null },
  },
  { timestamps: true }
);

// Back-relations
tenantSchema.virtual('occupiedRooms', { ref: 'Room', localField: '_id', foreignField: 'tenant' });
tenantSchema.virtual('bills', { ref: 'Bill', localField: '_id', foreignField: 'tenant' });
tenantSchema.virtual('payments', { ref: 'Payment', localField: '_id', foreignField: 'tenant' });
tenantSchema.virtual('requests', { ref: 'Request', localField: '_id', foreignField: 'tenant' });

toJSONPlugin(tenantSchema);

module.exports = mongoose.model('Tenant', tenantSchema);
