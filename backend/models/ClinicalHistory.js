const mongoose = require('mongoose');

// Modelo para historial clínico completo con seguimiento temporal
const clinicalHistorySchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Fecha del registro (permite seguimiento temporal)
  recordDate: {
    type: Date,
    default: Date.now,
    required: true
  },

  // ===== DATOS DEMOGRÁFICOS =====
  demographics: {
    weight: Number, // kg
    height: Number, // cm
    bmi: Number, // calculado automáticamente
    profession: String,
    employmentStatus: {
      type: String,
      enum: ['empleado', 'desempleado', 'jubilado', 'estudiante', 'otro']
    },
    livingSituation: {
      type: String,
      enum: ['solo', 'familia', 'pareja', 'residencia', 'otro']
    },
    socialSupport: {
      type: String,
      enum: ['alto', 'medio', 'bajo', 'ninguno']
    }
  },

  // ===== HISTORIA CLÍNICA =====
  clinicalHistory: {
    // Artritis Reumatoide específico
    arDiagnosisDate: Date,
    diseaseEvolutionYears: Number,
    rheumatoidFactor: {
      type: String,
      enum: ['positivo', 'negativo', 'no-realizado']
    },
    antiCCP: {
      type: String,
      enum: ['positivo', 'negativo', 'no-realizado']
    },

    // Comorbilidades
    comorbidities: [{
      condition: String,
      diagnosisDate: Date,
      controlled: Boolean,
      notes: String
    }],

    // Alergias medicamentosas
    allergies: [{
      medication: String,
      reaction: String,
      severity: {
        type: String,
        enum: ['leve', 'moderada', 'grave']
      }
    }]
  },

  // ===== TRATAMIENTO ACTUAL =====
  currentTreatment: {
    // FAME (Fármacos Antirreumáticos Modificadores de la Enfermedad)
    fame: [{
      medication: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Medication'
      },
      medicationName: String, // Para medicamentos no en sistema
      dose: String,
      frequency: String,
      startDate: Date,
      route: String // oral, subcutánea, intravenosa, etc.
    }],

    // Biológicos
    biologics: [{
      medication: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Medication'
      },
      medicationName: String,
      type: {
        type: String,
        enum: ['anti-TNF', 'anti-IL6', 'anti-JAK', 'otro']
      },
      dose: String,
      frequency: String,
      startDate: Date,
      route: String
    }],

    // Corticoides
    corticosteroids: [{
      medicationName: String,
      dose: String,
      frequency: String,
      startDate: Date,
      tapering: Boolean, // en descenso
      notes: String
    }],

    // AINEs y Analgésicos
    nsaidsAnalgesics: [{
      medicationName: String,
      dose: String,
      frequency: String,
      indication: String // dolor, inflamación, etc.
    }],

    // Suplementos
    supplements: [{
      name: String, // ácido fólico, calcio, vitamina D, etc.
      dose: String,
      frequency: String
    }],

    // Medicación para comorbilidades
    comorbidityMedication: [{
      condition: String,
      medicationName: String,
      dose: String,
      frequency: String
    }]
  },

  // ===== EVALUACIÓN DE ACTIVIDAD =====
  diseaseActivity: {
    // Articulaciones
    tenderJointsCount: Number, // número de articulaciones dolorosas
    swollenJointsCount: Number, // número de articulaciones inflamadas

    // Rigidez matutina
    morningStiffness: {
      duration: Number, // minutos
      severity: {
        type: String,
        enum: ['leve', 'moderada', 'grave']
      }
    },

    // DAS28 (Disease Activity Score)
    das28: {
      score: Number,
      classification: {
        type: String,
        enum: ['remision', 'baja', 'moderada', 'alta']
      }
    },

    // Marcadores inflamatorios
    labResults: {
      vsg: Number, // VSG - Velocidad de sedimentación globular
      crp: Number, // PCR - Proteína C reactiva
      date: Date
    },

    // HAQ (Health Assessment Questionnaire)
    haq: {
      score: Number, // 0-3
      date: Date
    },

    // Dolor (EVA - Escala Visual Análoga)
    painScale: {
      score: Number, // 0-10
      location: String
    }
  },

  // ===== ADHERENCIA Y EFECTOS ADVERSOS =====
  adherenceEvaluation: {
    overallAdherence: {
      type: String,
      enum: ['excelente', 'buena', 'regular', 'mala']
    },
    adherencePercentage: Number, // 0-100
    reasonsForNonAdherence: [{
      type: String,
      enum: [
        'olvido',
        'efectos-adversos',
        'coste',
        'complejidad',
        'falta-percepcion-beneficio',
        'mejoria-sintomas',
        'miedo-efectos',
        'otro'
      ]
    }],
    currentAdverseEffects: [{
      effect: String,
      severity: {
        type: String,
        enum: ['leve', 'moderado', 'grave']
      },
      relatedMedication: String,
      managementPlan: String
    }],
    questionsAboutMedication: [String]
  },

  // ===== DATOS PARA INVESTIGACIÓN =====
  researchData: {
    // Progresión radiológica
    radiologicalProgression: {
      sharpScore: Number, // Escala Sharp-van der Heijde
      date: Date,
      description: String
    },

    // Biomarcadores
    biomarkers: [{
      name: String,
      value: String,
      unit: String,
      date: Date
    }],

    // Calidad de vida
    qualityOfLife: {
      sf36: { // SF-36 score
        physical: Number,
        mental: Number,
        date: Date
      },
      eq5d: { // EQ-5D score
        score: Number,
        date: Date
      }
    },

    // Costes sanitarios
    healthcareCosts: {
      visits: Number,
      hospitalizations: Number,
      emergencyVisits: Number,
      period: String // mes, año, etc.
    },

    // Variables de resultado
    outcomes: {
      sustainedRemission: Boolean, // remisión sostenida
      das28Below2_6: Boolean,
      acrResponse: {
        type: String,
        enum: ['ACR20', 'ACR50', 'ACR70', 'ninguna']
      },
      structuralDamageProgression: Boolean,
      functionalCapacity: String
    }
  },

  // ===== ANÁLISIS POBLACIONAL =====
  populationAnalysis: {
    arPhenotype: {
      type: String,
      enum: ['seropositiva', 'seronegativa']
    },
    responsePredictor: String,
    cardiovascularRisk: {
      type: String,
      enum: ['bajo', 'moderado', 'alto', 'muy-alto']
    },
    healthcareResourceUse: {
      primaryCareVisits: Number,
      specialistVisits: Number,
      hospitalAdmissions: Number,
      period: String
    }
  },

  // ===== INFORMACIÓN PARA INDUSTRIA (ANONIMIZADA) =====
  industryData: {
    // Solo si el paciente ha dado consentimiento explícito
    consentGiven: {
      type: Boolean,
      default: false
    },
    consentDate: Date,

    prescriptionPatterns: {
      currentLine: Number, // línea de tratamiento actual
      previousTreatments: [{
        medicationName: String,
        startDate: Date,
        endDate: Date,
        reasonForSwitching: String
      }],
      timeToTreatmentStart: Number, // días desde diagnóstico
    },

    treatmentSatisfaction: {
      score: Number, // 0-10
      routePreference: String,
      adherenceBarriers: [String]
    },

    supportServiceUse: [{
      serviceName: String,
      frequency: String,
      satisfaction: Number
    }]
  },

  // ===== NOTAS DEL PROFESIONAL =====
  professionalNotes: {
    clinicalNotes: String,
    pharmacotherapyPlan: String,
    followUpPlan: String,
    interventions: [String],
    objectives: [String]
  },

  // ===== METADATOS =====
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  },

  // Tags para búsqueda y análisis
  tags: [String]

}, {
  timestamps: true
});

