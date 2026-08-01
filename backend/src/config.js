require("dotenv").config();

function str(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

function num(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isNaN(n) ? fallback : n;
}

const corsOrigins = str(
  "CORS_ORIGINS",
  "http://localhost:5173,http://localhost:3000"
);

const settings = {
  mongoUri: str("MONGO_URI", "mongodb://localhost:27017"),
  mongoDbName: str("MONGO_DB_NAME", "rentflow"),

  jwtSecret: str("JWT_SECRET", "insecure-dev-secret-change-me"),
  jwtAlgorithm: str("JWT_ALGORITHM", "HS256"),
  accessTokenExpireMinutes: num("ACCESS_TOKEN_EXPIRE_MINUTES", 1440),

  corsOrigins,
  get corsOriginList() {
    return corsOrigins
      .split(",")
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
  },

  ownerEmail: str("OWNER_EMAIL", "owner@rentflow.local"),
  ownerPassword: str("OWNER_PASSWORD", "changeme123"),
  ownerName: str("OWNER_NAME", "Property Owner"),

  smtpHost: str("SMTP_HOST", ""),
  smtpPort: num("SMTP_PORT", 587),
  smtpUser: str("SMTP_USER", ""),
  smtpPassword: str("SMTP_PASSWORD", ""),
  smtpFrom: str("SMTP_FROM", "noreply@rentflow.local"),

  port: num("PORT", 8000),
};

module.exports = { settings };
