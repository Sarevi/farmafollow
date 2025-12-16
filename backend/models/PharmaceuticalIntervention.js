const mongoose = require('mongoose');

/**
 * Modelo para Intervenciones Farmacéuticas
 * Registra todas las intervenciones realizadas por el farmacéutico
 * Clave para el timeline clínico y para medir impacto RWE
 */
const pharmaceuticalInterventionSchema = new mongoose.Schema({
  // ===== INFORMACIÓN BÁSICA =====
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Medicamento relacionado (opcional)
  medication: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medication',
    default: null
  },

  // Farmacéutico que realiza la intervención
  pharmacist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Fecha de la intervención
  interventionDate: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },

  // ===== TIPO DE INTERVENCIÓN =====
  type: {
    type: String,
    enum: [
      'educacion-paciente',           // Educación sobre medicamento/enfermedad
      'ajuste-pauta',                 // Modificación de dosis/frecuencia
      'derivacion-medico',            // Derivación al médico
      'derivacion-urgencias',         // Derivación a urgencias
      'cambio-medicamento',           // Sugerencia de cambio de medicamento
      'interaccion-medicamentosa',    // Detección de interacción
      'adherencia',                   // Intervención para mejorar adherencia
      'evento-adverso',               // Gestión de evento adverso
      'optimizacion-tratamiento',     // Optimización de terapia
      'seguimiento-clinico',          // Seguimiento de parámetros clínicos
      'conciliacion-medicacion',      // Conciliación de medicación
      'deshabituacion-tabaquica',     // Cesación tabáquica
      'nutricion',                    // Consejo nutricional
      'administracion-vacuna',        // Vacunación
      'servicio-profesional',         // Otros servicios profesionales
      'otra'
    ],
    required: true,
    index: true
  },

  // Subtipo (más específico)
  subtype: {
    type: String,
    default: ''
  },

  // ===== TRIGGER / MOTIVO =====
  trigger: {
    type: String,
    enum: [
      'adherencia-baja',
      'evento-adverso',
      'falta-eficacia',
      'interaccion-detectada',
      'duplicidad-terapeutica',
      'dosis-inadecuada',
      'contraindicacion',
      'solicitud-paciente',
      'seguimiento-programado',
      'alerta-sistema',
      'revision-tratamiento',
      'otro'
    ],
    required: true
  },

  triggerDetails: {
    type: String,
    default: ''
  },

  // ===== PROBLEMA IDENTIFICADO =====
  problem: {
    // Descripción del problema
    description: {
      type: String,
      required: true
    },

    // Gravedad del problema
    severity: {
      type: String,
      enum: ['leve', 'moderada', 'grave', 'critica'],
      default: 'moderada'
    },

    // Categoría del problema (según clasificación PCNE)
    category: {
      type: String,
      enum: [
        'necesidad-no-cubierta',
        'efectividad-insuficiente',
        'seguridad',
        'adherencia',
        'logistica',
        'otro'
      ],
      default: 'otro'
    }
  },

  // ===== ACCIÓN REALIZADA =====
  action: {
    // Descripción de la acción
    description: {
      type: String,
      required: true
    },

    // Tipo de acción
    actionType: {
      type: String,
      enum: [
        'educacion-verbal',
        'educacion-escrita',
        'modificacion-pauta',
        'cambio-medicamento',
        'derivacion',
        'seguimiento-establecido',
        'contacto-medico',
        'suspension-medicamento',
        'dispositivo-adherencia',
        'plan-personalizado',
        'otra'
      ],
      required: true
    },

    // Material entregado
    materialProvided: [{
      type: String
    }],

    // Tiempo invertido (minutos)
    timeSpent: {
      type: Number,
      default: null
    }
  },

  // ===== RESULTADO ESPERADO =====
  expectedOutcome: {
    type: String,
    required: true
  },

  // ===== RESULTADO OBTENIDO =====
  outcome: {
    // Estado del seguimiento
    status: {
      type: String,
      enum: ['pendiente', 'en-seguimiento', 'resuelto', 'no-resuelto', 'no-evaluable'],
      default: 'pendiente'
    },

    // Descripción del resultado
    description: {
      type: String,
      default: ''
    },

    // Fecha de evaluación
    evaluatedAt: {
      type: Date,
      default: null
    },

    // Éxito de la intervención
    successful: {
      type: Boolean,
      default: null
    },

    // Razón si no fue exitosa
    reasonIfUnsuccessful: {
      type: String,
      default: ''
    }
  },

  // ===== IMPACTO MEDIDO =====
  impact: {
    // Impacto en adherencia
    adherence: {
      before: Number, // % adherencia antes
      after: Number,  // % adherencia después
      improvement: Number // % mejora
    },

    // Impacto en eventos adversos
    adverseEvents: {
      resolved: Boolean,
      prevented: Boolean,
      reduced: Boolean
    },

    // Impacto en parámetros clínicos
    clinical: {
      parameter: String, // ej: "presión arterial", "DAS28", "dolor"
      before: String,
      after: String,
      improved: Boolean
    },

    // Impacto económico estimado
    economic: {
      costSaved: Number, // euros ahorrados
      hospitalizationPrevented: Boolean,
      emergencyVisitPrevented: Boolean
    },

    // Satisfacción del paciente
    patientSatisfaction: {
      type: Number,
      min: 1,
      max: 10,
      default: null
    }
  },

  // ===== SEGUIMIENTO =====
  followUp: {
    // ¿Requiere seguimiento?
    required: {
      type: Boolean,
      default: false
    },

    // Fecha planificada de seguimiento
    plannedDate: {
      type: Date,
      default: null
    },

    // Seguimientos realizados
    visits: [{
      date: Date,
      notes: String,
      status: {
        type: String,
        enum: ['mejorado', 'estable', 'empeorado', 'no-evaluable']
      }
    }]
  },

  // ===== RELACIÓN CON ESTUDIOS =====
  relatedStudies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Study'
  }],

  // ===== COMUNICACIÓN CON OTROS PROFESIONALES =====
  professionalCommunication: {
    // ¿Se comunicó con el médico?
    medicCommunicated: {
      type: Boolean,
      default: false
    },

    communicationDate: Date,

    communicationMethod: {
      type: String,
      enum: ['telefono', 'email', 'presencial', 'informe-escrito', 'receta', 'no-aplica'],
      default: 'no-aplica'
    },

    response: {
      type: String,
      default: ''
    },

    // ¿Se aceptó la recomendación?
    recommendationAccepted: {
      type: Boolean,
      default: null
    }
  },

  // ===== EVIDENCIA Y REFERENCIAS =====
  evidence: {
    // Referencias bibliográficas utilizadas
    references: [{
      type: String
    }],

    // Guías clínicas consultadas
    guidelines: [{
      type: String
    }],

    // Fichas técnicas consultadas
    technicalSheets: [{
      type: String
    }]
  },

  // ===== METADATOS =====

  // Notas adicionales
  notes: {
    type: String,
    default: ''
  },

  // Tags para búsqueda y análisis
  tags: [{
    type: String,
    trim: true
  }],

  // Prioridad
  priority: {
    type: String,
    enum: ['baja', 'normal', 'alta', 'urgente'],
    default: 'normal'
  },

  // Estado (para workflow)
  status: {
    type: String,
    enum: ['activa', 'completada', 'cancelada'],
    default: 'activa',
    index: true
  },

  // ===== PRIVACIDAD Y CONSENTIMIENTO =====
  privacy: {
    // Paciente ha dado consentimiento para uso en investigación
    researchConsent: {
      type: Boolean,
      default: false
    },

    // Datos anonimizados
    anonymized: {
      type: Boolean,
      default: true
    }
  }

}, {
  timestamps: true
});

