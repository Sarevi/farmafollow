const mongoose = require('mongoose');

/**
 * Modelo para Estudios Observacionales Real World Evidence (RWE)
 * Permite crear cohortes y estudios desde la farmacia comunitaria
 */
const studySchema = new mongoose.Schema({
  // ===== INFORMACIÓN BÁSICA DEL ESTUDIO =====
  title: {
    type: String,
    required: true,
    trim: true
  },

  description: {
    type: String,
    required: true
  },

  // Objetivo del estudio (ej: "Evaluar adherencia en HTA con ARA-II")
  objective: {
    type: String,
    required: true,
    trim: true
  },

  // Tipo de estudio
  studyType: {
    type: String,
    enum: [
      'adherencia',
      'efectividad',
      'seguridad',
      'farmacovigilancia',
      'calidad-vida',
      'patron-uso',
      'coste-efectividad',
      'personalizado'
    ],
    required: true
  },

  // ===== CRITERIOS DE INCLUSIÓN =====
  inclusionCriteria: {
    // Edad
    age: {
      min: {
        type: Number,
        default: null
      },
      max: {
        type: Number,
        default: null
      }
    },

    // Género
    gender: {
      type: String,
      enum: ['todos', 'masculino', 'femenino', 'otro'],
      default: 'todos'
    },

    // Enfermedades específicas
    diseases: [{
      type: String,
      trim: true
    }],

    // Medicamentos específicos
    medications: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medication'
    }],

    // Duración mínima del tratamiento (en días)
    minTreatmentDuration: {
      type: Number,
      default: 0
    },

    // Adherencia mínima requerida (%)
    minAdherence: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },

    // Adherencia máxima (para estudios de baja adherencia)
    maxAdherence: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },

    // Comorbilidades específicas
    comorbidities: [{
      type: String,
      trim: true
    }],

    // Eventos adversos previos
    hasAdverseEvents: {
      type: Boolean,
      default: null // null = no filtrar
    },

    // Pacientes específicos (manual)
    specificPatients: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },

  // ===== CRITERIOS DE EXCLUSIÓN =====
  exclusionCriteria: {
    // Enfermedades que excluyen
    diseases: [{
      type: String,
      trim: true
    }],

    // Medicamentos que excluyen
    medications: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medication'
    }],

    // Alergias medicamentosas
    hasAllergies: {
      type: Boolean,
      default: false
    },

    // Embarazo/lactancia
    pregnantOrLactating: {
      type: Boolean,
      default: false
    }
  },

  // ===== VARIABLES A RECOGER =====
  variables: {
    // Variables demográficas
    demographics: {
      age: { type: Boolean, default: true },
      gender: { type: Boolean, default: true },
      weight: { type: Boolean, default: false },
      height: { type: Boolean, default: false },
      bmi: { type: Boolean, default: false },
      profession: { type: Boolean, default: false },
      socialSupport: { type: Boolean, default: false }
    },

    // Variables clínicas
    clinical: {
      diseases: { type: Boolean, default: true },
      comorbidities: { type: Boolean, default: true },
      allergies: { type: Boolean, default: true },
      diseaseActivity: { type: Boolean, default: false }, // DAS28, HAQ, etc.
      labResults: { type: Boolean, default: false }, // VSG, PCR, etc.
      biomarkers: { type: Boolean, default: false }
    },

    // Variables de tratamiento
    treatment: {
      currentMedications: { type: Boolean, default: true },
      dose: { type: Boolean, default: true },
      frequency: { type: Boolean, default: true },
      duration: { type: Boolean, default: true },
      changes: { type: Boolean, default: true } // cambios de tratamiento
    },

    // Adherencia
    adherence: {
      overall: { type: Boolean, default: true },
      byMedication: { type: Boolean, default: true },
      missedDoses: { type: Boolean, default: true },
      reasonsForNonAdherence: { type: Boolean, default: true }
    },

    // Eventos adversos
    adverseEvents: {
      collect: { type: Boolean, default: true },
      severity: { type: Boolean, default: true },
      causality: { type: Boolean, default: true },
      outcome: { type: Boolean, default: true }
    },

    // Patient-Reported Outcomes (PROs)
    pros: {
      qualityOfLife: { type: Boolean, default: false }, // EQ-5D, SF-36
      painScale: { type: Boolean, default: false },
      fatigue: { type: Boolean, default: false },
      satisfaction: { type: Boolean, default: false },
      functionality: { type: Boolean, default: false }
    },

    // Intervenciones farmacéuticas
    pharmaceuticalInterventions: {
      type: { type: Boolean, default: true },
      outcome: { type: Boolean, default: true },
      impact: { type: Boolean, default: true }
    },

    // Variables económicas
    economic: {
      medicationCosts: { type: Boolean, default: false },
      healthcareVisits: { type: Boolean, default: false },
      hospitalizations: { type: Boolean, default: false },
      productivity: { type: Boolean, default: false }
    }
  },

  // ===== CUESTIONARIOS ASOCIADOS =====
  questionnaires: [{
    questionnaire: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Questionnaire'
    },
    timing: {
      type: String,
      enum: ['baseline', 'follow-up', 'final', 'ad-hoc'],
      default: 'follow-up'
    },
    scheduledAt: Number // días desde inicio
  }],

  // ===== SEGUIMIENTO =====
  followUp: {
    // Puntos de seguimiento (en meses)
    timePoints: [{
      type: Number // ej: 1, 3, 6, 12 meses
    }],

    // Seguimiento automático
    automatic: {
      type: Boolean,
      default: true
    },

    // Notificaciones
    notifications: {
      enabled: { type: Boolean, default: true },
      daysBeforeFollowUp: { type: Number, default: 7 }
    }
  },

  // ===== COHORTE (PACIENTES EN EL ESTUDIO) =====
  cohort: [{
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    // Fecha de inclusión
    enrolledAt: {
      type: Date,
      default: Date.now
    },

    // Baseline (datos al inicio)
    baseline: {
      adherence: Number,
      das28: Number,
      painScale: Number,
      // ... otros datos basales
    },

    // Estado del paciente en el estudio
    status: {
      type: String,
      enum: ['active', 'completed', 'withdrawn', 'lost-to-follow-up'],
      default: 'active'
    },

    // Seguimientos completados
    followUps: [{
      timePoint: Number, // meses
      completedAt: Date,
      data: mongoose.Schema.Types.Mixed, // datos flexibles
      questionnairesCompleted: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'QuestionnaireResponse'
      }]
    }],

    // Motivo de salida (si aplica)
    withdrawalReason: {
      type: String,
      enum: [
        null,
        'efectos-adversos',
        'falta-eficacia',
        'decision-paciente',
        'decision-medico',
        'perdida-seguimiento',
        'cambio-farmacia',
        'exitus',
        'otro'
      ],
      default: null
    },

    withdrawalDate: Date,
    withdrawalNotes: String
  }],

  // ===== ESTADO DEL ESTUDIO =====
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'completed', 'cancelled'],
    default: 'draft'
  },

  // Fechas del estudio
  startDate: {
    type: Date,
    default: null
  },

  endDate: {
    type: Date,
    default: null
  },

  // Duración planificada (meses)
  plannedDuration: {
    type: Number,
    required: true,
    default: 12
  },

  // ===== ESTADÍSTICAS DEL ESTUDIO =====
  stats: {
    // Cohorte
    cohortSize: {
      type: Number,
      default: 0
    },

    targetCohortSize: {
      type: Number,
      default: null // null = sin límite
    },

    // Estado de pacientes
    activePatients: {
      type: Number,
      default: 0
    },

    completedPatients: {
      type: Number,
      default: 0
    },

    withdrawnPatients: {
      type: Number,
      default: 0
    },

    lostToFollowUp: {
      type: Number,
      default: 0
    },

    // Seguimientos
    totalFollowUps: {
      type: Number,
      default: 0
    },

    completedFollowUps: {
      type: Number,
      default: 0
    },

    pendingFollowUps: {
      type: Number,
      default: 0
    },

    // Adherencia
    averageAdherence: {
      type: Number,
      default: null
    },

    // Eventos adversos
    totalAdverseEvents: {
      type: Number,
      default: 0
    },

    unresolvedAdverseEvents: {
      type: Number,
      default: 0
    },

    // Última actualización de stats
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },

  // ===== METADATOS =====
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  investigators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // Tags para búsqueda
  tags: [{
    type: String,
    trim: true
  }],

  // Notas internas
  notes: {
    type: String,
    default: ''
  },

  // ===== CONFIGURACIÓN DE PRIVACIDAD =====
  privacy: {
    // Datos anonimizados
    anonymized: {
      type: Boolean,
      default: true
    },

    // Compartir con industria
    industrySharing: {
      type: Boolean,
      default: false
    },

    // Compartir con academia
    academicSharing: {
      type: Boolean,
      default: false
    }
  }

}, {
  timestamps: true
});

// ===== ÍNDICES =====
studySchema.index({ status: 1 });
studySchema.index({ studyType: 1 });
studySchema.index({ createdBy: 1 });
studySchema.index({ 'cohort.patient': 1 });
studySchema.index({ startDate: 1, endDate: 1 });
studySchema.index({ tags: 1 });

// ===== MÉTODOS DE INSTANCIA =====

/**
 * Genera cohorte automáticamente basada en criterios de inclusión/exclusión
 */
studySchema.methods.generateCohort = async function() {
  try {
    const User = mongoose.model('User');
    const Medication = mongoose.model('Medication');
    const ClinicalHistory = mongoose.model('ClinicalHistory');

    // Construir query de inclusión
    let query = { role: 'patient', isActive: true };

    const criteria = this.inclusionCriteria;

    // Filtro de edad
    if (criteria.age.min !== null || criteria.age.max !== null) {
      const today = new Date();

      if (criteria.age.max !== null) {
        const minBirthDate = new Date(today.getFullYear() - criteria.age.max - 1, today.getMonth(), today.getDate());
        query.dateOfBirth = { $gte: minBirthDate };
      }

      if (criteria.age.min !== null) {
        const maxBirthDate = new Date(today.getFullYear() - criteria.age.min, today.getMonth(), today.getDate());
        if (!query.dateOfBirth) query.dateOfBirth = {};
        query.dateOfBirth.$lte = maxBirthDate;
      }
    }

    // Filtro de género
    if (criteria.gender && criteria.gender !== 'todos') {
      query.gender = criteria.gender;
    }

    // Filtro de enfermedades
    if (criteria.diseases && criteria.diseases.length > 0) {
      query.diseases = { $in: criteria.diseases };
    }

    // Obtener pacientes candidatos
    let candidates = await User.find(query);

    // Filtrar por medicamentos
    if (criteria.medications && criteria.medications.length > 0) {
      const medications = await Medication.find({
        _id: { $in: criteria.medications }
      });

      const patientIdsWithMeds = new Set();
      medications.forEach(med => {
        if (med.patients) {
          med.patients.forEach(pid => patientIdsWithMeds.add(pid.toString()));
        }
      });

      candidates = candidates.filter(c => patientIdsWithMeds.has(c._id.toString()));
    }

    // Filtrar por adherencia
    if (criteria.minAdherence > 0 || criteria.maxAdherence < 100) {
      candidates = candidates.filter(patient => {
        const adherence = patient.calculateAdherence();
        return adherence >= criteria.minAdherence && adherence <= criteria.maxAdherence;
      });
    }

    // Filtrar por eventos adversos
    if (criteria.hasAdverseEvents === true) {
      candidates = candidates.filter(patient =>
        patient.adverseEvents && patient.adverseEvents.length > 0
      );
    } else if (criteria.hasAdverseEvents === false) {
      candidates = candidates.filter(patient =>
        !patient.adverseEvents || patient.adverseEvents.length === 0
      );
    }

    // Aplicar criterios de exclusión
    const exclusion = this.exclusionCriteria;

    if (exclusion.diseases && exclusion.diseases.length > 0) {
      candidates = candidates.filter(patient => {
        return !patient.diseases ||
          !patient.diseases.some(d => exclusion.diseases.includes(d));
      });
    }

    // Pacientes específicos tienen prioridad
    if (criteria.specificPatients && criteria.specificPatients.length > 0) {
      const specificIds = criteria.specificPatients.map(id => id.toString());
      candidates = candidates.filter(c => specificIds.includes(c._id.toString()));
    }

    // Limitar al tamaño objetivo de cohorte si está definido
    if (this.stats.targetCohortSize && candidates.length > this.stats.targetCohortSize) {
      candidates = candidates.slice(0, this.stats.targetCohortSize);
    }

    return candidates;
  } catch (error) {
    console.error('Error generating cohort:', error);
    return [];
  }
};

/**
 * Añade paciente a la cohorte del estudio
 */
studySchema.methods.enrollPatient = async function(patientId, baselineData = {}) {
  // Verificar si ya está en el estudio
  const alreadyEnrolled = this.cohort.some(
    c => c.patient.toString() === patientId.toString()
  );

  if (alreadyEnrolled) {
    throw new Error('Patient already enrolled in this study');
  }

  // Añadir a cohorte
  this.cohort.push({
    patient: patientId,
    enrolledAt: new Date(),
    baseline: baselineData,
    status: 'active'
  });

  await this.updateStats();
  await this.save();

  return this;
};

/**
 * Retirar paciente del estudio
 */
studySchema.methods.withdrawPatient = async function(patientId, reason, notes = '') {
  const patientInCohort = this.cohort.find(
    c => c.patient.toString() === patientId.toString()
  );

  if (!patientInCohort) {
    throw new Error('Patient not found in study cohort');
  }

  patientInCohort.status = 'withdrawn';
  patientInCohort.withdrawalReason = reason;
  patientInCohort.withdrawalDate = new Date();
  patientInCohort.withdrawalNotes = notes;

  await this.updateStats();
  await this.save();

  return this;
};

/**
 * Registrar seguimiento de un paciente
 */
studySchema.methods.recordFollowUp = async function(patientId, timePoint, data, questionnaireResponses = []) {
  const patientInCohort = this.cohort.find(
    c => c.patient.toString() === patientId.toString()
  );

  if (!patientInCohort) {
    throw new Error('Patient not found in study cohort');
  }

  patientInCohort.followUps.push({
    timePoint,
    completedAt: new Date(),
    data,
    questionnairesCompleted: questionnaireResponses
  });

  await this.updateStats();
  await this.save();

  return this;
};

