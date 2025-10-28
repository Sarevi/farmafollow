const express = require('express');
const router = express.Router();
const Questionnaire = require('../models/Questionnaire');
const QuestionnaireResponse = require('../models/QuestionnaireResponse');
const User = require('../models/User');
const Medication = require('../models/Medication');
const auth = require('../middleware/auth');

// ===== RUTAS ADMIN =====

// Obtener todos los cuestionarios (Admin)
router.get('/admin/all', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const questionnaires = await Questionnaire.find()
      .populate('createdBy', 'name email')
      .populate('targetCriteria.medications', 'name')
      .sort('-createdAt');

    res.json(questionnaires);
  } catch (error) {
    console.error('Error obteniendo cuestionarios:', error);
    res.status(500).json({ error: error.message });
  }
});

// Crear cuestionario (Admin)
router.post('/admin/create', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const {
      title,
      description,
      type,
      questions,
      targetCriteria,
      schedule,
      status
    } = req.body;

    const questionnaire = new Questionnaire({
      title,
      description,
      type,
      questions,
      targetCriteria,
      schedule,
      status: status || 'draft',
      createdBy: req.user.userId
    });

    await questionnaire.save();

    res.status(201).json({
      message: 'Cuestionario creado exitosamente',
      questionnaire
    });
  } catch (error) {
    console.error('Error creando cuestionario:', error);
    res.status(400).json({ error: error.message });
  }
});

// Actualizar cuestionario (Admin)
router.put('/admin/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const {
      title,
      description,
      type,
      questions,
      targetCriteria,
      schedule,
      status
    } = req.body;

    const questionnaire = await Questionnaire.findByIdAndUpdate(
      req.params.id,
      {
        title,
        description,
        type,
        questions,
        targetCriteria,
        schedule,
        status,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );

    if (!questionnaire) {
      return res.status(404).json({ error: 'Cuestionario no encontrado' });
    }

    res.json({
      message: 'Cuestionario actualizado exitosamente',
      questionnaire
    });
  } catch (error) {
    console.error('Error actualizando cuestionario:', error);
    res.status(400).json({ error: error.message });
  }
});

// Eliminar cuestionario (Admin)
router.delete('/admin/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const questionnaire = await Questionnaire.findByIdAndDelete(req.params.id);

    if (!questionnaire) {
      return res.status(404).json({ error: 'Cuestionario no encontrado' });
    }

    // También eliminar todas las respuestas relacionadas
    await QuestionnaireResponse.deleteMany({ questionnaire: req.params.id });

    res.json({ message: 'Cuestionario eliminado correctamente' });
  } catch (error) {
    console.error('Error eliminando cuestionario:', error);
    res.status(500).json({ error: error.message });
  }
});

// Activar cuestionario (Admin)
router.put('/admin/:id/activate', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const questionnaire = await Questionnaire.findById(req.params.id);
    if (!questionnaire) {
      return res.status(404).json({ error: 'Cuestionario no encontrado' });
    }

    await questionnaire.activate();

    res.json({
      message: 'Cuestionario activado exitosamente',
      questionnaire
    });
  } catch (error) {
    console.error('Error activando cuestionario:', error);
    res.status(400).json({ error: error.message });
  }
});

// Asignar cuestionario a pacientes específicos (Admin)
router.post('/admin/:id/assign', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { patientIds } = req.body; // Array de IDs de pacientes

    if (!Array.isArray(patientIds) || patientIds.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de IDs de pacientes' });
    }

    const questionnaire = await Questionnaire.findById(req.params.id);
    if (!questionnaire) {
      return res.status(404).json({ error: 'Cuestionario no encontrado' });
    }

    // Crear respuestas pendientes para cada paciente
    const responses = [];
    for (const patientId of patientIds) {
      const existingResponse = await QuestionnaireResponse.findOne({
        questionnaire: req.params.id,
        patient: patientId,
        status: { $in: ['pending', 'in-progress'] }
      });

      // Solo crear si no existe una respuesta pendiente
      if (!existingResponse) {
        const response = new QuestionnaireResponse({
          questionnaire: req.params.id,
          patient: patientId,
          responses: [],
          status: 'pending'
        });
        await response.save();
        responses.push(response);

        // Actualizar estadísticas del cuestionario
        questionnaire.stats.sent += 1;
        questionnaire.stats.pending += 1;
      }
    }

    // Agregar a asignados si no están
    patientIds.forEach(patientId => {
      if (!questionnaire.targetCriteria.specificPatients) {
        questionnaire.targetCriteria.specificPatients = [];
      }
      if (!questionnaire.targetCriteria.specificPatients.includes(patientId)) {
        questionnaire.targetCriteria.specificPatients.push(patientId);
      }
    });

    await questionnaire.save();

    res.json({
      message: `Cuestionario asignado a ${responses.length} paciente(s)`,
      assigned: responses.length,
      skipped: patientIds.length - responses.length
    });
  } catch (error) {
    console.error('Error asignando cuestionario:', error);
    res.status(400).json({ error: error.message });
  }
});

