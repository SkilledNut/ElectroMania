import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  let token;

  console.log('[Auth] protect middleware called for:', req.method, req.originalUrl);
  console.log('[Auth] Authorization header:', req.headers.authorization ? 'Present' : 'Missing');

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        console.log('[Auth] User not found for id:', decoded.id);
        return res.status(401).json({ message: 'User not found' });
      }
      
      console.log('[Auth] User authenticated:', req.user._id);
      next();
    } catch (error) {
      console.error('[Auth] Token verification failed:', error.message);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    console.log('[Auth] No token provided');
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

export const optional = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
    } catch (error) {
      console.error(error);
    }
  }
  
  next();
};
