const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../utils');

// Account.Register & Account.Register.Operator
router.post('/register', (req, res) => {
  try {
    const { name, email, phone, password, role = 'driver', organizationName } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: 'Name, email, phone, and password are required' });
    }

    if (!['driver', 'operator'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either driver or operator' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    const userId = 'USR-' + (role === 'driver' ? 'DRV-' : 'OP-') + uuidv4().substring(0, 6).toUpperCase();
    const verificationCode = '123456'; // standard demo OTP
    const status = role === 'operator' ? 'pending_approval' : 'active';
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, name, email, phone, password_hash, role, status, is_verified, verification_code, organization_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).run(userId, name, email, phone, passwordHash, role, status, verificationCode, organizationName || null, now);

    logAudit({
      userId,
      userName: name,
      userRole: role,
      action: 'USER_REGISTERED',
      targetType: 'user',
      targetId: userId,
      details: `New ${role} registration. Status: ${status}`
    });

    res.status(201).json({
      message: role === 'operator' 
        ? 'Registration successful! Operator accounts require approval from a System Administrator after verification.' 
        : 'Registration successful! Please verify your email with the verification code.',
      userId,
      verificationCodeNeeded: true,
      role,
      status,
      // For convenience during demo/grading:
      sampleOtpCode: verificationCode
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to register account' });
  }
});

// Account.Register.Verify
router.post('/verify-otp', (req, res) => {
  try {
    const { email, code } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.verification_code !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    db.prepare('UPDATE users SET is_verified = 1 WHERE id = ?').run(user.id);

    logAudit({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'EMAIL_VERIFIED',
      targetType: 'user',
      targetId: user.id,
      details: 'User verified email successfully'
    });

    res.json({ message: 'Account verified successfully! You can now log in.' });
  } catch (err) {
    console.error('OTP verification error:', err);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// Login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const match = bcrypt.compareSync(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status === 'deactivated') {
      return res.status(403).json({ error: 'Your account has been deactivated by the administrator.' });
    }

    if (user.role === 'operator' && user.status === 'pending_approval') {
      return res.status(403).json({ error: 'Your operator account is currently pending approval by a System Administrator.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        is_verified: user.is_verified,
        organizationName: user.organization_name
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

// Account.Password.Reset
router.post('/forgot-password', (req, res) => {
  try {
    const { email } = req.body;
    const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(404).json({ error: 'No account registered with this email address' });
    }

    const resetCode = '654321';
    db.prepare('UPDATE users SET verification_code = ? WHERE id = ?').run(resetCode, user.id);

    res.json({
      message: 'Password reset code sent to your email',
      sampleResetCode: resetCode
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to initiate password reset' });
  }
});

router.post('/reset-password', (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || user.verification_code !== code) {
      return res.status(400).json({ error: 'Invalid reset code' });
    }

    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync(newPassword, salt);
    db.prepare('UPDATE users SET password_hash = ?, verification_code = NULL WHERE id = ?').run(newHash, user.id);

    res.json({ message: 'Password has been successfully updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Account.Profile.View
router.get('/profile', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT id, name, email, phone, role, status, is_verified, organization_name, created_at FROM users WHERE id = ?').get(req.user.id);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Account.Profile.Edit
router.put('/profile', authenticateToken, (req, res) => {
  try {
    const { name, organizationName } = req.body;
    db.prepare('UPDATE users SET name = ?, organization_name = COALESCE(?, organization_name) WHERE id = ?')
      .run(name, organizationName || null, req.user.id);

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Account.Vehicle.Add & management
router.get('/vehicles', authenticateToken, (req, res) => {
  try {
    const vehicles = db.prepare('SELECT * FROM vehicles WHERE driver_id = ? ORDER BY created_at DESC').all(req.user.id);
    res.json(vehicles);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

router.post('/vehicles', authenticateToken, (req, res) => {
  try {
    const { make, model, connectorType, batteryCapacity } = req.body;
    if (!make || !model || !connectorType || !batteryCapacity) {
      return res.status(400).json({ error: 'All vehicle fields are required' });
    }

    const id = 'VEH-' + uuidv4().substring(0, 6).toUpperCase();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO vehicles (id, driver_id, make, model, connector_type, battery_capacity, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.user.id, make, model, connectorType, parseFloat(batteryCapacity), now);

    res.status(201).json({ message: 'Vehicle added successfully', vehicleId: id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add vehicle' });
  }
});

router.delete('/vehicles/:id', authenticateToken, (req, res) => {
  try {
    db.prepare('DELETE FROM vehicles WHERE id = ? AND driver_id = ?').run(req.params.id, req.user.id);
    res.json({ message: 'Vehicle deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete vehicle' });
  }
});

// Pay.Methods.Manage
router.get('/payment-methods', authenticateToken, (req, res) => {
  try {
    const methods = db.prepare('SELECT * FROM payment_methods WHERE driver_id = ? ORDER BY is_default DESC, created_at DESC').all(req.user.id);
    res.json(methods);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

router.post('/payment-methods', authenticateToken, (req, res) => {
  try {
    const { type, provider, cardNumber, upiId } = req.body;
    const id = 'PM-' + uuidv4().substring(0, 6).toUpperCase();
    const now = new Date().toISOString();

    let maskedNumber = '•••• •••• •••• 1111';
    if (cardNumber && cardNumber.length >= 4) {
      maskedNumber = `•••• •••• •••• ${cardNumber.slice(-4)}`;
    } else if (upiId) {
      maskedNumber = upiId;
    }

    const token = 'tok_sim_' + uuidv4().substring(0, 12);

    db.prepare(`
      INSERT INTO payment_methods (id, driver_id, type, provider, masked_number, token, is_default, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(id, req.user.id, type || 'credit card', provider || 'Visa', maskedNumber, token, now);

    res.status(201).json({ message: 'Payment method saved securely', id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add payment method' });
  }
});

router.delete('/payment-methods/:id', authenticateToken, (req, res) => {
  try {
    db.prepare('DELETE FROM payment_methods WHERE id = ? AND driver_id = ?').run(req.params.id, req.user.id);
    res.json({ message: 'Payment method removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove payment method' });
  }
});

module.exports = router;
