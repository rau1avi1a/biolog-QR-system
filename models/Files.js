import mongoose from 'mongoose';

const filesSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['file', 'folder'],
    required: true
  },
  path: {
    type: String,
    default: ''
  },
  size: {
    type: Number,
    default: 0
  },
  mimeType: {
    type: String
  },
  data: {
    type: Buffer  // For storing PDF data directly
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const Files = mongoose.models.Files || mongoose.model('Files', filesSchema);

export default Files;