import mongoose from 'mongoose';

const challengeSchema = new mongoose.Schema({
  prompt: {
    type: String,
    required: true
  },
  requiredComponents: [{
    type: String,
    required: true
  }],
  theory: [{
    type: String
  }],
  order: {
    type: Number,
    default: 0
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  points: {
    type: Number,
    default: 100
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

challengeSchema.index({ order: 1 });

const Challenge = mongoose.model('Challenge', challengeSchema);

export default Challenge;
