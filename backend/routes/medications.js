const express = require('express');
const router = express.Router();
const Medication = require('../models/Medication');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Obtener todos los medicamentos - MEJORADO con filtros
router.get('/', auth, async (req, res) => {
  try {
    const { search, indication, isActive } = req.query;
    
    let query = {};
    
    // Filtro por búsqueda (nombre o principio activo)
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { activeIngredient: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Filtro por indicación
    if (indication) {
      query.indications = indication;
    }
    
    // Filtro por estado activo
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    const medications = await Medication.find(query)
      .populate('patients', 'name email')
      .sort('name');
    
    // Agregar estadísticas calculadas
    const medicationsWithStats = await Promise.all(
      medications.map(async (med) => {
        const medObj = med.toObject();
        medObj.averageAdherence = await med.calculateAverageAdherence();
        medObj.adverseEventsCount = await med.countAdverseEvents();
        medObj.activePatients = await med.getActivePatients();
        return medObj;
      })
    );
    
    res.json(medicationsWithStats);
  } catch (error) {
    console.error('Error obteniendo medicamentos:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener medicamento por ID - MEJORADO con estadísticas
router.get('/:id', auth, async (req, res) => {
  try {
    const medication = await Medication.findById(req.params.id)
      .populate('patients', 'name email phone diseases')
      .populate('createdBy', 'name');
    
    if (!medication) {
      return res.status(404).json({ error: 'Medicamento no encontrado' });
    }
    
    // Agregar estadísticas
    const medObj = medication.toObject();
    medObj.averageAdherence = await medication.calculateAverageAdherence();
    medObj.adverseEventsCount = await medication.countAdverseEvents();
    medObj.activePatients = await medication.getActivePatients();
    
    res.json(medObj);
  } catch (error) {
    console.error('Error obteniendo medicamento:', error);
    res.status(500).json({ error: error.message });
  }
});

// Crear medicamento (admin) - MEJORADO con nuevos campos
router.post('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const {
      name,
      description,
      activeIngredient,
      adverseReactions,
      indications,
      contraindications,
      pharmaceuticalForm,
      standardDose,
      administrationRoute,
      videoUrl,
      faqs
    } = req.body;
    
    if (!name || !description) {
      return res.status(400).json({ error: 'Nombre y descripción son requeridos' });
    }
    
    const medication = new Medication({
      name,
      description,
      activeIngredient: activeIngredient || '',
      adverseReactions: adverseReactions || [],
      indications: indications || [],
      contraindications: contraindications || '',
      pharmaceuticalForm: pharmaceuticalForm || '',
      standardDose: standardDose || '',
      administrationRoute: administrationRoute || 'oral',
      videoUrl: videoUrl || '',
      faqs: faqs || [],
      createdBy: req.user.userId
    });
    
    await medication.save();
    
    res.status(201).json(medication);
  } catch (error) {
    console.error('Error creando medicamento:', error);
    res.status(400).json({ error: error.message });
  }
});

// Actualizar medicamento (admin) - MEJORADO con nuevos campos
router.put('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const allowedUpdates = [
      'name',
      'description',
      'activeIngredient',
      'adverseReactions',
      'indications',
      'contraindications',
      'pharmaceuticalForm',
      'standardDose',
      'administrationRoute',
      'videoUrl',
      'faqs',
      'isActive'
    ];
    
    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });
    
    const medication = await Medication.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );
    
    if (!medication) {
      return res.status(404).json({ error: 'Medicamento no encontrado' });
    }
    
    res.json(medication);
  } catch (error) {
    console.error('Error actualizando medicamento:', error);
    res.status(400).json({ error: error.message });
  }
});

// Eliminar medicamento (admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const medication = await Medication.findByIdAndDelete(req.params.id);
    
    if (!medication) {
      return res.status(404).json({ error: 'Medicamento no encontrado' });
    }
    
    res.json({ message: 'Medicamento eliminado correctamente' });
  } catch (error) {
    console.error('Error eliminando medicamento:', error);
    res.status(500).json({ error: error.message });
  }
});

// Asignar medicamento a paciente (admin)
router.post('/:id/assign', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const { patientId } = req.body;
    
    if (!patientId) {
      return res.status(400).json({ error: 'ID del paciente es requerido' });
    }
    
    const medication = await Medication.findById(req.params.id);
    const patient = await User.findById(patientId);
    
    if (!medication) {
      return res.status(404).json({ error: 'Medicamento no encontrado' });
    }
    
    if (!patient || patient.role !== 'patient') {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }
    
    // Verificar si ya está asignado
    if (medication.patients.includes(patientId)) {
      return res.status(400).json({ error: 'El medicamento ya está asignado a este paciente' });
    }
    
    await medication.addPatient(patientId);
    
    res.json({ message: 'Medicamento asignado correctamente', medication });
  } catch (error) {
    console.error('Error asignando medicamento:', error);
    res.status(400).json({ error: error.message });
  }
});

// Desasignar medicamento de paciente (admin)
router.post('/:id/unassign', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const { patientId } = req.body;
    
    if (!patientId) {
      return res.status(400).json({ error: 'ID del paciente es requerido' });
    }
    
    const medication = await Medication.findById(req.params.id);
    
    if (!medication) {
      return res.status(404).json({ error: 'Medicamento no encontrado' });
    }
    
    await medication.removePatient(patientId);
    
    res.json({ message: 'Medicamento desasignado correctamente', medication });
  } catch (error) {
    console.error('Error desasignando medicamento:', error);
    res.status(400).json({ error: error.message });
  }
});

