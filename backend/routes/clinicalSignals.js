const express = require('express');
const router = express.Router();
const ClinicalSignal = require('../models/ClinicalSignal');
const signalDetectionService = require('../services/signalDetectionService');
const auth = require('../middleware/auth');

/**
 * RUTAS DE INTELIGENCIA CLÍNICA - SEÑALES TEMPRANAS
 * Motor de detección de patrones y alertas predictivas
 */

// ===== ANÁLISIS Y DETECCIÓN =====

/**
 * POST /api/signals/analyze
 * Ejecutar análisis completo de señales
 */
router.post('/analyze', auth, async (req, res) => {
  try {
    // Solo admins pueden ejecutar análisis completos
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No autorizado para ejecutar análisis'
      });
    }

    const signals = await signalDetectionService.runFullAnalysis();

    res.json({
      success: true,
      data: signals,
      count: signals.length,
      message: `Análisis completado: ${signals.length} señales detectadas`
    });
  } catch (error) {
    console.error('Error running signal analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Error ejecutando análisis de señales',
      error: error.message
    });
  }
});

/**
 * POST /api/signals/analyze/patient/:patientId
 * Analizar señales para un paciente específico
 */
router.post('/analyze/patient/:patientId', auth, async (req, res) => {
  try {
    const { patientId } = req.params;

    const signals = await signalDetectionService.analyzePatientSignals(patientId);

    res.json({
      success: true,
      data: signals,
      count: signals.length
    });
  } catch (error) {
    console.error('Error analyzing patient signals:', error);
    res.status(500).json({
      success: false,
      message: 'Error analizando señales del paciente',
      error: error.message
    });
  }
});

// ===== CONSULTAS =====

/**
 * GET /api/signals
 * Obtener todas las señales con filtros
 */
router.get('/', auth, async (req, res) => {
  try {
    const {
      signalType,
      severity,
      status,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
      sortBy = 'priority',
      sortOrder = 'desc'
    } = req.query;

    // Construir query
    const query = {};

    if (signalType) query.signalType = signalType;
    if (severity) query.severity = severity;
    if (status) query.status = status;

    if (startDate || endDate) {
      query['detection.detectedAt'] = {};
      if (startDate) query['detection.detectedAt'].$gte = new Date(startDate);
      if (endDate) query['detection.detectedAt'].$lte = new Date(endDate);
    }

    // Ejecutar query
    const signals = await ClinicalSignal.find(query)
      .populate('affectedEntities.patients.patient', 'name email')
      .populate('affectedEntities.medications.medication', 'name')
      .populate('reviews.reviewedBy', 'name email')
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await ClinicalSignal.countDocuments(query);

    res.json({
      success: true,
      data: signals,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching signals:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo señales',
      error: error.message
    });
  }
});

/**
 * GET /api/signals/dashboard
 * Obtener señales para dashboard (resumen)
 */
router.get('/dashboard', auth, async (req, res) => {
  try {
    // Señales críticas sin revisar
    const critical = await ClinicalSignal.getCriticalUnreviewed();

    // Señales por severidad (activas)
    const active = {
      critical: await ClinicalSignal.getActiveBySeverity('critical'),
      high: await ClinicalSignal.getActiveBySeverity('high'),
      medium: await ClinicalSignal.getActiveBySeverity('medium'),
      low: await ClinicalSignal.getActiveBySeverity('low')
    };

    // Estadísticas generales
    const stats = await ClinicalSignal.getStats();

    // Señales recientes (últimos 7 días)
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 7);

    const recent = await ClinicalSignal.find({
      'detection.detectedAt': { $gte: recentDate }
    })
    .populate('affectedEntities.patients.patient', 'name')
    .populate('affectedEntities.medications.medication', 'name')
    .sort({ 'detection.detectedAt': -1 })
    .limit(10);

    res.json({
      success: true,
      data: {
        critical,
        active,
        stats,
        recent
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard signals:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo dashboard de señales',
      error: error.message
    });
  }
});

/**
 * GET /api/signals/:id
 * Obtener señal específica
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const signal = await ClinicalSignal.findById(req.params.id)
      .populate('affectedEntities.patients.patient')
      .populate('affectedEntities.medications.medication')
      .populate('affectedEntities.studies')
      .populate('reviews.reviewedBy', 'name email role')
      .populate('recommendations.assignedTo', 'name email');

    if (!signal) {
      return res.status(404).json({
        success: false,
        message: 'Señal no encontrada'
      });
    }

    res.json({
      success: true,
      data: signal
    });
  } catch (error) {
    console.error('Error fetching signal:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo señal',
      error: error.message
    });
  }
});

/**
 * GET /api/signals/patient/:patientId
 * Obtener señales de un paciente
 */
