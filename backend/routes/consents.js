const express = require('express');
const router = express.Router();
const Consent = require('../models/Consent');
const User = require('../models/User');
const auth = require('../middleware/auth');

/**
 * RUTAS DE CONSENTIMIENTOS DINÁMICOS
 * Cumplimiento GDPR, HIPAA, ICH-GCP
 */

// ===== CREAR CONSENTIMIENTO =====

/**
 * POST /api/consents
 * Crear un nuevo consentimiento para un paciente
 */
router.post('/', auth, async (req, res) => {
  try {
    const {
      patientId,
      version,
      language,
      purposes,
      informationProvided,
      signature
    } = req.body;

    // Validar que el paciente existe
    const patient = await User.findById(patientId);
    if (!patient || patient.role !== 'patient') {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    // Crear el consentimiento
    const consent = new Consent({
      patient: patientId,
      version: version || '1.0',
      language: language || 'es',
      purposes: purposes || {},
      informationProvided: informationProvided || {},
      signature: signature || {},
      status: 'pending',
      auditTrail: [{
        action: 'created',
        performedBy: req.user.userId,
        performedAt: new Date(),
        details: 'Consentimiento creado',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }]
    });

    await consent.save();

    res.status(201).json({
      success: true,
      data: consent,
      message: 'Consentimiento creado exitosamente'
    });
  } catch (error) {
    console.error('Error creating consent:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear consentimiento',
      error: error.message
    });
  }
});

// ===== FIRMAR CONSENTIMIENTO =====

/**
 * POST /api/consents/:id/sign
 * Firmar un consentimiento
 */
router.post('/:id/sign', auth, async (req, res) => {
  try {
    const consent = await Consent.findById(req.params.id);

    if (!consent) {
      return res.status(404).json({
        success: false,
        message: 'Consentimiento no encontrado'
      });
    }

    // Verificar que el usuario puede firmar este consentimiento
    if (req.user.role === 'patient' && consent.patient.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'No tiene permiso para firmar este consentimiento'
      });
    }

    const signatureData = {
      signature: req.body.signature,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      location: req.body.location
    };

    await consent.sign(signatureData);

    res.json({
      success: true,
      data: consent,
      message: 'Consentimiento firmado exitosamente'
    });
  } catch (error) {
    console.error('Error signing consent:', error);
    res.status(500).json({
      success: false,
      message: 'Error al firmar consentimiento',
      error: error.message
    });
  }
});

// ===== GESTIONAR PROPÓSITOS =====

/**
 * POST /api/consents/:id/purposes/:purposeName/grant
 * Otorgar un propósito específico
 */
router.post('/:id/purposes/:purposeName/grant', auth, async (req, res) => {
  try {
    const consent = await Consent.findById(req.params.id);

    if (!consent) {
      return res.status(404).json({
        success: false,
        message: 'Consentimiento no encontrado'
      });
    }

    const { purposeName } = req.params;
    const additionalData = req.body;

    await consent.grantPurpose(purposeName, additionalData);

    res.json({
      success: true,
      data: consent,
      message: `Consentimiento otorgado para: ${purposeName}`
    });
  } catch (error) {
    console.error('Error granting purpose:', error);
    res.status(500).json({
      success: false,
      message: 'Error al otorgar consentimiento',
      error: error.message
    });
  }
});

/**
 * POST /api/consents/:id/purposes/:purposeName/withdraw
 * Retirar un propósito específico
 */
router.post('/:id/purposes/:purposeName/withdraw', auth, async (req, res) => {
  try {
    const consent = await Consent.findById(req.params.id);

    if (!consent) {
      return res.status(404).json({
        success: false,
        message: 'Consentimiento no encontrado'
      });
    }

    const { purposeName } = req.params;
    const { reason } = req.body;

    await consent.withdrawPurpose(purposeName, reason);

    res.json({
      success: true,
      data: consent,
      message: `Consentimiento retirado para: ${purposeName}`
    });
  } catch (error) {
    console.error('Error withdrawing purpose:', error);
    res.status(500).json({
      success: false,
      message: 'Error al retirar consentimiento',
      error: error.message
    });
  }
});