/**
 * Actualizar estadísticas del estudio
 */
studySchema.methods.updateStats = async function() {
  // Tamaño de cohorte
  this.stats.cohortSize = this.cohort.length;

  // Estados de pacientes
  this.stats.activePatients = this.cohort.filter(c => c.status === 'active').length;
  this.stats.completedPatients = this.cohort.filter(c => c.status === 'completed').length;
  this.stats.withdrawnPatients = this.cohort.filter(c => c.status === 'withdrawn').length;
  this.stats.lostToFollowUp = this.cohort.filter(c => c.status === 'lost-to-follow-up').length;

  // Seguimientos
  let totalFollowUps = 0;
  let completedFollowUps = 0;

  this.cohort.forEach(patient => {
    if (patient.status === 'active') {
      totalFollowUps += this.followUp.timePoints.length;
      completedFollowUps += patient.followUps.length;
    }
  });

  this.stats.totalFollowUps = totalFollowUps;
  this.stats.completedFollowUps = completedFollowUps;
  this.stats.pendingFollowUps = totalFollowUps - completedFollowUps;

  // Adherencia promedio
  if (this.cohort.length > 0) {
    const User = mongoose.model('User');
    const patientIds = this.cohort.map(c => c.patient);
    const patients = await User.find({ _id: { $in: patientIds } });

    const adherenceRates = patients.map(p => p.calculateAdherence());
    this.stats.averageAdherence = Math.round(
      adherenceRates.reduce((sum, rate) => sum + rate, 0) / adherenceRates.length
    );

    // Eventos adversos
    let totalAE = 0;
    let unresolvedAE = 0;

    patients.forEach(p => {
      if (p.adverseEvents && p.adverseEvents.length > 0) {
        totalAE += p.adverseEvents.length;
        unresolvedAE += p.adverseEvents.filter(ae => !ae.resolved).length;
      }
    });

    this.stats.totalAdverseEvents = totalAE;
    this.stats.unresolvedAdverseEvents = unresolvedAE;
  }

  this.stats.lastUpdated = new Date();

  return this;
};

