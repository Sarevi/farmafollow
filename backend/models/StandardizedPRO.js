const mongoose = require('mongoose');

/**
 * Modelo de Patient-Reported Outcomes (PROs) Estandarizados
 * Soporta escalas validadas internacionalmente:
 * - PROMIS (Patient-Reported Outcomes Measurement Information System)
 * - EQ-5D (EuroQol 5 Dimension)
 * - SF-36 (Short Form 36 Health Survey)
 * - HAQ-DI (Health Assessment Questionnaire - Disability Index)
 * - WPAI (Work Productivity and Activity Impairment)
 * - MMAS (Morisky Medication Adherence Scale)
 * - GAD-7 (Generalized Anxiety Disorder 7-item)
 * - PHQ-9 (Patient Health Questionnaire 9-item)
 */
const standardizedPROSchema = new mongoose.Schema({
  // ===== INFORMACIÓN BÁSICA =====
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },

  // Código/ID único del PRO
  code: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Escala estándar utilizada
  standardScale: {
    type: String,
    enum: [
      'PROMIS',           // NIH Patient-Reported Outcomes Measurement Information System
      'EQ-5D-3L',         // EuroQol 5D - 3 levels
      'EQ-5D-5L',         // EuroQol 5D - 5 levels
      'SF-36',            // Short Form 36
      'SF-12',            // Short Form 12
      'HAQ-DI',           // Health Assessment Questionnaire - Disability Index
      'WPAI',             // Work Productivity and Activity Impairment
      'MMAS-4',           // Morisky 4-item
      'MMAS-8',           // Morisky 8-item
      'GAD-7',            // Generalized Anxiety Disorder 7
      'PHQ-9',            // Patient Health Questionnaire 9
      'PHQ-2',            // Patient Health Questionnaire 2
      'FACIT',            // Functional Assessment of Chronic Illness Therapy
      'EORTC-QLQ',        // European Organisation for Research and Treatment of Cancer QoL
      'DLQI',             // Dermatology Life Quality Index
      'BASDAI',           // Bath Ankylosing Spondylitis Disease Activity Index
      'HADS',             // Hospital Anxiety and Depression Scale
      'VAS',              // Visual Analog Scale
      'NRS',              // Numeric Rating Scale
      'Custom'            // Personalizado pero estandarizado localmente
    ],
    required: true,
    index: true
  },

  // Versión de la escala
  version: {
    type: String,
    default: '1.0'
  },

  // Dominio que mide
  domain: {
    type: String,
    enum: [
      'physical-function',        // Función física
      'pain',                     // Dolor
      'fatigue',                  // Fatiga
      'emotional-wellbeing',      // Bienestar emocional
      'cognitive-function',       // Función cognitiva
      'social-function',          // Función social
      'sleep',                    // Sueño
      'anxiety',                  // Ansiedad
      'depression',               // Depresión
      'quality-of-life',          // Calidad de vida general
      'work-productivity',        // Productividad laboral
      'medication-adherence',     // Adherencia a medicación
      'disease-activity',         // Actividad de enfermedad
      'disability',               // Discapacidad
      'symptom-severity',         // Severidad de síntomas
      'treatment-satisfaction',   // Satisfacción con tratamiento
      'global-health',            // Salud global
      'other'
    ],
    required: true,
    index: true
  },

  description: {
    type: String,
    required: true
  },

  // ===== DETALLES DE LA ESCALA =====

  // Número de ítems
  itemCount: {
    type: Number,
    required: true
  },

  // Tiempo estimado de completado (minutos)
  estimatedCompletionTime: {
    type: Number,
    default: 5
  },

  // Rango de puntuación
  scoring: {
    // Mínimo
    min: {
      type: Number,
      required: true
    },
    // Máximo
    max: {
      type: Number,
      required: true
    },
    // Tipo de puntuación
    type: {
      type: String,
      enum: ['sum', 'average', 'weighted', 'algorithm', 'lookup-table'],
      default: 'sum'
    },
    // Dirección de la escala
    direction: {
      type: String,
      enum: ['higher-better', 'lower-better', 'neutral'],
      default: 'higher-better'
    },
    // Punto de corte (si aplica)
    cutoffPoints: [{
      label: String,      // ej: "Normal", "Leve", "Moderado", "Grave"
      min: Number,
      max: Number,
      interpretation: String
    }],
    // Diferencia mínima clínicamente importante (MCID)
    mcid: {
      type: Number,
      default: null
    }
  },

  // ===== ÍTEMS DEL PRO =====
  items: [{
    // ID del ítem (ej: "PROMIS_PAIN_1")
    itemId: {
      type: String,
      required: true
    },

    // Orden de presentación
    order: {
      type: Number,
      required: true
    },

    // Texto de la pregunta
    text: {
      type: String,
      required: true
    },

    // Texto alternativo en otros idiomas
    translations: [{
      language: {
        type: String,
        enum: ['es', 'en', 'ca', 'gl', 'eu', 'pt', 'fr']
      },
      text: String
    }],

    // Tipo de respuesta
    responseType: {
      type: String,
      enum: ['likert', 'visual-analog', 'numeric', 'binary', 'multiple-choice'],
      required: true
    },

    // Opciones de respuesta
    responseOptions: [{
      value: Number,       // Valor numérico
      label: String,       // Etiqueta (ej: "Nunca", "A veces", "Siempre")
      translations: [{
        language: String,
        label: String
      }]
    }],

    // ¿Es obligatorio?
    required: {
      type: Boolean,
      default: true
    },

    // Lógica condicional (skip logic)
    conditionalLogic: {
      enabled: {
        type: Boolean,
        default: false
      },
      // Mostrar solo si...
      showIf: [{
        itemId: String,      // ID del ítem de referencia
        operator: {
          type: String,
          enum: ['equals', 'not-equals', 'greater-than', 'less-than', 'contains']
        },
        value: mongoose.Schema.Types.Mixed
      }]
    },

    // Peso del ítem en el cálculo (si se usa weighted scoring)
    weight: {
      type: Number,
      default: 1
    }
  }],

  // ===== VALIDACIÓN Y PSICOMÉTRICAS =====
  psychometrics: {
    // Fiabilidad (Cronbach's alpha)
    reliability: {
      cronbachAlpha: Number,
      testRetest: Number
    },

    // Validez
    validity: {
      construct: String,    // Descripción de validez de constructo
      criterion: String,    // Descripción de validez de criterio
      content: String       // Descripción de validez de contenido
    },

    // Sensibilidad al cambio
    responsiveness: {
      type: String,
      enum: ['low', 'moderate', 'high'],
      default: null
    },

    // Población validada
    validatedPopulation: [{
      type: String
    }],

    // Idiomas validados
    validatedLanguages: [{
      type: String,
      enum: ['es', 'en', 'ca', 'gl', 'eu', 'pt', 'fr', 'de', 'it']
    }]
  },

  // ===== REFERENCIAS Y LICENCIAS =====
  references: {
    // Publicación original
    originalPublication: {
      citation: String,
      doi: String,
      pmid: String,
      year: Number
    },

    // Publicaciones de validación
    validationStudies: [{
      citation: String,
      doi: String,
      pmid: String,
      population: String
    }],

    // Guías de uso
    userManual: {
      url: String,
      version: String
    }
  },

  // Licencia de uso
  license: {
    type: {
      type: String,
      enum: ['public-domain', 'creative-commons', 'proprietary', 'restricted'],
      default: 'public-domain'
    },
    terms: String,
    requiresPermission: {
      type: Boolean,
      default: false
    },
    contactForPermission: String
  },

  // ===== INTEGRACIÓN CON ESTÁNDARES =====

  // Mapeo a LOINC (para PROs)
  loincCode: {
    type: String,
    default: null,
    index: true
  },

  // Mapeo a OMOP CDM
  omopConceptId: {
    type: Number,
    default: null,
    index: true
  },

  // Compatible con FHIR Questionnaire
  fhirQuestionnaire: {
    url: String,              // Canonical URL
    resourceType: {
      type: String,
      default: 'Questionnaire'
    },
    version: String
  },

  // ===== CONFIGURACIÓN DE USO =====

  // ¿Está activo para uso?
  active: {
    type: Boolean,
    default: true,
    index: true
  },

  // Frecuencia recomendada de administración
  recommendedFrequency: {
    type: String,
    enum: [
      'baseline-only',      // Solo al inicio
      'weekly',
      'biweekly',
      'monthly',
      'quarterly',
      'biannually',
      'annually',
      'as-needed',
      'per-protocol'
    ],
    default: 'monthly'
  },

  // Contexto de uso recomendado
  recommendedContext: [{
    type: String,
    enum: [
      'clinical-trial',
      'rwe-study',
      'routine-care',
      'registry',
      'pharmacovigilance',
      'health-economics',
      'quality-improvement'
    ]
  }],

  // Enfermedades/condiciones para las que se recomienda
  recommendedFor: [{
    condition: String,
    snomedCode: String,
    icd10Code: String
  }],

  // ===== METADATOS =====
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  updatedAt: {
    type: Date,
    default: Date.now
  },

  // Estadísticas de uso
  usageStats: {
    timesUsed: {
      type: Number,
      default: 0
    },
    totalResponses: {
      type: Number,
      default: 0
    },
    averageScore: {
      type: Number,
      default: null
    },
    lastUsed: {
      type: Date,
      default: null
    }
  },

  notes: String
}, {
  timestamps: true,
  collection: 'standardized_pros'
});

