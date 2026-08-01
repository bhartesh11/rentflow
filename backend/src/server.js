const { app } = require("./app");
const { settings } = require("./config");
const { connect, ensureIndexes, usersCol } = require("./database");
const { hashPassword } = require("./auth");

async function startup() {
  await connect();
  await ensureIndexes();

  const owner = await usersCol.findOne({ role: "owner" });
  if (!owner) {
    await usersCol.insertOne({
      name: settings.ownerName,
      email: settings.ownerEmail.toLowerCase(),
      password_hash: await hashPassword(settings.ownerPassword),
      role: "owner",
      created_at: new Date(),
    });
  }
}

startup()
  .then(() => {
    app.listen(settings.port, () => {
      console.log(`RentFlow API listening on port ${settings.port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
