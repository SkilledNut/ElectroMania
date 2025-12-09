import { validationResult } from 'express-validator';
import Sandbox from '../models/Sandbox.js';

export const getSandboxSaves = async (req, res) => {
  try {
    const saves = await Sandbox.find({ userId: req.user._id })
      .sort({ updatedAt: -1 })
      .select('name isAutoSave createdAt updatedAt');
    
    res.json(saves);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getSandboxSave = async (req, res) => {
  try {
    const save = await Sandbox.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!save) {
      return res.status(404).json({ message: 'Save not found' });
    }

    res.json(save);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAutoSave = async (req, res) => {
  try {
    const autoSave = await Sandbox.findOne({
      userId: req.user._id,
      isAutoSave: true
    }).sort({ updatedAt: -1 });

    if (!autoSave) {
      return res.status(404).json({ message: 'No autosave found' });
    }

    res.json(autoSave);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createSandboxSave = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('[Sandbox] Validation errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    console.log('[Sandbox] createSandboxSave called');
    console.log('[Sandbox] User:', req.user?._id);
    console.log('[Sandbox] Body:', JSON.stringify(req.body, null, 2).substring(0, 500));
    
    const { name, components, cameraPosition, isAutoSave } = req.body;

    if (isAutoSave) {
      const existingAutoSave = await Sandbox.findOne({
        userId: req.user._id,
        isAutoSave: true
      });

      if (existingAutoSave) {
        console.log('[Sandbox] Updating existing autosave:', existingAutoSave._id);
        existingAutoSave.components = components || [];
        existingAutoSave.cameraPosition = cameraPosition;
        const updatedSave = await existingAutoSave.save();
        return res.json(updatedSave);
      }
    }

    console.log('[Sandbox] Creating new save...');
    const save = await Sandbox.create({
      userId: req.user._id,
      name: name || 'Untitled Save',
      components: components || [],
      cameraPosition: cameraPosition || { x: 0, y: 0, zoom: 1 },
      isAutoSave: isAutoSave || false
    });

    console.log('[Sandbox] Save created:', save._id);
    res.status(201).json(save);
  } catch (error) {
    console.error('[Sandbox] Error in createSandboxSave:', error);
    res.status(500).json({ message: error.message });
  }
};

export const updateSandboxSave = async (req, res) => {
  try {
    const save = await Sandbox.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!save) {
      return res.status(404).json({ message: 'Save not found' });
    }

    const { name, components, cameraPosition } = req.body;

    if (name !== undefined) save.name = name;
    if (components !== undefined) save.components = components;
    if (cameraPosition !== undefined) save.cameraPosition = cameraPosition;

    const updatedSave = await save.save();
    res.json(updatedSave);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteSandboxSave = async (req, res) => {
  try {
    const save = await Sandbox.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!save) {
      return res.status(404).json({ message: 'Save not found' });
    }

    await save.deleteOne();
    res.json({ message: 'Save deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const quickSave = async (req, res) => {
  try {
    console.log('[Sandbox] quickSave called');
    console.log('[Sandbox] User:', req.user?._id);
    console.log('[Sandbox] Components count:', req.body.components?.length);
    
    const { components, cameraPosition } = req.body;

    const save = await Sandbox.findOneAndUpdate(
      { userId: req.user._id, isAutoSave: true },
      {
        userId: req.user._id,
        name: 'Autosave',
        components: components || [],
        cameraPosition: cameraPosition || { x: 0, y: 0, zoom: 1 },
        isAutoSave: true
      },
      { upsert: true, new: true }
    );

    console.log('[Sandbox] quickSave success:', save._id);
    res.json(save);
  } catch (error) {
    console.error('[Sandbox] Error in quickSave:', error);
    res.status(500).json({ message: error.message });
  }
};
