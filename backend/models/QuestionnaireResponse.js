const mongoose = require('mongoose');

const questionnaireResponseSchema = new mongoose.Schema({
  // Referencias
  questionnaire: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Questionnaire',
    required: true
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Respuestas
  responses: [{
    questionId: {
      type: String,
      required: true
    },
    questionText: {
      type: String,
      required: true
    },
    questionType: {
      type: String,
      required: true
    },
    answer: {
      type: mongoose.Schema.Types.Mixed, // Puede ser String, Number, Date, Boolean
      required: true
    },
    // Para respuestas múltiples
    answerText: {
      type: String,
      default: ''
    }
  }],
  
  // Estado
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed'],
    default: 'pending'
  },
  
  // Metadatos
  startedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  timeToComplete: {
    type: Number, // en segundos
    default: null
  },
  
  // Información adicional
  deviceInfo: {
    type: String,
    default: ''
  },
  
  // Notas del farmacéutico sobre esta respuesta
  pharmacistNotes: {
    type: String,
    default: ''
  },
  reviewed: {
    type: Boolean,
    default: false
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
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
questionnaireResponseSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Método para marcar como iniciado
questionnaireResponseSchema.methods.markAsStarted = async function() {
  if (!this.startedAt) {
    this.startedAt = new Date();
    this.status = 'in-progress';
    await this.save();
  }
};

// Método para completar cuestionario
questionnaireResponseSchema.methods.complete = async function() {
  if (this.status !== 'completed') {
    this.completedAt = new Date();
    this.status = 'completed';
    
    // Calcular tiempo de completado
    if (this.startedAt) {
      const seconds = Math.floor((this.completedAt - this.startedAt) / 1000);
      this.timeToComplete = seconds;
    }
    
    await this.save();
    
    // Actualizar estadísticas del cuestionario
    const Questionnaire = mongoose.model('Questionnaire');
    const questionnaire = await Questionnaire.findById(this.questionnaire);
    if (questionnaire) {
      await questionnaire.updateStats();
    }
  }
};

// Método para marcar como revisado
questionnaireResponseSchema.methods.markAsReviewed = async function(reviewerId, notes) {
  this.reviewed = true;
  this.reviewedBy = reviewerId;
  this.reviewedAt = new Date();
  if (notes) {
    this.pharmacistNotes = notes;
  }
  await this.save();
};

// Método para obtener respuesta por ID de pregunta
questionnaireResponseSchema.methods.getAnswerByQuestionId = function(questionId) {
  const response = this.responses.find(r => r.questionId === questionId);
  return response ? response.answer : null;
};

// Método para formatear respuestas para exportación
questionnaireResponseSchema.methods.formatForExport = function() {
  const formatted = {
    patientId: this.patient,
    questionnaireTitle: '', // Se llenará con populate
    completedAt: this.completedAt,
    timeToComplete: this.timeToComplete,
    responses: {}
  };
  
  this.responses.forEach(response => {
    formatted.responses[response.questionText] = response.answerText || response.answer;
  });
  
  return formatted;
};

// Virtual para verificar si está pendiente hace mucho tiempo
questionnaireResponseSchema.virtual('isPendingTooLong').get(function() {
  if (this.status !== 'pending') return false;
  
  const now = new Date();
  const daysSinceCreated = Math.floor((now - this.createdAt) / (1000 * 60 * 60 * 24));
  
  return daysSinceCreated > 7; // Pendiente más de 7 días
});

// Virtual para verificar si necesita revisión
questionnaireResponseSchema.virtual('needsReview').get(function() {
  return this.status === 'completed' && !this.reviewed;
});

// Incluir virtuals en JSON
questionnaireResponseSchema.set('toJSON', { virtuals: true });
questionnaireResponseSchema.set('toObject', { virtuals: true });

// Índices
questionnaireResponseSchema.index({ questionnaire: 1 });
questionnaireResponseSchema.index({ patient: 1 });
questionnaireResponseSchema.index({ status: 1 });
questionnaireResponseSchema.index({ completedAt: 1 });
questionnaireResponseSchema.index({ reviewed: 1 });
questionnaireResponseSchema.index({ createdAt: 1 });

// Índice compuesto para búsquedas comunes
questionnaireResponseSchema.index({ questionnaire: 1, patient: 1 });
questionnaireResponseSchema.index({ status: 1, reviewed: 1 });

module.exports = mongoose.model('QuestionnaireResponse', questionnaireResponseSchema);