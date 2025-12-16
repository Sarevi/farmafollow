const express = require('express');
const router = express.Router();
const User = require('../models/User');
const ClinicalHistory = require('../models/ClinicalHistory');
const PharmaceuticalIntervention = require('../models/PharmaceuticalIntervention');
const Medication = require('../models/Medication');
const Consultation = require('../models/Consultation');
const QuestionnaireResponse = require('../models/QuestionnaireResponse');
const auth = require('../middleware/auth');

// ===== PROTEGER TODAS LAS RUTAS =====
router.use(auth);

/**
 * @route   GET /api/timeline/patient/:patientId
 * @desc    Obtener timeline clínico unificado de un paciente
 * @access  Private
 *
 * Este endpoint es la JOYA de RWE: consolida TODOS los eventos clínicos
 * en una única línea temporal para facilitar decisiones y análisis
 */
router.get('/patient/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { startDate, endDate, eventTypes, limit } = req.query;

    // Verificar permisos
    if (req.user.role === 'patient' && req.user.id !== patientId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver este timeline'
      });
    }

    // Verificar que el paciente existe
    const patient = await User.findById(patientId);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    // Filtros de fecha
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    // Array para consolidar todos los eventos
    const timeline = [];

    // Filtrar tipos de eventos solicitados
    const types = eventTypes ? eventTypes.split(',') : ['all'];
    const includeAll = types.includes('all');

    // ===== 1. DIAGNÓSTICO INICIAL =====
    if (includeAll || types.includes('diagnosis')) {
      if (patient.diseases && patient.diseases.length > 0) {
        patient.diseases.forEach(disease => {
          timeline.push({
            type: 'diagnosis',
            category: 'clinical',
            date: patient.startDate || patient.createdAt,
            title: 'Diagnóstico',
            description: disease,
            data: { disease },
            icon: '🏥',
            severity: 'info'
          });
        });
      }
    }

    // ===== 2. HISTORIA CLÍNICA =====
    if (includeAll || types.includes('clinical-history')) {
      let clinicalHistoryQuery = { patient: patientId, isActive: true };
      if (Object.keys(dateFilter).length > 0) {
        clinicalHistoryQuery.recordDate = dateFilter;
      }

      const clinicalRecords = await ClinicalHistory.find(clinicalHistoryQuery)
        .sort({ recordDate: -1 })
        .limit(limit ? parseInt(limit) : 1000);

      clinicalRecords.forEach(record => {
        timeline.push({
          type: 'clinical-history',
          category: 'clinical',
          date: record.recordDate,
          title: 'Registro Clínico',
          description: `DAS28: ${record.diseaseActivity?.das28?.score || 'N/A'}, Adherencia: ${record.adherenceEvaluation?.adherencePercentage || 'N/A'}%`,
          data: {
            das28: record.diseaseActivity?.das28,
            adherence: record.adherenceEvaluation?.adherencePercentage,
            bmi: record.demographics?.bmi,
            painScale: record.diseaseActivity?.painScale,
            haq: record.diseaseActivity?.haq
          },
          icon: '📊',
          severity: 'info',
          recordId: record._id
        });
      });
    }

    // ===== 3. MEDICAMENTOS (INICIO DE TRATAMIENTO) =====
    if (includeAll || types.includes('medications')) {
      const medications = await Medication.find({
        patients: patientId,
        isActive: true
      });

      medications.forEach(med => {
        timeline.push({
          type: 'medication-start',
          category: 'treatment',
          date: med.createdAt,
          title: 'Inicio de Medicamento',
          description: `${med.name} (${med.activeIngredient})`,
          data: {
            medication: {
              id: med._id,
              name: med.name,
              activeIngredient: med.activeIngredient,
              indications: med.indications
            }
          },
          icon: '💊',
          severity: 'success'
        });
      });
    }

    // ===== 4. ADHERENCIA (EVENTOS IMPORTANTES) =====
    if (includeAll || types.includes('adherence')) {
      if (patient.adherence && patient.adherence.length > 0) {
        let adherenceRecords = patient.adherence;

        if (Object.keys(dateFilter).length > 0) {
          adherenceRecords = adherenceRecords.filter(a => {
            const date = new Date(a.date);
            if (dateFilter.$gte && date < dateFilter.$gte) return false;
            if (dateFilter.$lte && date > dateFilter.$lte) return false;
            return true;
          });
        }

        // Agrupar por semana para no saturar el timeline
        const weeklyAdherence = {};

        adherenceRecords.forEach(record => {
          const date = new Date(record.date);
          const weekKey = `${date.getFullYear()}-W${Math.ceil(date.getDate() / 7)}`;

          if (!weeklyAdherence[weekKey]) {
            weeklyAdherence[weekKey] = {
              date: record.date,
              taken: 0,
              missed: 0,
              total: 0
            };
          }

          weeklyAdherence[weekKey].total++;
          if (record.taken) {
            weeklyAdherence[weekKey].taken++;
          } else {
            weeklyAdherence[weekKey].missed++;
          }
        });

        // Crear eventos solo para semanas con problemas de adherencia
        Object.values(weeklyAdherence).forEach(week => {
          const adherenceRate = (week.taken / week.total) * 100;

          if (adherenceRate < 80) {
            timeline.push({
              type: 'adherence-issue',
              category: 'adherence',
              date: week.date,
              title: 'Problema de Adherencia',
              description: `Adherencia semanal: ${Math.round(adherenceRate)}% (${week.taken}/${week.total} dosis)`,
              data: {
                taken: week.taken,
                missed: week.missed,
                total: week.total,
                rate: adherenceRate
              },
              icon: '⚠️',
              severity: adherenceRate < 50 ? 'error' : 'warning'
            });
          }
        });
      }
    }

    // ===== 5. EVENTOS ADVERSOS =====
    if (includeAll || types.includes('adverse-events')) {
      if (patient.adverseEvents && patient.adverseEvents.length > 0) {
        let adverseEvents = patient.adverseEvents;

        if (Object.keys(dateFilter).length > 0) {
          adverseEvents = adverseEvents.filter(ae => {
            const date = new Date(ae.date);
            if (dateFilter.$gte && date < dateFilter.$gte) return false;
            if (dateFilter.$lte && date > dateFilter.$lte) return false;
            return true;
          });
        }

        adverseEvents.forEach(ae => {
          timeline.push({
            type: 'adverse-event',
            category: 'safety',
            date: ae.date,
            title: 'Evento Adverso',
            description: ae.event,
            data: {
              event: ae.event,
              severity: ae.severity,
              medication: ae.medication,
              resolved: ae.resolved,
              action: ae.action,
              notes: ae.notes
            },
            icon: ae.severity === 'grave' ? '🚨' : ae.severity === 'moderado' ? '⚠️' : '🔔',
            severity: ae.severity === 'grave' ? 'error' : ae.severity === 'moderado' ? 'warning' : 'info'
          });
        });
      }
    }

    // ===== 6. INTERVENCIONES FARMACÉUTICAS =====
    if (includeAll || types.includes('interventions')) {
      let interventionQuery = { patient: patientId };
      if (Object.keys(dateFilter).length > 0) {
        interventionQuery.interventionDate = dateFilter;
      }

      const interventions = await PharmaceuticalIntervention.find(interventionQuery)
        .sort({ interventionDate: -1 })
        .limit(limit ? parseInt(limit) : 1000)
        .populate('medication', 'name')
        .populate('pharmacist', 'name');

      interventions.forEach(intervention => {
        timeline.push({
          type: 'pharmaceutical-intervention',
          category: 'intervention',
          date: intervention.interventionDate,
          title: 'Intervención Farmacéutica',
          description: `${intervention.type.replace(/-/g, ' ')} - ${intervention.problem.description}`,
          data: {
            interventionType: intervention.type,
            trigger: intervention.trigger,
            problem: intervention.problem,
            action: intervention.action,
            outcome: intervention.outcome,
            impact: intervention.impact,
            pharmacist: intervention.pharmacist?.name,
            medication: intervention.medication?.name
          },
          icon: '👨‍⚕️',
          severity: intervention.problem.severity === 'grave' || intervention.problem.severity === 'critica' ? 'error' : 'info',
          interventionId: intervention._id
        });
      });
    }

    // ===== 7. CONSULTAS =====
    if (includeAll || types.includes('consultations')) {
      let consultationQuery = { patient: patientId };
      if (Object.keys(dateFilter).length > 0) {
        consultationQuery.createdAt = dateFilter;
      }

      const consultations = await Consultation.find(consultationQuery)
        .sort({ createdAt: -1 })
        .limit(limit ? parseInt(limit) : 1000);

      consultations.forEach(consultation => {
        timeline.push({
          type: 'consultation',
          category: 'communication',
          date: consultation.createdAt,
          title: 'Consulta',
          description: consultation.subject,
          data: {
            subject: consultation.subject,
            message: consultation.message,
            urgency: consultation.urgency,
            status: consultation.status,
            response: consultation.response,
            respondedAt: consultation.respondedAt
          },
          icon: '💬',
          severity: consultation.urgency === 'high' ? 'warning' : 'info',
          consultationId: consultation._id
        });
      });
    }

    // ===== 8. CUESTIONARIOS PROs =====
    if (includeAll || types.includes('questionnaires')) {
      let questionnaireQuery = { patient: patientId };
      if (Object.keys(dateFilter).length > 0) {
        questionnaireQuery.completedAt = dateFilter;
      }

      const responses = await QuestionnaireResponse.find(questionnaireQuery)
        .sort({ completedAt: -1 })
        .limit(limit ? parseInt(limit) : 1000)
        .populate('questionnaire', 'title type');

      responses.forEach(response => {
        if (response.completedAt) {
          timeline.push({
            type: 'questionnaire',
            category: 'assessment',
            date: response.completedAt,
            title: `Cuestionario: ${response.questionnaire?.title || 'Sin título'}`,
            description: `Tipo: ${response.questionnaire?.type || 'N/A'}`,
            data: {
              questionnaireType: response.questionnaire?.type,
              answers: response.answers,
              score: response.score
            },
            icon: '📝',
            severity: 'info',
            responseId: response._id
          });
        }
      });
    }

    // ===== ORDENAR TIMELINE POR FECHA (MÁS RECIENTE PRIMERO) =====
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Limitar resultados si se especifica
    const limitedTimeline = limit ? timeline.slice(0, parseInt(limit)) : timeline;

    // ===== CALCULAR ESTADÍSTICAS DEL TIMELINE =====
    const stats = {
      totalEvents: timeline.length,
      byCategory: {},
      byType: {},
      bySeverity: {
        info: 0,
        success: 0,
        warning: 0,
        error: 0
      },
      dateRange: {
        earliest: timeline.length > 0 ? timeline[timeline.length - 1].date : null,
        latest: timeline.length > 0 ? timeline[0].date : null
      }
    };

    timeline.forEach(event => {
      // Por categoría
      stats.byCategory[event.category] = (stats.byCategory[event.category] || 0) + 1;

      // Por tipo
      stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;

      // Por severidad
      stats.bySeverity[event.severity]++;
    });

    res.json({
      success: true,
      data: {
        patient: {
          id: patient._id,
          name: patient.name,
          email: patient.email,
          age: patient.getAge(),
          gender: patient.gender,
          diseases: patient.diseases
        },
        timeline: limitedTimeline,
        stats
      }
    });
  } catch (error) {
    console.error('Error fetching timeline:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener timeline clínico',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/timeline/patient/:patientId/summary
 * @desc    Obtener resumen ejecutivo del timeline del paciente
 * @access  Private
 */
router.get('/patient/:patientId/summary', async (req, res) => {
  try {
    const { patientId } = req.params;

    // Verificar permisos
    if (req.user.role === 'patient' && req.user.id !== patientId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver este resumen'
      });
    }

    const patient = await User.findById(patientId);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    // Obtener datos relevantes
    const [
      clinicalHistoryCount,
      interventionsCount,
      adverseEventsCount,
      activeAdverseEvents,
      consultationsCount,
      latestClinicalHistory
    ] = await Promise.all([
      ClinicalHistory.countDocuments({ patient: patientId, isActive: true }),
      PharmaceuticalIntervention.countDocuments({ patient: patientId }),
      Promise.resolve(patient.adverseEvents ? patient.adverseEvents.length : 0),
      Promise.resolve(patient.adverseEvents ? patient.adverseEvents.filter(ae => !ae.resolved).length : 0),
      Consultation.countDocuments({ patient: patientId }),
      ClinicalHistory.findOne({ patient: patientId, isActive: true })
        .sort({ recordDate: -1 })
    ]);

    // Calcular adherencia actual
    const currentAdherence = patient.calculateAdherence(30);

    // Resumen
    const summary = {
      patient: {
        id: patient._id,
        name: patient.name,
        age: patient.getAge(),
        diseases: patient.diseases,
        timeInTreatment: patient.startDate
          ? Math.floor((Date.now() - patient.startDate.getTime()) / (1000 * 60 * 60 * 24))
          : null
      },
      clinicalStatus: {
        adherence: currentAdherence,
        adverseEventsTotal: adverseEventsCount,
        adverseEventsActive: activeAdverseEvents,
        latestDAS28: latestClinicalHistory?.diseaseActivity?.das28?.score || null,
        latestPainScale: latestClinicalHistory?.diseaseActivity?.painScale?.score || null
      },
      activity: {
        clinicalRecords: clinicalHistoryCount,
        interventions: interventionsCount,
        consultations: consultationsCount,
        lastUpdate: latestClinicalHistory?.recordDate || patient.updatedAt
      },
      alerts: []
    };

    // Generar alertas
    if (currentAdherence < 80) {
      summary.alerts.push({
        type: 'adherence',
        severity: currentAdherence < 50 ? 'error' : 'warning',
        message: `Adherencia baja: ${currentAdherence}%`
      });
    }

    if (activeAdverseEvents > 0) {
      summary.alerts.push({
        type: 'adverse-events',
        severity: 'warning',
        message: `${activeAdverseEvents} evento(s) adverso(s) sin resolver`
      });
    }

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching timeline summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener resumen',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/timeline/compare
 * @desc    Comparar timelines de múltiples pacientes (para estudios)
 * @access  Private (Admin only)
 */
router.get('/compare', async (req, res) => {
  try {
    const { patientIds, eventTypes, startDate, endDate } = req.query;

    if (!patientIds) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere patientIds (comma-separated)'
      });
    }

    // Solo admin puede comparar
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para comparar timelines'
      });
    }

    const patientIdArray = patientIds.split(',');
    const comparisons = [];

    // Obtener timeline de cada paciente
    for (const patientId of patientIdArray) {
      // Aquí reutilizaríamos la lógica del endpoint principal
      // Por simplicidad, referenciamos al endpoint
      comparisons.push({
        patientId,
        message: 'Use /api/timeline/patient/:patientId for individual timelines'
      });
    }

    res.json({
      success: true,
      data: {
        patients: patientIdArray.length,
        message: 'Feature in development - use individual timeline endpoints',
        comparisons
      }
    });
  } catch (error) {
    console.error('Error comparing timelines:', error);
    res.status(500).json({
      success: false,
      message: 'Error al comparar timelines',
      error: error.message
    });
  }
});

module.exports = router;
