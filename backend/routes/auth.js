const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { idProofUpload } = require('../lib/upload');

const VALID_ID_PROOF_TYPES = ['AADHAAR', 'PAN', 'PASSPORT', 'VOTER_ID', 'DRIVING_LICENSE'];

const router = express.Router();

function signToken(user) {
  return jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
}

function sanitizeUser(user) {
  const { password, ...rest } = user;
  return rest;
}

// POST /api/auth/register - property owner sign-up
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { name, email, password, phone } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashed, phone, role: 'OWNER' },
    });

    const token = signToken(user);
    res.status(201).json({ token, user: sanitizeUser(user) });
  })
);

// POST /api/auth/login
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(user);
    res.json({ token, user: sanitizeUser(user) });
  })
);

// POST /api/auth/join - tenant self-registration (creates a pending Tenant + TENANT user)
router.post(
  '/join',
  (req, res, next) => {
    idProofUpload.single('idProofDocument')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  asyncHandler(async (req, res) => {
    const {
      fullName,
      email,
      password,
      mobileNumber,
      address,
      aadhaarNumber,
      pan,
      occupation,
      joiningDate,
      idProofType,
      idProofNumber,
    } = req.body;

    if (!fullName || !email || !password || !mobileNumber) {
      return res
        .status(400)
        .json({ error: 'Full name, email, password and mobile number are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (idProofType && !VALID_ID_PROOF_TYPES.includes(idProofType)) {
      return res.status(400).json({ error: 'Invalid ID proof type' });
    }
    if (idProofType && !idProofNumber) {
      return res.status(400).json({ error: 'ID proof number is required when an ID proof type is selected' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const idProofDocument = req.file ? `/uploads/id-proofs/${req.file.filename}` : null;

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: fullName, email, password: hashed, phone: mobileNumber, role: 'TENANT' },
      });

      const tenant = await tx.tenant.create({
        data: {
          fullName,
          email,
          mobileNumber,
          address,
          aadhaarNumber,
          pan,
          occupation,
          joiningDate: joiningDate ? new Date(joiningDate) : null,
          idProofType: idProofType || null,
          idProofNumber: idProofNumber || null,
          idProofDocument,
          status: 'PENDING',
          userId: user.id,
        },
      });

      return { user, tenant };
    });

    const token = signToken(result.user);
    res.status(201).json({
      token,
      user: sanitizeUser(result.user),
      tenant: result.tenant,
      message: 'Registration successful. Please wait for the property owner to approve your account.',
    });
  })
);

// GET /api/auth/me - current authenticated user
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { tenants: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: sanitizeUser(user) });
  })
);

module.exports = router;
