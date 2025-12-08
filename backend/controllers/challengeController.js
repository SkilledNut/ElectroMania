import { validationResult } from 'express-validator';
import Challenge from '../models/Challenge.js';
import User from '../models/User.js';

export const getChallenges = async (req, res) => {
  try {
    const { difficulty, isActive } = req.query;
    const filter = {};

    if (difficulty) filter.difficulty = difficulty;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const challenges = await Challenge.find(filter).sort({ order: 1 });

    if (req.user) {
      const user = await User.findById(req.user._id);
      const completedIds = user.completedChallenges.map(c => c.challengeId.toString());
      
      const enrichedChallenges = challenges.map(challenge => ({
        ...challenge.toObject(),
        completed: completedIds.includes(challenge._id.toString())
      }));
      
      return res.json(enrichedChallenges);
    }

    res.json(challenges);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getChallenge = async (req, res) => {
  try {
    const { id } = req.params;
    let challenge;

    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      challenge = await Challenge.findById(id);
    } else if (!isNaN(id)) {
      challenge = await Challenge.findOne({ order: parseInt(id) });
    } else {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    if (req.user) {
      const user = await User.findById(req.user._id);
      const completed = user.completedChallenges.some(
        c => c.challengeId.toString() === challenge._id.toString()
      );
      
      return res.json({
        ...challenge.toObject(),
        completed
      });
    }

    res.json(challenge);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createChallenge = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const challenge = await Challenge.create(req.body);
    res.status(201).json(challenge);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateChallenge = async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id);

    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    Object.assign(challenge, req.body);
    const updatedChallenge = await challenge.save();

    res.json(updatedChallenge);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteChallenge = async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id);

    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    await challenge.deleteOne();
    res.json({ message: 'Challenge removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const completeChallenge = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { id } = req.params;
    let challenge;

    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      challenge = await Challenge.findById(id);
    } else if (!isNaN(id)) {
      challenge = await Challenge.findOne({ order: parseInt(id) });
    } else {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    const user = await User.findById(req.user._id);

    const alreadyCompleted = user.completedChallenges.some(
      c => c.challengeId.toString() === challenge._id.toString()
    );

    if (!alreadyCompleted) {
      user.completedChallenges.push({
        challengeId: challenge._id,
        score: req.body.score || challenge.points,
        completedAt: new Date()
      });

      if (user.currentChallengeIndex === challenge.order) {
        user.currentChallengeIndex += 1;
      }

      await user.save();
    }

    res.json({
      message: 'Challenge completed',
      completedChallenges: user.completedChallenges,
      currentChallengeIndex: user.currentChallengeIndex
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
