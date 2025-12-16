const mongoose = require('mongoose');

/**
 * Modelo de Señales Clínicas
 * Motor de detección automática de patrones y señales tempranas
 * Inteligencia Clínica para identificar tendencias, riesgos y oportunidades
 */
const clinicalSignalSchema = new mongoose.Schema({
  // ===== INFORMACIÓN BÁSICA =====

  // Tipo de señal
  signalType: {
    type: String,
    enum: [
      'adverse-event-cluster',       // Cluster de eventos adversos
      'adherence-decline',            // Declive de adherencia
      'efficacy-concern',             // Preocupación de eficacia
      'drug-interaction',             // Interacción medicamentosa
      'unexpected-pattern',           // Patrón inesperado
      'safety-signal',                // Señal de seguridad
      'quality-of-life-deterioration', // Deterioro de calidad de vida
      'hospitalization-risk',         // Riesgo de hospitalización
      'treatment-failure',            // Fallo terapéutico
      'positive-outlier',             // Resultado excepcionalmente bueno
      'cost-opportunity',             // Oportunidad de ahorro
      'intervention-needed'           // Intervención requerida
    ],
    required: true,
    index: true
  },

  // Título descriptivo de la señal
  title: {
    type: String,
    required: true
  },

  // Descripción detallada
  description: {
    type: String,
    required: true
  },

  // ===== DATOS DE LA SEÑAL =====

  // Severidad de la señal
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },

  // Confianza en la señal (0-100)
  confidence: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  },

  // Prioridad (calculada automáticamente)
  priority: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },

  // ===== CONTEXTO CLÍNICO =====

  // Entidades afectadas
  affectedEntities: {
    // Pacientes afectados
    patients: [{
      patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      riskScore: Number,
      contribution: Number  // % contribución a la señal
    }],

    // Medicamentos involucrados
    medications: [{
      medication: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Medication'
      },
      role: String  // 'causative', 'related', 'concurrent'
    }],

    // Condiciones relacionadas
    conditions: [String],

    // Estudios relacionados
    studies: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Study'
    }]
  },

  // ===== DATOS ESTADÍSTICOS =====

  statistics: {
    // Tamaño de la muestra
    sampleSize: {
      type: Number,
      required: true
    },

    // Frecuencia observada
    observedFrequency: Number,

    // Frecuencia esperada (baseline)
    expectedFrequency: Number,

    // Ratio observado/esperado
    reportingOddsRatio: Number,

    // Intervalo de confianza
    confidenceInterval: {
      lower: Number,
      upper: Number
    },

    // P-value (si aplica)
    pValue: Number,

    // Chi-square (si aplica)
    chiSquare: Number,

    // Tendencia temporal
    trend: {
      type: String,
      enum: ['increasing', 'decreasing', 'stable', 'fluctuating'],
      default: 'stable'
    },

    // Velocidad de cambio
    changeRate: Number  // % por unidad de tiempo
  },

  // ===== DETECCIÓN Y ANÁLISIS =====

  detection: {
    // Método de detección
    method: {
      type: String,
      enum: [
        'frequency-analysis',       // Análisis de frecuencias
        'temporal-pattern',         // Patrón temporal
        'bayesian-analysis',        // Análisis bayesiano
        'clustering',               // Clustering
        'anomaly-detection',        // Detección de anomalías
        'regression-analysis',      // Análisis de regresión
        'survival-analysis',        // Análisis de supervivencia
        'propensity-score',         // Propensity score matching
        'rule-based'                // Basado en reglas
      ],
      required: true
    },

    // Algoritmo específico usado
    algorithm: String,

    // Fecha de detección
    detectedAt: {
      type: Date,
      default: Date.now,
      index: true
    },

    // Detectado por (sistema o usuario)
    detectedBy: {
      type: {
        type: String,
        enum: ['automatic', 'manual', 'hybrid']
      },
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    },

    // Período de análisis
    analysisWindow: {
      startDate: Date,
      endDate: Date,
      duration: String  // ej: "90 days", "6 months"
    }
  },

  // ===== EVIDENCIA Y FUNDAMENTO =====

  evidence: {
    // Nivel de evidencia
    level: {
      type: String,
      enum: ['preliminary', 'moderate', 'strong', 'conclusive'],
      default: 'preliminary'
    },

    // Datos de soporte
    supportingData: [{
      type: String,
      description: String,
      source: String,
      date: Date
    }],

    // Referencias bibliográficas
    references: [{
      title: String,
      authors: String,
      journal: String,
      year: Number,
      doi: String,
      pmid: String,
      relevance: String
    }],

    // Casos específicos que apoyan la señal
    supportingCases: [{
      caseId: String,
      patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      description: String,
      date: Date
    }]
  },

  // ===== HIPÓTESIS GENERADA =====

  hypothesis: {
    // Hipótesis principal
    statement: String,

    // Hipótesis alternativas
    alternatives: [String],

    // Mecanismo propuesto
    proposedMechanism: String,

    // Factores de confusión identificados
    confounders: [String],

    // Recomendaciones para validación
    validationSteps: [String]
  },

  // ===== ACCIONES RECOMENDADAS =====

  recommendations: [{
    action: {
      type: String,
      enum: [
        'monitor-closely',              // Monitorizar de cerca
        'clinical-review',              // Revisión clínica
        'adjust-treatment',             // Ajustar tratamiento
        'discontinue-medication',       // Discontinuar medicamento
        'report-to-authorities',        // Reportar a autoridades
        'conduct-study',                // Conducir estudio formal
        'patient-communication',        // Comunicar a pacientes
        'update-protocols',             // Actualizar protocolos
        'consult-specialist',           // Consultar especialista
        'implement-intervention',       // Implementar intervención
        'no-action-needed'              // No requiere acción
      ],
      required: true
    },
    description: String,
    priority: {
      type: String,
      enum: ['immediate', 'urgent', 'routine', 'deferred']
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deadline: Date,
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed', 'dismissed'],
      default: 'pending'
    },
    completedAt: Date
  }],

  // ===== ALERTAS =====

  alerts: [{
    alertType: {
      type: String,
      enum: ['email', 'sms', 'push', 'in-app', 'dashboard']
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    sentAt: Date,
    read: {
      type: Boolean,
      default: false
    },
    readAt: Date
  }],

  // ===== ESTADO Y SEGUIMIENTO =====

  status: {
    type: String,
    enum: [
      'new',              // Recién detectada
      'under-review',     // Bajo revisión
      'confirmed',        // Confirmada
      'false-positive',   // Falso positivo
      'requires-action',  // Requiere acción
      'resolved',         // Resuelta
      'monitoring',       // En monitorización
      'escalated'         // Escalada
    ],
    default: 'new',
    index: true
  },

  // Revisiones realizadas
  reviews: [{
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reviewedAt: {
      type: Date,
      default: Date.now
    },
    assessment: {
      type: String,
      enum: ['confirmed', 'rejected', 'needs-more-data', 'inconclusive']
    },
    notes: String,
    recommendations: String
  }],

  // ===== IMPACTO =====

  impact: {
    // Estimación del impacto clínico
    clinical: {
      type: String,
      enum: ['negligible', 'minor', 'moderate', 'major', 'severe']
    },

    // Número de pacientes potencialmente afectados
    affectedPopulation: Number,

    // Impacto económico estimado
    economic: {
      estimatedCost: Number,
      currency: {
        type: String,
        default: 'EUR'
      },
      costType: String  // 'healthcare-costs', 'lost-productivity', 'hospitalization'
    },

    // Impacto en salud pública
    publicHealth: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    }
  },

  // ===== METADATOS =====

  // Visibilidad
  visibility: {
    type: String,
    enum: ['private', 'team', 'organization', 'public'],
    default: 'team'
  },

  // Reportada a autoridades
  reportedToAuthorities: {
    reported: {
      type: Boolean,
      default: false
    },
    reportDate: Date,
    authority: String,  // 'AEMPS', 'EMA', 'FDA'
    referenceNumber: String
  },

  // Tags para clasificación
  tags: [String],

  // Notas adicionales
  notes: String,

  // Fechas
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  updatedAt: {
    type: Date,
    default: Date.now
  },

  // Fecha de resolución
  resolvedAt: Date
}, {
  timestamps: true,
  collection: 'clinical_signals'
});

