const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre es requerido']
  },
  email: {
    type: String,
    required: [true, 'El email es requerido'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'La contraseña es requerida'],
    minlength: 6
  },
  role: {
    type: String,
    enum: ['patient', 'admin'],
    default: 'patient'
  },
  medication: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medication'
  },
  adherence: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  doseHistory: [{
    medicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medication'
    },
    scheduledTime: Date,
    actualTime: Date,
    status: {
      type: String,
      enum: ['taken', 'missed', 'postponed'],
      default: 'pending'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  reminders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reminder'
  }],
  lastActivity: {
    type: Date,
    default: Date.now
  },
  consultations: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Encriptar contraseña antes de guardar
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Método para verificar contraseña
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Actualizar adherencia
userSchema.methods.updateAdherence = async function() {
  if (this.doseHistory.length === 0) return;
  
  const takenDoses = this.doseHistory.filter(dose => dose.status === 'taken').length;
  this.adherence = Math.round((takenDoses / this.doseHistory.length) * 100);
  await this.save();
};

module.exports = mongoose.model('User', userSchema);