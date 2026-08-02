const mongoose = require('mongoose');
const { Schema } = mongoose;
const { toJSONPlugin } = require('./plugins');

const roomSchema = new Schema(
  {
    roomNumber: { type: String, required: true },
    floor: { type: String },
    rentAmount: { type: Number, required: true },
    depositAmount: { type: Number },
    capacity: { type: Number, required: true },
    occupancyStatus: { type: String, enum: ['VACANT', 'OCCUPIED'], default: 'VACANT' },
    notes: { type: String },
    images: { type: [String], default: [] },
    property: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
    // Current occupant (mirrors Prisma's Room.tenantId / "RoomOccupancy" relation)
    tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null },
  },
  { timestamps: true }
);

// Back-relations - these were mistakenly modeled as stored arrays before;
// in the original Prisma schema they have no physical column on Room, they're
// derived from the "many" side (Tenant.assignedRoom / Bill.room / MeterReading.room).
roomSchema.virtual('assignedTenants', { ref: 'Tenant', localField: '_id', foreignField: 'assignedRoom' });
roomSchema.virtual('bills', { ref: 'Bill', localField: '_id', foreignField: 'room' });
roomSchema.virtual('meterReadings', { ref: 'MeterReading', localField: '_id', foreignField: 'room' });

toJSONPlugin(roomSchema);

module.exports = mongoose.model('Room', roomSchema);