// Obtener pacientes de un medicamento (admin) - NUEVO
router.get('/:id/patients', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const medication = await Medication.findById(req.params.id)
      .populate('patients', 'name email phone diseases');
    
    if (!medication) {
      return res.status(404).json({ error: 'Medicamento no encontrado' });
    }
    
    // Agregar adherencia a cada paciente
    const patientsWithAdherence = medication.patients.map(patient => {
      const patientObj = patient.toObject();
      patientObj.adherenceRate = patient.calculateAdherence();
      return patientObj;
    });
    
    res.json(patientsWithAdherence);
  } catch (error) {
    console.error('Error obteniendo pacientes del medicamento:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener estadísticas detalladas de un medicamento (admin) - NUEVO
router.get('/:id/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const medication = await Medication.findById(req.params.id);
    
    if (!medication) {
      return res.status(404).json({ error: 'Medicamento no encontrado' });
    }
    
    const activePatients = await medication.getActivePatients();
    const averageAdherence = await medication.calculateAverageAdherence();
    const adverseEvents = await medication.countAdverseEvents();
    
    // Calcular adherencia por paciente
    const adherenceByPatient = activePatients.map(patient => ({
      patientId: patient._id,
      name: patient.name,
      adherence: patient.calculateAdherence()
    }));
    
    // Eventos adversos recientes (últimos 30 días)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const patientsWithEvents = await User.find({
      _id: { $in: medication.patients },
      'adverseEvents.medication': medication._id,
      'adverseEvents.date': { $gte: thirtyDaysAgo }
    });
    
    const recentAdverseEvents = [];
    patientsWithEvents.forEach(patient => {
      patient.adverseEvents.forEach(event => {
        if (
          event.medication?.toString() === medication._id.toString() &&
          event.date >= thirtyDaysAgo
        ) {
          recentAdverseEvents.push({
            patient: patient.name,
            event: event.event,
            severity: event.severity,
            date: event.date,
            resolved: event.resolved
          });
        }
      });
    });
    
    const stats = {
      totalPatients: medication.patients.length,
      activePatients: activePatients.length,
      averageAdherence,
      adverseEvents,
      adherenceByPatient,
      recentAdverseEvents,
      adherenceDistribution: {
        excellent: adherenceByPatient.filter(p => p.adherence >= 90).length,
        good: adherenceByPatient.filter(p => p.adherence >= 70 && p.adherence < 90).length,
        poor: adherenceByPatient.filter(p => p.adherence < 70).length
      }
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error obteniendo estadísticas del medicamento:', error);
    res.status(500).json({ error: error.message });
  }
});

// Agregar FAQ a medicamento (admin) - NUEVO
router.post('/:id/faqs', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const { question, answer } = req.body;
    
    if (!question || !answer) {
      return res.status(400).json({ error: 'Pregunta y respuesta son requeridas' });
    }
    
    const medication = await Medication.findById(req.params.id);
    
    if (!medication) {
      return res.status(404).json({ error: 'Medicamento no encontrado' });
    }
    
    medication.faqs.push({ question, answer });
    await medication.save();
    
    res.status(201).json(medication.faqs[medication.faqs.length - 1]);
  } catch (error) {
    console.error('Error agregando FAQ:', error);
    res.status(400).json({ error: error.message });
  }
});

// Actualizar FAQ de medicamento (admin) - NUEVO
router.put('/:id/faqs/:faqId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const { question, answer } = req.body;
    
    const medication = await Medication.findById(req.params.id);
    
    if (!medication) {
      return res.status(404).json({ error: 'Medicamento no encontrado' });
    }
    
    const faq = medication.faqs.id(req.params.faqId);
    
    if (!faq) {
      return res.status(404).json({ error: 'FAQ no encontrada' });
    }
    
    if (question) faq.question = question;
    if (answer) faq.answer = answer;
    
    await medication.save();
    
    res.json(faq);
  } catch (error) {
    console.error('Error actualizando FAQ:', error);
    res.status(400).json({ error: error.message });
  }
});

// Eliminar FAQ de medicamento (admin) - NUEVO
router.delete('/:id/faqs/:faqId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const medication = await Medication.findById(req.params.id);
    
    if (!medication) {
      return res.status(404).json({ error: 'Medicamento no encontrado' });
    }
    
    medication.faqs.pull(req.params.faqId);
    await medication.save();
    
    res.json({ message: 'FAQ eliminada correctamente' });
  } catch (error) {
    console.error('Error eliminando FAQ:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener todas las indicaciones únicas (para filtros) - NUEVO
router.get('/meta/indications', auth, async (req, res) => {
  try {
    const medications = await Medication.find({ isActive: true });
    
    const indicationsSet = new Set();
    medications.forEach(med => {
      if (med.indications) {
        med.indications.forEach(indication => {
          if (indication) indicationsSet.add(indication);
        });
      }
    });
    
    const indications = Array.from(indicationsSet).sort();
    
    res.json(indications);
  } catch (error) {
    console.error('Error obteniendo indicaciones:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;