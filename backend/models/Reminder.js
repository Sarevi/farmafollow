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
    required: true,
    validate: {
      validator: function(v) {
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'El formato de hora debe ser HH:MM'
    }
  },
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'biweekly', 'monthly'],
    required: true,
    default: 'daily'
  },
  // Para frecuencia semanal: [0,1,2,3,4,5,6] donde 0=Domingo, 1=Lunes, etc.
  daysOfWeek: [{
    type: Number,
    min: 0,
    max: 6
  }],
  notes: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Historial de dosis (IMPORTANTE: llamado "history" para el frontend)
  history: [{
    timestamp: {
      type: Date,
      default: Date.now,
      required: true
    },
    taken: {
      type: Boolean,
      required: true
    },
    notes: {
      type: String,
      default: ''
    }
  }],
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
reminderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Método para calcular adherencia de este recordatorio
reminderSchema.methods.calculateAdherence = function(days = 30) {
  if (!this.history || this.history.length === 0) return 100;
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const recentHistory = this.history.filter(h => h.timestamp >= cutoffDate);
  
  if (recentHistory.length === 0) return 100;
  
  const taken = recentHistory.filter(h => h.taken).length;
  return Math.round((taken / recentHistory.length) * 100);
};

// Método para obtener próxima notificación
reminderSchema.methods.getNextNotification = function() {
  const now = new Date();
  const [hours, minutes] = this.time.split(':').map(Number);
  
  const next = new Date();
  next.setHours(hours, minutes, 0, 0);
  
  // Si ya pasó hoy, calcular para mañana o siguiente día válido
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  
  // Para frecuencia semanal, encontrar el próximo día válido
  if (this.frequency === 'weekly' && this.daysOfWeek && this.daysOfWeek.length > 0) {
    let attempts = 0;
    while (!this.daysOfWeek.includes(next.getDay()) && attempts < 7) {
      next.setDate(next.getDate() + 1);
      attempts++;
    }
  }
  
  return next;
};

// Virtual para obtener racha actual (días consecutivos)
reminderSchema.virtual('currentStreak').get(function() {
  if (!this.history || this.history.length === 0) return 0;
  
  const sorted = this.history.sort((a, b) => b.timestamp - a.timestamp);
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (let i = 0; i < sorted.length; i++) {
    const recordDate = new Date(sorted[i].timestamp);
    recordDate.setHours(0, 0, 0, 0);
    
    const expectedDate = new Date(today);
    expectedDate.setDate(expectedDate.getDate() - i);
    
    if (recordDate.getTime() === expectedDate.getTime() && sorted[i].taken) {
      streak++;
    } else {
      break;
    }
  }
  
  return streak;
});

// Incluir virtuals en JSON
reminderSchema.set('toJSON', { virtuals: true });
reminderSchema.set('toObject', { virtuals: true });

// Índices para búsquedas rápidas
reminderSchema.index({ user: 1, isActive: 1 });
reminderSchema.index({ user: 1, medication: 1 });
reminderSchema.index({ time: 1, isActive: 1 });

module.exports = mongoose.model('Reminder', reminderSchema);