const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Medication = require('../models/Medication');
const Consultation = require('../models/Consultation');
const Questionnaire = require('../models/Questionnaire');
const QuestionnaireResponse = require('../models/QuestionnaireResponse');
const auth = require('../middleware/auth');

// Obtener analytics generales - MEJORADO
router.get('/', auth, async (req, res) => {
  try {
    // Verificar que es admin
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    // 1. MÉTRICAS GENERALES
    const totalPatients = await User.countDocuments({ role: 'patient', isActive: true });
    const totalMedications = await Medication.countDocuments({ isActive: true });
    
    // Adherencia promedio global
    const patients = await User.find({ role: 'patient', isActive: true });
    let totalAdherence = 0;
    patients.forEach(patient => {
      totalAdherence += patient.calculateAdherence();
    });
    const averageAdherence = patients.length > 0 
      ? Math.round(totalAdherence / patients.length) 
      : 100;

    // Consultas
    const pendingConsultations = await Consultation.countDocuments({ status: 'pending' });
    const totalConsultations = await Consultation.countDocuments();
    const resolvedConsultations = await Consultation.countDocuments({ status: 'resolved' });

    // Cuestionarios
    const pendingQuestionnaires = await QuestionnaireResponse.countDocuments({ 
      status: { $in: ['pending', 'in-progress'] }
    });
    const completedQuestionnaires = await QuestionnaireResponse.countDocuments({ 
      status: 'completed' 
    });

    // Eventos adversos
    const patientsWithEvents = await User.find({
      role: 'patient',
      'adverseEvents.0': { $exists: true }
    });
    
    let unresolvedAdverseEvents = 0;
    let totalAdverseEvents = 0;
    const recentAdverseEvents = []; // Últimos 7 días
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    patientsWithEvents.forEach(patient => {
      patient.adverseEvents.forEach(event => {
        totalAdverseEvents++;
        if (!event.resolved) {
          unresolvedAdverseEvents++;
        }
        if (event.date >= sevenDaysAgo) {
          recentAdverseEvents.push({
            patient: patient.name,
            event: event.event,
            severity: event.severity,
            date: event.date
          });
        }
      });
    });

    // 2. ALERTAS
    const alerts = [];

    // Pacientes con baja adherencia (<70%)
    const lowAdherencePatients = patients.filter(p => p.calculateAdherence() < 70);
    if (lowAdherencePatients.length > 0) {
      alerts.push({
        type: 'danger',
        message: `${lowAdherencePatients.length} paciente(s) con adherencia menor al 70%`,
        count: lowAdherencePatients.length,
        patients: lowAdherencePatients.map(p => ({
          id: p._id,
          name: p.name,
          adherence: p.calculateAdherence()
        }))
      });
    }

    // Eventos adversos sin resolver
    if (unresolvedAdverseEvents > 0) {
      alerts.push({
        type: 'warning',
        message: `${unresolvedAdverseEvents} evento(s) adverso(s) sin resolver`,
        count: unresolvedAdverseEvents
      });
    }

    // Cuestionarios sin responder más de 7 días
    const oldPendingResponses = await QuestionnaireResponse.find({
      status: 'pending',
      createdAt: { $lt: sevenDaysAgo }
    }).populate('patient', 'name').populate('questionnaire', 'title');
    
    if (oldPendingResponses.length > 0) {
      alerts.push({
        type: 'warning',
        message: `${oldPendingResponses.length} cuestionario(s) sin responder hace más de 7 días`,
        count: oldPendingResponses.length,
        questionnaires: oldPendingResponses.map(r => ({
          patient: r.patient?.name,
          questionnaire: r.questionnaire?.title,
          daysPending: Math.floor((Date.now() - r.createdAt) / (1000 * 60 * 60 * 24))
        }))
      });
    }

    // Consultas urgentes pendientes
    const urgentConsultations = await Consultation.countDocuments({
      status: 'pending',
      urgency: 'high'
    });
    
    if (urgentConsultations > 0) {
      alerts.push({
        type: 'danger',
        message: `${urgentConsultations} consulta(s) urgente(s) pendiente(s)`,
        count: urgentConsultations
      });
    }

    // 3. RESPUESTA
    res.json({
      generalMetrics: {
        totalPatients,
        totalMedications,
        averageAdherence,
        pendingConsultations,
        totalConsultations,
        resolvedConsultations,
        pendingQuestionnaires,
        completedQuestionnaires,
        totalAdverseEvents,
        unresolvedAdverseEvents,
        recentAdverseEvents: recentAdverseEvents.length
      },
      alerts,
      recentActivity: {
        adverseEvents: recentAdverseEvents.slice(0, 5) // Últimos 5
      }
    });

  } catch (error) {
    console.error('Error obteniendo analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener analytics por medicamento - NUEVO
router.get('/by-medication', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const medications = await Medication.find({ isActive: true });
    
    const medicationStats = await Promise.all(medications.map(async (med) => {
      const avgAdherence = await med.calculateAverageAdherence();
      const adverseEvents = await med.countAdverseEvents();
      const activePatients = await med.getActivePatients();
      
      return {
        id: med._id,
        name: med.name,
        activeIngredient: med.activeIngredient,
        patientCount: activePatients.length,
        averageAdherence: avgAdherence,
        adverseEvents: adverseEvents.total,
        unresolvedAdverseEvents: adverseEvents.unresolved,
        indications: med.indications
      };
    }));

    res.json(medicationStats);

  } catch (error) {
    console.error('Error obteniendo analytics por medicamento:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener analytics por enfermedad - NUEVO
router.get('/by-disease', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    // Obtener todas las enfermedades únicas
    const patients = await User.find({ role: 'patient', isActive: true });
    const diseaseMap = new Map();

    patients.forEach(patient => {
      if (patient.diseases && patient.diseases.length > 0) {
        patient.diseases.forEach(disease => {
          if (!diseaseMap.has(disease)) {
            diseaseMap.set(disease, []);
          }
          diseaseMap.get(disease).push(patient);
        });
      }
    });

    // Calcular estadísticas por enfermedad
    const diseaseStats = [];
    
    for (const [disease, patientsWithDisease] of diseaseMap.entries()) {
      let totalAdherence = 0;
      let totalAdverseEvents = 0;
      let unresolvedAdverseEvents = 0;

      patientsWithDisease.forEach(patient => {
        totalAdherence += patient.calculateAdherence();
        
        if (patient.adverseEvents) {
          const events = patient.adverseEvents.filter(e => !e.resolved);
          unresolvedAdverseEvents += events.length;
          totalAdverseEvents += patient.adverseEvents.length;
        }
      });

      const avgAdherence = patientsWithDisease.length > 0
        ? Math.round(totalAdherence / patientsWithDisease.length)
        : 100;

      diseaseStats.push({
        disease,
        patientCount: patientsWithDisease.length,
        averageAdherence: avgAdherence,
        totalAdverseEvents,
        unresolvedAdverseEvents
      });
    }

    // Ordenar por número de pacientes
    diseaseStats.sort((a, b) => b.patientCount - a.patientCount);

    res.json(diseaseStats);

  } catch (error) {
    console.error('Error obteniendo analytics por enfermedad:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener pacientes con baja adherencia - NUEVO
router.get('/low-adherence', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const threshold = parseInt(req.query.threshold) || 70;
    const patients = await User.find({ role: 'patient', isActive: true })
      .populate('doseHistory.medication', 'name');

    const lowAdherencePatients = patients
      .map(patient => ({
        id: patient._id,
        name: patient.name,
        email: patient.email,
        adherence: patient.calculateAdherence(),
        diseases: patient.diseases,
        lastDose: patient.getLastDose(),
        phone: patient.phone
      }))
      .filter(p => p.adherence < threshold)
      .sort((a, b) => a.adherence - b.adherence);

    res.json(lowAdherencePatients);

  } catch (error) {
    console.error('Error obteniendo pacientes con baja adherencia:', error);
    res.status(500).json({ error: error.message });
  }
});

// Exportar datos para reportes - NUEVO
router.get('/export', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { type } = req.query; // 'patients', 'medications', 'consultations', 'questionnaires'

    let data = [];

    switch (type) {
      case 'patients':
        const patients = await User.find({ role: 'patient', isActive: true });
        data = patients.map(p => ({
          nombre: p.name,
          email: p.email,
          telefono: p.phone || '',
          enfermedades: p.diseases?.join(', ') || '',
          adherencia: p.calculateAdherence(),
          edad: p.getAge() || '',
          fechaInicio: p.startDate ? p.startDate.toLocaleDateString() : '',
          eventosAdversos: p.adverseEvents?.length || 0
        }));
        break;

      case 'medications':
        const medications = await Medication.find({ isActive: true });
        data = await Promise.all(medications.map(async (m) => ({
          nombre: m.name,
          principioActivo: m.activeIngredient || '',
          indicaciones: m.indications?.join(', ') || '',
          pacientes: m.patients?.length || 0,
          adherenciaPromedio: await m.calculateAverageAdherence(),
          eventosAdversos: (await m.countAdverseEvents()).total
        })));
        break;

      case 'consultations':
        const consultations = await Consultation.find()
          .populate('patient', 'name email')
          .sort('-createdAt');
        data = consultations.map(c => ({
          paciente: c.patient?.name || '',
          email: c.patient?.email || '',
          asunto: c.subject,
          mensaje: c.message,
          urgencia: c.urgency,
          estado: c.status,
          fecha: c.createdAt.toLocaleDateString(),
          respuesta: c.response || ''
        }));
        break;

      case 'questionnaires':
        const responses = await QuestionnaireResponse.find({ status: 'completed' })
          .populate('patient', 'name email')
          .populate('questionnaire', 'title type');
        data = responses.map(r => ({
          paciente: r.patient?.name || '',
          cuestionario: r.questionnaire?.title || '',
          tipo: r.questionnaire?.type || '',
          completado: r.completedAt?.toLocaleDateString() || '',
          tiempoCompletado: r.timeToComplete ? `${Math.round(r.timeToComplete / 60)} min` : '',
          revisado: r.reviewed ? 'Sí' : 'No'
        }));
        break;

      default:
        return res.status(400).json({ error: 'Tipo de exportación no válido' });
    }

    res.json(data);

  } catch (error) {
    console.error('Error exportando datos:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;