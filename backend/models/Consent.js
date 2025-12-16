const mongoose = require('mongoose');

/**
 * Modelo de Consentimiento Dinámico
 * Cumple con GDPR, HIPAA, ICH-GCP y normativas de protección de datos
 * Permite gestión granular de consentimientos para investigación RWE
 */
const consentSchema = new mongoose.Schema({
  // ===== INFORMACIÓN DEL PACIENTE =====
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // ===== VERSIÓN DEL CONSENTIMIENTO =====
  // Versión del formulario de consentimiento (ej: "1.0", "2.1")
  version: {
    type: String,
    required: true,
    default: '1.0'
  },

  // Idioma del consentimiento
  language: {
    type: String,
    enum: ['es', 'en', 'ca', 'gl', 'eu'],
    default: 'es'
  },

  // ===== ESTADO GENERAL =====
  status: {
    type: String,
    enum: [
      'pending',      // Pendiente de firma
      'granted',      // Otorgado/Firmado
      'withdrawn',    // Retirado/Revocado
      'expired'       // Expirado (si tiene fecha límite)
    ],
    default: 'pending',
    index: true
  },

  // ===== CONSENTIMIENTOS GRANULARES =====
  // Cada propósito puede tener estado independiente
  purposes: {
    // Uso de datos para investigación general RWE
    generalResearch: {
      granted: {
        type: Boolean,
        default: false
      },
      grantedAt: Date,
      withdrawnAt: Date,
      // Información adicional proporcionada al paciente
      informationProvided: {
        type: String,
        default: 'Uso de datos clínicos anonimizados para investigación en salud real'
      }
    },

    // Participación en estudios específicos
    specificStudies: {
      granted: {
        type: Boolean,
        default: false
      },
      grantedAt: Date,
      withdrawnAt: Date,
      // IDs de estudios autorizados
      authorizedStudies: [{
        study: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Study'
        },
        authorizedAt: Date,
        withdrawnAt: Date
      }]
    },

    // Compartir datos con terceros (ej: investigadores externos)
    dataSharing: {
      granted: {
        type: Boolean,
        default: false
      },
      grantedAt: Date,
      withdrawnAt: Date,
      // Restricciones específicas
      restrictions: {
        type: String,
        default: 'Solo datos anonimizados'
      }
    },

    // Exportación de datos para publicaciones científicas
    scientificPublications: {
      granted: {
        type: Boolean,
        default: false
      },
      grantedAt: Date,
      withdrawnAt: Date,
      // Condiciones
      conditions: {
        type: String,
        default: 'Datos completamente anonimizados, sin información identificativa'
      }
    },

    // Contacto para seguimientos adicionales
    contactForFollowUp: {
      granted: {
        type: Boolean,
        default: false
      },
      grantedAt: Date,
      withdrawnAt: Date,
      // Preferencias de contacto
      preferredMethod: {
        type: String,
        enum: ['email', 'phone', 'sms', 'app'],
        default: 'email'
      },
      maxFrequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'as-needed'],
        default: 'monthly'
      }
    },

    // Uso de datos genéticos/biomarcadores (si aplica)
    geneticData: {
      granted: {
        type: Boolean,
        default: false
      },
      grantedAt: Date,
      withdrawnAt: Date
    },

    // Uso de imágenes/vídeos con fines educativos
    educationalMaterials: {
      granted: {
        type: Boolean,
        default: false
      },
      grantedAt: Date,
      withdrawnAt: Date
    },

    // Uso de datos para inteligencia artificial/machine learning
    aiAnalysis: {
      granted: {
        type: Boolean,
        default: false
      },
      grantedAt: Date,
      withdrawnAt: Date,
      details: {
        type: String,
        default: 'Desarrollo de modelos predictivos y algoritmos de señales tempranas'
      }
    }
  },

  // ===== FIRMA Y VALIDACIÓN =====
  signature: {
    // Tipo de firma
    type: {
      type: String,
      enum: ['electronic', 'written', 'verbal', 'click-through'],
      default: 'electronic'
    },

    // Firma electrónica (hash o ID de firma digital)
    signatureData: {
      type: String,
      default: null
    },

    // IP del usuario al firmar
    ipAddress: {
      type: String,
      default: null
    },

    // User Agent (navegador/dispositivo)
    userAgent: {
      type: String,
      default: null
    },

    // Ubicación geográfica (opcional)
    location: {
      type: String,
      default: null
    },

    // Fecha y hora exacta de firma
    signedAt: {
      type: Date,
      default: null
    },

    // Testigo (si aplica - para consentimientos presenciales)
    witness: {
      name: String,
      role: String,
      signature: String,
      date: Date
    }
  },

  // ===== INFORMACIÓN PROPORCIONADA AL PACIENTE =====
  informationProvided: {
    // Documento(s) de información al paciente proporcionados
    documents: [{
      title: String,
      version: String,
      url: String,
      providedAt: Date,
      acknowledged: {
        type: Boolean,
        default: false
      }
    }],

    // Explicación verbal proporcionada
    verbalExplanation: {
      provided: {
        type: Boolean,
        default: false
      },
      providedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      date: Date,
      duration: Number, // minutos
      notes: String
    },

    // Preguntas del paciente y respuestas
    questionsAndAnswers: [{
      question: String,
      answer: String,
      answeredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      date: Date
    }],

    // Confirmación de comprensión
    comprehensionConfirmed: {
      type: Boolean,
      default: false
    }
  },

  // ===== DERECHOS DEL PACIENTE (GDPR) =====
  dataSubjectRights: {
    // Derecho al olvido (Right to be forgotten)
    rightToErasure: {
      requested: {
        type: Boolean,
        default: false
      },
      requestedAt: Date,
      processedAt: Date,
      status: {
        type: String,
        enum: ['not-requested', 'pending', 'completed', 'denied'],
        default: 'not-requested'
      },
      denialReason: String
    },

    // Derecho de acceso (Right to access)
    rightToAccess: {
      lastRequested: Date,
      requests: [{
        requestedAt: Date,
        fulfilledAt: Date,
        dataProvided: String // URL o descripción de datos proporcionados
      }]
    },

    // Derecho a la portabilidad (Right to data portability)
    rightToPortability: {
      lastRequested: Date,
      requests: [{
        requestedAt: Date,
        fulfilledAt: Date,
        format: {
          type: String,
          enum: ['JSON', 'CSV', 'FHIR', 'OMOP-CDM'],
          default: 'JSON'
        },
        downloadUrl: String
      }]
    },

    // Derecho de rectificación (Right to rectification)
    rightToRectification: {
      requests: [{
        field: String,
        oldValue: String,
        newValue: String,
        requestedAt: Date,
        processedAt: Date,
        status: {
          type: String,
          enum: ['pending', 'completed', 'denied']
        }
      }]
    },

    // Derecho de restricción (Right to restriction)
    rightToRestriction: {
      active: {
        type: Boolean,
        default: false
      },
      restrictions: [{
        purpose: String,
        startDate: Date,
        endDate: Date,
        reason: String
      }]
    },

    // Derecho de oposición (Right to object)
    rightToObject: {
      objections: [{
        purpose: String,
        objectedAt: Date,
        reason: String,
        accepted: Boolean
      }]
    }
  },

  // ===== FECHAS Y VALIDEZ =====
  // Fecha de creación del consentimiento
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Fecha de última modificación
  updatedAt: {
    type: Date,
    default: Date.now
  },

  // Fecha de expiración (si aplica)
  expiresAt: {
    type: Date,
    default: null
  },

  // ===== AUDITORÍA =====
  auditTrail: [{
    action: {
      type: String,
      enum: [
        'created',
        'signed',
        'purpose-granted',
        'purpose-withdrawn',
        'modified',
        'expired',
        'fully-withdrawn',
        'data-accessed',
        'data-exported',
        'data-shared'
      ],
      required: true
    },
    purpose: String,  // Propósito específico afectado
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    performedAt: {
      type: Date,
      default: Date.now
    },
    details: String,
    ipAddress: String,
    userAgent: String
  }],

  // ===== METADATOS DE CUMPLIMIENTO =====
  compliance: {
    // Normativas aplicables
    regulations: [{
      type: String,
      enum: ['GDPR', 'HIPAA', 'ICH-GCP', 'LOPD', 'RGPD', 'FDA-21CFR11'],
      default: 'GDPR'
    }],

    // Base legal del procesamiento
    legalBasis: {
      type: String,
      enum: [
        'consent',              // Consentimiento explícito
        'contract',             // Ejecución de contrato
        'legal-obligation',     // Obligación legal
        'vital-interests',      // Intereses vitales
        'public-interest',      // Interés público
        'legitimate-interests'  // Intereses legítimos
      ],
      default: 'consent'
    },

    // Datos de contacto del DPO (Data Protection Officer)
    dpo: {
      name: String,
      email: String,
      phone: String
    },

    // Evaluación de impacto de protección de datos (DPIA)
    dpiaRequired: {
      type: Boolean,
      default: false
    },
    dpiaCompleted: {
      type: Boolean,
      default: false
    },
    dpiaReference: String
  },

  // ===== NOTAS Y OBSERVACIONES =====
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  collection: 'consents'
});