// Índices para búsqueda eficiente
clinicalHistorySchema.index({ patient: 1, recordDate: -1 });
clinicalHistorySchema.index({ 'demographics.bmi': 1 });
clinicalHistorySchema.index({ 'diseaseActivity.das28.classification': 1 });
clinicalHistorySchema.index({ isActive: 1 });

// Middleware para calcular IMC antes de guardar
clinicalHistorySchema.pre('save', function(next) {
  if (this.demographics && this.demographics.weight && this.demographics.height) {
    const heightInMeters = this.demographics.height / 100;
    this.demographics.bmi = parseFloat(
      (this.demographics.weight / (heightInMeters * heightInMeters)).toFixed(2)
    );
  }
  next();
});

// Métodos del modelo
clinicalHistorySchema.methods.getEvolutionTrend = function() {
  // Método para obtener tendencias (implementar lógica de comparación)
  return {
    das28Trend: 'stable', // improving, stable, worsening
    adherenceTrend: 'stable',
    weightTrend: 'stable'
  };
};

clinicalHistorySchema.methods.exportToJSON = function() {
  // Método para exportar datos anonimizados
  const exported = this.toObject();

  // Remover información sensible si no hay consentimiento
  if (!this.industryData?.consentGiven) {
    delete exported.industryData;
  }

  return exported;
};

// Método estático para obtener evolución de un paciente
clinicalHistorySchema.statics.getPatientEvolution = async function(patientId, options = {}) {
  const { startDate, endDate, limit } = options;

  let query = { patient: patientId, isActive: true };

  if (startDate || endDate) {
    query.recordDate = {};
    if (startDate) query.recordDate.$gte = new Date(startDate);
    if (endDate) query.recordDate.$lte = new Date(endDate);
  }

  return this.find(query)
    .sort({ recordDate: -1 })
    .limit(limit || 100)
    .populate('recordedBy', 'name')
    .populate('currentTreatment.fame.medication', 'name')
    .populate('currentTreatment.biologics.medication', 'name');
};

// Método estático para análisis poblacional
clinicalHistorySchema.statics.getPopulationStats = async function(filters = {}) {
  const pipeline = [
    { $match: { isActive: true, ...filters } },
    {
      $group: {
        _id: null,
        avgDAS28: { $avg: '$diseaseActivity.das28.score' },
        avgBMI: { $avg: '$demographics.bmi' },
        avgAdherence: { $avg: '$adherenceEvaluation.adherencePercentage' },
        totalRecords: { $sum: 1 }
      }
    }
  ];

  const results = await this.aggregate(pipeline);
  return results[0] || {};
};

module.exports = mongoose.model('ClinicalHistory', clinicalHistorySchema);
