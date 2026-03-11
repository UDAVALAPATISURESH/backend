const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const User = require('../models/User');
const authService = require('./authService');

const generateQR = async (userId) => {
  const dbUser = await User.findByPk(userId);
  if (!dbUser) {
    throw new Error('User not found');
  }

  // Generate a secret for TOTP
  // Use very short name to avoid "Data too long" error in QR code
  const appName = (process.env.APP_NAME || 'TMS').substring(0, 5);
  // Extract short username from email (max 10 chars)
  const emailUsername = dbUser.email.split('@')[0].substring(0, 10);
  const secret = speakeasy.generateSecret({
    name: `${emailUsername}@${appName}`,
    length: 32
  });

  // Store the secret in the database for future OTP verification
  await dbUser.update({
    totpSecret: secret.base32
  });

  // Generate QR code on backend to avoid "Data too long" error
  // This ensures the QR code is generated correctly even with longer URLs
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      width: 256
    });

    return {
      qrCode: qrCodeDataUrl, // Return as data URL image
      secret: secret.base32
    };
  } catch (error) {
    // Do NOT fall back to returning raw URL (frontend QR generation can hit "Data too long")
    console.error('Error generating QR code on backend:', error);
    throw new Error('Failed to generate QR code');
  }
};

const verifyOTP = async (userId, otp, secret) => {
  const dbUser = await User.findByPk(userId);
  if (!dbUser) {
    throw new Error('User not found');
  }

  // Validate OTP format (should be 6 digits)
  if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
    throw new Error('OTP must be a 6-digit number');
  }

  // Use stored secret if available, otherwise use provided secret
  const secretToVerify = dbUser.totpSecret || secret;
  
  if (!secretToVerify) {
    throw new Error('No TOTP secret found. Please generate QR code first.');
  }

  // Verify the OTP with a larger window to account for time drift
  const verified = speakeasy.totp.verify({
    secret: secretToVerify,
    encoding: 'base32',
    token: otp,
    window: 3 // Allow 3 time steps (90 seconds) before/after to handle clock drift
  });

  if (!verified) {
    // Generate current valid OTP for debugging (only in development)
    if (process.env.NODE_ENV !== 'production') {
      const currentOTP = speakeasy.totp({
        secret: secretToVerify,
        encoding: 'base32',
      });
      console.log(`[DEBUG] Expected OTP: ${currentOTP}, Received: ${otp}`);
    }
    throw new Error('Invalid OTP. Please check your authenticator app and try again.');
  }

  // If it's first login, mark it as complete
  if (dbUser.isFirstLogin) {
    await dbUser.update({
      isFirstLogin: false,
    });
  }

  const token = authService.generateToken(dbUser);
  return {
    token,
    user: authService.formatUser(dbUser)
  };
};

const getStoredSecret = async (userId) => {
  const dbUser = await User.findByPk(userId);
  if (!dbUser) {
    throw new Error('User not found');
  }
  return dbUser.totpSecret;
};

module.exports = {
  generateQR,
  verifyOTP,
  getStoredSecret
};