// ===== ÍNDICES =====
standardizedPROSchema.index({ standardScale: 1, active: 1 });
standardizedPROSchema.index({ domain: 1, active: 1 });
standardizedPROSchema.index({ code: 1 });

// ===== MÉTODOS DE INSTANCIA =====

/**
 * Calcular puntuación de respuestas
 */
standardizedPROSchema.methods.calculateScore = function(responses) {
  if (!responses || responses.length === 0) {
    return null;
  }

  let score = 0;

  switch (this.scoring.type) {
    case 'sum':
      // Suma simple de valores
      score = responses.reduce((sum, r) => sum + (r.value || 0), 0);
      break;

    case 'average':
      // Promedio
      const validResponses = responses.filter(r => r.value !== null && r.value !== undefined);
      if (validResponses.length === 0) return null;
      score = validResponses.reduce((sum, r) => sum + r.value, 0) / validResponses.length;
      break;

    case 'weighted':
      // Suma ponderada
      score = responses.reduce((sum, r) => {
        const item = this.items.find(i => i.itemId === r.itemId);
        const weight = item?.weight || 1;
        return sum + ((r.value || 0) * weight);
      }, 0);
      break;

    case 'algorithm':
      // Requiere algoritmo específico por escala
      score = this.calculateScaleSpecificScore(responses);
      break;

    case 'lookup-table':
      // Requiere tabla de conversión
      score = this.lookupScore(responses);
      break;

    default:
      score = responses.reduce((sum, r) => sum + (r.value || 0), 0);
  }

  // Asegurar que está en el rango válido
  score = Math.max(this.scoring.min, Math.min(this.scoring.max, score));

  return Math.round(score * 100) / 100; // 2 decimales
};

