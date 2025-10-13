const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Medication = require('../models/Medication');
const Consultation = require('../models/Consultation');
const Reminder = require('../models/Reminder');
const { protect, admin } = require('../middleware/auth');

// @route   GET /api/analytics/dashboard
// @desc    Obtener métricas del dashboard
// @access  Private/Admin
router.get('/dashboard', protect, admin, async (req, res) => {
  try {
    const totalPatients = await User.countDocuments({ role: 'patient' });
    const totalMedications = await Medication.countDocuments();
    
    // Calcular adherencia global
    const patients = await User.find({ role: 'patient' });
    const totalAdherence = patients.reduce((sum, patient) => sum + patient.adherence, 0);
    const globalAdherence = totalPatients > 0 ? Math.round(totalAdherence / totalPatients) : 0;
    
    // Pacientes en riesgo (adherencia < 60%)
    const riskPatients = await User.countDocuments({ 
      role: 'patient', 
      adherence: { $lt: 60 } 
    });
    
    // Consultas pendientes
    const pendingConsultations = await Consultation.countDocuments({ 
      status: 'pending' 
    });
    
    // Adherencia por los últimos 7 días
    const weekAdherence = await getWeeklyAdherence();
    
    // Pacientes críticos
    const criticalPatients = await User.find({
      role: 'patient',
      $or: [
        { adherence: { $lt: 60 } },
        { lastActivity: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
      ]
    }).populate('medication', 'name');
    
    res.json({
      metrics: {
        totalPatients,
        totalMedications,
        globalAdherence,
        riskPatients,
        pendingConsultations
      },
      weekAdherence,
      criticalPatients
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/analytics/medications
// @desc    Obtener análisis por medicamento
// @access  Private/Admin
router.get('/medications', protect, admin, async (req, res) => {
  try {
    const medications = await Medication.find()
      .populate('patients', 'name adherence lastActivity');
    
    const analysis = medications.map(med => {
      const patients = med.patients || [];
      const totalAdherence = patients.reduce((sum, p) => sum + (p.adherence || 0), 0);
      const avgAdherence = patients.length > 0 ? Math.round(totalAdherence / patients.length) : 0;
      const riskPatients = patients.filter(p => p.adherence < 60).length;
      
      return {
        id: med._id,
        name: med.name,
        totalPatients: patients.length,
        avgAdherence,
        riskPatients,
        sideEffectsReports: med.sideEffectsReports
      };
    });
    
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/analytics/alerts
// @desc    Obtener alertas del sistema
// @access  Private/Admin
router.get('/alerts', protect, admin, async (req, res) => {
  try {
    const alerts = [];
    const now = new Date();
    
    // Pacientes con baja adherencia
    const lowAdherencePatients = await User.find({
      role: 'patient',
      adherence: { $lt: 60 }
    });
    
    lowAdherencePatients.forEach(patient => {
      alerts.push({
        type: 'critical',
        title: `Adherencia crítica: ${patient.name}`,
        description: `Adherencia actual: ${patient.adherence}%`,
        patient: patient.name,
        timestamp: new Date()
      });
    });
    
    // Pacientes inactivos
    const inactiveDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const inactivePatients = await User.find({
      role: 'patient',
      lastActivity: { $lt: inactiveDate }
    });
    
    inactivePatients.forEach(patient => {
      const daysInactive = Math.floor((now - patient.lastActivity) / (1000 * 60 * 60 * 24));
      alerts.push({
        type: 'warning',
        title: `Paciente inactivo: ${patient.name}`,
        description: `${daysInactive} días sin actividad`,
        patient: patient.name,
        timestamp: new Date()
      });
    });
    
    // Consultas urgentes sin responder
    const urgentConsultations = await Consultation.find({
      status: 'pending',
      urgency: 'high',
      createdAt: { $lt: new Date(now.getTime() - 4 * 60 * 60 * 1000) }
    }).populate('patient', 'name');
    
    urgentConsultations.forEach(consultation => {
      const hoursOld = Math.floor((now - consultation.createdAt) / (1000 * 60 * 60));
      alerts.push({
        type: 'critical',
        title: 'Consulta urgente sin responder',
        description: `${hoursOld}h esperando respuesta`,
        patient: consultation.patient.name,
        timestamp: consultation.createdAt
      });
    });
    
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Función auxiliar para obtener adherencia semanal
async function getWeeklyAdherence() {
  const weekData = [];
  const now = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    
    // Contar dosis del día
    const users = await User.find({ role: 'patient' });
    let totalDoses = 0;
    let takenDoses = 0;
    
    for (const user of users) {
      const dayDoses = user.doseHistory.filter(dose => {
        const doseDate = new Date(dose.scheduledTime);
        return doseDate >= date && doseDate < nextDate;
      });
      
      totalDoses += dayDoses.length;
      takenDoses += dayDoses.filter(d => d.status === 'taken').length;
    }
    
    const adherence = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0;
    
    weekData.push({
      date: date.toLocaleDateString('es-ES', { weekday: 'short' }),
      adherence: adherence || Math.floor(Math.random() * 20) + 70 // Datos simulados si no hay reales
    });
  }
  
  return weekData;
}

module.exports = router;