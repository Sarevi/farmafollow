const express = require('express');
const router = express.Router();
const ClinicalHistory = require('../models/ClinicalHistory');
const User = require('../models/User');
const auth = require('../middleware/auth');

// ===== RUTAS PARA ADMINISTRADORES =====

// Crear nuevo registro de historial clínico
router.post('/patient/:patientId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const patient = await User.findById(req.params.patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    const clinicalRecord = new ClinicalHistory({
      patient: req.params.patientId,
      recordedBy: req.user.userId,
      ...req.body
    });

    await clinicalRecord.save();

    res.status(201).json(clinicalRecord);
  } catch (error) {
    console.error('Error creando registro clínico:', error);
    res.status(400).json({ error: error.message });
  }
});

// Obtener todos los registros de historial de un paciente
router.get('/patient/:patientId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { startDate, endDate, limit } = req.query;

    const history = await ClinicalHistory.getPatientEvolution(
      req.params.patientId,
      { startDate, endDate, limit: limit ? parseInt(limit) : 100 }
    );

    res.json(history);
  } catch (error) {
    console.error('Error obteniendo historial clínico:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener un registro específico de historial
router.get('/record/:recordId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const record = await ClinicalHistory.findById(req.params.recordId)
      .populate('patient', 'name email')
      .populate('recordedBy', 'name')
      .populate('currentTreatment.fame.medication', 'name')
      .populate('currentTreatment.biologics.medication', 'name');

    if (!record) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    res.json(record);
  } catch (error) {
    console.error('Error obteniendo registro:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener el registro más reciente de un paciente
router.get('/patient/:patientId/latest', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const latestRecord = await ClinicalHistory.findOne({
      patient: req.params.patientId,
      isActive: true
    })
      .sort({ recordDate: -1 })
      .populate('recordedBy', 'name')
      .populate('currentTreatment.fame.medication', 'name')
      .populate('currentTreatment.biologics.medication', 'name');

    if (!latestRecord) {
      return res.status(404).json({ error: 'No hay registros para este paciente' });
    }

    res.json(latestRecord);
  } catch (error) {
    console.error('Error obteniendo último registro:', error);
    res.status(500).json({ error: error.message });
  }
});

// Actualizar un registro de historial clínico
router.put('/record/:recordId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const record = await ClinicalHistory.findByIdAndUpdate(
      req.params.recordId,
      req.body,
      { new: true, runValidators: true }
    )
      .populate('recordedBy', 'name')
      .populate('currentTreatment.fame.medication', 'name')
      .populate('currentTreatment.biologics.medication', 'name');

    if (!record) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    res.json(record);
  } catch (error) {
    console.error('Error actualizando registro:', error);
    res.status(400).json({ error: error.message });
  }
});

// Eliminar (desactivar) un registro de historial clínico
router.delete('/record/:recordId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const record = await ClinicalHistory.findByIdAndUpdate(
      req.params.recordId,
      { isActive: false },
      { new: true }
    );

    if (!record) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    res.json({ message: 'Registro desactivado correctamente' });
  } catch (error) {
    console.error('Error eliminando registro:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== RUTAS DE ANÁLISIS Y EXPORTACIÓN =====

// Obtener evolución temporal de parámetros específicos
router.get('/patient/:patientId/evolution/:parameter', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { parameter } = req.params;
    const { startDate, endDate } = req.query;

    let query = {
      patient: req.params.patientId,
      isActive: true
    };

    if (startDate || endDate) {
      query.recordDate = {};
      if (startDate) query.recordDate.$gte = new Date(startDate);
      if (endDate) query.recordDate.$lte = new Date(endDate);
    }

    // Mapeo de parámetros a campos del modelo
    const parameterMapping = {
      'das28': 'diseaseActivity.das28.score',
      'weight': 'demographics.weight',
      'bmi': 'demographics.bmi',
      'adherence': 'adherenceEvaluation.adherencePercentage',
      'vsg': 'diseaseActivity.labResults.vsg',
      'crp': 'diseaseActivity.labResults.crp',
      'haq': 'diseaseActivity.haq.score',
      'pain': 'diseaseActivity.painScale.score'
    };

    const fieldPath = parameterMapping[parameter];
    if (!fieldPath) {
      return res.status(400).json({ error: 'Parámetro no válido' });
    }

    const projection = {
      recordDate: 1,
      [fieldPath]: 1
    };

    const evolution = await ClinicalHistory.find(query, projection)
      .sort({ recordDate: 1 });

    const data = evolution.map(record => {
      const value = fieldPath.split('.').reduce((obj, key) => obj?.[key], record);
      return {
        date: record.recordDate,
        value: value
      };
    }).filter(item => item.value !== null && item.value !== undefined);

    res.json({
      parameter,
      data,
      trend: calculateTrend(data)
    });
  } catch (error) {
    console.error('Error obteniendo evolución:', error);
    res.status(500).json({ error: error.message });
  }
});

