import mongoose from 'mongoose';

const equationRunnerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  gameData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  lastSynced: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

equationRunnerSchema.index({ userId: 1 });

const EquationRunner = mongoose.model('EquationRunner', equationRunnerSchema);

export default EquationRunner;