// ===== ÍNDICES =====
consentSchema.index({ patient: 1, status: 1 });
consentSchema.index({ patient: 1, version: 1 });
consentSchema.index({ 'purposes.specificStudies.authorizedStudies.study': 1 });
consentSchema.index({ createdAt: -1 });
consentSchema.index({ expiresAt: 1 });

// ===== MÉTODOS DE INSTANCIA =====

/**
 * Otorgar un consentimiento específico
 */
consentSchema.methods.grantPurpose = async function(purposeName, additionalData = {}) {
  if (!this.purposes[purposeName]) {
    throw new Error(`Propósito desconocido: ${purposeName}`);
  }

  this.purposes[purposeName].granted = true;
  this.purposes[purposeName].grantedAt = new Date();
  this.purposes[purposeName].withdrawnAt = null;

  // Aplicar datos adicionales si los hay
  Object.assign(this.purposes[purposeName], additionalData);

  // Registrar en auditoría
  this.auditTrail.push({
    action: 'purpose-granted',
    purpose: purposeName,
    performedAt: new Date(),
    details: `Consentimiento otorgado para: ${purposeName}`
  });

  this.updatedAt = new Date();
  await this.save();
  return this;
};

/**
 * Retirar un consentimiento específico
 */
consentSchema.methods.withdrawPurpose = async function(purposeName, reason = '') {
  if (!this.purposes[purposeName]) {
    throw new Error(`Propósito desconocido: ${purposeName}`);
  }

  this.purposes[purposeName].granted = false;
  this.purposes[purposeName].withdrawnAt = new Date();

  // Registrar en auditoría
  this.auditTrail.push({
    action: 'purpose-withdrawn',
    purpose: purposeName,
    performedAt: new Date(),
    details: reason || `Consentimiento retirado para: ${purposeName}`
  });

  this.updatedAt = new Date();
  await this.save();
  return this;
};

/**
 * Firmar el consentimiento
 */
consentSchema.methods.sign = async function(signatureData = {}) {
  this.status = 'granted';
  this.signature.signedAt = new Date();
  this.signature.signatureData = signatureData.signature || null;
  this.signature.ipAddress = signatureData.ipAddress || null;
  this.signature.userAgent = signatureData.userAgent || null;
  this.signature.location = signatureData.location || null;

  // Registrar en auditoría
  this.auditTrail.push({
    action: 'signed',
    performedAt: new Date(),
    details: 'Consentimiento firmado por el paciente',
    ipAddress: signatureData.ipAddress,
    userAgent: signatureData.userAgent
  });

  this.updatedAt = new Date();
  await this.save();
  return this;
};

/**
 * Retirar completamente el consentimiento
 */
consentSchema.methods.withdraw = async function(reason = '') {
  this.status = 'withdrawn';

  // Retirar todos los propósitos
  for (const purposeName in this.purposes) {
    if (this.purposes[purposeName].granted) {
      this.purposes[purposeName].granted = false;
      this.purposes[purposeName].withdrawnAt = new Date();
    }
  }

  // Registrar en auditoría
  this.auditTrail.push({
    action: 'fully-withdrawn',
    performedAt: new Date(),
    details: reason || 'Consentimiento retirado completamente por el paciente'
  });

  this.updatedAt = new Date();
  await this.save();
  return this;
};

/**
 * Autorizar un estudio específico
 */
consentSchema.methods.authorizeStudy = async function(studyId) {
  // Asegurar que el propósito de estudios específicos está otorgado
  if (!this.purposes.specificStudies.granted) {
    await this.grantPurpose('specificStudies');
  }

  // Verificar si ya está autorizado
  const existing = this.purposes.specificStudies.authorizedStudies.find(
    s => s.study.toString() === studyId.toString()
  );

  if (!existing) {
    this.purposes.specificStudies.authorizedStudies.push({
      study: studyId,
      authorizedAt: new Date(),
      withdrawnAt: null
    });
  } else if (existing.withdrawnAt) {
    // Reautorizar
    existing.withdrawnAt = null;
    existing.authorizedAt = new Date();
  }

  // Registrar en auditoría
  this.auditTrail.push({
    action: 'purpose-granted',
    purpose: 'specificStudies',
    performedAt: new Date(),
    details: `Estudio autorizado: ${studyId}`
  });

  this.updatedAt = new Date();
  await this.save();
  return this;
};

/**
 * Retirar autorización de un estudio específico
 */
consentSchema.methods.withdrawStudyAuthorization = async function(studyId) {
  const study = this.purposes.specificStudies.authorizedStudies.find(
    s => s.study.toString() === studyId.toString()
  );

  if (study) {
    study.withdrawnAt = new Date();

    // Registrar en auditoría
    this.auditTrail.push({
      action: 'purpose-withdrawn',
      purpose: 'specificStudies',
      performedAt: new Date(),
      details: `Estudio desautorizado: ${studyId}`
    });

    this.updatedAt = new Date();
    await this.save();
  }

  return this;
};

/**
 * Verificar si un estudio está autorizado
 */
consentSchema.methods.isStudyAuthorized = function(studyId) {
  if (!this.purposes.specificStudies.granted) {
    return false;
  }

  const study = this.purposes.specificStudies.authorizedStudies.find(
    s => s.study.toString() === studyId.toString()
  );

  return study && !study.withdrawnAt;
};

/**
 * Verificar si un propósito está otorgado
 */
consentSchema.methods.isPurposeGranted = function(purposeName) {
  if (!this.purposes[purposeName]) {
    return false;
  }

  return this.purposes[purposeName].granted && !this.purposes[purposeName].withdrawnAt;
};

/**
 * Obtener todos los propósitos otorgados
 */
consentSchema.methods.getGrantedPurposes = function() {
  const granted = [];
  for (const purposeName in this.purposes) {
    if (this.isPurposeGranted(purposeName)) {
      granted.push(purposeName);
    }
  }
  return granted;
};

/**
 * Registrar acceso a datos (auditoría GDPR)
 */
consentSchema.methods.logDataAccess = async function(performedBy, details = '') {
  this.auditTrail.push({
    action: 'data-accessed',
    performedBy,
    performedAt: new Date(),
    details: details || 'Acceso a datos del paciente'
  });

  await this.save();
  return this;
};

/**
 * Registrar exportación de datos (auditoría GDPR)
 */
consentSchema.methods.logDataExport = async function(performedBy, details = '') {
  this.auditTrail.push({
    action: 'data-exported',
    performedBy,
    performedAt: new Date(),
    details: details || 'Exportación de datos del paciente'
  });

  await this.save();
  return this;
};

/**
 * Solicitar derecho al olvido (Right to be forgotten)
 */
consentSchema.methods.requestErasure = async function(reason = '') {
  this.dataSubjectRights.rightToErasure.requested = true;
  this.dataSubjectRights.rightToErasure.requestedAt = new Date();
  this.dataSubjectRights.rightToErasure.status = 'pending';

  this.auditTrail.push({
    action: 'data-accessed',
    performedAt: new Date(),
    details: `Solicitud de derecho al olvido: ${reason}`
  });

  this.updatedAt = new Date();
  await this.save();
  return this;
};

/**
 * Verificar si el consentimiento está expirado
 */
consentSchema.methods.isExpired = function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
};

/**
 * Verificar si el consentimiento es válido y activo
 */
consentSchema.methods.isValid = function() {
  return this.status === 'granted' && !this.isExpired();
};

// ===== MÉTODOS ESTÁTICOS =====

/**
 * Obtener consentimiento activo de un paciente
 */
consentSchema.statics.getActiveConsent = async function(patientId) {
  return await this.findOne({
    patient: patientId,
    status: 'granted'
  }).sort({ createdAt: -1 });
};

/**
 * Verificar si un paciente ha otorgado un propósito específico
 */
consentSchema.statics.hasConsent = async function(patientId, purposeName) {
  const consent = await this.getActiveConsent(patientId);
  if (!consent) return false;
  return consent.isPurposeGranted(purposeName);
};

/**
 * Verificar si un paciente ha autorizado un estudio
 */
consentSchema.statics.hasStudyConsent = async function(patientId, studyId) {
  const consent = await this.getActiveConsent(patientId);
  if (!consent) return false;
  return consent.isStudyAuthorized(studyId);
};

/**
 * Crear consentimiento por defecto para un nuevo paciente
 */
consentSchema.statics.createDefault = async function(patientId) {
  const consent = new this({
    patient: patientId,
    version: '1.0',
    status: 'pending',
    auditTrail: [{
      action: 'created',
      performedAt: new Date(),
      details: 'Consentimiento creado automáticamente'
    }]
  });

  await consent.save();
  return consent;
};

// ===== MIDDLEWARES =====

// Actualizar updatedAt antes de guardar
consentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Verificar expiración automáticamente
consentSchema.pre('save', function(next) {
  if (this.isExpired() && this.status === 'granted') {
    this.status = 'expired';
    this.auditTrail.push({
      action: 'expired',
      performedAt: new Date(),
      details: 'Consentimiento expirado automáticamente'
    });
  }
  next();
});

// Virtual para obtener nombre del paciente (para reportes)
consentSchema.virtual('patientName', {
  ref: 'User',
  localField: 'patient',
  foreignField: '_id',
  justOne: true
});

// Incluir virtuals en JSON
consentSchema.set('toJSON', { virtuals: true });
consentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Consent', consentSchema);
