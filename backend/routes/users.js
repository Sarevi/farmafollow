const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, admin } = require('../middleware/auth');

// @route   GET /api/users/profile
// @desc    Obtener perfil del usuario actual
// @access  Private
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('medication')
      .populate('reminders');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/users/profile
// @desc    Actualizar perfil
// @access  Private
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, email } = req.body;
    
    const user = await User.findById(req.user._id);
    
    if (user) {
      user.name = name || user.name;
      user.email = email || user.email;
      user.lastActivity = Date.now();
      
      const updatedUser = await user.save();
      
      res.json({
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        adherence: updatedUser.adherence
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/users
// @desc    Obtener todos los usuarios (admin)
// @access  Private/Admin
router.get('/', protect, admin, async (req, res) => {
  try {
    const users = await User.find({ role: 'patient' })
      .select('-password')
      .populate('medication', 'name');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/users
// @desc    Crear usuario (admin)
// @access  Private/Admin
router.post('/', protect, admin, async (req, res) => {
  try {
    const { name, email, password, medicationId } = req.body;
    
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'El usuario ya existe' });
    }
    
    const user = await User.create({
      name,
      email,
      password,
      medication: medicationId
    });
    
    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/users/:id
// @desc    Eliminar usuario (admin)
// @access  Private/Admin
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    // Eliminar de medicamentos
    if (user.medication) {
      await Medication.findByIdAndUpdate(user.medication, {
        $pull: { patients: user._id }
      });
    }
    
    // Eliminar recordatorios y consultas
    await Reminder.deleteMany({ user: user._id });
    await Consultation.deleteMany({ patient: user._id });
    
    await user.deleteOne();
    
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;