const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Types } = require("mongoose");

const { settings } = require("./config");
const { User } = require("./database");
const { HttpError } = require("./utils/httpError");

const { ObjectId } = Types;
const BCRYPT_ROUNDS = 12;

async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(plain, hashed) {
  return bcrypt.compare(plain, hashed);
}

function createAccessToken(data) {
  const toEncode = { ...data };
  const expiresInSeconds = settings.accessTokenExpireMinutes * 60;
  return jwt.sign(toEncode, settings.jwtSecret, {
    algorithm: settings.jwtAlgorithm,
    expiresIn: expiresInSeconds,
  });
}

function decodeToken(token) {
  try {
    return jwt.verify(token, settings.jwtSecret, {
      algorithms: [settings.jwtAlgorithm],
    });
  } catch (err) {
    throw new HttpError(401, "Invalid or expired token");
  }
}

/** Extracts and validates the Bearer token. */
function extractBearerToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (!token || scheme.toLowerCase() !== "bearer") {
    throw new HttpError(401, "Not authenticated");
  }
  return token;
}

async function getCurrentUser(req, res, next) {
  try {
    const token = extractBearerToken(req);
    const payload = decodeToken(token);
    const userId = payload.sub;
    if (!userId) {
      throw new HttpError(401, "Invalid token");
    }
    if (!ObjectId.isValid(userId)) {
      throw new HttpError(401, "User not found");
    }
    const user = await User.findById(userId).lean();
    if (!user) {
      throw new HttpError(401, "User not found");
    }
    user._id = String(user._id);
    if (user.tenant_id) {
      user.tenant_id = String(user.tenant_id);
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

async function requireOwner(req, res, next) {
  getCurrentUser(req, res, (err) => {
    if (err) return next(err);
    if (req.user.role !== "owner") {
      return next(new HttpError(403, "Owner access required"));
    }
    next();
  });
}

async function requireTenant(req, res, next) {
  getCurrentUser(req, res, (err) => {
    if (err) return next(err);
    if (req.user.role !== "tenant") {
      return next(new HttpError(403, "Tenant access required"));
    }
    next();
  });
}

module.exports = {
  hashPassword,
  verifyPassword,
  createAccessToken,
  decodeToken,
  getCurrentUser,
  requireOwner,
  requireTenant,
};