// ===== GESTIÓN DE ESTUDIOS =====

/**
 * POST /api/consents/:id/studies/:studyId/authorize
 * Autorizar un estudio específico
 */
router.post('/:id/studies/:studyId/authorize', auth, async (req, res) => {
  try {
    const consent = await Consent.findById(req.params.id);

    if (!consent) {
      return res.status(404).json({
        success: false,
        message: 'Consentimiento no encontrado'
      });
    }

    const { studyId } = req.params;

    await consent.authorizeStudy(studyId);

    res.json({
      success: true,
      data: consent,
      message: 'Estudio autorizado exitosamente'
    });
  } catch (error) {
    console.error('Error authorizing study:', error);
    res.status(500).json({
      success: false,
      message: 'Error al autorizar estudio',
      error: error.message
    });
  }
});

/**
 * POST /api/consents/:id/studies/:studyId/withdraw
 * Retirar autorización de un estudio
 */
router.post('/:id/studies/:studyId/withdraw', auth, async (req, res) => {
  try {
    const consent = await Consent.findById(req.params.id);

    if (!consent) {
      return res.status(404).json({
        success: false,
        message: 'Consentimiento no encontrado'
      });
    }

    const { studyId } = req.params;

    await consent.withdrawStudyAuthorization(studyId);

    res.json({
      success: true,
      data: consent,
      message: 'Autorización de estudio retirada'
    });
  } catch (error) {
    console.error('Error withdrawing study authorization:', error);
    res.status(500).json({
      success: false,
      message: 'Error al retirar autorización',
      error: error.message
    });
  }
});

// ===== RETIRADA COMPLETA =====

/**
 * POST /api/consents/:id/withdraw
 * Retirar completamente el consentimiento
 */
router.post('/:id/withdraw', auth, async (req, res) => {
  try {
    const consent = await Consent.findById(req.params.id);

    if (!consent) {
      return res.status(404).json({
        success: false,
        message: 'Consentimiento no encontrado'
      });
    }

    // Verificar permisos
    if (req.user.role === 'patient' && consent.patient.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'No tiene permiso para retirar este consentimiento'
      });
    }

    const { reason } = req.body;

    await consent.withdraw(reason);

    res.json({
      success: true,
      data: consent,
      message: 'Consentimiento retirado completamente'
    });
  } catch (error) {
    console.error('Error withdrawing consent:', error);
    res.status(500).json({
      success: false,
      message: 'Error al retirar consentimiento',
      error: error.message
    });
  }
});

// ===== CONSULTAS =====

/**
 * GET /api/consents/patient/:patientId
 * Obtener consentimiento activo de un paciente
 */
router.get('/patient/:patientId', auth, async (req, res) => {
  try {
    const consent = await Consent.getActiveConsent(req.params.patientId);

    if (!consent) {
      return res.status(404).json({
        success: false,
        message: 'No hay consentimiento activo para este paciente'
      });
    }

    res.json({
      success: true,
      data: consent
    });
  } catch (error) {
    console.error('Error getting consent:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener consentimiento',
      error: error.message
    });
  }
});

/**
 * GET /api/consents/patient/:patientId/all
 * Obtener todos los consentimientos de un paciente (historial)
 */
router.get('/patient/:patientId/all', auth, async (req, res) => {
  try {
    const consents = await Consent.find({ patient: req.params.patientId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: consents,
      count: consents.length
    });
  } catch (error) {
    console.error('Error getting consents:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener consentimientos',
      error: error.message
    });
  }
});

