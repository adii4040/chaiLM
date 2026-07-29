import User from '../models/user.model.js';
import jwt from 'jsonwebtoken';

const verifyJwt = async (req, res, next) => {
  try {
    const token = req.cookies?.accessToken || req.headers?.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized request! No token provided' });
    }

    const decodedToken = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET_KEY || 'chailm_access_secret_key_default_2026'
    );

    const user = await User.findById(decodedToken?._id).select('-password -refreshToken');
    if (!user) {
      return res.status(401).json({ error: 'Invalid Access Token' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: error.message || 'Unauthorized request' });
  }
};

export { verifyJwt };
