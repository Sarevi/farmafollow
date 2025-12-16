const mongoose = require('mongoose');

/**
 * Modelo de Terminología Estándar
 * Mapea conceptos locales a estándares internacionales
 * Soporta: SNOMED CT, ICD-10, ATC, MedDRA, LOINC, OMOP CDM
 * Clave para FAIR data y exportación científica
 */
const standardTerminologySchema = new mongoose.Schema({
  // ===== TÉRMINO LOCAL =====
  localTerm: {
    type: String,
    required: true,
    trim: true,
    index: true
  },

  // Descripción local del término
  localDescription: {
    type: String,
    default: ''
  },

  // Dominio del concepto
  domain: {
    type: String,
    enum: [
      'condition',        // Enfermedades/Condiciones
      'medication',       // Medicamentos
      'procedure',        // Procedimientos
      'observation',      // Observaciones/Mediciones
      'measurement',      // Mediciones clínicas
      'adverse-event',    // Eventos adversos
      'intervention',     // Intervenciones farmacéuticas
      'device',           // Dispositivos médicos
      'specimen',         // Muestras biológicas
      'organism',         // Microorganismos
      'substance',        // Sustancias
      'demographic',      // Datos demográficos
      'other'
    ],
    required: true,
    index: true
  },

  // ===== MAPEOS A ESTÁNDARES =====

  // SNOMED CT (Systematized Nomenclature of Medicine - Clinical Terms)
  // Estándar internacional para terminología clínica
  snomedCT: {
    conceptId: {
      type: String,
      default: null,
      index: true
    },
    // Descripción SNOMED
    description: String,
    // Fully Specified Name
    fsn: String,
    // Semantic tag (ej: "disorder", "finding", "procedure")
    semanticTag: String,
    // Confidence del mapeo (0-100)
    mappingConfidence: {
      type: Number,
      min: 0,
      max: 100,
      default: null
    },
    // Fecha del mapeo
    mappedAt: Date,
    // Fuente del mapeo (manual, automático, API)
    mappingSource: {
      type: String,
      enum: ['manual', 'automatic', 'api', 'validated'],
      default: 'manual'
    }
  },

  // ICD-10 (International Classification of Diseases, 10th Revision)
  // Clasificación internacional de enfermedades
  icd10: {
    code: {
      type: String,
      default: null,
      index: true
    },
    description: String,
    // ICD-10-CM (Clinical Modification) - usado en USA
    cmCode: String,
    // Confidence del mapeo
    mappingConfidence: {
      type: Number,
      min: 0,
      max: 100,
      default: null
    },
    mappedAt: Date,
    mappingSource: {
      type: String,
      enum: ['manual', 'automatic', 'api', 'validated'],
      default: 'manual'
    }
  },

  // ATC (Anatomical Therapeutic Chemical Classification)
  // Clasificación de medicamentos
  atc: {
    code: {
      type: String,
      default: null,
      index: true
    },
    description: String,
    // Nivel de clasificación (1-5)
    level: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    // DDD (Defined Daily Dose)
    ddd: {
      value: Number,
      unit: String,
      route: String
    },
    mappingConfidence: {
      type: Number,
      min: 0,
      max: 100,
      default: null
    },
    mappedAt: Date,
    mappingSource: {
      type: String,
      enum: ['manual', 'automatic', 'api', 'validated'],
      default: 'manual'
    }
  },

  // MedDRA (Medical Dictionary for Regulatory Activities)
  // Terminología para eventos adversos y farmacovigilancia
  meddra: {
    // LLT (Lowest Level Term)
    llt: {
      code: String,
      description: String
    },
    // PT (Preferred Term)
    pt: {
      code: {
        type: String,
        index: true
      },
      description: String
    },
    // HLT (High Level Term)
    hlt: {
      code: String,
      description: String
    },
    // HLGT (High Level Group Term)
    hlgt: {
      code: String,
      description: String
    },
    // SOC (System Organ Class)
    soc: {
      code: String,
      description: String
    },
    mappingConfidence: {
      type: Number,
      min: 0,
      max: 100,
      default: null
    },
    mappedAt: Date,
    mappingSource: {
      type: String,
      enum: ['manual', 'automatic', 'api', 'validated'],
      default: 'manual'
    }
  },

  // LOINC (Logical Observation Identifiers Names and Codes)
  // Para mediciones de laboratorio y observaciones clínicas
  loinc: {
    code: {
      type: String,
      default: null,
      index: true
    },
    description: String,
    // Componente (ej: "Glucose")
    component: String,
    // Propiedad (ej: "MCnc" = Mass Concentration)
    property: String,
    // Sistema (ej: "Ser" = Serum)
    system: String,
    // Escala (ej: "Qn" = Quantitative)
    scale: String,
    // Unidades comunes
    commonUnits: [String],
    mappingConfidence: {
      type: Number,
      min: 0,
      max: 100,
      default: null
    },
    mappedAt: Date,
    mappingSource: {
      type: String,
      enum: ['manual', 'automatic', 'api', 'validated'],
      default: 'manual'
    }
  },

  // OMOP CDM (Observational Medical Outcomes Partnership Common Data Model)
  // Modelo de datos común para investigación observacional
  omopCDM: {
    // Concept ID en OMOP
    conceptId: {
      type: Number,
      default: null,
      index: true
    },
    // Nombre del concepto
    conceptName: String,
    // Domain ID (ej: "Condition", "Drug", "Measurement")
    domainId: String,
    // Vocabulary ID (ej: "SNOMED", "RxNorm", "LOINC")
    vocabularyId: String,
    // Concept Class ID (ej: "Clinical Finding", "Ingredient")
    conceptClassId: String,
    // Standard Concept (S = Standard, C = Classification, null = Non-standard)
    standardConcept: {
      type: String,
      enum: ['S', 'C', null],
      default: null
    },
    // Código original en el vocabulario fuente
    conceptCode: String,
    mappingConfidence: {
      type: Number,
      min: 0,
      max: 100,
      default: null
    },
    mappedAt: Date,
    mappingSource: {
      type: String,
      enum: ['manual', 'automatic', 'api', 'validated'],
      default: 'manual'
    }
  },

  // RxNorm (para medicamentos - específico de USA pero usado internacionalmente)
  rxNorm: {
    rxcui: {
      type: String,
      default: null,
      index: true
    },
    description: String,
    // TTY (Term Type): SCD, SBD, GPCK, etc.
    termType: String,
    // Ingrediente activo
    ingredient: String,
    // Dosis
    strength: String,
    // Forma farmacéutica
    doseForm: String,
    mappingConfidence: {
      type: Number,
      min: 0,
      max: 100,
      default: null
    },
    mappedAt: Date,
    mappingSource: {
      type: String,
      enum: ['manual', 'automatic', 'api', 'validated'],
      default: 'manual'
    }
  },

  // UCUM (Unified Code for Units of Measure)
  // Para unidades de medida estandarizadas
  ucum: {
    code: String,
    description: String,
    caseSensitive: Boolean
  },

  // ===== SINÓNIMOS Y TRADUCCIONES =====
  synonyms: [{
    term: String,
    language: {
      type: String,
      enum: ['es', 'en', 'ca', 'gl', 'eu', 'pt', 'fr'],
      default: 'es'
    },
    type: {
      type: String,
      enum: ['synonym', 'abbreviation', 'full-name', 'trade-name'],
      default: 'synonym'
    }
  }],

  // ===== METADATOS =====
  // Estado de validación
  validationStatus: {
    type: String,
    enum: ['pending', 'validated', 'rejected', 'needs-review'],
    default: 'pending',
    index: true
  },

  // Validado por (farmacéutico, médico, etc.)
  validatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  validatedAt: Date,

  // Notas de validación
  validationNotes: String,

  // Uso en el sistema (para priorizar mapeos)
  usageCount: {
    type: Number,
    default: 0
  },

  // Última vez que se usó
  lastUsedAt: Date,

  // ===== FAIR COMPLIANCE =====
  fair: {
    // Findable: ¿Tiene identificadores únicos?
    findable: {
      hasUniqueIdentifiers: {
        type: Boolean,
        default: false
      },
      identifiers: [{
        system: String,  // ej: "SNOMED CT", "ICD-10"
        value: String
      }]
    },

    // Accessible: ¿Es accesible mediante protocolos estándar?
    accessible: {
      accessProtocol: {
        type: String,
        enum: ['REST-API', 'FHIR', 'HL7', 'direct-access'],
        default: 'REST-API'
      },
      requiresAuthentication: {
        type: Boolean,
        default: true
      }
    },

    // Interoperable: ¿Usa vocabularios estándar?
    interoperable: {
      usesStandardVocabularies: {
        type: Boolean,
        default: false
      },
      vocabulariesUsed: [String]
    },

    // Reusable: ¿Tiene licencia y metadatos claros?
    reusable: {
      license: {
        type: String,
        default: 'proprietary'
      },
      hasProvenanceInfo: {
        type: Boolean,
        default: true
      }
    }
  },

  // ===== FECHAS =====
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  updatedAt: {
    type: Date,
    default: Date.now
  },

  // Fuente original del mapeo
  source: {
    type: String,
    default: 'manual-entry'
  },

  // Notas adicionales
  notes: String
}, {
  timestamps: true,
  collection: 'standard_terminologies'
});

