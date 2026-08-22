import User from '../models/user.model.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const verifyJwt = async (req, res, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.headers?.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized request: No access token provided' });
    }

    const decodedToken = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET_KEY || 'chailm_access_secret_key_default_2026'
    );

    const user = await User.findById(decodedToken?._id).select('-password -refreshToken');
    if (!user) {
      return res.status(401).json({ error: 'Invalid access token: User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('[Auth Middleware] Verification failed:', error.message);
    return res.status(401).json({ error: error.message || 'Invalid access token' });
  }
};

export { verifyJwt };

