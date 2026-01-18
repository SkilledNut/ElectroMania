import EquationRunner from '../models/EquationRunner.js';

export const syncGameData = async (req, res) => {
  try {
    const { gameData } = req.body;

    const save = await EquationRunner.findOneAndUpdate(
      { userId: req.user._id },
      {
        userId: req.user._id,
        gameData: gameData || {},
        lastSynced: new Date()
      },
      { upsert: true, new: true }
    );

    res.json(save);
  } catch (error) {
    console.error('[EquationRunner] Sync error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getGameData = async (req, res) => {
  try {
    const save = await EquationRunner.findOne({ userId: req.user._id });

    if (!save) {
      return res.status(404).json({ message: 'No game data found' });
    }

    res.json(save);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
