const mongoose = require('mongoose');
const { Schema } = mongoose;
const { toJSONPlugin } = require('./plugins');

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['OWNER', 'TENANT'], default: 'OWNER' },
    name: { type: String },
    phone: { type: String },
  },
  { timestamps: true }
);

// Back-relations (no physical column - populated on demand)
userSchema.virtual('tenants', { ref: 'Tenant', localField: '_id', foreignField: 'user' });
userSchema.virtual('properties', { ref: 'Property', localField: '_id', foreignField: 'owner' });
userSchema.virtual('requests', { ref: 'Request', localField: '_id', foreignField: 'user' });

toJSONPlugin(userSchema);

// `select: false` above only keeps password out of *default* queries - it's
// still present in memory (and would be serialized) right after .create(),
// or after routes/auth.js explicitly does .select('+password') for login.
// Strip it here too so it can never end up in an API response.
userSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.password;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
