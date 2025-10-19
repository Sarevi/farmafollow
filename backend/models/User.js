const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['patient', 'admin'],
    default: 'patient'
  },
  
  // ===== CAMPOS NUEVOS - FASE 1 =====
  
  // Información demográfica
  dateOfBirth: {
    type: Date,
    default: null
  },
  gender: {
    type: String,
    enum: ['masculino', 'femenino', 'otro', 'prefiero-no-decir', null],
    default: null
  },
  phone: {
    type: String,
    trim: true,
    default: null
  },
  
  // Información clínica
  diseases: [{
    type: String,
    trim: true
  }],
  startDate: {
    type: Date,
    default: Date.now
  },
  
  // Eventos adversos
  adverseEvents: [{
    date: {
      type: Date,
      default: Date.now
    },
    event: {
      type: String,
      required: true
    },
    severity: {
      type: String,
      enum: ['leve', 'moderado', 'grave'],
      default: 'leve'
    },
    medication: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medication'
    },
    action: {
      type: String,
      default: ''
    },
    resolved: {
      type: Boolean,
      default: false
    },
    notes: {
      type: String,
      default: ''
    }
  }],
  
  // Notas del farmacéutico (privadas)
  notes: [{
    date: {
      type: Date,
      default: Date.now
    },
    content: {
      type: String,
      required: true
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // ===== CAMPOS EXISTENTES =====
  
  // Adherencia
  adherence: [{
    date: {
      type: Date,
      default: Date.now
    },
    taken: {
      type: Boolean,
      default: false
    },
    medication: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medication'
    },
    time: String,
    notes: String
  }],
  
  // Historial de dosis
  doseHistory: [{
    medication: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medication'
    },
    takenAt: {
      type: Date,
      default: Date.now
    },
    scheduled: Boolean,
    notes: String
  }],
  
  // Estado
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Fechas de sistema
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware para actualizar updatedAt
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Hash de contraseña antes de guardar
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

// Método para comparar contraseñas
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Método para calcular adherencia
userSchema.methods.calculateAdherence = function(days = 30) {
  if (!this.adherence || this.adherence.length === 0) return 100;
  
  const recentAdherence = this.adherence.slice(-days);
  const taken = recentAdherence.filter(a => a.taken).length;
  
  return recentAdherence.length > 0 
    ? Math.round((taken / recentAdherence.length) * 100)
    : 100;
};

// Método para obtener eventos adversos activos
userSchema.methods.getActiveAdverseEvents = function() {
  return this.adverseEvents.filter(event => !event.resolved);
};

// Método para obtener última dosis
userSchema.methods.getLastDose = function() {
  if (!this.doseHistory || this.doseHistory.length === 0) return null;
  
  const sorted = this.doseHistory.sort((a, b) => b.takenAt - a.takenAt);
  return sorted[0];
};

// Método para obtener edad
userSchema.methods.getAge = function() {
  if (!this.dateOfBirth) return null;
  
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

// Virtual para obtener adherencia calculada
userSchema.virtual('adherenceRate').get(function() {
  return this.calculateAdherence();
});

// Incluir virtuals en JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema);