const express = require('express');
const router = express.Router();
const Reminder = require('../models/Reminder');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// @route   GET /api/reminders
// @desc    Obtener recordatorios del usuario
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const reminders = await Reminder.find({ user: req.user._id })
      .populate('medication', 'name description');
    res.json(reminders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/reminders
// @desc    Crear recordatorio
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { time, frequency, message, medicationId } = req.body;
    
    const reminder = await Reminder.create({
      user: req.user._id,
      medication: medicationId || req.user.medication,
      time,
      frequency,
      message,
      nextNotification: calculateNextNotification(time, frequency)
    });
    
    // Añadir recordatorio al usuario
    const user = await User.findById(req.user._id);
    user.reminders.push(reminder._id);
    await user.save();
    
    res.status(201).json(reminder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/reminders/:id/dose
// @desc    Actualizar estado de dosis
// @access  Private
router.put('/:id/dose', protect, async (req, res) => {
  try {
    const { status } = req.body;
    const reminder = await Reminder.findById(req.params.id);
    
    if (!reminder || reminder.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: 'Recordatorio no encontrado' });
    }
    
    // Registrar la dosis
    reminder.doseHistory.push({
      scheduledTime: reminder.nextNotification,
      actualTime: new Date(),
      status
    });
    
    // Calcular próxima notificación
    reminder.nextNotification = calculateNextNotification(reminder.time, reminder.frequency);
    await reminder.save();
    
    // Actualizar historial del usuario
    const user = await User.findById(req.user._id);
    user.doseHistory.push({
      medicationId: reminder.medication,
      scheduledTime: reminder.nextNotification,
      actualTime: status === 'taken' ? new Date() : null,
      status
    });
    await user.updateAdherence();
    
    res.json({ message: 'Dosis actualizada', adherence: user.adherence });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/reminders/:id
// @desc    Eliminar recordatorio
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const reminder = await Reminder.findById(req.params.id);
    
    if (!reminder || reminder.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: 'Recordatorio no encontrado' });
    }
    
    await reminder.deleteOne();
    
    // Eliminar del usuario
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { reminders: req.params.id }
    });
    
    res.json({ message: 'Recordatorio eliminado' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Función auxiliar para calcular próxima notificación
function calculateNextNotification(time, frequency) {
  const now = new Date();
  const [hours, minutes] = time.split(':').map(Number);
  let nextDate = new Date(now);
  
  nextDate.setHours(hours, minutes, 0, 0);
  
  if (nextDate <= now) {
    nextDate.setDate(nextDate.getDate() + 1);
  }
  
  switch (frequency) {
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'biweekly':
      nextDate.setDate(nextDate.getDate() + 14);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'bimonthly':
      nextDate.setMonth(nextDate.getMonth() + 2);
      break;
  }
  
  return nextDate;
}

module.exports = router;