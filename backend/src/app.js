const express = require("express");
const cors = require("cors");

const { settings } = require("./config");
const { errorHandler } = require("./middleware/errorHandler");

const authRouter = require("./routes/auth");
const roomsRouter = require("./routes/rooms");
const tenantsRouter = require("./routes/tenants");
const { router: billsRouter } = require("./routes/bills");
const paymentsRouter = require("./routes/payments");
const requestsRouter = require("./routes/requests");
const dashboardRouter = require("./routes/dashboard");

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: "*",
  })
);

app.use("/api/auth", authRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api/tenants", tenantsRouter);
app.use("/api/bills", billsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/requests", requestsRouter);
app.use("/api/dashboard", dashboardRouter);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// 404 fallback for unmatched API routes
app.use((req, res) => {
  res.status(404).json({ detail: "Not Found" });
});

app.use(errorHandler);

module.exports = { app };
