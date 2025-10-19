const mongoose = require('mongoose');

const questionnaireSchema = new mongoose.Schema({
  // Información básica
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  
  // Tipo de cuestionario
  type: {
    type: String,
    enum: [
      'adherencia',
      'eventos-adversos',
      'calidad-vida',
      'eficacia',
      'satisfaccion',
      'personalizado'
    ],
    default: 'personalizado'
  },
  
  // Preguntas del cuestionario
  questions: [{
    id: {
      type: String,
      required: true
    },
    text: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['text', 'multiple', 'scale', 'yesno', 'number', 'date'],
      required: true
    },
    options: [{
      type: String
    }],
    required: {
      type: Boolean,
      default: true
    },
    // Para escalas
    scaleMin: {
      type: Number,
      default: 1
    },
    scaleMax: {
      type: Number,
      default: 10
    },
    scaleMinLabel: {
      type: String,
      default: ''
    },
    scaleMaxLabel: {
      type: String,
      default: ''
    }
  }],
  
  // Criterios de asignación
  targetCriteria: {
    // Medicamentos específicos
    medications: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medication'
    }],
    // Enfermedades específicas
    diseases: [{
      type: String
    }],
    // Pacientes específicos
    specificPatients: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    // Si está vacío, se envía a todos
    sendToAll: {
      type: Boolean,
      default: false
    }
  },
  
  // Programación
  schedule: {
    type: {
      type: String,
      enum: ['once', 'daily', 'weekly', 'monthly'],
      default: 'once'
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date,
      default: null
    },
    // Para cuestionarios recurrentes
    lastSent: {
      type: Date,
      default: null
    },
    nextScheduled: {
      type: Date,
      default: null
    }
  },
  
  // Estado
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'completed'],
    default: 'draft'
  },
  
  // Metadatos
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Estadísticas
  stats: {
    sent: {
      type: Number,
      default: 0
    },
    completed: {
      type: Number,
      default: 0
    },
    pending: {
      type: Number,
      default: 0
    },
    averageCompletionTime: {
      type: Number,
      default: 0
    }
  },
  
  // Fechas
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
questionnaireSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Método para obtener pacientes objetivo
questionnaireSchema.methods.getTargetPatients = async function() {
  try {
    const User = mongoose.model('User');
    const Medication = mongoose.model('Medication');
    
    let query = { role: 'patient', isActive: true };
    
    // Si se envía a todos
    if (this.targetCriteria.sendToAll) {
      return await User.find(query);
    }
    
    // Si hay pacientes específicos
    if (this.targetCriteria.specificPatients && this.targetCriteria.specificPatients.length > 0) {
      query._id = { $in: this.targetCriteria.specificPatients };
      return await User.find(query);
    }
    
    // Filtrar por medicamentos o enfermedades
    const conditions = [];
    
    if (this.targetCriteria.medications && this.targetCriteria.medications.length > 0) {
      // Obtener pacientes de esos medicamentos
      const medications = await Medication.find({ 
        _id: { $in: this.targetCriteria.medications }
      });
      
      const patientIds = [];
      medications.forEach(med => {
        if (med.patients) {
          patientIds.push(...med.patients);
        }
      });
      
      if (patientIds.length > 0) {
        conditions.push({ _id: { $in: patientIds } });
      }
    }
    
    if (this.targetCriteria.diseases && this.targetCriteria.diseases.length > 0) {
      conditions.push({ 
        diseases: { $in: this.targetCriteria.diseases }
      });
    }
    
    if (conditions.length > 0) {
      query.$or = conditions;
    } else {
      // Si no hay criterios específicos, no enviar a nadie
      return [];
    }
    
    return await User.find(query);
  } catch (error) {
    console.error('Error getting target patients:', error);
    return [];
  }
};

// Método para actualizar estadísticas
questionnaireSchema.methods.updateStats = async function() {
  try {
    const QuestionnaireResponse = mongoose.model('QuestionnaireResponse');
    
    const responses = await QuestionnaireResponse.find({ 
      questionnaire: this._id 
    });
    
    this.stats.sent = responses.length;
    this.stats.completed = responses.filter(r => r.completedAt).length;
    this.stats.pending = responses.filter(r => !r.completedAt).length;
    
    // Calcular tiempo promedio de completado
    const completedResponses = responses.filter(r => r.timeToComplete);
    if (completedResponses.length > 0) {
      const totalTime = completedResponses.reduce((sum, r) => sum + r.timeToComplete, 0);
      this.stats.averageCompletionTime = Math.round(totalTime / completedResponses.length);
    }
    
    await this.save();
  } catch (error) {
    console.error('Error updating questionnaire stats:', error);
  }
};

// Método para calcular próximo envío programado
questionnaireSchema.methods.calculateNextSchedule = function() {
  if (this.schedule.type === 'once') {
    return null;
  }
  
  const lastSent = this.schedule.lastSent || this.schedule.startDate;
  const next = new Date(lastSent);
  
  switch (this.schedule.type) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
  }
  
  // Verificar si está dentro del rango de fechas
  if (this.schedule.endDate && next > this.schedule.endDate) {
    return null;
  }
  
  return next;
};

// Método para activar cuestionario
questionnaireSchema.methods.activate = async function() {
  this.status = 'active';
  if (!this.schedule.nextScheduled && this.schedule.type !== 'once') {
    this.schedule.nextScheduled = this.calculateNextSchedule();
  }
  await this.save();
};

// Virtual para tasa de respuesta
questionnaireSchema.virtual('responseRate').get(function() {
  if (this.stats.sent === 0) return 0;
  return Math.round((this.stats.completed / this.stats.sent) * 100);
});

// Incluir virtuals en JSON
questionnaireSchema.set('toJSON', { virtuals: true });
questionnaireSchema.set('toObject', { virtuals: true });

// Índices
questionnaireSchema.index({ status: 1 });
questionnaireSchema.index({ type: 1 });
questionnaireSchema.index({ 'schedule.nextScheduled': 1 });
questionnaireSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Questionnaire', questionnaireSchema);