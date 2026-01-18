import { validationResult } from 'express-validator';
import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';

export const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password } = req.body;

  try {
    const userExists = await User.findOne({ username });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      username,
      password
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        username: user.username,
        points: user.points || 0,
        currentChallengeIndex: user.currentChallengeIndex,
        token: generateToken(user._id)
      });
    }
  } catch (error) {
    console.error('[Register Error]:', error);
    res.status(500).json({ message: error.message, error: error.toString() });
  }
};

export const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        username: user.username,
        currentChallengeIndex: user.currentChallengeIndex,
        completedChallenges: user.completedChallenges,
        points: user.points || 0,
        token: generateToken(user._id)
      });
    } else {
      res.status(401).json({ message: 'Invalid username or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({
      _id: user._id,
      username: user.username,
      points: user.points || 0,
      currentChallengeIndex: user.currentChallengeIndex,
      completedChallenges: user.completedChallenges
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getLeaderboard = async (req, res) => {
  try {
    const users = await User.find({})
      .select('username points profilePic score')
      .lean();

    users.sort((a, b) => ((b.points ?? b.score ?? 0) - (a.points ?? a.score ?? 0)));

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
