const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Medication = require('../models/Medication');
const auth = require('../middleware/auth');

// Obtener todos los usuarios (admin) - MEJORADO con filtros
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    // Filtros opcionales
    const { 
      medication, 
      disease, 
      minAdherence, 
      maxAdherence,
      search 
    } = req.query;

    let query = { role: 'patient' };
    
    // Filtro por enfermedad
    if (disease) {
      query.diseases = disease;
    }

    // Filtro por búsqueda (nombre o email)
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    let users = await User.find(query)
      .populate('doseHistory.medication', 'name')
      .sort('-createdAt');

    // Filtro por medicamento (requiere buscar en Medication)
    if (medication) {
      const med = await Medication.findById(medication);
      if (med && med.patients) {
        const patientIds = med.patients.map(id => id.toString());
        users = users.filter(u => patientIds.includes(u._id.toString()));
      }
    }

    // Filtro por adherencia
    if (minAdherence || maxAdherence) {
      users = users.filter(u => {
        const adherence = u.calculateAdherence();
        if (minAdherence && adherence < parseInt(minAdherence)) return false;
        if (maxAdherence && adherence > parseInt(maxAdherence)) return false;
        return true;
      });
    }

    // Agregar adherencia calculada y última dosis
    const usersWithStats = users.map(u => {
      const userObj = u.toObject();
      userObj.adherenceRate = u.calculateAdherence();
      userObj.lastDose = u.getLastDose();
      userObj.age = u.getAge();
      userObj.activeAdverseEvents = u.getActiveAdverseEvents().length;
      return userObj;
    });

    res.json(usersWithStats);
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener perfil completo de un paciente (admin) - NUEVO
router.get('/:id/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const patient = await User.findById(req.params.id)
      .populate('doseHistory.medication', 'name')
      .populate('adverseEvents.medication', 'name')
      .populate('notes.author', 'name');

    if (!patient) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    // Obtener medicamentos asignados
    const medications = await Medication.find({ 
      patients: patient._id 
    });

    // Obtener consultas del paciente
    const Consultation = require('../models/Consultation');
    const consultations = await Consultation.find({ 
      patient: patient._id 
    }).sort('-createdAt');

    // Obtener respuestas a cuestionarios
    const QuestionnaireResponse = require('../models/QuestionnaireResponse');
    const questionnaireResponses = await QuestionnaireResponse.find({ 
      patient: patient._id 
    })
    .populate('questionnaire', 'title type')
    .sort('-completedAt');

    // Construir perfil completo
    const profile = {
      patient: {
        ...patient.toObject(),
        adherenceRate: patient.calculateAdherence(),
        age: patient.getAge(),
        lastDose: patient.getLastDose(),
        activeAdverseEvents: patient.getActiveAdverseEvents()
      },
      medications,
      consultations,
      questionnaireResponses,
      stats: {
        totalDoses: patient.doseHistory?.length || 0,
        totalAdverseEvents: patient.adverseEvents?.length || 0,
        unresolvedAdverseEvents: patient.getActiveAdverseEvents().length,
        totalConsultations: consultations.length,
        pendingConsultations: consultations.filter(c => c.status === 'pending').length,
        completedQuestionnaires: questionnaireResponses.filter(r => r.status === 'completed').length
      }
    };

    res.json(profile);
  } catch (error) {
    console.error('Error obteniendo perfil del paciente:', error);
    res.status(500).json({ error: error.message });
  }
});

// Actualizar usuario (admin) - MEJORADO con nuevos campos
router.put('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const allowedUpdates = [
      'name', 
      'email', 
      'phone',
      'dateOfBirth',
      'gender',
      'diseases',
      'startDate',
      'isActive'
    ];
    
    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(updatedUser);
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    res.status(400).json({ error: error.message });
  }
});

