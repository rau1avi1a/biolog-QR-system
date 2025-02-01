// models/FileStatus.js
import mongoose from 'mongoose';

const fileStatusSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  dropboxPath: {
    type: String,
    required: true
  },
  currentStatus: {
    type: String,
    enum: ['production', 'inProgress', 'review', 'completed'],
    default: 'production'
  },
  history: [{
    status: String,
    timestamp: Date,
    user: {
      _id: mongoose.Schema.Types.ObjectId,
      name: String,
      email: String
    },
    notes: String,
    dropboxPath: String
  }],
  currentUsers: [{
    _id: mongoose.Schema.Types.ObjectId,
    name: String,
    email: String,
    role: String,
    lastAccessed: Date
  }],
  metadata: {
    solutionNumber: String,
    batchNumber: String,
    createdDate: Date,
    completedDate: Date
  }
}, {
  timestamps: true
});

const FileStatus = mongoose.models.FileStatus || mongoose.model('FileStatus', fileStatusSchema);

export default FileStatus;