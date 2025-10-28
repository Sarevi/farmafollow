const express = require('express');
const router = express.Router();
const Reminder = require('../models/Reminder');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Obtener recordatorios del usuario
router.get('/', auth, async (req, res) => {
  try {
    const reminders = await Reminder.find({ user: req.user.userId })
      .populate('medication', 'name description')
      .sort('-createdAt');
    
    res.json(reminders);
  } catch (error) {
    console.error('Error obteniendo recordatorios:', error);
    res.status(500).json({ error: error.message });
  }
});

// Crear recordatorio
router.post('/', auth, async (req, res) => {
  try {
    const { medication, time, frequency, days, notes } = req.body;
    
    const reminder = new Reminder({
      user: req.user.userId,
      medication,
      time,
      frequency: frequency || 'daily',
      days: days || [],
      notes: notes || '',
      isActive: true
    });
    
    await reminder.save();
    
    res.status(201).json(reminder);
  } catch (error) {
    console.error('Error creando recordatorio:', error);
    res.status(400).json({ error: error.message });
  }
});

// Actualizar recordatorio
router.put('/:id', auth, async (req, res) => {
  try {
    const allowedUpdates = ['time', 'frequency', 'days', 'notes', 'isActive'];
    const updates = {};
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });
    
    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, user: req.user.userId },
      updates,
      { new: true, runValidators: true }
    );
    
    if (!reminder) {
      return res.status(404).json({ error: 'Recordatorio no encontrado' });
    }
    
    res.json(reminder);
  } catch (error) {
    console.error('Error actualizando recordatorio:', error);
    res.status(400).json({ error: error.message });
  }
});

// Eliminar recordatorio
router.delete('/:id', auth, async (req, res) => {
  try {
    const reminder = await Reminder.findOneAndDelete({
      _id: req.params.id,
      user: req.user.userId
    });
    
    if (!reminder) {
      return res.status(404).json({ error: 'Recordatorio no encontrado' });
    }
    
    res.json({ message: 'Recordatorio eliminado correctamente' });
  } catch (error) {
    console.error('Error eliminando recordatorio:', error);
    res.status(500).json({ error: error.message });
  }
});

// Registrar dosis tomada
router.post('/:id/record-dose', auth, async (req, res) => {
  try {
    const { taken, notes } = req.body;
    const reminder = await Reminder.findOne({
      _id: req.params.id,
      user: req.user.userId
    });
    
    if (!reminder) {
      return res.status(404).json({ error: 'Recordatorio no encontrado' });
    }
    
    // Registrar en historial
    reminder.doseHistory.push({
      scheduledTime: new Date(),
      actualTime: new Date(),
      status: taken !== false ? 'taken' : 'missed',
      notes: notes || ''
    });
    
    await reminder.save();
    
    // Actualizar adherencia del usuario
    const user = await User.findById(req.user.userId);
    if (user) {
      user.adherence.push({
        date: new Date(),
        taken: taken !== false,
        medication: reminder.medication,
        notes: notes || ''
      });
      
      // Agregar a historial de dosis
      user.doseHistory.push({
        medication: reminder.medication,
        takenAt: new Date(),
        scheduled: true,
        notes: notes || ''
      });
      
      await user.save();
    }
    
    res.json({ 
      message: 'Dosis registrada correctamente',
      reminder,
      adherence: user ? user.calculateAdherence() : null
    });
  } catch (error) {
    console.error('Error registrando dosis:', error);
    res.status(400).json({ error: error.message });
  }
});

// Obtener historial de recordatorio
router.get('/:id/history', auth, async (req, res) => {
  try {
    const reminder = await Reminder.findOne({
      _id: req.params.id,
      user: req.user.userId
    }).populate('medication', 'name');
    
    if (!reminder) {
      return res.status(404).json({ error: 'Recordatorio no encontrado' });
    }
    
    // Ordenar historial por fecha descendente
    const history = reminder.doseHistory.sort((a, b) => b.actualTime - a.actualTime);
    
    res.json({
      reminder: {
        id: reminder._id,
        medication: reminder.medication,
        time: reminder.time,
        frequency: reminder.frequency
      },
      history
    });
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;