// Eliminar usuario (admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const deletedUser = await User.findByIdAndDelete(req.params.id);
    
    if (!deletedUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Remover de medicamentos
    await Medication.updateMany(
      { patients: req.params.id },
      { $pull: { patients: req.params.id } }
    );

    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== EVENTOS ADVERSOS - NUEVOS ENDPOINTS =====

// Agregar evento adverso (admin)
router.post('/:id/adverse-events', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const patient = await User.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    const { event, severity, medication, action, notes } = req.body;

    if (!event) {
      return res.status(400).json({ error: 'El evento es requerido' });
    }

    patient.adverseEvents.push({
      event,
      severity: severity || 'leve',
      medication,
      action: action || '',
      notes: notes || '',
      resolved: false,
      date: new Date()
    });

    await patient.save();

    res.status(201).json(patient.adverseEvents[patient.adverseEvents.length - 1]);
  } catch (error) {
    console.error('Error agregando evento adverso:', error);
    res.status(400).json({ error: error.message });
  }
});

// Actualizar evento adverso (admin)
router.put('/:id/adverse-events/:eventId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const patient = await User.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    const event = patient.adverseEvents.id(req.params.eventId);
    if (!event) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    const { action, notes, resolved, severity } = req.body;

    if (action !== undefined) event.action = action;
    if (notes !== undefined) event.notes = notes;
    if (resolved !== undefined) event.resolved = resolved;
    if (severity !== undefined) event.severity = severity;

    await patient.save();

    res.json(event);
  } catch (error) {
    console.error('Error actualizando evento adverso:', error);
    res.status(400).json({ error: error.message });
  }
});

// Eliminar evento adverso (admin)
router.delete('/:id/adverse-events/:eventId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const patient = await User.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    patient.adverseEvents.pull(req.params.eventId);
    await patient.save();

    res.json({ message: 'Evento adverso eliminado' });
  } catch (error) {
    console.error('Error eliminando evento adverso:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== NOTAS DEL FARMACÉUTICO - NUEVOS ENDPOINTS =====

// Agregar nota (admin)
router.post('/:id/notes', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const patient = await User.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'El contenido de la nota es requerido' });
    }

    patient.notes.push({
      content,
      author: req.user.userId,
      date: new Date()
    });

    await patient.save();

    const savedNote = patient.notes[patient.notes.length - 1];
    await patient.populate('notes.author', 'name');

    res.status(201).json(savedNote);
  } catch (error) {
    console.error('Error agregando nota:', error);
    res.status(400).json({ error: error.message });
  }
});

// Actualizar nota (admin)
router.put('/:id/notes/:noteId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const patient = await User.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    const note = patient.notes.id(req.params.noteId);
    if (!note) {
      return res.status(404).json({ error: 'Nota no encontrada' });
    }

    const { content } = req.body;
    if (content) {
      note.content = content;
      await patient.save();
    }

    res.json(note);
  } catch (error) {
    console.error('Error actualizando nota:', error);
    res.status(400).json({ error: error.message });
  }
});

// Eliminar nota (admin)
router.delete('/:id/notes/:noteId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const patient = await User.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    patient.notes.pull(req.params.noteId);
    await patient.save();

    res.json({ message: 'Nota eliminada' });
  } catch (error) {
    console.error('Error eliminando nota:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener adherencia detallada de un paciente (admin)
router.get('/:id/adherence', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const patient = await User.findById(req.params.id)
      .populate('adherence.medication', 'name');

    if (!patient) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    const { days } = req.query;
    const daysToShow = parseInt(days) || 30;

    const recentAdherence = patient.adherence
      .slice(-daysToShow)
      .sort((a, b) => b.date - a.date);

    const stats = {
      overall: patient.calculateAdherence(daysToShow),
      total: recentAdherence.length,
      taken: recentAdherence.filter(a => a.taken).length,
      missed: recentAdherence.filter(a => !a.taken).length
    };

    res.json({
      stats,
      adherence: recentAdherence
    });
  } catch (error) {
    console.error('Error obteniendo adherencia:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;