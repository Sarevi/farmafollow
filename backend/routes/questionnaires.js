const express = require('express');
const router = express.Router();
const Questionnaire = require('../models/Questionnaire');
const QuestionnaireResponse = require('../models/QuestionnaireResponse');
const User = require('../models/User');
const Medication = require('../models/Medication');
const auth = require('../middleware/auth');

// ===== ADMIN ENDPOINTS =====

// Crear cuestionario (admin)
router.post('/', auth, async (req, res) => {
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
      showAsPopup,
      priority
    } = req.body;

    if (!title || !questions || questions.length === 0) {
      return res.status(400).json({ 
        error: 'Título y preguntas son requeridos' 
      });
    }

    const questionnaire = new Questionnaire({
      title,
      description: description || '',
      type: type || 'personalizado',
      questions,
      targetCriteria: targetCriteria || { sendToAll: true },
      showAsPopup: showAsPopup !== false, // true por defecto
      priority: priority || 0,
      status: 'active',
      createdBy: req.user.userId
    });

    await questionnaire.save();

    // Crear respuestas pendientes para pacientes objetivo
    const targetPatients = await questionnaire.getTargetPatients();
    
    for (const patient of targetPatients) {
      const response = new QuestionnaireResponse({
        questionnaire: questionnaire._id,
        patient: patient._id,
        status: 'pending',
        responses: []
      });
      await response.save();
    }

    res.status(201).json({
      message: 'Cuestionario creado correctamente',
      questionnaire,
      patientsAssigned: targetPatients.length
    });

  } catch (error) {
    console.error('Error creando cuestionario:', error);
    res.status(400).json({ error: error.message });
  }
});

// Obtener todos los cuestionarios (admin)
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const questionnaires = await Questionnaire.find()
      .populate('createdBy', 'name')
      .sort('-createdAt');

    // Agregar estadísticas
    const questionnairesWithStats = await Promise.all(
      questionnaires.map(async (q) => {
        await q.updateStats();
        return q.toObject();
      })
    );

    res.json(questionnairesWithStats);

  } catch (error) {
    console.error('Error obteniendo cuestionarios:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener respuestas de un cuestionario (admin)
router.get('/:id/responses', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const questionnaire = await Questionnaire.findById(req.params.id);
    if (!questionnaire) {
      return res.status(404).json({ error: 'Cuestionario no encontrado' });
    }

    const responses = await QuestionnaireResponse.find({
      questionnaire: req.params.id
    })
      .populate('patient', 'name email diseases')
      .sort('-completedAt');

    // Calcular estadísticas
    const stats = {
      total: responses.length,
      completed: responses.filter(r => r.status === 'completed').length,
      pending: responses.filter(r => r.status === 'pending').length,
      inProgress: responses.filter(r => r.status === 'in-progress').length
    };

    // Calcular promedios para preguntas tipo escala
    const scaleQuestions = questionnaire.questions.filter(q => q.type === 'scale');
    const averages = {};

    scaleQuestions.forEach(question => {
      const completedResponses = responses.filter(r => r.status === 'completed');
      const answers = completedResponses.map(r => {
        const answer = r.responses.find(res => res.questionId === question.id);
        return answer ? Number(answer.answer) : null;
      }).filter(a => a !== null);

      if (answers.length > 0) {
        averages[question.id] = {
          question: question.text,
          average: (answers.reduce((a, b) => a + b, 0) / answers.length).toFixed(1),
          count: answers.length
        };
      }
    });

    res.json({
      questionnaire: {
        id: questionnaire._id,
        title: questionnaire.title,
        questions: questionnaire.questions
      },
      stats,
      averages,
      responses
    });

  } catch (error) {
    console.error('Error obteniendo respuestas:', error);
    res.status(500).json({ error: error.message });
  }
});

