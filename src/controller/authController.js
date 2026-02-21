const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const twilio = require('twilio')(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);


const parsePositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_TOKEN_TTL_DAYS = parsePositiveNumber(process.env.JWT_REFRESH_DAYS, 30);
const MAX_REFRESH_TOKENS = parsePositiveNumber(process.env.JWT_REFRESH_MAX_TOKENS, 5);
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const ensureJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('Missing JWT_SECRET in environment variables');
  }
  return process.env.JWT_SECRET;
};

const signAccessToken = (userId) =>
  jwt.sign({ id: userId }, ensureJwtSecret(), {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });

const generateRefreshTokenValue = () => crypto.randomBytes(40).toString('hex');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const buildUserPayload = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  photo: user.picture,
});

const pruneExpiredTokens = (user) => {
  const now = Date.now();
  user.refreshTokens = user.refreshTokens.filter((entry) => entry.expiresAt.getTime() > now);
};

const enforceTokenLimit = (user) => {
  if (user.refreshTokens.length <= MAX_REFRESH_TOKENS) {
    return;
  }

  const excess = user.refreshTokens.length - MAX_REFRESH_TOKENS;
  user.refreshTokens.splice(0, excess);
};

const attachRefreshToken = (user, refreshTokenValue) => {
  const hashed = hashToken(refreshTokenValue);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * DAY_IN_MS);
  user.refreshTokens.push({ token: hashed, expiresAt });
};

const issueTokensForUser = async (user) => {
  pruneExpiredTokens(user);
  enforceTokenLimit(user);

  const refreshToken = generateRefreshTokenValue();
  attachRefreshToken(user, refreshToken);
  await user.save();

  const accessToken = signAccessToken(user._id);
  return { accessToken, refreshToken };
};

const removeRefreshToken = (user, hashedToken) => {
  const initialLength = user.refreshTokens.length;
  user.refreshTokens = user.refreshTokens.filter((entry) => entry.token !== hashedToken);
  return initialLength !== user.refreshTokens.length;
};

const respondWithTokens = (res, statusCode, message, user, tokens) =>
  res.status(statusCode).json({
    message,
    token: tokens.accessToken,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: buildUserPayload(user),
  });

exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    const user = await User.create({ name: name.trim(), email, password });
    const tokens = await issueTokensForUser(user);

    return respondWithTokens(res, 201, 'User created successfully', user, tokens);
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'User does not exist' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const tokens = await issueTokensForUser(user);

    return respondWithTokens(res, 200, 'Login successful', user, tokens);
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.googleLogin = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Google token is required' });
    }

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { name, email, sub: googleId, picture } = ticket.getPayload();

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        googleId,
        picture,
      });
    } else {
      if (!user.googleId) {
        user.googleId = googleId;
      }
      // Always update picture if available
      if (picture) {
        user.picture = picture;
      }
      await user.save();
    }

    const tokens = await issueTokensForUser(user);
    return respondWithTokens(res, 200, 'Google login successful', user, tokens);
  } catch (error) {
    console.error('Google login error:', error);
    return res.status(401).json({ message: 'Invalid Google token' });
  }
};

exports.refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    const hashedToken = hashToken(refreshToken);
    const user = await User.findOne({ 'refreshTokens.token': hashedToken });

    if (!user) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const storedToken = user.refreshTokens.find((entry) => entry.token === hashedToken);
    if (!storedToken || storedToken.expiresAt.getTime() <= Date.now()) {
      removeRefreshToken(user, hashedToken);
      await user.save();
      return res.status(401).json({ message: 'Refresh token expired' });
    }

    removeRefreshToken(user, hashedToken);
    const tokens = await issueTokensForUser(user);

    return respondWithTokens(res, 200, 'Token refreshed', user, tokens);
  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    const hashedToken = hashToken(refreshToken);
    const user = await User.findOne({ 'refreshTokens.token': hashedToken });

    if (user) {
      const removed = removeRefreshToken(user, hashedToken);
      if (removed) {
        await user.save();
      }
    }

    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.sendOTP = async (req, res) => {
  try {
    const { phoneNumber, name } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    let user = await User.findOne({ phoneNumber });
    if (!user) {
      user = new User({
        phoneNumber,
        name: name || `User ${phoneNumber.slice(-4)}`
      });
    } else if (name) {
      // Update name if provided during resend or similar
      user.name = name;
    }

    user.otp = otp;
    user.otpExpiresAt = otpExpiresAt;
    await user.save();

    await twilio.messages.create({
      body: `Your verification code is ${otp}. It will expire in 10 minutes.`,
      from: process.env.TWILIO_FROM_NUMBER,
      to: phoneNumber,
    });

    return res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Send OTP error:', error);
    return res.status(500).json({ message: 'Failed to send OTP' });
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;
    if (!phoneNumber || !otp) {
      return res.status(400).json({ message: 'Phone number and OTP are required' });
    }

    const user = await User.findOne({ phoneNumber });
    if (!user || user.otp !== otp || user.otpExpiresAt < Date.now()) {
      return res.status(401).json({ message: 'Invalid or expired OTP' });
    }

    // Clear OTP after successful verification
    user.otp = undefined;
    user.otpExpiresAt = undefined;

    const tokens = await issueTokensForUser(user);
    return respondWithTokens(res, 200, 'Login successful', user, tokens);
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};