// ===== ÍNDICES =====
pharmaceuticalInterventionSchema.index({ patient: 1, interventionDate: -1 });
pharmaceuticalInterventionSchema.index({ pharmacist: 1, interventionDate: -1 });
pharmaceuticalInterventionSchema.index({ type: 1 });
pharmaceuticalInterventionSchema.index({ 'outcome.status': 1 });
pharmaceuticalInterventionSchema.index({ status: 1 });
pharmaceuticalInterventionSchema.index({ tags: 1 });

// ===== MÉTODOS DE INSTANCIA =====

/**
 * Evaluar resultado de la intervención
 */
pharmaceuticalInterventionSchema.methods.evaluateOutcome = async function(
  successful,
  description,
  impactData = {}
) {
  this.outcome.status = successful ? 'resuelto' : 'no-resuelto';
  this.outcome.successful = successful;
  this.outcome.description = description;
  this.outcome.evaluatedAt = new Date();

  if (!successful && impactData.reason) {
    this.outcome.reasonIfUnsuccessful = impactData.reason;
  }

  // Actualizar impacto
  if (impactData.adherence) {
    this.impact.adherence = impactData.adherence;
  }

  if (impactData.adverseEvents) {
    this.impact.adverseEvents = impactData.adverseEvents;
  }

  if (impactData.clinical) {
    this.impact.clinical = impactData.clinical;
  }

  if (impactData.economic) {
    this.impact.economic = impactData.economic;
  }

  if (impactData.patientSatisfaction) {
    this.impact.patientSatisfaction = impactData.patientSatisfaction;
  }

  // Si está resuelta, marcar como completada
  if (successful && !this.followUp.required) {
    this.status = 'completada';
  }

  await this.save();

  return this;
};