/**
 * GET /api/consents/:id
 * Obtener un consentimiento específico
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const consent = await Consent.findById(req.params.id)
      .populate('patient', 'name email')
      .populate('auditTrail.performedBy', 'name email role');

    if (!consent) {
      return res.status(404).json({
        success: false,
        message: 'Consentimiento no encontrado'
      });
    }

    res.json({
      success: true,
      data: consent
    });
  } catch (error) {
    console.error('Error getting consent:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener consentimiento',
      error: error.message
    });
  }
});

/**
 * GET /api/consents/:id/audit
 * Obtener trazabilidad completa de un consentimiento
 */
router.get('/:id/audit', auth, async (req, res) => {
  try {
    const consent = await Consent.findById(req.params.id)
      .populate('auditTrail.performedBy', 'name email role');

    if (!consent) {
      return res.status(404).json({
        success: false,
        message: 'Consentimiento no encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        consentId: consent._id,
        patient: consent.patient,
        status: consent.status,
        auditTrail: consent.auditTrail,
        createdAt: consent.createdAt,
        updatedAt: consent.updatedAt
      }
    });
  } catch (error) {
    console.error('Error getting audit trail:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener auditoría',
      error: error.message
    });
  }
});

// ===== VERIFICACIÓN DE CONSENTIMIENTOS =====

/**
 * GET /api/consents/check/:patientId/purpose/:purposeName
 * Verificar si un paciente ha otorgado un propósito específico
 */
router.get('/check/:patientId/purpose/:purposeName', auth, async (req, res) => {
  try {
    const { patientId, purposeName } = req.params;

    const hasConsent = await Consent.hasConsent(patientId, purposeName);

    res.json({
      success: true,
      data: {
        patientId,
        purpose: purposeName,
        granted: hasConsent
      }
    });
  } catch (error) {
    console.error('Error checking consent:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar consentimiento',
      error: error.message
    });
  }
});

/**
 * GET /api/consents/check/:patientId/study/:studyId
 * Verificar si un paciente ha autorizado un estudio
 */
router.get('/check/:patientId/study/:studyId', auth, async (req, res) => {
  try {
    const { patientId, studyId } = req.params;

    const hasConsent = await Consent.hasStudyConsent(patientId, studyId);

    res.json({
      success: true,
      data: {
        patientId,
        studyId,
        authorized: hasConsent
      }
    });
  } catch (error) {
    console.error('Error checking study consent:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar autorización de estudio',
      error: error.message
    });
  }
});

// ===== DERECHOS GDPR =====

/**
 * POST /api/consents/:id/gdpr/erasure
 * Solicitar derecho al olvido (Right to be forgotten)
 */
router.post('/:id/gdpr/erasure', auth, async (req, res) => {
  try {
    const consent = await Consent.findById(req.params.id);

    if (!consent) {
      return res.status(404).json({
        success: false,
        message: 'Consentimiento no encontrado'
      });
    }

    const { reason } = req.body;

    await consent.requestErasure(reason);

    res.json({
      success: true,
      data: consent,
      message: 'Solicitud de derecho al olvido registrada. Será procesada en 30 días hábiles.'
    });
  } catch (error) {
    console.error('Error requesting erasure:', error);
    res.status(500).json({
      success: false,
      message: 'Error al solicitar derecho al olvido',
      error: error.message
    });
  }
});

/**
 * POST /api/consents/:id/gdpr/access
 * Solicitar derecho de acceso a datos
 */
router.post('/:id/gdpr/access', auth, async (req, res) => {
  try {
    const consent = await Consent.findById(req.params.id);

    if (!consent) {
      return res.status(404).json({
        success: false,
        message: 'Consentimiento no encontrado'
      });
    }

    // Registrar la solicitud
    consent.dataSubjectRights.rightToAccess.lastRequested = new Date();
    consent.dataSubjectRights.rightToAccess.requests.push({
      requestedAt: new Date(),
      fulfilledAt: null,
      dataProvided: null
    });

    await consent.save();

    res.json({
      success: true,
      data: consent,
      message: 'Solicitud de acceso a datos registrada. Se enviará copia de sus datos en 30 días hábiles.'
    });
  } catch (error) {
    console.error('Error requesting data access:', error);
    res.status(500).json({
      success: false,
      message: 'Error al solicitar acceso a datos',
      error: error.message
    });
  }
});