// ===== ÍNDICES =====
clinicalSignalSchema.index({ signalType: 1, status: 1 });
clinicalSignalSchema.index({ severity: 1, priority: -1 });
clinicalSignalSchema.index({ 'detection.detectedAt': -1 });
clinicalSignalSchema.index({ 'affectedEntities.patients.patient': 1 });
clinicalSignalSchema.index({ 'affectedEntities.medications.medication': 1 });

// ===== MÉTODOS DE INSTANCIA =====

/**
 * Calcular prioridad automáticamente
 */
clinicalSignalSchema.methods.calculatePriority = function() {
  let priority = 5;

  // Ajustar por severidad
  const severityWeights = {
    'low': 1,
    'medium': 3,
    'high': 5,
    'critical': 7
  };
  priority += severityWeights[this.severity] || 3;

  // Ajustar por confianza
  if (this.confidence >= 90) priority += 2;
  else if (this.confidence >= 75) priority += 1;
  else if (this.confidence < 50) priority -= 1;

  // Ajustar por población afectada
  const affectedCount = this.affectedEntities.patients.length;
  if (affectedCount >= 10) priority += 2;
  else if (affectedCount >= 5) priority += 1;

  // Ajustar por tipo de señal
  if (this.signalType === 'safety-signal' || this.signalType === 'hospitalization-risk') {
    priority += 2;
  }

  // Mantener en rango 1-10
  this.priority = Math.max(1, Math.min(10, priority));
  return this.priority;
};

/**
 * Marcar como revisada
 */