// Exportar historial completo de un paciente
router.get('/patient/:patientId/export', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { format = 'json', anonymize = false } = req.query;

    const patient = await User.findById(req.params.patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    const history = await ClinicalHistory.find({
      patient: req.params.patientId,
      isActive: true
    })
      .sort({ recordDate: -1 })
      .populate('recordedBy', 'name')
      .populate('currentTreatment.fame.medication', 'name')
      .populate('currentTreatment.biologics.medication', 'name');

    let exportData = {
      patient: {
        id: anonymize ? `PATIENT_${patient._id.toString().slice(-8)}` : patient._id,
        name: anonymize ? 'ANÓNIMO' : patient.name,
        age: patient.getAge(),
        gender: patient.gender
      },
      exportDate: new Date(),
      recordsCount: history.length,
      records: history.map(record =>
        anonymize ? record.exportToJSON() : record.toObject()
      )
    };

    // Si se solicita CSV, convertir a CSV
    if (format === 'csv') {
      const csv = convertToCSV(exportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=historial_${patient._id}.csv`);
      res.send(csv);
    } else {
      // Por defecto JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=historial_${patient._id}.json`);
      res.json(exportData);
    }
  } catch (error) {
    console.error('Error exportando historial:', error);
    res.status(500).json({ error: error.message });
  }
});

// Comparar dos registros de historial
router.post('/compare', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { recordId1, recordId2 } = req.body;

    const [record1, record2] = await Promise.all([
      ClinicalHistory.findById(recordId1),
      ClinicalHistory.findById(recordId2)
    ]);

    if (!record1 || !record2) {
      return res.status(404).json({ error: 'Uno o ambos registros no encontrados' });
    }

    const comparison = {
      dates: {
        record1: record1.recordDate,
        record2: record2.recordDate,
        daysBetween: Math.floor((record2.recordDate - record1.recordDate) / (1000 * 60 * 60 * 24))
      },
      demographics: {
        weightChange: record2.demographics?.weight - record1.demographics?.weight,
        bmiChange: record2.demographics?.bmi - record1.demographics?.bmi
      },
      diseaseActivity: {
        das28Change: record2.diseaseActivity?.das28?.score - record1.diseaseActivity?.das28?.score,
        tenderJointsChange: record2.diseaseActivity?.tenderJointsCount - record1.diseaseActivity?.tenderJointsCount,
        swollenJointsChange: record2.diseaseActivity?.swollenJointsCount - record1.diseaseActivity?.swollenJointsCount,
        vsgChange: record2.diseaseActivity?.labResults?.vsg - record1.diseaseActivity?.labResults?.vsg,
        crpChange: record2.diseaseActivity?.labResults?.crp - record1.diseaseActivity?.labResults?.crp
      },
      adherence: {
        adherenceChange: record2.adherenceEvaluation?.adherencePercentage - record1.adherenceEvaluation?.adherencePercentage
      }
    };

    res.json(comparison);
  } catch (error) {
    console.error('Error comparando registros:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener estadísticas poblacionales
router.get('/stats/population', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const stats = await ClinicalHistory.getPopulationStats();

    res.json(stats);
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== FUNCIONES AUXILIARES =====

// Calcular tendencia simple
function calculateTrend(data) {
  if (data.length < 2) return 'insufficient-data';

  const first = data[0].value;
  const last = data[data.length - 1].value;
  const change = ((last - first) / first) * 100;

  if (Math.abs(change) < 5) return 'stable';
  return change > 0 ? 'increasing' : 'decreasing';
}

// Convertir a CSV simple
function convertToCSV(data) {
  const headers = [
    'Fecha',
    'Peso',
    'IMC',
    'DAS28',
    'VSG',
    'PCR',
    'Adherencia %',
    'Articulaciones dolorosas',
    'Articulaciones inflamadas'
  ];

  const rows = data.records.map(record => [
    new Date(record.recordDate).toISOString().split('T')[0],
    record.demographics?.weight || '',
    record.demographics?.bmi || '',
    record.diseaseActivity?.das28?.score || '',
    record.diseaseActivity?.labResults?.vsg || '',
    record.diseaseActivity?.labResults?.crp || '',
    record.adherenceEvaluation?.adherencePercentage || '',
    record.diseaseActivity?.tenderJointsCount || '',
    record.diseaseActivity?.swollenJointsCount || ''
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

module.exports = router;
