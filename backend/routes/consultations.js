const express = require('express');
const router = express.Router();
const Consultation = require('../models/Consultation');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Los emails están desactivados temporalmente
// Si quieres activarlos en el futuro, descomenta las líneas relacionadas con nodemailer

// Crear consulta
router.post('/', auth, async (req, res) => {
  try {
    const { subject, message, contact, urgency } = req.body;
    
    const consultation = new Consultation({
      patient: req.user.userId,
      subject,
      message,
      contact,
      urgency: urgency || 'medium'
    });
    
    await consultation.save();
    
    // Email desactivado temporalmente - Las consultas se guardan en la BD
    // y puedes verlas en el panel de administración
    console.log('📝 Consulta guardada (email desactivado)');
    
    res.status(201).json(consultation);
  } catch (error) {
    console.error('Error creando consulta:', error);
    res.status(400).json({ error: error.message });
  }
});

// Obtener consultas del usuario
router.get('/', auth, async (req, res) => {
  try {
    const consultations = await Consultation.find({ patient: req.user.userId })
      .sort('-createdAt');
    res.json(consultations);
  } catch (error) {
    console.error('Error obteniendo consultas:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener todas las consultas (admin)
router.get('/all', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const consultations = await Consultation.find()
      .populate('patient', 'name email')
      .sort('-createdAt');
    res.json(consultations);
  } catch (error) {
    console.error('Error obteniendo consultas:', error);
    res.status(500).json({ error: error.message });
  }
});

// Responder consulta (admin)
router.put('/:id/respond', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const { response } = req.body;
    const consultation = await Consultation.findByIdAndUpdate(
      req.params.id,
      {
        response,
        status: 'resolved',
        respondedAt: new Date()
      },
      { new: true }
    ).populate('patient', 'name email');
    
    if (!consultation) {
      return res.status(404).json({ error: 'Consulta no encontrada' });
    }
    
    // Email desactivado temporalmente
    console.log('📝 Consulta respondida (email desactivado)');
    
    res.json(consultation);
  } catch (error) {
    console.error('Error respondiendo consulta:', error);
    res.status(400).json({ error: error.message });
  }
});

// Eliminar consulta (admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const consultation = await Consultation.findByIdAndDelete(req.params.id);
    
    if (!consultation) {
      return res.status(404).json({ error: 'Consulta no encontrada' });
    }
    
    res.json({ message: 'Consulta eliminada correctamente' });
  } catch (error) {
    console.error('Error eliminando consulta:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;