router.get('/patient/:patientId', auth, async (req, res) => {
  try {
    const signals = await ClinicalSignal.getByPatient(req.params.patientId);

    res.json({
      success: true,
      data: signals,
      count: signals.length
    });
  } catch (error) {
    console.error('Error fetching patient signals:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo señales del paciente',
      error: error.message
    });
  }
});

/**
 * GET /api/signals/medication/:medicationId
 * Obtener señales de un medicamento
 */
router.get('/medication/:medicationId', auth, async (req, res) => {
  try {
    const signals = await ClinicalSignal.getByMedication(req.params.medicationId);

    res.json({
      success: true,
      data: signals,
      count: signals.length
    });
  } catch (error) {
    console.error('Error fetching medication signals:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo señales del medicamento',
      error: error.message
    });
  }
});

// ===== GESTIÓN DE SEÑALES =====

/**
 * POST /api/signals/:id/review
 * Revisar una señal
 */
router.post('/:id/review', auth, async (req, res) => {
  try {
    const { assessment, notes, recommendations } = req.body;

    if (!['confirmed', 'rejected', 'needs-more-data', 'inconclusive'].includes(assessment)) {
      return res.status(400).json({
        success: false,
        message: 'Assessment inválido'
      });
    }

    const signal = await ClinicalSignal.findById(req.params.id);

    if (!signal) {
      return res.status(404).json({
        success: false,
        message: 'Señal no encontrada'
      });
    }

    await signal.markReviewed(req.user.userId, assessment, notes);

    if (recommendations && recommendations.length > 0) {
      signal.reviews[signal.reviews.length - 1].recommendations = recommendations;
      await signal.save();
    }

    res.json({
      success: true,
      data: signal,
      message: 'Señal revisada exitosamente'
    });
  } catch (error) {
    console.error('Error reviewing signal:', error);
    res.status(500).json({
      success: false,
      message: 'Error revisando señal',
      error: error.message
    });
  }
});

/**
 * POST /api/signals/:id/resolve
 * Resolver una señal
 */
router.post('/:id/resolve', auth, async (req, res) => {
  try {
    const { resolution } = req.body;

    const signal = await ClinicalSignal.findById(req.params.id);

    if (!signal) {
      return res.status(404).json({
        success: false,
        message: 'Señal no encontrada'
      });
    }

    await signal.resolve(resolution);

    res.json({
      success: true,
      data: signal,
      message: 'Señal resuelta exitosamente'
    });
  } catch (error) {
    console.error('Error resolving signal:', error);
    res.status(500).json({
      success: false,
      message: 'Error resolviendo señal',
      error: error.message
    });
  }
});

/**
 * POST /api/signals/:id/escalate
 * Escalar una señal
 */
router.post('/:id/escalate', auth, async (req, res) => {
  try {
    const { reason } = req.body;

    const signal = await ClinicalSignal.findById(req.params.id);

    if (!signal) {
      return res.status(404).json({
        success: false,
        message: 'Señal no encontrada'
      });
    }

    await signal.escalate(reason);

    res.json({
      success: true,
      data: signal,
      message: 'Señal escalada exitosamente'
    });
  } catch (error) {
    console.error('Error escalating signal:', error);
    res.status(500).json({
      success: false,
      message: 'Error escalando señal',
      error: error.message
    });
  }
});

/**
 * PUT /api/signals/:id/status
 * Actualizar estado de señal
 */
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;

    const validStatuses = ['new', 'under-review', 'confirmed', 'false-positive',
                          'requires-action', 'resolved', 'monitoring', 'escalated'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Estado inválido'
      });
    }

    const signal = await ClinicalSignal.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!signal) {
      return res.status(404).json({
        success: false,
        message: 'Señal no encontrada'
      });
    }

    res.json({
      success: true,
      data: signal,
      message: 'Estado actualizado'
    });
  } catch (error) {
    console.error('Error updating signal status:', error);
    res.status(500).json({
      success: false,
      message: 'Error actualizando estado',
      error: error.message
    });
  }
});

/**
 * POST /api/signals/:id/recommendations
 * Añadir recomendación
 */
