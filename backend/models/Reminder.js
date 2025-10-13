const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  medication: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medication',
    required: true
  },
  time: {
    type: String,
    required: true
  },
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'biweekly', 'monthly', 'bimonthly'],
    required: true
  },
  message: String,
  isActive: {
    type: Boolean,
    default: true
  },
  nextNotification: Date,
  doseHistory: [{
    scheduledTime: Date,
    actualTime: Date,
    status: {
      type: String,
      enum: ['taken', 'missed', 'postponed']
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Reminder', reminderSchema);