/**
 * Registrar seguimiento
 */
pharmaceuticalInterventionSchema.methods.addFollowUpVisit = async function(
  notes,
  status
) {
  this.followUp.visits.push({
    date: new Date(),
    notes,
    status
  });

  this.outcome.status = 'en-seguimiento';

  await this.save();

  return this;
};

/**
 * Completar intervención
 */
pharmaceuticalInterventionSchema.methods.complete = async function() {
  this.status = 'completada';
  await this.save();
  return this;
};

/**
 * Cancelar intervención
 */
pharmaceuticalInterventionSchema.methods.cancel = async function(reason = '') {
  this.status = 'cancelada';
  this.notes += `\n[Cancelada: ${reason}]`;
  await this.save();
  return this;
};

// ===== MÉTODOS ESTÁTICOS =====

/**
 * Obtener intervenciones de un paciente (para timeline)
 */
pharmaceuticalInterventionSchema.statics.getPatientTimeline = async function(
  patientId,
  options = {}
) {
  const { startDate, endDate, limit } = options;

  let query = { patient: patientId };

  if (startDate || endDate) {
    query.interventionDate = {};
    if (startDate) query.interventionDate.$gte = new Date(startDate);
    if (endDate) query.interventionDate.$lte = new Date(endDate);
  }

  return this.find(query)
    .sort({ interventionDate: -1 })
    .limit(limit || 100)
    .populate('pharmacist', 'name email')
    .populate('medication', 'name activeIngredient')
    .populate('relatedStudies', 'title studyType');
};

/**
 * Obtener intervenciones por tipo
 */
pharmaceuticalInterventionSchema.statics.getByType = function(type, options = {}) {
  const { startDate, endDate, pharmacist } = options;

  let query = { type };

  if (startDate || endDate) {
    query.interventionDate = {};
    if (startDate) query.interventionDate.$gte = new Date(startDate);
    if (endDate) query.interventionDate.$lte = new Date(endDate);
  }

  if (pharmacist) {
    query.pharmacist = pharmacist;
  }

  return this.find(query)
    .sort({ interventionDate: -1 })
    .populate('patient', 'name email')
    .populate('medication', 'name');
};