// ===== ÍNDICES COMPUESTOS =====
standardTerminologySchema.index({ domain: 1, validationStatus: 1 });
standardTerminologySchema.index({ localTerm: 'text', localDescription: 'text' });
standardTerminologySchema.index({ 'snomedCT.conceptId': 1, domain: 1 });
standardTerminologySchema.index({ 'icd10.code': 1 });
standardTerminologySchema.index({ 'atc.code': 1 });
standardTerminologySchema.index({ 'meddra.pt.code': 1 });

// ===== MÉTODOS DE INSTANCIA =====

/**
 * Obtener el código estándar preferido para exportación
 */
standardTerminologySchema.methods.getPreferredCode = function(standard = 'SNOMED') {
  switch (standard.toUpperCase()) {
    case 'SNOMED':
    case 'SNOMEDCT':
      return this.snomedCT?.conceptId || null;

    case 'ICD10':
    case 'ICD-10':
      return this.icd10?.code || null;

    case 'ATC':
      return this.atc?.code || null;

    case 'MEDDRA':
      return this.meddra?.pt?.code || null;

    case 'LOINC':
      return this.loinc?.code || null;

    case 'OMOP':
    case 'OMOPCDM':
      return this.omopCDM?.conceptId || null;

    case 'RXNORM':
      return this.rxNorm?.rxcui || null;

    default:
      return null;
  }
};

