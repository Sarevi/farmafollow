const express = require('express');
const router = express.Router();
const Study = require('../models/Study');
const User = require('../models/User');
const auth = require('../middleware/auth');

// ===== PROTEGER TODAS LAS RUTAS =====
router.use(auth);

// ===== CRUD BÁSICO =====

/**
 * @route   POST /api/studies
 * @desc    Crear nuevo estudio RWE
 * @access  Private (Admin/Pharmacist)
 */
router.post('/', async (req, res) => {
  try {
    const studyData = {
      ...req.body,
      createdBy: req.user.id
    };

    const study = new Study(studyData);
    await study.save();

    res.status(201).json({
      success: true,
      message: 'Estudio creado exitosamente',
      data: study
    });
  } catch (error) {
    console.error('Error creating study:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear el estudio',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/studies
 * @desc    Obtener todos los estudios
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    const {
      status,
      studyType,
      createdBy,
      limit = 50,
      skip = 0,
      sortBy = '-createdAt'
    } = req.query;

    // Construir query
    let query = {};

    if (status) query.status = status;
    if (studyType) query.studyType = studyType;
    if (createdBy) query.createdBy = createdBy;

    // Si el usuario es paciente, solo ver estudios donde esté incluido
    if (req.user.role === 'patient') {
      query['cohort.patient'] = req.user.id;
    }

    const studies = await Study.find(query)
      .sort(sortBy)
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .populate('createdBy', 'name email')
      .populate('investigators', 'name email')
      .populate('inclusionCriteria.medications', 'name activeIngredient')
      .populate('cohort.patient', 'name email');

    const total = await Study.countDocuments(query);

    res.json({
      success: true,
      data: studies,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching studies:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estudios',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/studies/active
 * @desc    Obtener estudios activos
 * @access  Private
 */
router.get('/active', async (req, res) => {
  try {
    const studies = await Study.getActiveStudies();

    res.json({
      success: true,
      data: studies,
      count: studies.length
    });
  } catch (error) {
    console.error('Error fetching active studies:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estudios activos',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/studies/stats/global
 * @desc    Obtener estadísticas globales de todos los estudios
 * @access  Private (Admin)
 */
router.get('/stats/global', async (req, res) => {
  try {
    const stats = await Study.getGlobalStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching global stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas globales',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/studies/:id
 * @desc    Obtener un estudio específico
 * @access  Private
 */
router.get('/:id', async (req, res) => {
  try {
    const study = await Study.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('investigators', 'name email')
      .populate('inclusionCriteria.medications', 'name activeIngredient')
      .populate('exclusionCriteria.medications', 'name activeIngredient')
      .populate('questionnaires.questionnaire', 'title type')
      .populate('cohort.patient', 'name email gender dateOfBirth diseases')
      .populate('cohort.followUps.questionnairesCompleted');

    if (!study) {
      return res.status(404).json({
        success: false,
        message: 'Estudio no encontrado'
      });
    }

    // Verificar permisos
    if (req.user.role === 'patient') {
      const isInCohort = study.cohort.some(
        c => c.patient._id.toString() === req.user.id
      );

      if (!isInCohort) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para ver este estudio'
        });
      }
    }

    res.json({
      success: true,
      data: study
    });
  } catch (error) {
    console.error('Error fetching study:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el estudio',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/studies/:id
 * @desc    Actualizar estudio
 * @access  Private (Admin/Creator)
 */
router.put('/:id', async (req, res) => {
  try {
    const study = await Study.findById(req.params.id);

    if (!study) {
      return res.status(404).json({
        success: false,
        message: 'Estudio no encontrado'
      });
    }

    // Verificar permisos
    if (
      req.user.role !== 'admin' &&
      study.createdBy.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para editar este estudio'
      });
    }

    // No permitir editar estudios completados
    if (study.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'No se pueden editar estudios completados'
      });
    }

    // Actualizar campos
    Object.keys(req.body).forEach(key => {
      if (key !== 'createdBy' && key !== 'cohort') {
        study[key] = req.body[key];
      }
    });

    await study.save();

    res.json({
      success: true,
      message: 'Estudio actualizado exitosamente',
      data: study
    });
  } catch (error) {
    console.error('Error updating study:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el estudio',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/studies/:id
 * @desc    Eliminar estudio
 * @access  Private (Admin/Creator)
 */
router.delete('/:id', async (req, res) => {
  try {
    const study = await Study.findById(req.params.id);

    if (!study) {
      return res.status(404).json({
        success: false,
        message: 'Estudio no encontrado'
      });
    }

    // Verificar permisos
    if (
      req.user.role !== 'admin' &&
      study.createdBy.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para eliminar este estudio'
      });
    }

    // Solo permitir eliminar estudios en draft
    if (study.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden eliminar estudios en borrador'
      });
    }

    await Study.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Estudio eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error deleting study:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el estudio',
      error: error.message
    });
  }
});

// ===== GESTIÓN DEL ESTUDIO =====

/**
 * @route   POST /api/studies/:id/activate
 * @desc    Activar estudio
 * @access  Private (Admin/Creator)
 */
router.post('/:id/activate', async (req, res) => {
  try {
    const study = await Study.findById(req.params.id);

    if (!study) {
      return res.status(404).json({
        success: false,
        message: 'Estudio no encontrado'
      });
    }

    // Verificar permisos
    if (
      req.user.role !== 'admin' &&
      study.createdBy.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para activar este estudio'
      });
    }

    await study.activate();

    res.json({
      success: true,
      message: 'Estudio activado exitosamente',
      data: study
    });
  } catch (error) {
    console.error('Error activating study:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al activar el estudio',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/studies/:id/pause
 * @desc    Pausar estudio
 * @access  Private (Admin/Creator)
 */
router.post('/:id/pause', async (req, res) => {
  try {
    const study = await Study.findById(req.params.id);

    if (!study) {
      return res.status(404).json({
        success: false,
        message: 'Estudio no encontrado'
      });
    }

    if (study.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden pausar estudios activos'
      });
    }

    study.status = 'paused';
    await study.save();

    res.json({
      success: true,
      message: 'Estudio pausado exitosamente',
      data: study
    });
  } catch (error) {
    console.error('Error pausing study:', error);
    res.status(500).json({
      success: false,
      message: 'Error al pausar el estudio',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/studies/:id/resume
 * @desc    Reanudar estudio pausado
 * @access  Private (Admin/Creator)
 */
router.post('/:id/resume', async (req, res) => {
  try {
    const study = await Study.findById(req.params.id);

    if (!study) {
      return res.status(404).json({
        success: false,
        message: 'Estudio no encontrado'
      });
    }

    if (study.status !== 'paused') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden reanudar estudios pausados'
      });
    }

    study.status = 'active';
    await study.save();

    res.json({
      success: true,
      message: 'Estudio reanudado exitosamente',
      data: study
    });
  } catch (error) {
    console.error('Error resuming study:', error);
    res.status(500).json({
      success: false,
      message: 'Error al reanudar el estudio',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/studies/:id/complete
 * @desc    Completar estudio
 * @access  Private (Admin/Creator)
 */
router.post('/:id/complete', async (req, res) => {
  try {
    const study = await Study.findById(req.params.id);

    if (!study) {
      return res.status(404).json({
        success: false,
        message: 'Estudio no encontrado'
      });
    }

    // Verificar permisos
    if (
      req.user.role !== 'admin' &&
      study.createdBy.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para completar este estudio'
      });
    }

    await study.complete();

    res.json({
      success: true,
      message: 'Estudio completado exitosamente',
      data: study
    });
  } catch (error) {
    console.error('Error completing study:', error);
    res.status(500).json({
      success: false,
      message: 'Error al completar el estudio',
      error: error.message
    });
  }
});

// ===== GESTIÓN DE COHORTE =====

/**
 * @route   POST /api/studies/:id/generate-cohort
 * @desc    Generar cohorte automáticamente basada en criterios
 * @access  Private (Admin/Creator)
 */
router.post('/:id/generate-cohort', async (req, res) => {
  try {
    const study = await Study.findById(req.params.id);

    if (!study) {
      return res.status(404).json({
        success: false,
        message: 'Estudio no encontrado'
      });
    }

    const candidates = await study.generateCohort();

    res.json({
      success: true,
      message: `Se encontraron ${candidates.length} candidatos`,
      data: {
        candidateCount: candidates.length,
        candidates: candidates.map(c => ({
          id: c._id,
          name: c.name,
          email: c.email,
          age: c.getAge(),
          gender: c.gender,
          diseases: c.diseases,
          adherence: c.calculateAdherence()
        }))
      }
    });
  } catch (error) {
    console.error('Error generating cohort:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar cohorte',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/studies/:id/enroll
 * @desc    Añadir paciente a cohorte
 * @access  Private (Admin/Creator)
 */
router.post('/:id/enroll', async (req, res) => {
  try {
    const { patientId, baselineData } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere patientId'
      });
    }

    const study = await Study.findById(req.params.id);

    if (!study) {
      return res.status(404).json({
        success: false,
        message: 'Estudio no encontrado'
      });
    }

    // Verificar que el paciente existe
    const patient = await User.findById(patientId);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    await study.enrollPatient(patientId, baselineData || {});

    res.json({
      success: true,
      message: 'Paciente añadido a la cohorte exitosamente',
      data: study
    });
  } catch (error) {
    console.error('Error enrolling patient:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al añadir paciente',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/studies/:id/enroll-batch
 * @desc    Añadir múltiples pacientes a cohorte
 * @access  Private (Admin/Creator)
 */
router.post('/:id/enroll-batch', async (req, res) => {
  try {
    const { patientIds } = req.body;

    if (!patientIds || !Array.isArray(patientIds) || patientIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de patientIds'
      });
    }

    const study = await Study.findById(req.params.id);

    if (!study) {
      return res.status(404).json({
        success: false,
        message: 'Estudio no encontrado'
      });
    }

    const results = {
      success: [],
      failed: []
    };

    for (const patientId of patientIds) {
      try {
        await study.enrollPatient(patientId, {});
        results.success.push(patientId);
      } catch (error) {
        results.failed.push({
          patientId,
          error: error.message
        });
      }
    }

    await study.save();

    res.json({
      success: true,
      message: `${results.success.length} pacientes añadidos, ${results.failed.length} fallidos`,
      data: {
        enrolled: results.success.length,
        failed: results.failed.length,
        details: results
      }
    });
  } catch (error) {
    console.error('Error enrolling patients batch:', error);
    res.status(500).json({
      success: false,
      message: 'Error al añadir pacientes',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/studies/:id/withdraw
 * @desc    Retirar paciente del estudio
 * @access  Private (Admin/Creator)
 */
router.post('/:id/withdraw', async (req, res) => {
  try {
    const { patientId, reason, notes } = req.body;

    if (!patientId || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere patientId y reason'
      });
    }

    const study = await Study.findById(req.params.id);

    if (!study) {
      return res.status(404).json({
        success: false,
        message: 'Estudio no encontrado'
      });
    }

    await study.withdrawPatient(patientId, reason, notes || '');

    res.json({
      success: true,
      message: 'Paciente retirado del estudio',
      data: study
    });
  } catch (error) {
    console.error('Error withdrawing patient:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al retirar paciente',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/studies/:id/follow-up
 * @desc    Registrar seguimiento de paciente
 * @access  Private (Admin/Creator)
 */
router.post('/:id/follow-up', async (req, res) => {
  try {
    const { patientId, timePoint, data, questionnaireResponses } = req.body;

    if (!patientId || timePoint === undefined || !data) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere patientId, timePoint y data'
      });
    }

    const study = await Study.findById(req.params.id);

    if (!study) {
      return res.status(404).json({
        success: false,
        message: 'Estudio no encontrado'
      });
    }

    await study.recordFollowUp(
      patientId,
      timePoint,
      data,
      questionnaireResponses || []
    );

    res.json({
      success: true,
      message: 'Seguimiento registrado exitosamente',
      data: study
    });
  } catch (error) {
    console.error('Error recording follow-up:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al registrar seguimiento',
      error: error.message
    });
  }
});

// ===== EXPORTACIÓN =====

/**
 * @route   GET /api/studies/:id/export
 * @desc    Exportar datos del estudio
 * @access  Private (Admin/Creator)
 */
router.get('/:id/export', async (req, res) => {
  try {
    const { format = 'json' } = req.query;

    const study = await Study.findById(req.params.id);

    if (!study) {
      return res.status(404).json({
        success: false,
        message: 'Estudio no encontrado'
      });
    }

    // Verificar permisos
    if (
      req.user.role !== 'admin' &&
      study.createdBy.toString() !== req.user.id &&
      !study.investigators.some(inv => inv.toString() === req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para exportar este estudio'
      });
    }

    const exportData = await study.exportData(format);

    // Configurar headers para descarga
    const filename = `study_${study._id}_${Date.now()}.${format}`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.json({
      success: true,
      data: exportData,
      exportedAt: new Date(),
      format
    });
  } catch (error) {
    console.error('Error exporting study:', error);
    res.status(500).json({
      success: false,
      message: 'Error al exportar datos',
      error: error.message
    });
  }
});

module.exports = router;
