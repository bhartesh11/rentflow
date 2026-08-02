// Applied to every schema so API responses look the same shape as the old
// Prisma output ({ id: "...", ... }) instead of Mongo's { _id, __v }.
function toJSONPlugin(schema) {
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      return ret;
    },
  });
  schema.set('toObject', { virtuals: true });
}

module.exports = { toJSONPlugin };
