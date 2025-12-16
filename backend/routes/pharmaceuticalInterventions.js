const express = require('express');
const router = express.Router();
const PharmaceuticalIntervention = require('../models/PharmaceuticalIntervention');
const User = require('../models/User');
const Medication = require('../models/Medication');
const auth = require('../middleware/auth');

// ===== PROTEGER TODAS LAS RUTAS =====
router.use(auth);

// ===== CRUD BÁSICO =====

/**
 * @route   POST /api/interventions
 * @desc    Crear nueva intervención farmacéutica
 * @access  Private (Admin/Pharmacist)
 */
router.post('/', async (req, res) => {
  try {
    const interventionData = {
      ...req.body,
      pharmacist: req.user.id
    };

    const intervention = new PharmaceuticalIntervention(interventionData);
    await intervention.save();

    await intervention.populate('patient', 'name email');
    await intervention.populate('medication', 'name activeIngredient');

    res.status(201).json({
      success: true,
      message: 'Intervención farmacéutica registrada exitosamente',
      data: intervention
    });
  } catch (error) {
    console.error('Error creating intervention:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar la intervención',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/interventions
 * @desc    Obtener todas las intervenciones
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    const {
      patient,
      pharmacist,
      type,
      status,
      outcomeStatus,
      startDate,
      endDate,
      limit = 50,
      skip = 0,
      sortBy = '-interventionDate'
    } = req.query;

    // Construir query
    let query = {};

    if (patient) query.patient = patient;
    if (pharmacist) query.pharmacist = pharmacist;
    if (type) query.type = type;
    if (status) query.status = status;
    if (outcomeStatus) query['outcome.status'] = outcomeStatus;

    if (startDate || endDate) {
      query.interventionDate = {};
      if (startDate) query.interventionDate.$gte = new Date(startDate);
      if (endDate) query.interventionDate.$lte = new Date(endDate);
    }

    // Si el usuario es paciente, solo ver sus intervenciones
    if (req.user.role === 'patient') {
      query.patient = req.user.id;
    }

    const interventions = await PharmaceuticalIntervention.find(query)
      .sort(sortBy)
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .populate('patient', 'name email')
      .populate('medication', 'name activeIngredient')
      .populate('pharmacist', 'name email')
      .populate('relatedStudies', 'title studyType');

    const total = await PharmaceuticalIntervention.countDocuments(query);

    res.json({
      success: true,
      data: interventions,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching interventions:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener intervenciones',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/interventions/stats
 * @desc    Obtener estadísticas de intervenciones
 * @access  Private
 */
router.get('/stats', async (req, res) => {
  try {
    const { pharmacist, startDate, endDate } = req.query;

    let filters = {};

    if (pharmacist) filters.pharmacist = pharmacist;

    if (startDate || endDate) {
      filters.interventionDate = {};
      if (startDate) filters.interventionDate.$gte = new Date(startDate);
      if (endDate) filters.interventionDate.$lte = new Date(endDate);
    }

    const stats = await PharmaceuticalIntervention.getStats(filters);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/interventions/impact
 * @desc    Obtener impacto total de intervenciones
 * @access  Private
 */
router.get('/impact', async (req, res) => {
  try {
    const { pharmacist, startDate, endDate } = req.query;

    let filters = {};

    if (pharmacist) filters.pharmacist = pharmacist;

    if (startDate || endDate) {
      filters.interventionDate = {};
      if (startDate) filters.interventionDate.$gte = new Date(startDate);
      if (endDate) filters.interventionDate.$lte = new Date(endDate);
    }

    const impact = await PharmaceuticalIntervention.getTotalImpact(filters);

    res.json({
      success: true,
      data: impact
    });
  } catch (error) {
    console.error('Error fetching impact:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener impacto',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/interventions/by-type/:type
 * @desc    Obtener intervenciones por tipo
 * @access  Private
 */
router.get('/by-type/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { pharmacist, startDate, endDate } = req.query;

    const options = {};

    if (pharmacist) options.pharmacist = pharmacist;
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;

    const interventions = await PharmaceuticalIntervention.getByType(type, options);

    res.json({
      success: true,
      data: interventions,
      count: interventions.length
    });
  } catch (error) {
    console.error('Error fetching interventions by type:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener intervenciones',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/interventions/patient/:patientId
 * @desc    Obtener intervenciones de un paciente
 * @access  Private
 */
router.get('/patient/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { startDate, endDate, limit } = req.query;

    // Verificar permisos
    if (req.user.role === 'patient' && req.user.id !== patientId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver estas intervenciones'
      });
    }

    const options = {};
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;
    if (limit) options.limit = parseInt(limit);

    const interventions = await PharmaceuticalIntervention.getPatientTimeline(
      patientId,
      options
    );

    res.json({
      success: true,
      data: interventions,
      count: interventions.length
    });
  } catch (error) {
    console.error('Error fetching patient interventions:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener intervenciones del paciente',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/interventions/:id
 * @desc    Obtener una intervención específica
 * @access  Private
 */
router.get('/:id', async (req, res) => {
  try {
    const intervention = await PharmaceuticalIntervention.findById(req.params.id)
      .populate('patient', 'name email gender dateOfBirth diseases')
      .populate('medication', 'name activeIngredient')
      .populate('pharmacist', 'name email')
      .populate('relatedStudies', 'title studyType');

    if (!intervention) {
      return res.status(404).json({
        success: false,
        message: 'Intervención no encontrada'
      });
    }

    // Verificar permisos
    if (req.user.role === 'patient') {
      if (intervention.patient._id.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para ver esta intervención'
        });
      }
    }

    res.json({
      success: true,
      data: intervention
    });
  } catch (error) {
    console.error('Error fetching intervention:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la intervención',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/interventions/:id
 * @desc    Actualizar intervención
 * @access  Private (Admin/Pharmacist owner)
 */
router.put('/:id', async (req, res) => {
  try {
    const intervention = await PharmaceuticalIntervention.findById(req.params.id);

    if (!intervention) {
      return res.status(404).json({
        success: false,
        message: 'Intervención no encontrada'
      });
    }

    // Verificar permisos
    if (
      req.user.role !== 'admin' &&
      intervention.pharmacist.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para editar esta intervención'
      });
    }

    // No permitir editar intervenciones completadas
    if (intervention.status === 'completada') {
      return res.status(400).json({
        success: false,
        message: 'No se pueden editar intervenciones completadas'
      });
    }

    // Actualizar campos
    Object.keys(req.body).forEach(key => {
      if (key !== 'pharmacist' && key !== 'patient') {
        intervention[key] = req.body[key];
      }
    });

    await intervention.save();

    res.json({
      success: true,
      message: 'Intervención actualizada exitosamente',
      data: intervention
    });
  } catch (error) {
    console.error('Error updating intervention:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar la intervención',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/interventions/:id
 * @desc    Eliminar intervención
 * @access  Private (Admin only)
 */
router.delete('/:id', async (req, res) => {
  try {
    const intervention = await PharmaceuticalIntervention.findById(req.params.id);

    if (!intervention) {
      return res.status(404).json({
        success: false,
        message: 'Intervención no encontrada'
      });
    }

    // Solo admin puede eliminar
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para eliminar intervenciones'
      });
    }

    await PharmaceuticalIntervention.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Intervención eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error deleting intervention:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar la intervención',
      error: error.message
    });
  }
});

// ===== GESTIÓN DE LA INTERVENCIÓN =====

/**
 * @route   POST /api/interventions/:id/evaluate
 * @desc    Evaluar resultado de la intervención
 * @access  Private (Admin/Pharmacist owner)
 */
router.post('/:id/evaluate', async (req, res) => {
  try {
    const { successful, description, impactData } = req.body;

    if (successful === undefined || !description) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere successful y description'
      });
    }

    const intervention = await PharmaceuticalIntervention.findById(req.params.id);

    if (!intervention) {
      return res.status(404).json({
        success: false,
        message: 'Intervención no encontrada'
      });
    }

    // Verificar permisos
    if (
      req.user.role !== 'admin' &&
      intervention.pharmacist.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para evaluar esta intervención'
      });
    }

    await intervention.evaluateOutcome(successful, description, impactData || {});

    res.json({
      success: true,
      message: 'Resultado evaluado exitosamente',
      data: intervention
    });
  } catch (error) {
    console.error('Error evaluating intervention:', error);
    res.status(500).json({
      success: false,
      message: 'Error al evaluar la intervención',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/interventions/:id/follow-up
 * @desc    Registrar seguimiento de la intervención
 * @access  Private (Admin/Pharmacist owner)
 */
router.post('/:id/follow-up', async (req, res) => {
  try {
    const { notes, status } = req.body;

    if (!notes || !status) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere notes y status'
      });
    }

    const intervention = await PharmaceuticalIntervention.findById(req.params.id);

    if (!intervention) {
      return res.status(404).json({
        success: false,
        message: 'Intervención no encontrada'
      });
    }

    // Verificar permisos
    if (
      req.user.role !== 'admin' &&
      intervention.pharmacist.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para actualizar esta intervención'
      });
    }

    await intervention.addFollowUpVisit(notes, status);

    res.json({
      success: true,
      message: 'Seguimiento registrado exitosamente',
      data: intervention
    });
  } catch (error) {
    console.error('Error adding follow-up:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar seguimiento',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/interventions/:id/complete
 * @desc    Completar intervención
 * @access  Private (Admin/Pharmacist owner)
 */
router.post('/:id/complete', async (req, res) => {
  try {
    const intervention = await PharmaceuticalIntervention.findById(req.params.id);

    if (!intervention) {
      return res.status(404).json({
        success: false,
        message: 'Intervención no encontrada'
      });
    }

    // Verificar permisos
    if (
      req.user.role !== 'admin' &&
      intervention.pharmacist.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para completar esta intervención'
      });
    }

    await intervention.complete();

    res.json({
      success: true,
      message: 'Intervención completada exitosamente',
      data: intervention
    });
  } catch (error) {
    console.error('Error completing intervention:', error);
    res.status(500).json({
      success: false,
      message: 'Error al completar la intervención',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/interventions/:id/cancel
 * @desc    Cancelar intervención
 * @access  Private (Admin/Pharmacist owner)
 */
router.post('/:id/cancel', async (req, res) => {
  try {
    const { reason } = req.body;

    const intervention = await PharmaceuticalIntervention.findById(req.params.id);

    if (!intervention) {
      return res.status(404).json({
        success: false,
        message: 'Intervención no encontrada'
      });
    }

    // Verificar permisos
    if (
      req.user.role !== 'admin' &&
      intervention.pharmacist.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para cancelar esta intervención'
      });
    }

    await intervention.cancel(reason || '');

    res.json({
      success: true,
      message: 'Intervención cancelada exitosamente',
      data: intervention
    });
  } catch (error) {
    console.error('Error cancelling intervention:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cancelar la intervención',
      error: error.message
    });
  }
});

module.exports = router;