/**
 * Validar mapeo
 */
standardTerminologySchema.methods.validateMapping = async function(userId, notes = '') {
  this.validationStatus = 'validated';
  this.validatedBy = userId;
  this.validatedAt = new Date();
  this.validationNotes = notes;

  await this.save();
  return this;
};

/**
 * Incrementar contador de uso
 */
standardTerminologySchema.methods.recordUsage = async function() {
  this.usageCount += 1;
  this.lastUsedAt = new Date();
  await this.save();
  return this;
};

/**
 * Verificar si tiene mapeo para un estándar específico
 */
standardTerminologySchema.methods.hasMappingFor = function(standard) {
  return this.getPreferredCode(standard) !== null;
};

/**
 * Obtener nivel de completitud de mapeo (0-100)
 */
standardTerminologySchema.methods.getMappingCompleteness = function() {
  const standards = ['snomedCT', 'icd10', 'atc', 'meddra', 'loinc', 'omopCDM'];
  let mapped = 0;

  standards.forEach(std => {
    if (this.hasMappingFor(std)) {
      mapped++;
    }
  });

  return Math.round((mapped / standards.length) * 100);
};

/**
 * Exportar a formato OMOP CDM
 */
standardTerminologySchema.methods.toOMOPFormat = function() {
  return {
    source_code: this.localTerm,
    source_description: this.localDescription,
    source_vocabulary_id: 'Local',
    target_concept_id: this.omopCDM?.conceptId || 0,
    target_concept_name: this.omopCDM?.conceptName || this.localTerm,
    target_vocabulary_id: this.omopCDM?.vocabularyId || 'None',
    target_domain_id: this.omopCDM?.domainId || this.domain,
    target_concept_class_id: this.omopCDM?.conceptClassId || 'Undefined',
    target_standard_concept: this.omopCDM?.standardConcept || null,
    valid_start_date: this.createdAt,
    valid_end_date: null,
    invalid_reason: null
  };
};

/**
 * Exportar a formato FHIR CodeableConcept
 */
standardTerminologySchema.methods.toFHIRCodeableConcept = function() {
  const codings = [];

  // SNOMED CT
  if (this.snomedCT?.conceptId) {
    codings.push({
      system: 'http://snomed.info/sct',
      code: this.snomedCT.conceptId,
      display: this.snomedCT.description || this.localTerm
    });
  }

  // ICD-10
  if (this.icd10?.code) {
    codings.push({
      system: 'http://hl7.org/fhir/sid/icd-10',
      code: this.icd10.code,
      display: this.icd10.description || this.localTerm
    });
  }

  // LOINC
  if (this.loinc?.code) {
    codings.push({
      system: 'http://loinc.org',
      code: this.loinc.code,
      display: this.loinc.description || this.localTerm
    });
  }

  // RxNorm
  if (this.rxNorm?.rxcui) {
    codings.push({
      system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
      code: this.rxNorm.rxcui,
      display: this.rxNorm.description || this.localTerm
    });
  }

  return {
    coding: codings,
    text: this.localDescription || this.localTerm
  };
};

// ===== MÉTODOS ESTÁTICOS =====