// Actualizar cuestionario (admin)
router.put('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const allowedUpdates = ['title', 'description', 'status', 'questions', 'targetCriteria', 'showAsPopup', 'priority'];
    const updates = {};
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const questionnaire = await Questionnaire.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!questionnaire) {
      return res.status(404).json({ error: 'Cuestionario no encontrado' });
    }

    res.json({
      message: 'Cuestionario actualizado correctamente',
      questionnaire
    });

  } catch (error) {
    console.error('Error actualizando cuestionario:', error);
    res.status(400).json({ error: error.message });
  }
});

// Eliminar cuestionario (admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const questionnaire = await Questionnaire.findByIdAndDelete(req.params.id);
    
    if (!questionnaire) {
      return res.status(404).json({ error: 'Cuestionario no encontrado' });
    }

    // Eliminar respuestas asociadas
    await QuestionnaireResponse.deleteMany({ questionnaire: req.params.id });

    res.json({ message: 'Cuestionario eliminado correctamente' });

  } catch (error) {
    console.error('Error eliminando cuestionario:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== PATIENT ENDPOINTS =====

// Obtener cuestionarios pendientes (paciente)
router.get('/pending/list', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'patient') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    // Buscar respuestas pendientes del paciente
    const pendingResponses = await QuestionnaireResponse.find({
      patient: req.user.userId,
      status: { $in: ['pending', 'in-progress'] }
    })
      .populate({
        path: 'questionnaire',
        match: { status: 'active', showAsPopup: true },
        select: 'title description type questions showAsPopup priority'
      })
      .sort('questionnaire.priority'); // Ordenar por prioridad

    // Filtrar los que tienen cuestionario válido (algunos pueden estar inactivos)
    const validPending = pendingResponses.filter(r => r.questionnaire !== null);

    res.json(validPending);

  } catch (error) {
    console.error('Error obteniendo cuestionarios pendientes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Enviar respuesta a cuestionario (paciente)
router.post('/:id/respond', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'patient') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { responses } = req.body;

    if (!responses || responses.length === 0) {
      return res.status(400).json({ 
        error: 'Las respuestas son requeridas' 
      });
    }

    // Buscar la respuesta pendiente
    const questionnaireResponse = await QuestionnaireResponse.findOne({
      questionnaire: req.params.id,
      patient: req.user.userId
    }).populate('questionnaire');

    if (!questionnaireResponse) {
      return res.status(404).json({ 
        error: 'Cuestionario no encontrado o no asignado' 
      });
    }

    if (questionnaireResponse.status === 'completed') {
      return res.status(400).json({ 
        error: 'Este cuestionario ya fue completado' 
      });
    }

    // Validar que todas las preguntas requeridas tengan respuesta
    const questionnaire = questionnaireResponse.questionnaire;
    const requiredQuestions = questionnaire.questions.filter(q => q.required);
    
    for (const question of requiredQuestions) {
      const hasAnswer = responses.some(r => r.questionId === question.id && r.answer);
      if (!hasAnswer) {
        return res.status(400).json({ 
          error: `La pregunta "${question.text}" es requerida` 
        });
      }
    }

    // Guardar respuestas
    questionnaireResponse.responses = responses.map(r => ({
      questionId: r.questionId,
      questionText: questionnaire.questions.find(q => q.id === r.questionId)?.text || '',
      questionType: questionnaire.questions.find(q => q.id === r.questionId)?.type || '',
      answer: r.answer,
      answerText: r.answerText || String(r.answer)
    }));

    await questionnaireResponse.markAsStarted();
    await questionnaireResponse.complete();

    res.json({
      message: 'Cuestionario completado correctamente',
      response: questionnaireResponse
    });

  } catch (error) {
    console.error('Error enviando respuesta:', error);
    res.status(400).json({ error: error.message });
  }
});

// Obtener mis cuestionarios completados (paciente)
router.get('/my-responses', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'patient') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const responses = await QuestionnaireResponse.find({
      patient: req.user.userId,
      status: 'completed'
    })
      .populate('questionnaire', 'title type')
      .sort('-completedAt');

    res.json(responses);

  } catch (error) {
    console.error('Error obteniendo mis respuestas:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;