router.post('/:id/recommendations', auth, async (req, res) => {
  try {
    const { action, description, priority, assignedTo, deadline } = req.body;

    const signal = await ClinicalSignal.findById(req.params.id);

    if (!signal) {
      return res.status(404).json({
        success: false,
        message: 'Señal no encontrada'
      });
    }

    await signal.addRecommendation(action, description, priority);

    // Actualizar campos adicionales si se proporcionaron
    if (assignedTo || deadline) {
      const lastRecommendation = signal.recommendations[signal.recommendations.length - 1];
      if (assignedTo) lastRecommendation.assignedTo = assignedTo;
      if (deadline) lastRecommendation.deadline = deadline;
      await signal.save();
    }

    res.json({
      success: true,
      data: signal,
      message: 'Recomendación añadida'
    });
  } catch (error) {
    console.error('Error adding recommendation:', error);
    res.status(500).json({
      success: false,
      message: 'Error añadiendo recomendación',
      error: error.message
    });
  }
});

/**
 * PUT /api/signals/:id/recommendations/:recommendationId
 * Actualizar estado de recomendación
 */
router.put('/:id/recommendations/:recommendationId', auth, async (req, res) => {
  try {
    const { status } = req.body;

    const signal = await ClinicalSignal.findById(req.params.id);

    if (!signal) {
      return res.status(404).json({
        success: false,
        message: 'Señal no encontrada'
      });
    }

    const recommendation = signal.recommendations.id(req.params.recommendationId);

    if (!recommendation) {
      return res.status(404).json({
        success: false,
        message: 'Recomendación no encontrada'
      });
    }

    recommendation.status = status;
    if (status === 'completed') {
      recommendation.completedAt = new Date();
    }

    await signal.save();

    res.json({
      success: true,
      data: signal,
      message: 'Recomendación actualizada'
    });
  } catch (error) {
    console.error('Error updating recommendation:', error);
    res.status(500).json({
      success: false,
      message: 'Error actualizando recomendación',
      error: error.message
    });
  }
});

// ===== ALERTAS =====

/**
 * POST /api/signals/:id/alerts
 * Enviar alertas para una señal
 */
router.post('/:id/alerts', auth, async (req, res) => {
  try {
    const { recipients, alertType = 'in-app' } = req.body;

    if (!recipients || !Array.isArray(recipients)) {
      return res.status(400).json({
        success: false,
        message: 'Recipients requeridos (array de user IDs)'
      });
    }

    const signal = await ClinicalSignal.findById(req.params.id);

    if (!signal) {
      return res.status(404).json({
        success: false,
        message: 'Señal no encontrada'
      });
    }

    await signal.sendAlerts(recipients, alertType);

    res.json({
      success: true,
      data: signal,
      message: `Alertas enviadas a ${recipients.length} usuario(s)`
    });
  } catch (error) {
    console.error('Error sending alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Error enviando alertas',
      error: error.message
    });
  }
});

/**
 * PUT /api/signals/:id/alerts/:alertId/read
 * Marcar alerta como leída
 */
router.put('/:id/alerts/:alertId/read', auth, async (req, res) => {
  try {
    const signal = await ClinicalSignal.findById(req.params.id);

    if (!signal) {
      return res.status(404).json({
        success: false,
        message: 'Señal no encontrada'
      });
    }

    const alert = signal.alerts.id(req.params.alertId);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alerta no encontrada'
      });
    }

    alert.read = true;
    alert.readAt = new Date();
    await signal.save();

    res.json({
      success: true,
      message: 'Alerta marcada como leída'
    });
  } catch (error) {
    console.error('Error marking alert as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error marcando alerta',
      error: error.message
    });
  }
});

// ===== REPORTES =====

/**
 * GET /api/signals/stats/overview
 * Obtener estadísticas generales
 */
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateRange = {};
    if (startDate) dateRange.start = startDate;
    if (endDate) dateRange.end = endDate;

    const stats = await ClinicalSignal.getStats(dateRange);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estadísticas',
      error: error.message
    });
  }
});

/**
 * GET /api/signals/export/pharmacovigilance
 * Exportar señales de seguridad para farmacovigilancia
 */
router.get('/export/pharmacovigilance', auth, async (req, res) => {
  try {
    // Solo admins pueden exportar
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No autorizado'
      });
    }

    const signals = await ClinicalSignal.find({
      signalType: { $in: ['adverse-event-cluster', 'safety-signal', 'drug-interaction'] },
      severity: { $in: ['high', 'critical'] },
      status: { $ne: 'false-positive' }
    }).populate('affectedEntities.medications.medication');

    const report = signals.map(signal => signal.toPharmacvigilanceReport());

    res.json({
      success: true,
      data: report,
      count: report.length,
      generated: new Date()
    });
  } catch (error) {
    console.error('Error exporting pharmacovigilance report:', error);
    res.status(500).json({
      success: false,
      message: 'Error exportando reporte',
      error: error.message
    });
  }
});

module.exports = router;