/**
 * Buscar mapeo por término local
 */
standardTerminologySchema.statics.findByLocalTerm = async function(term, domain = null) {
  const query = {
    localTerm: { $regex: new RegExp(term, 'i') },
    validationStatus: 'validated'
  };

  if (domain) {
    query.domain = domain;
  }

  return await this.findOne(query);
};

/**
 * Buscar por código estándar
 */
standardTerminologySchema.statics.findByStandardCode = async function(code, standard = 'SNOMED') {
  const query = {};

  switch (standard.toUpperCase()) {
    case 'SNOMED':
    case 'SNOMEDCT':
      query['snomedCT.conceptId'] = code;
      break;
    case 'ICD10':
    case 'ICD-10':
      query['icd10.code'] = code;
      break;
    case 'ATC':
      query['atc.code'] = code;
      break;
    case 'MEDDRA':
      query['meddra.pt.code'] = code;
      break;
    case 'LOINC':
      query['loinc.code'] = code;
      break;
    case 'OMOP':
      query['omopCDM.conceptId'] = parseInt(code);
      break;
    case 'RXNORM':
      query['rxNorm.rxcui'] = code;
      break;
  }

  return await this.findOne(query);
};

/**
 * Obtener mapeos pendientes de validación
 */
standardTerminologySchema.statics.getPendingValidation = async function(domain = null) {
  const query = { validationStatus: 'pending' };
  if (domain) query.domain = domain;

  return await this.find(query).sort({ usageCount: -1, createdAt: -1 });
};

/**
 * Obtener estadísticas de mapeo
 */
standardTerminologySchema.statics.getMappingStats = async function() {
  const total = await this.countDocuments();
  const validated = await this.countDocuments({ validationStatus: 'validated' });
  const pending = await this.countDocuments({ validationStatus: 'pending' });

  const domains = await this.aggregate([
    { $group: { _id: '$domain', count: { $sum: 1 } } }
  ]);

  const standards = {
    snomedCT: await this.countDocuments({ 'snomedCT.conceptId': { $exists: true, $ne: null } }),
    icd10: await this.countDocuments({ 'icd10.code': { $exists: true, $ne: null } }),
    atc: await this.countDocuments({ 'atc.code': { $exists: true, $ne: null } }),
    meddra: await this.countDocuments({ 'meddra.pt.code': { $exists: true, $ne: null } }),
    loinc: await this.countDocuments({ 'loinc.code': { $exists: true, $ne: null } }),
    omopCDM: await this.countDocuments({ 'omopCDM.conceptId': { $exists: true, $ne: null } })
  };

  return {
    total,
    validated,
    pending,
    validationRate: total > 0 ? Math.round((validated / total) * 100) : 0,
    byDomain: domains,
    byStandard: standards
  };
};

/**
 * Crear mapeo automático desde OMOP Athena
 */
standardTerminologySchema.statics.createFromOMOP = async function(omopConcept) {
  const terminology = new this({
    localTerm: omopConcept.concept_name,
    localDescription: omopConcept.concept_name,
    domain: omopConcept.domain_id.toLowerCase(),
    omopCDM: {
      conceptId: omopConcept.concept_id,
      conceptName: omopConcept.concept_name,
      domainId: omopConcept.domain_id,
      vocabularyId: omopConcept.vocabulary_id,
      conceptClassId: omopConcept.concept_class_id,
      standardConcept: omopConcept.standard_concept,
      conceptCode: omopConcept.concept_code,
      mappingSource: 'api',
      mappedAt: new Date()
    },
    validationStatus: 'needs-review',
    source: 'OMOP-Athena'
  });

  await terminology.save();
  return terminology;
};

// ===== MIDDLEWARES =====

standardTerminologySchema.pre('save', function(next) {
  this.updatedAt = Date.now();

  // Actualizar FAIR compliance automáticamente
  const hasIdentifiers = !!(
    this.snomedCT?.conceptId ||
    this.icd10?.code ||
    this.omopCDM?.conceptId
  );

  this.fair.findable.hasUniqueIdentifiers = hasIdentifiers;

  const vocabularies = [];
  if (this.snomedCT?.conceptId) vocabularies.push('SNOMED CT');
  if (this.icd10?.code) vocabularies.push('ICD-10');
  if (this.loinc?.code) vocabularies.push('LOINC');
  if (this.omopCDM?.conceptId) vocabularies.push('OMOP CDM');

  this.fair.interoperable.usesStandardVocabularies = vocabularies.length > 0;
  this.fair.interoperable.vocabulariesUsed = vocabularies;

  next();
});

module.exports = mongoose.model('StandardTerminology', standardTerminologySchema);