/**
 * Interpretar puntuación
 */
standardizedPROSchema.methods.interpretScore = function(score) {
  if (score === null || score === undefined) {
    return {
      category: 'unknown',
      interpretation: 'No se pudo calcular la puntuación'
    };
  }

  // Buscar en puntos de corte
  if (this.scoring.cutoffPoints && this.scoring.cutoffPoints.length > 0) {
    for (const cutoff of this.scoring.cutoffPoints) {
      if (score >= cutoff.min && score <= cutoff.max) {
        return {
          category: cutoff.label,
          interpretation: cutoff.interpretation,
          score: score
        };
      }
    }
  }

  // Interpretación genérica basada en percentiles
  const range = this.scoring.max - this.scoring.min;
  const percentile = ((score - this.scoring.min) / range) * 100;

  let category, interpretation;

  if (this.scoring.direction === 'higher-better') {
    if (percentile >= 75) {
      category = 'Excelente';
      interpretation = 'Funcionamiento muy bueno en este dominio';
    } else if (percentile >= 50) {
      category = 'Bueno';
      interpretation = 'Funcionamiento adecuado en este dominio';
    } else if (percentile >= 25) {
      category = 'Regular';
      interpretation = 'Alguna dificultad en este dominio';
    } else {
      category = 'Bajo';
      interpretation = 'Dificultades significativas en este dominio';
    }
  } else if (this.scoring.direction === 'lower-better') {
    if (percentile >= 75) {
      category = 'Grave';
      interpretation = 'Síntomas/dificultades graves';
    } else if (percentile >= 50) {
      category = 'Moderado';
      interpretation = 'Síntomas/dificultades moderadas';
    } else if (percentile >= 25) {
      category = 'Leve';
      interpretation = 'Síntomas/dificultades leves';
    } else {
      category = 'Mínimo';
      interpretation = 'Síntomas/dificultades mínimas o ausentes';
    }
  } else {
    category = 'Neutro';
    interpretation = `Puntuación: ${score}`;
  }

  return {
    category,
    interpretation,
    score,
    percentile: Math.round(percentile)
  };
};