/**
 * Estadísticas de intervenciones
 */
pharmaceuticalInterventionSchema.statics.getStats = async function(filters = {}) {
  const matchStage = { ...filters };

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalInterventions: { $sum: 1 },
        byType: {
          $push: '$type'
        },
        successfulInterventions: {
          $sum: { $cond: [{ $eq: ['$outcome.successful', true] }, 1, 0] }
        },
        unresolvedInterventions: {
          $sum: { $cond: [{ $eq: ['$outcome.status', 'pendiente'] }, 1, 0] }
        },
        avgTimeSpent: { $avg: '$action.timeSpent' },
        avgPatientSatisfaction: { $avg: '$impact.patientSatisfaction' }
      }
    }
  ];

  const results = await this.aggregate(pipeline);

  if (results.length === 0) {
    return {
      totalInterventions: 0,
      successfulInterventions: 0,
      unresolvedInterventions: 0,
      successRate: 0,
      avgTimeSpent: 0,
      avgPatientSatisfaction: 0,
      byType: {}
    };
  }

  const stats = results[0];

  // Contar por tipo
  const typeCount = {};
  stats.byType.forEach(type => {
    typeCount[type] = (typeCount[type] || 0) + 1;
  });

  return {
    totalInterventions: stats.totalInterventions,
    successfulInterventions: stats.successfulInterventions,
    unresolvedInterventions: stats.unresolvedInterventions,
    successRate: Math.round(
      (stats.successfulInterventions / stats.totalInterventions) * 100
    ),
    avgTimeSpent: Math.round(stats.avgTimeSpent || 0),
    avgPatientSatisfaction: parseFloat((stats.avgPatientSatisfaction || 0).toFixed(1)),
    byType: typeCount
  };
};

/**
 * Obtener impacto total de intervenciones
 */
pharmaceuticalInterventionSchema.statics.getTotalImpact = async function(filters = {}) {
  const matchStage = {
    ...filters,
    'outcome.successful': true
  };

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalInterventions: { $sum: 1 },
        adverseEventsResolved: {
          $sum: { $cond: ['$impact.adverseEvents.resolved', 1, 0] }
        },
        adverseEventsPrevented: {
          $sum: { $cond: ['$impact.adverseEvents.prevented', 1, 0] }
        },
        hospitalizationsPrevented: {
          $sum: { $cond: ['$impact.economic.hospitalizationPrevented', 1, 0] }
        },
        emergencyVisitsPrevented: {
          $sum: { $cond: ['$impact.economic.emergencyVisitPrevented', 1, 0] }
        },
        totalCostSaved: { $sum: '$impact.economic.costSaved' },
        avgAdherenceImprovement: { $avg: '$impact.adherence.improvement' }
      }
    }
  ];

  const results = await this.aggregate(pipeline);

  return results[0] || {
    totalInterventions: 0,
    adverseEventsResolved: 0,
    adverseEventsPrevented: 0,
    hospitalizationsPrevented: 0,
    emergencyVisitsPrevented: 0,
    totalCostSaved: 0,
    avgAdherenceImprovement: 0
  };
};

// ===== VIRTUALS =====

// Duración desde la intervención
pharmaceuticalInterventionSchema.virtual('daysSinceIntervention').get(function() {
  const now = new Date();
  const diff = now - this.interventionDate;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

// ¿Requiere atención?
pharmaceuticalInterventionSchema.virtual('requiresAttention').get(function() {
  return (
    this.status === 'activa' &&
    (this.outcome.status === 'pendiente' || this.priority === 'urgente')
  );
});

// Incluir virtuals en JSON
pharmaceuticalInterventionSchema.set('toJSON', { virtuals: true });
pharmaceuticalInterventionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('PharmaceuticalIntervention', pharmaceuticalInterventionSchema);