clinicalSignalSchema.methods.markReviewed = async function(userId, assessment, notes = '') {
  this.reviews.push({
    reviewedBy: userId,
    reviewedAt: new Date(),
    assessment,
    notes
  });

  // Actualizar estado según assessment
  if (assessment === 'confirmed') {
    this.status = 'confirmed';
  } else if (assessment === 'rejected') {
    this.status = 'false-positive';
  }

  await this.save();
  return this;
};

/**
 * Enviar alertas
 */
clinicalSignalSchema.methods.sendAlerts = async function(recipients, alertType = 'in-app') {
  for (const recipientId of recipients) {
    this.alerts.push({
      alertType,
      recipient: recipientId,
      sentAt: new Date(),
      read: false
    });
  }

  await this.save();
  return this;
};

/**
 * Añadir recomendación
 */
clinicalSignalSchema.methods.addRecommendation = async function(action, description, priority = 'routine') {
  this.recommendations.push({
    action,
    description,
    priority,
    status: 'pending'
  });

  await this.save();
  return this;
};

/**
 * Resolver señal
 */
clinicalSignalSchema.methods.resolve = async function(resolution = '') {
  this.status = 'resolved';
  this.resolvedAt = new Date();
  this.notes = (this.notes || '') + '\n\nResolución: ' + resolution;

  await this.save();
  return this;
};

/**
 * Escalar señal
 */
clinicalSignalSchema.methods.escalate = async function(reason = '') {
  this.status = 'escalated';
  this.severity = this.severity === 'critical' ? 'critical' :
                  this.severity === 'high' ? 'critical' : 'high';
  this.priority = Math.min(10, this.priority + 2);
  this.notes = (this.notes || '') + '\n\nEscalada: ' + reason;

  await this.save();
  return this;
};

/**
 * Exportar a formato de farmacovigilancia
 */
clinicalSignalSchema.methods.toPharmacvigilanceReport = function() {
  return {
    signalId: this._id.toString(),
    reportDate: this.detection.detectedAt,
    signalType: this.signalType,
    title: this.title,
    description: this.description,
    severity: this.severity,
    confidence: this.confidence,
    affectedPatients: this.affectedEntities.patients.length,
    medications: this.affectedEntities.medications.map(m => m.medication),
    statistics: this.statistics,
    evidence: this.evidence,
    recommendations: this.recommendations,
    status: this.status
  };
};

// ===== MÉTODOS ESTÁTICOS =====

/**
 * Obtener señales activas por severidad
 */
clinicalSignalSchema.statics.getActiveBySeverity = async function(severity) {
  return await this.find({
    severity,
    status: { $in: ['new', 'under-review', 'confirmed', 'requires-action', 'monitoring'] }
  }).sort({ priority: -1, 'detection.detectedAt': -1 });
};

/**
 * Obtener señales críticas sin revisar
 */
clinicalSignalSchema.statics.getCriticalUnreviewed = async function() {
  return await this.find({
    severity: 'critical',
    status: 'new',
    reviews: { $size: 0 }
  }).sort({ 'detection.detectedAt': -1 });
};

/**
 * Obtener señales por paciente
 */
clinicalSignalSchema.statics.getByPatient = async function(patientId) {
  return await this.find({
    'affectedEntities.patients.patient': patientId,
    status: { $ne: 'false-positive' }
  }).sort({ priority: -1 });
};

/**
 * Obtener señales por medicamento
 */
clinicalSignalSchema.statics.getByMedication = async function(medicationId) {
  return await this.find({
    'affectedEntities.medications.medication': medicationId,
    status: { $ne: 'false-positive' }
  }).sort({ priority: -1 });
};

/**
 * Obtener estadísticas de señales
 */
clinicalSignalSchema.statics.getStats = async function(dateRange = {}) {
  const query = {};
  if (dateRange.start && dateRange.end) {
    query['detection.detectedAt'] = {
      $gte: new Date(dateRange.start),
      $lte: new Date(dateRange.end)
    };
  }

  const total = await this.countDocuments(query);
  const bySeverity = await this.aggregate([
    { $match: query },
    { $group: { _id: '$severity', count: { $sum: 1 } } }
  ]);
  const byType = await this.aggregate([
    { $match: query },
    { $group: { _id: '$signalType', count: { $sum: 1 } } }
  ]);
  const byStatus = await this.aggregate([
    { $match: query },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  return {
    total,
    bySeverity,
    byType,
    byStatus,
    critical: await this.countDocuments({ ...query, severity: 'critical' }),
    unreviewed: await this.countDocuments({ ...query, status: 'new' })
  };
};

// ===== MIDDLEWARES =====

clinicalSignalSchema.pre('save', function(next) {
  this.updatedAt = Date.now();

  // Calcular prioridad automáticamente si no está establecida
  if (this.isModified('severity') || this.isModified('confidence') || this.isNew) {
    this.calculatePriority();
  }

  next();
});

module.exports = mongoose.model('ClinicalSignal', clinicalSignalSchema);
