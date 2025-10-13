const express = require('express');
const router = express.Router();
const Consultation = require('../models/Consultation');
const User = require('../models/User');
const { protect, admin } = require('../middleware/auth');
const nodemailer = require('nodemailer');

// Configurar transporter de email de forma segura
let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  try {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: process.env.EMAIL_PORT || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    console.log('📧 Servicio de email configurado');
  } catch (error) {
    console.log('❌ Error configurando email:', error.message);
    console.log('⚠️ Email no configurado, las notificaciones por email no funcionarán');
  }
} else {
  console.log('⚠️ Credenciales de email no configuradas');
}

// @route   GET /api/consultations
// @desc    Obtener consultas (admin: todas, usuario: propias)
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { patient: req.user._id };
    
    const consultations = await Consultation.find(filter)
      .populate('patient', 'name email')
      .populate('medication', 'name')
      .sort('-createdAt');
      
    res.json(consultations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/consultations
// @desc    Crear consulta
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { subject, message, contact, urgency } = req.body;
    
    const consultation = await Consultation.create({
      patient: req.user._id,
      medication: req.user.medication,
      subject,
      message,
      contact: contact || req.user.email,
      urgency: urgency || 'medium'
    });
    
    // Actualizar contador de consultas del usuario
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { consultations: 1 }
    });
    
    // Intentar enviar email de notificación
    if (transporter && process.env.EMAIL_USER) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: 'consultasfarmachuo@gmail.com',
          subject: `FarmaFollow - Nueva consulta: ${subject}`,
          html: `
            <h2>Nueva Consulta Farmacéutica</h2>
            <p><strong>Paciente:</strong> ${req.user.name}</p>
            <p><strong>Email:</strong> ${contact || req.user.email}</p>
            <p><strong>Asunto:</strong> ${subject}</p>
            <p><strong>Urgencia:</strong> ${urgency || 'medium'}</p>
            <p><strong>Mensaje:</strong></p>
            <p>${message}</p>
          `
        });
        console.log('✅ Email de notificación enviado');
      } catch (emailError) {
        console.error('❌ Error enviando email:', emailError.message);
        // No fallar la operación si el email no se envía
      }
    }
    
    res.status(201).json(consultation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/consultations/:id/respond
// @desc    Responder consulta (admin)
// @access  Private/Admin
router.put('/:id/respond', protect, admin, async (req, res) => {
  try {
    const { response } = req.body;
    
    const consultation = await Consultation.findByIdAndUpdate(
      req.params.id,
      {
        response,
        status: 'resolved',
        respondedBy: req.user._id,
        respondedAt: Date.now()
      },
      { new: true }
    ).populate('patient', 'name email');
    
    if (!consultation) {
      return res.status(404).json({ message: 'Consulta no encontrada' });
    }
    
    // Intentar enviar email al paciente con la respuesta
    if (transporter && process.env.EMAIL_USER && consultation.patient.email) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: consultation.patient.email,
          subject: 'FarmaFollow - Respuesta a tu consulta',
          html: `
            <h2>Respuesta del Farmacéutico</h2>
            <p><strong>Tu consulta:</strong> ${consultation.message}</p>
            <hr>
            <p><strong>Respuesta:</strong></p>
            <p>${response}</p>
          `
        });
        console.log('✅ Respuesta enviada por email al paciente');
      } catch (emailError) {
        console.error('❌ Error enviando respuesta por email:', emailError.message);
        // No fallar la operación si el email no se envía
      }
    }
    
    res.json(consultation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/consultations/:id
// @desc    Obtener una consulta específica
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const consultation = await Consultation.findById(req.params.id)
      .populate('patient', 'name email')
      .populate('medication', 'name');
    
    if (!consultation) {
      return res.status(404).json({ message: 'Consulta no encontrada' });
    }
    
    // Verificar que el usuario tenga acceso
    if (req.user.role !== 'admin' && consultation.patient._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'No tienes acceso a esta consulta' });
    }
    
    res.json(consultation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/consultations/:id
// @desc    Eliminar consulta (admin)
// @access  Private/Admin
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const consultation = await Consultation.findById(req.params.id);
    
    if (!consultation) {
      return res.status(404).json({ message: 'Consulta no encontrada' });
    }
    
    await consultation.deleteOne();
    
    res.json({ message: 'Consulta eliminada' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;