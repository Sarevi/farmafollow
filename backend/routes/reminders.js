const express = require('express');
const router = express.Router();
const Reminder = require('../models/Reminder');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Obtener todos los recordatorios del usuario
router.get('/', auth, async (req, res) => {
  try {
    const reminders = await Reminder.find({ 
      user: req.user.userId 
    })
      .populate('medication', 'name description videoUrl faqs')
      .sort('time');
    
    // Agregar datos calculados
    const remindersWithStats = reminders.map(reminder => {
      const reminderObj = reminder.toObject();
      reminderObj.adherence = reminder.calculateAdherence();
      reminderObj.nextNotification = reminder.getNextNotification();
      return reminderObj;
    });
    
    res.json(remindersWithStats);
  } catch (error) {
    console.error('Error obteniendo recordatorios:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener un recordatorio específico
router.get('/:id', auth, async (req, res) => {
  try {
    const reminder = await Reminder.findOne({
      _id: req.params.id,
      user: req.user.userId
    }).populate('medication', 'name description');
    
    if (!reminder) {
      return res.status(404).json({ error: 'Recordatorio no encontrado' });
    }
    
    const reminderObj = reminder.toObject();
    reminderObj.adherence = reminder.calculateAdherence();
    reminderObj.nextNotification = reminder.getNextNotification();
    
    res.json(reminderObj);
  } catch (error) {
    console.error('Error obteniendo recordatorio:', error);
    res.status(500).json({ error: error.message });
  }
});

// Crear nuevo recordatorio
router.post('/', auth, async (req, res) => {
  try {
    const { medication, time, frequency, daysOfWeek, notes } = req.body;
    
    // Validaciones
    if (!medication || !time || !frequency) {
      return res.status(400).json({ 
        error: 'Medicamento, hora y frecuencia son requeridos' 
      });
    }
    
    // Validar formato de hora
    if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
      return res.status(400).json({ 
        error: 'Formato de hora inválido. Use HH:MM' 
      });
    }
    
    // Si es semanal y no tiene días, usar lunes a viernes por defecto
    let finalDaysOfWeek = daysOfWeek;
    if (frequency === 'weekly' && (!daysOfWeek || daysOfWeek.length === 0)) {
      finalDaysOfWeek = [1, 2, 3, 4, 5]; // Lun-Vie
    }
    
    const reminder = new Reminder({
      user: req.user.userId,
      medication,
      time,
      frequency,
      daysOfWeek: finalDaysOfWeek,
      notes: notes || '',
      isActive: true,
      history: []
    });
    
    await reminder.save();
    await reminder.populate('medication', 'name description');
    
    res.status(201).json({
      message: 'Recordatorio creado correctamente',
      reminder: reminder.toObject()
    });
  } catch (error) {
    console.error('Error creando recordatorio:', error);
    res.status(400).json({ error: error.message });
  }
});

// Actualizar recordatorio
router.put('/:id', auth, async (req, res) => {
  try {
    const allowedUpdates = ['time', 'frequency', 'daysOfWeek', 'notes', 'isActive'];
    const updates = {};
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });
    
    // Validar formato de hora si se actualiza
    if (updates.time && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(updates.time)) {
      return res.status(400).json({ 
        error: 'Formato de hora inválido. Use HH:MM' 
      });
    }
    
    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, user: req.user.userId },
      updates,
      { new: true, runValidators: true }
    ).populate('medication', 'name description');
    
    if (!reminder) {
      return res.status(404).json({ error: 'Recordatorio no encontrado' });
    }
    
    res.json({
      message: 'Recordatorio actualizado correctamente',
      reminder: reminder.toObject()
    });
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
    
    res.json({ 
      message: 'Recordatorio eliminado correctamente' 
    });
  } catch (error) {
    console.error('Error eliminando recordatorio:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== REGISTRO DE DOSIS - ENDPOINT PRINCIPAL =====

router.post('/:id/record-dose', auth, async (req, res) => {
  try {
    const { taken, notes } = req.body;
    
    // Validar que taken sea booleano
    if (typeof taken !== 'boolean') {
      return res.status(400).json({ 
        error: 'El campo "taken" debe ser true o false' 
      });
    }
    
    const reminder = await Reminder.findOne({
      _id: req.params.id,
      user: req.user.userId
    }).populate('medication', 'name');
    
    if (!reminder) {
      return res.status(404).json({ error: 'Recordatorio no encontrado' });
    }
    
    // 1. Agregar al historial del recordatorio
    reminder.history.push({
      timestamp: new Date(),
      taken: taken,
      notes: notes || ''
    });
    
    await reminder.save();
    
    // 2. Actualizar adherencia del usuario
    const user = await User.findById(req.user.userId);
    if (user) {
      // Agregar a adherencia general
      user.adherence.push({
        date: new Date(),
        taken: taken,
        medication: reminder.medication._id,
        time: reminder.time,
        notes: notes || ''
      });
      
      // Agregar al historial de dosis
      if (taken) {
        user.doseHistory.push({
          medication: reminder.medication._id,
          takenAt: new Date(),
          scheduled: true,
          notes: notes || ''
        });
      }
      
      await user.save();
    }
    
    // 3. Calcular nueva adherencia
    const adherenceRate = user ? user.calculateAdherence() : 100;
    const reminderAdherence = reminder.calculateAdherence();
    
    res.json({ 
      message: taken ? 'Dosis registrada como tomada' : 'Dosis registrada como omitida',
      success: true,
      data: {
        reminder: {
          id: reminder._id,
          medication: reminder.medication.name,
          time: reminder.time,
          adherence: reminderAdherence
        },
        user: {
          adherenceRate: adherenceRate
        },
        doseRecord: {
          timestamp: new Date(),
          taken: taken,
          notes: notes || ''
        }
      }
    });
    
  } catch (error) {
    console.error('Error registrando dosis:', error);
    res.status(400).json({ error: error.message });
  }
});

// Obtener historial completo de un recordatorio
router.get('/:id/history', auth, async (req, res) => {
  try {
    const { days } = req.query;
    const daysToShow = parseInt(days) || 30;
    
    const reminder = await Reminder.findOne({
      _id: req.params.id,
      user: req.user.userId
    }).populate('medication', 'name description');
    
    if (!reminder) {
      return res.status(404).json({ error: 'Recordatorio no encontrado' });
    }
    
    // Filtrar historial por días
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToShow);
    
    const filteredHistory = reminder.history
      .filter(h => h.timestamp >= cutoffDate)
      .sort((a, b) => b.timestamp - a.timestamp);
    
    // Calcular estadísticas
    const stats = {
      total: filteredHistory.length,
      taken: filteredHistory.filter(h => h.taken).length,
      missed: filteredHistory.filter(h => !h.taken).length,
      adherence: reminder.calculateAdherence(daysToShow),
      streak: reminder.currentStreak || 0
    };
    
    res.json({
      reminder: {
        id: reminder._id,
        medication: reminder.medication,
        time: reminder.time,
        frequency: reminder.frequency,
        isActive: reminder.isActive
      },
      stats,
      history: filteredHistory
    });
    
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener estadísticas de adherencia del usuario
router.get('/stats/adherence', auth, async (req, res) => {
  try {
    const { days } = req.query;
    const daysToShow = parseInt(days) || 30;
    
    const reminders = await Reminder.find({ 
      user: req.user.userId,
      isActive: true
    }).populate('medication', 'name');
    
    const user = await User.findById(req.user.userId);
    
    // Calcular adherencia por medicamento
    const adherenceByMedication = {};
    
    reminders.forEach(reminder => {
      const medId = reminder.medication._id.toString();
      const medName = reminder.medication.name;
      
      if (!adherenceByMedication[medId]) {
        adherenceByMedication[medId] = {
          medication: medName,
          medicationId: medId,
          totalDoses: 0,
          takenDoses: 0,
          missedDoses: 0,
          adherence: 100
        };
      }
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToShow);
      
      const recentHistory = reminder.history.filter(h => h.timestamp >= cutoffDate);
      
      adherenceByMedication[medId].totalDoses += recentHistory.length;
      adherenceByMedication[medId].takenDoses += recentHistory.filter(h => h.taken).length;
      adherenceByMedication[medId].missedDoses += recentHistory.filter(h => !h.taken).length;
      
      if (recentHistory.length > 0) {
        adherenceByMedication[medId].adherence = Math.round(
          (adherenceByMedication[medId].takenDoses / adherenceByMedication[medId].totalDoses) * 100
        );
      }
    });
    
    // Calcular racha máxima
    let maxStreak = 0;
    reminders.forEach(reminder => {
      const streak = reminder.currentStreak || 0;
      if (streak > maxStreak) maxStreak = streak;
    });
    
    res.json({
      overall: {
        adherenceRate: user ? user.calculateAdherence(daysToShow) : 100,
        currentStreak: maxStreak,
        totalReminders: reminders.length,
        activeReminders: reminders.filter(r => r.isActive).length
      },
      byMedication: Object.values(adherenceByMedication),
      period: {
        days: daysToShow,
        from: new Date(Date.now() - daysToShow * 24 * 60 * 60 * 1000).toISOString(),
        to: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;