/**
 * Calcular puntuación específica de escala (para algoritmos complejos)
 */
standardizedPROSchema.methods.calculateScaleSpecificScore = function(responses) {
  // Implementaciones específicas según standardScale
  switch (this.standardScale) {
    case 'EQ-5D-3L':
    case 'EQ-5D-5L':
      return this.calculateEQ5DScore(responses);

    case 'HAQ-DI':
      return this.calculateHAQScore(responses);

    case 'SF-36':
      return this.calculateSF36Score(responses);

    // Por defecto, suma simple
    default:
      return responses.reduce((sum, r) => sum + (r.value || 0), 0);
  }
};

/**
 * Calcular EQ-5D (requiere tabla de valores)
 */
standardizedPROSchema.methods.calculateEQ5DScore = function(responses) {
  // EQ-5D tiene 5 dimensiones + VAS
  // Aquí calculamos el índice (simplificado - normalmente usa tablas de valores nacionales)
  const dimensions = responses.slice(0, 5);

  // Estado de salud como string (ej: "11111" = mejor salud)
  const healthState = dimensions.map(r => r.value).join('');

  // Simplificación: usar una fórmula aproximada
  // En producción, se usaría la tabla de valores del país correspondiente
  const sum = dimensions.reduce((s, r) => s + r.value, 0);

  // EQ-5D Index (0-1, donde 1 = salud perfecta)
  // Fórmula simplificada
  const index = 1 - ((sum - 5) / 10);

  return Math.max(0, Math.min(1, index));
};

/**
 * Calcular HAQ-DI
 */
standardizedPROSchema.methods.calculateHAQScore = function(responses) {
  // HAQ tiene 8 categorías, se calcula el promedio de las categorías
  // Cada categoría usa la puntuación más alta de sus ítems
  const categories = {};

  responses.forEach(r => {
    const item = this.items.find(i => i.itemId === r.itemId);
    if (item && item.category) {
      if (!categories[item.category] || r.value > categories[item.category]) {
        categories[item.category] = r.value;
      }
    }
  });

  const categoryScores = Object.values(categories);
  if (categoryScores.length === 0) return 0;

  const average = categoryScores.reduce((sum, s) => sum + s, 0) / categoryScores.length;

  return Math.round(average * 100) / 100;
};

/**
 * Calcular SF-36 (simplificado)
 */