/**
 * Activar estudio
 */
studySchema.methods.activate = async function() {
  if (this.status !== 'draft') {
    throw new Error('Only draft studies can be activated');
  }

  this.status = 'active';
  this.startDate = new Date();

  await this.save();

  return this;
};

/**
 * Completar estudio
 */
studySchema.methods.complete = async function() {
  this.status = 'completed';
  this.endDate = new Date();

  // Marcar todos los pacientes activos como completados
  this.cohort.forEach(patient => {
    if (patient.status === 'active') {
      patient.status = 'completed';
    }
  });

  await this.updateStats();
  await this.save();

  return this;
};

/**
 * Exportar datos del estudio (anonimizados si aplica)
 */
studySchema.methods.exportData = async function(format = 'json') {
  const User = mongoose.model('User');
  const ClinicalHistory = mongoose.model('ClinicalHistory');

  const patientIds = this.cohort.map(c => c.patient);
  const patients = await User.find({ _id: { $in: patientIds } })
    .populate('adherence.medication')
    .populate('adverseEvents.medication');

  const exportData = {
    study: {
      title: this.title,
      objective: this.objective,
      studyType: this.studyType,
      startDate: this.startDate,
      endDate: this.endDate,
      cohortSize: this.stats.cohortSize
    },
    patients: []
  };

  // Exportar datos de cada paciente
  for (const patient of patients) {
    const patientInCohort = this.cohort.find(
      c => c.patient.toString() === patient._id.toString()
    );

    const patientData = {
      // ID anonimizado
      studyId: this.privacy.anonymized ? `P${this.cohort.indexOf(patientInCohort) + 1}` : patient._id,

      // Demographics (si están en variables)
      demographics: {},

      // Clinical data
      clinical: {},

      // Adherence
      adherence: {},

      // Adverse events
      adverseEvents: [],

      // Follow-ups
      followUps: patientInCohort.followUps
    };

    // Agregar solo las variables seleccionadas
    if (this.variables.demographics.age && patient.dateOfBirth) {
      patientData.demographics.age = patient.getAge();
    }

    if (this.variables.demographics.gender) {
      patientData.demographics.gender = patient.gender;
    }

    if (this.variables.adherence.overall) {
      patientData.adherence.overall = patient.calculateAdherence();
    }

    if (this.variables.adverseEvents.collect && patient.adverseEvents) {
      patientData.adverseEvents = patient.adverseEvents.map(ae => ({
        event: ae.event,
        severity: this.variables.adverseEvents.severity ? ae.severity : undefined,
        date: ae.date,
        resolved: ae.resolved
      }));
    }

    exportData.patients.push(patientData);
  }

  return exportData;
};

// ===== MÉTODOS ESTÁTICOS =====

/**
 * Obtener estudios activos
 */
studySchema.statics.getActiveStudies = function() {
  return this.find({ status: 'active' })
    .populate('createdBy', 'name email')
    .populate('cohort.patient', 'name email')
    .sort({ startDate: -1 });
};

/**
 * Obtener estadísticas globales de todos los estudios
 */
studySchema.statics.getGlobalStats = async function() {
  const pipeline = [
    {
      $group: {
        _id: null,
        totalStudies: { $sum: 1 },
        activeStudies: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        completedStudies: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        totalCohortSize: { $sum: '$stats.cohortSize' },
        averageAdherence: { $avg: '$stats.averageAdherence' }
      }
    }
  ];

  const results = await this.aggregate(pipeline);
  return results[0] || {};
};

// ===== VIRTUALS =====

// Tasa de retención
studySchema.virtual('retentionRate').get(function() {
  if (this.stats.cohortSize === 0) return 100;

  const retained = this.stats.activePatients + this.stats.completedPatients;
  return Math.round((retained / this.stats.cohortSize) * 100);
});

// Tasa de completitud de seguimientos
studySchema.virtual('followUpCompletionRate').get(function() {
  if (this.stats.totalFollowUps === 0) return 100;

  return Math.round((this.stats.completedFollowUps / this.stats.totalFollowUps) * 100);
});

// Incluir virtuals en JSON
studySchema.set('toJSON', { virtuals: true });
studySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Study', studySchema);
