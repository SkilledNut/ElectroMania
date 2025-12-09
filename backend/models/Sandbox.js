import mongoose from 'mongoose';

const logicComponentSchema = new mongoose.Schema({
  id: String,
  type: String,
  is_on: Boolean,
  voltage: Number,
  resistance: Number
}, { _id: false });

const componentSchema = new mongoose.Schema({
  x: Number,
  y: Number,
  type: String,
  rotation: Number,
  angle: Number,
  logicComponent: logicComponentSchema
}, { _id: false });

const sandboxSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    default: 'Untitled Save'
  },
  components: [componentSchema],
  cameraPosition: {
    x: Number,
    y: Number,
    zoom: Number
  },
  isAutoSave: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

sandboxSchema.index({ userId: 1, updatedAt: -1 });
sandboxSchema.index({ userId: 1, isAutoSave: 1 });

const Sandbox = mongoose.model('Sandbox', sandboxSchema);

export default Sandbox;