standardizedPROSchema.methods.calculateSF36Score = function(responses) {
  // SF-36 tiene 8 dimensiones
  // Requiere transformaciones y ponderaciones específicas
  // Esta es una implementación simplificada

  const sum = responses.reduce((s, r) => s + (r.value || 0), 0);
  const max = responses.length * 5; // Asumiendo escala 0-5

  // Transformar a escala 0-100
  return Math.round((sum / max) * 100);
};

/**
 * Convertir a FHIR Questionnaire
 */
standardizedPROSchema.methods.toFHIRQuestionnaire = function() {
  return {
    resourceType: 'Questionnaire',
    url: this.fhirQuestionnaire?.url || `http://farmafollow.com/fhir/Questionnaire/${this.code}`,
    version: this.version,
    name: this.code,
    title: this.name,
    status: this.active ? 'active' : 'retired',
    date: this.updatedAt,
    description: this.description,
    code: [{
      system: this.loincCode ? 'http://loinc.org' : 'http://farmafollow.com/pro',
      code: this.loincCode || this.code,
      display: this.name
    }],
    item: this.items.map(item => ({
      linkId: item.itemId,
      text: item.text,
      type: this.mapResponseTypeToFHIR(item.responseType),
      required: item.required,
      answerOption: item.responseOptions?.map(opt => ({
        valueCoding: {
          code: opt.value.toString(),
          display: opt.label
        }
      }))
    }))
  };
};

/**
 * Mapear tipo de respuesta a FHIR
 */
standardizedPROSchema.methods.mapResponseTypeToFHIR = function(responseType) {
  const mapping = {
    'likert': 'choice',
    'visual-analog': 'integer',
    'numeric': 'integer',
    'binary': 'boolean',
    'multiple-choice': 'choice'
  };

  return mapping[responseType] || 'string';
};

/**
 * Registrar uso
 */
standardizedPROSchema.methods.recordUsage = async function() {
  this.usageStats.timesUsed += 1;
  this.usageStats.lastUsed = new Date();
  await this.save();
  return this;
};

/**
 * Registrar respuesta y actualizar estadísticas
 */
standardizedPROSchema.methods.recordResponse = async function(score) {
  this.usageStats.totalResponses += 1;

  // Calcular nueva media móvil
  if (this.usageStats.averageScore === null) {
    this.usageStats.averageScore = score;
  } else {
    const n = this.usageStats.totalResponses;
    this.usageStats.averageScore =
      ((this.usageStats.averageScore * (n - 1)) + score) / n;
  }

  await this.save();
  return this;
};

// ===== MÉTODOS ESTÁTICOS =====

/**
 * Obtener PROs por dominio
 */
standardizedPROSchema.statics.getByDomain = async function(domain) {
  return await this.find({ domain, active: true }).sort({ usageStats.timesUsed: -1 });
};

/**
 * Obtener PROs por escala estándar
 */
standardizedPROSchema.statics.getByStandard = async function(standardScale) {
  return await this.find({ standardScale, active: true });
};

/**
 * Buscar PROs recomendados para una condición
 */
standardizedPROSchema.statics.getRecommendedFor = async function(condition) {
  return await this.find({
    active: true,
    'recommendedFor.condition': { $regex: new RegExp(condition, 'i') }
  });
};

/**
 * Obtener estadísticas globales de PROs
 */
standardizedPROSchema.statics.getGlobalStats = async function() {
  const total = await this.countDocuments({ active: true });
  const byDomain = await this.aggregate([
    { $match: { active: true } },
    { $group: { _id: '$domain', count: { $sum: 1 } } }
  ]);
  const byStandard = await this.aggregate([
    { $match: { active: true } },
    { $group: { _id: '$standardScale', count: { $sum: 1 } } }
  ]);
  const mostUsed = await this.find({ active: true })
    .sort({ 'usageStats.timesUsed': -1 })
    .limit(10)
    .select('name code standardScale usageStats.timesUsed');

  return {
    total,
    byDomain,
    byStandard,
    mostUsed
  };
};

// ===== MIDDLEWARES =====

standardizedPROSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('StandardizedPRO', standardizedPROSchema);