/**
 * POST /api/consents/:id/gdpr/portability
 * Solicitar portabilidad de datos
 */
router.post('/:id/gdpr/portability', auth, async (req, res) => {
  try {
    const consent = await Consent.findById(req.params.id);

    if (!consent) {
      return res.status(404).json({
        success: false,
        message: 'Consentimiento no encontrado'
      });
    }

    const { format } = req.body; // JSON, CSV, FHIR, OMOP-CDM

    // Registrar la solicitud
    consent.dataSubjectRights.rightToPortability.lastRequested = new Date();
    consent.dataSubjectRights.rightToPortability.requests.push({
      requestedAt: new Date(),
      fulfilledAt: null,
      format: format || 'JSON',
      downloadUrl: null
    });

    await consent.save();

    res.json({
      success: true,
      data: consent,
      message: `Solicitud de portabilidad de datos en formato ${format || 'JSON'} registrada.`
    });
  } catch (error) {
    console.error('Error requesting data portability:', error);
    res.status(500).json({
      success: false,
      message: 'Error al solicitar portabilidad',
      error: error.message
    });
  }
});

// ===== AUDITORÍA DE ACCESO =====

/**
 * POST /api/consents/:id/log-access
 * Registrar acceso a datos del paciente (para auditoría)
 */
router.post('/:id/log-access', auth, async (req, res) => {
  try {
    const consent = await Consent.findById(req.params.id);

    if (!consent) {
      return res.status(404).json({
        success: false,
        message: 'Consentimiento no encontrado'
      });
    }

    const { details } = req.body;

    await consent.logDataAccess(req.user.userId, details);

    res.json({
      success: true,
      message: 'Acceso registrado en auditoría'
    });
  } catch (error) {
    console.error('Error logging access:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar acceso',
      error: error.message
    });
  }
});

/**
 * POST /api/consents/:id/log-export
 * Registrar exportación de datos (para auditoría)
 */
router.post('/:id/log-export', auth, async (req, res) => {
  try {
    const consent = await Consent.findById(req.params.id);

    if (!consent) {
      return res.status(404).json({
        success: false,
        message: 'Consentimiento no encontrado'
      });
    }

    const { details } = req.body;

    await consent.logDataExport(req.user.userId, details);

    res.json({
      success: true,
      message: 'Exportación registrada en auditoría'
    });
  } catch (error) {
    console.error('Error logging export:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar exportación',
      error: error.message
    });
  }
});

// ===== ESTADÍSTICAS =====

/**
 * GET /api/consents/stats/global
 * Obtener estadísticas globales de consentimientos
 */
router.get('/stats/global', auth, async (req, res) => {
  try {
    const total = await Consent.countDocuments();
    const granted = await Consent.countDocuments({ status: 'granted' });
    const pending = await Consent.countDocuments({ status: 'pending' });
    const withdrawn = await Consent.countDocuments({ status: 'withdrawn' });

    // Consentimientos por propósito
    const consents = await Consent.find({ status: 'granted' });

    const purposeStats = {
      generalResearch: 0,
      specificStudies: 0,
      dataSharing: 0,
      scientificPublications: 0,
      contactForFollowUp: 0,
      geneticData: 0,
      educationalMaterials: 0,
      aiAnalysis: 0
    };

    consents.forEach(consent => {
      Object.keys(purposeStats).forEach(purpose => {
        if (consent.purposes[purpose]?.granted) {
          purposeStats[purpose]++;
        }
      });
    });

    res.json({
      success: true,
      data: {
        total,
        byStatus: {
          granted,
          pending,
          withdrawn
        },
        consentRate: total > 0 ? Math.round((granted / total) * 100) : 0,
        byPurpose: purposeStats
      }
    });
  } catch (error) {
    console.error('Error getting consent stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
});

module.exports = router;
