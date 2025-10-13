const mongoose = require('mongoose');

const medicationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre del medicamento es requerido'],
    unique: true
  },
  description: {
    type: String,
    required: [true, 'La descripción es requerida']
  },
  video: {
    url: String,
    description: String,
    duration: Number
  },
  faqs: [{
    question: String,
    answer: String
  }],
  patients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  sideEffectsReports: {
    type: Number,
    default: 0
  },
  adherenceHistory: [Number],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Medication', medicationSchema);