// Obtener respuestas de un cuestionario (Admin)
router.get('/admin/:id/responses', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { status } = req.query; // Filtrar por estado

    let query = { questionnaire: req.params.id };
    if (status) {
      query.status = status;
    }

    const responses = await QuestionnaireResponse.find(query)
      .populate('patient', 'name email phone')
      .sort('-createdAt');

    res.json(responses);
  } catch (error) {
    console.error('Error obteniendo respuestas:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener estadísticas de un cuestionario (Admin)
router.get('/admin/:id/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const questionnaire = await Questionnaire.findById(req.params.id);
    if (!questionnaire) {
      return res.status(404).json({ error: 'Cuestionario no encontrado' });
    }

    // Actualizar estadísticas
    await questionnaire.updateStats();

    const responses = await QuestionnaireResponse.find({
      questionnaire: req.params.id
    });

    // Calcular análisis de respuestas
    const analysis = {
      total: responses.length,
      pending: responses.filter(r => r.status === 'pending').length,
      inProgress: responses.filter(r => r.status === 'in-progress').length,
      completed: responses.filter(r => r.status === 'completed').length,
      averageTime: questionnaire.stats.averageCompletionTime,
      responseRate: questionnaire.responseRate,
      needsReview: responses.filter(r => r.needsReview).length,
      reviewed: responses.filter(r => r.reviewed).length
    };

    res.json({
      questionnaire: {
        id: questionnaire._id,
        title: questionnaire.title,
        type: questionnaire.type,
        status: questionnaire.status
      },
      stats: analysis
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: error.message });
  }
});

// Marcar respuesta como revisada (Admin)
router.put('/admin/responses/:responseId/review', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { notes } = req.body;

    const response = await QuestionnaireResponse.findById(req.params.responseId);
    if (!response) {
      return res.status(404).json({ error: 'Respuesta no encontrada' });
    }

    await response.markAsReviewed(req.user.userId, notes);

    res.json({
      message: 'Respuesta marcada como revisada',
      response
    });
  } catch (error) {
    console.error('Error revisando respuesta:', error);
    res.status(400).json({ error: error.message });
  }
});

// ===== RUTAS PACIENTE =====

// Obtener cuestionarios pendientes del paciente
router.get('/my-questionnaires', auth, async (req, res) => {
  try {
    const responses = await QuestionnaireResponse.find({
      patient: req.user.userId,
      status: { $in: ['pending', 'in-progress'] }
    })
    .populate('questionnaire', 'title description type questions')
    .sort('-createdAt');

    res.json(responses);
  } catch (error) {
    console.error('Error obteniendo cuestionarios del paciente:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener historial de cuestionarios completados
router.get('/my-history', auth, async (req, res) => {
  try {
    const responses = await QuestionnaireResponse.find({
      patient: req.user.userId,
      status: 'completed'
    })
    .populate('questionnaire', 'title description type')
    .sort('-completedAt');

    res.json(responses);
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener un cuestionario específico para completar
router.get('/:id', auth, async (req, res) => {
  try {
    const response = await QuestionnaireResponse.findById(req.params.id)
      .populate('questionnaire', 'title description type questions');

    if (!response) {
      return res.status(404).json({ error: 'Cuestionario no encontrado' });
    }

    // Verificar que el cuestionario pertenece al usuario
    if (response.patient.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    res.json(response);
  } catch (error) {
    console.error('Error obteniendo cuestionario:', error);
    res.status(500).json({ error: error.message });
  }
});

// Iniciar cuestionario
router.post('/:id/start', auth, async (req, res) => {
  try {
    const response = await QuestionnaireResponse.findById(req.params.id);

    if (!response) {
      return res.status(404).json({ error: 'Cuestionario no encontrado' });
    }

    if (response.patient.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    await response.markAsStarted();

    res.json({
      message: 'Cuestionario iniciado',
      response
    });
  } catch (error) {
    console.error('Error iniciando cuestionario:', error);
    res.status(400).json({ error: error.message });
  }
});

// Guardar respuestas del cuestionario
router.put('/:id/submit', auth, async (req, res) => {
  try {
    const { responses: answers } = req.body;

    const response = await QuestionnaireResponse.findById(req.params.id);

    if (!response) {
      return res.status(404).json({ error: 'Cuestionario no encontrado' });
    }

    if (response.patient.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    // Actualizar respuestas
    response.responses = answers;
    await response.save();

    // Completar cuestionario
    await response.complete();

    res.json({
      message: 'Cuestionario completado exitosamente',
      response
    });
  } catch (error) {
    console.error('Error guardando respuestas:', error);
    res.status(400).json({ error: error.message });
  }
});

// Guardar progreso parcial
router.put('/:id/save-progress', auth, async (req, res) => {
  try {
    const { responses: answers } = req.body;

    const response = await QuestionnaireResponse.findById(req.params.id);

    if (!response) {
      return res.status(404).json({ error: 'Cuestionario no encontrado' });
    }

    if (response.patient.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    // Actualizar respuestas sin completar
    response.responses = answers;
    response.status = 'in-progress';
    await response.save();

    res.json({
      message: 'Progreso guardado',
      response
    });
  } catch (error) {
    console.error('Error guardando progreso:', error);
    res.status(400).json({ error: error.message });
  }
});

// ===== RUTAS AUXILIARES =====

// Obtener medicamentos disponibles para criterios
router.get('/utils/medications', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const medications = await Medication.find({ isActive: true })
      .select('name description')
      .sort('name');

    res.json(medications);
  } catch (error) {
    console.error('Error obteniendo medicamentos:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener enfermedades únicas de los pacientes
router.get('/utils/diseases', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const users = await User.find({ role: 'patient' }).select('diseases');

    const diseasesSet = new Set();
    users.forEach(u => {
      if (u.diseases && Array.isArray(u.diseases)) {
        u.diseases.forEach(d => diseasesSet.add(d));
      }
    });

    const diseases = Array.from(diseasesSet).sort();

    res.json(diseases);
  } catch (error) {
    console.error('Error obteniendo enfermedades:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
