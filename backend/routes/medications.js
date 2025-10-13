const express = require('express');
const router = express.Router();
const Medication = require('../models/Medication');
const User = require('../models/User');
const { protect, admin } = require('../middleware/auth');

// @route   GET /api/medications
// @desc    Obtener todos los medicamentos
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const medications = await Medication.find()
      .populate('patients', 'name email adherence')
      .populate('createdBy', 'name');
    res.json(medications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/medications/:id
// @desc    Obtener un medicamento
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const medication = await Medication.findById(req.params.id)
      .populate('patients', 'name email adherence');
    
    if (!medication) {
      return res.status(404).json({ message: 'Medicamento no encontrado' });
    }
    
    res.json(medication);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/medications
// @desc    Crear medicamento
// @access  Private/Admin
router.post('/', protect, admin, async (req, res) => {
  try {
    const { name, description, video, faqs } = req.body;
    
    // Verificar si existe
    const exists = await Medication.findOne({ name });
    if (exists) {
      return res.status(400).json({ message: 'El medicamento ya existe' });
    }
    
    const medication = await Medication.create({
      name,
      description,
      video,
      faqs,
      createdBy: req.user._id
    });
    
    res.status(201).json(medication);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/medications/:id
// @desc    Actualizar medicamento
// @access  Private/Admin
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const medication = await Medication.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!medication) {
      return res.status(404).json({ message: 'Medicamento no encontrado' });
    }
    
    res.json(medication);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/medications/:id/assign
// @desc    Asignar medicamento a paciente
// @access  Private/Admin
router.post('/:id/assign', protect, admin, async (req, res) => {
  try {
    const { patientId } = req.body;
    
    const medication = await Medication.findById(req.params.id);
    const patient = await User.findById(patientId);
    
    if (!medication || !patient) {
      return res.status(404).json({ message: 'Medicamento o paciente no encontrado' });
    }
    
    // Asignar medicamento al paciente
    patient.medication = medication._id;
    await patient.save();
    
    // Añadir paciente al medicamento
    if (!medication.patients.includes(patientId)) {
      medication.patients.push(patientId);
      await medication.save();
    }
    
    res.json({ message: 'Medicamento asignado correctamente' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/medications/:id
// @desc    Eliminar medicamento
// @access  Private/Admin
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const medication = await Medication.findById(req.params.id);
    
    if (!medication) {
      return res.status(404).json({ message: 'Medicamento no encontrado' });
    }
    
    // Desasignar de pacientes
    await User.updateMany(
      { medication: medication._id },
      { $unset: { medication: 1 } }
    );
    
    await medication.deleteOne();
    
    res.json({ message: 'Medicamento eliminado' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;