const ClinicalSignal = require('../models/ClinicalSignal');
const User = require('../models/User');
const Medication = require('../models/Medication');
const PharmaceuticalIntervention = require('../models/PharmaceuticalIntervention');
const Study = require('../models/Study');

/**
 * Servicio de Detección de Señales Clínicas
 * Motor de inteligencia para identificar patrones automáticamente
 */
class SignalDetectionService {

  /**
   * Ejecutar análisis completo de señales
   */
  async runFullAnalysis() {
    console.log('🔍 Iniciando análisis completo de señales clínicas...');

    const signals = [];

    try {
      // 1. Detección de clusters de eventos adversos
      const aeClusterSignals = await this.detectAdverseEventClusters();
      signals.push(...aeClusterSignals);

      // 2. Detección de declives de adherencia
      const adherenceSignals = await this.detectAdherenceDeclines();
      signals.push(...adherenceSignals);

      // 3. Detección de interacciones medicamentosas
      const interactionSignals = await this.detectDrugInteractions();
      signals.push(...interactionSignals);

      // 4. Detección de patrones de hospitalización
      const hospitalizationSignals = await this.detectHospitalizationRisks();
      signals.push(...hospitalizationSignals);

      // 5. Detección de fallos terapéuticos
      const failureSignals = await this.detectTreatmentFailures();
      signals.push(...failureSignals);

      // 6. Detección de anomalías estadísticas
      const anomalySignals = await this.detectStatisticalAnomalies();
      signals.push(...anomalySignals);

      console.log(`✅ Análisis completado: ${signals.length} señales detectadas`);
      return signals;

    } catch (error) {
      console.error('Error en análisis de señales:', error);
      return signals;
    }
  }

  /**
   * 1. Detectar clusters de eventos adversos
   */
  async detectAdverseEventClusters() {
    const signals = [];

    try {
      // Obtener todos los pacientes con eventos adversos recientes (últimos 90 días)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);

      const patients = await User.find({
        role: 'patient',
        adverseEvents: { $exists: true, $ne: [] }
      });

      // Agrupar eventos adversos por medicamento
      const aeByMedication = {};

      for (const patient of patients) {
        for (const ae of patient.adverseEvents) {
          if (ae.date < cutoffDate) continue;
          if (!ae.medication) continue;

          const medId = ae.medication.toString();
          if (!aeByMedication[medId]) {
            aeByMedication[medId] = {
              medicationId: medId,
              events: [],
              patients: new Set()
            };
          }

          aeByMedication[medId].events.push({
            event: ae.event,
            severity: ae.severity,
            date: ae.date,
            patient: patient._id
          });
          aeByMedication[medId].patients.add(patient._id.toString());
        }
      }

      // Analizar cada medicamento
      for (const [medId, data] of Object.entries(aeByMedication)) {
        const medication = await Medication.findById(medId);
        if (!medication) continue;

        const totalPatientsOnMed = medication.patients ? medication.patients.length : 1;
        const affectedCount = data.patients.size;
        const eventCount = data.events.length;

        // Calcular tasa de eventos adversos
        const aeRate = (affectedCount / totalPatientsOnMed) * 100;

        // Threshold: si más del 20% de pacientes tienen EA, generar señal
        if (aeRate > 20 && affectedCount >= 3) {

          // Analizar severidad
          const severeCount = data.events.filter(e => e.severity === 'grave').length;
          const severity = severeCount > 0 ? 'high' :
                          aeRate > 30 ? 'medium' : 'low';

          // Calcular confianza (basado en tamaño de muestra)
          const confidence = Math.min(95, 50 + (affectedCount * 5));

          // Agrupar por tipo de evento
          const eventTypes = {};
          data.events.forEach(e => {
            eventTypes[e.event] = (eventTypes[e.event] || 0) + 1;
          });

          const mostCommonEvent = Object.entries(eventTypes)
            .sort((a, b) => b[1] - a[1])[0];

          const signal = new ClinicalSignal({
            signalType: 'adverse-event-cluster',
            title: `Cluster de Eventos Adversos: ${medication.name}`,
            description: `Se ha detectado un cluster de eventos adversos asociados con ${medication.name}. ` +
                        `${affectedCount} pacientes (${aeRate.toFixed(1)}%) han reportado eventos adversos en los últimos 90 días. ` +
                        `El evento más común es "${mostCommonEvent[0]}" (${mostCommonEvent[1]} casos).`,
            severity,
            confidence,
            affectedEntities: {
              patients: Array.from(data.patients).map(pId => ({
                patient: pId,
                riskScore: 75,
                contribution: 100 / data.patients.size
              })),
              medications: [{
                medication: medId,
                role: 'causative'
              }]
            },
            statistics: {
              sampleSize: totalPatientsOnMed,
              observedFrequency: aeRate,
              expectedFrequency: 5,  // baseline esperado 5%
              reportingOddsRatio: aeRate / 5,
              trend: 'stable'
            },
            detection: {
              method: 'frequency-analysis',
              algorithm: 'Adverse Event Clustering',
              detectedBy: {
                type: 'automatic'
              },
              analysisWindow: {
                startDate: cutoffDate,
                endDate: new Date(),
                duration: '90 days'
              }
            },
            evidence: {
              level: affectedCount >= 5 ? 'moderate' : 'preliminary',
              supportingData: [{
                type: 'clinical-data',
                description: `${eventCount} eventos adversos reportados`,
                source: 'FarmaFollow Database',
                date: new Date()
              }]
            },
            hypothesis: {
              statement: `${medication.name} puede estar asociado con un riesgo aumentado de ${mostCommonEvent[0]}`,
              proposedMechanism: 'Requiere investigación adicional para determinar el mecanismo',
              validationSteps: [
                'Revisar casos individuales',
                'Consultar literatura médica',
                'Considerar factores de confusión',
                'Evaluar si reportar a farmacovigilancia'
              ]
            },
            status: 'new'
          });

          // Añadir recomendaciones
          if (severeCount > 0) {
            signal.recommendations.push({
              action: 'report-to-authorities',
              description: 'Considerar reporte a farmacovigilancia',
              priority: 'urgent'
            });
          }

          signal.recommendations.push({
            action: 'clinical-review',
            description: 'Revisar historial de pacientes afectados',
            priority: severity === 'high' ? 'urgent' : 'routine'
          });

          await signal.save();
          signals.push(signal);
        }
      }

    } catch (error) {
      console.error('Error detectando clusters de EA:', error);
    }

    return signals;
  }

  /**
   * 2. Detectar declives de adherencia
   */
  async detectAdherenceDeclines() {
    const signals = [];

    try {
      const patients = await User.find({
        role: 'patient',
        isActive: true
      });

      for (const patient of patients) {
        // Calcular adherencia en diferentes períodos
        const adherence30 = patient.calculateAdherence(30);
        const adherence90 = patient.calculateAdherence(90);

        // Detectar declive significativo
        const decline = adherence90 - adherence30;

        if (decline > 20 && adherence30 < 70) {
          const signal = new ClinicalSignal({
            signalType: 'adherence-decline',
            title: `Declive Significativo de Adherencia: ${patient.name}`,
            description: `${patient.name} ha experimentado un declive de adherencia de ${decline.toFixed(1)}% en las últimas semanas. ` +
                        `Adherencia actual: ${adherence30}% (últimos 30 días) vs ${adherence90}% (últimos 90 días).`,
            severity: adherence30 < 50 ? 'high' : 'medium',
            confidence: 85,
            affectedEntities: {
              patients: [{
                patient: patient._id,
                riskScore: 100 - adherence30,
                contribution: 100
              }]
            },
            statistics: {
              sampleSize: 1,
              observedFrequency: adherence30,
              expectedFrequency: adherence90,
              changeRate: -decline,
              trend: 'decreasing'
            },
            detection: {
              method: 'temporal-pattern',
              algorithm: 'Adherence Trend Analysis',
              detectedBy: {
                type: 'automatic'
              },
              analysisWindow: {
                startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
                endDate: new Date(),
                duration: '90 days'
              }
            },
            hypothesis: {
              statement: 'El paciente está experimentando dificultades con la adherencia al tratamiento',
              confounders: [
                'Efectos adversos no reportados',
                'Barreras económicas',
                'Falta de comprensión',
                'Complejidad del régimen',
                'Problemas de acceso'
              ],
              validationSteps: [
                'Contactar al paciente',
                'Evaluar barreras',
                'Revisar eventos adversos recientes',
                'Considerar simplificación del tratamiento'
              ]
            },
            recommendations: [{
              action: 'implement-intervention',
              description: 'Intervención farmacéutica para mejorar adherencia',
              priority: adherence30 < 50 ? 'urgent' : 'routine'
            }],
            status: 'requires-action'
          });

          await signal.save();
          signals.push(signal);
        }
      }

    } catch (error) {
      console.error('Error detectando declives de adherencia:', error);
    }

    return signals;
  }

  /**
   * 3. Detectar interacciones medicamentosas
   */
  async detectDrugInteractions() {
    const signals = [];

    try {
      const patients = await User.find({
        role: 'patient',
        isActive: true
      }).populate('medications');

      for (const patient of patients) {
        const medications = await Medication.find({
          patients: patient._id
        });

        if (medications.length < 2) continue;

        // Base de datos simple de interacciones conocidas (en producción, usar API externa)
        const knownInteractions = this.getKnownInteractions();

        for (let i = 0; i < medications.length; i++) {
          for (let j = i + 1; j < medications.length; j++) {
            const med1 = medications[i];
            const med2 = medications[j];

            const interactionKey = [med1.name, med2.name].sort().join('|');
            const interaction = knownInteractions[interactionKey];

            if (interaction) {
              const signal = new ClinicalSignal({
                signalType: 'drug-interaction',
                title: `Interacción Medicamentosa Detectada: ${med1.name} + ${med2.name}`,
                description: `Se ha detectado una potencial interacción entre ${med1.name} y ${med2.name} en el paciente ${patient.name}. ` +
                            `${interaction.description}`,
                severity: interaction.severity,
                confidence: 90,
                affectedEntities: {
                  patients: [{
                    patient: patient._id,
                    riskScore: interaction.severity === 'high' ? 85 : 60,
                    contribution: 100
                  }],
                  medications: [
                    { medication: med1._id, role: 'causative' },
                    { medication: med2._id, role: 'causative' }
                  ]
                },
                detection: {
                  method: 'rule-based',
                  algorithm: 'Drug Interaction Checker',
                  detectedBy: {
                    type: 'automatic'
                  }
                },
                evidence: {
                  level: 'strong',
                  references: interaction.references || []
                },
                hypothesis: {
                  statement: interaction.mechanism,
                  proposedMechanism: interaction.mechanism
                },
                recommendations: [{
                  action: 'clinical-review',
                  description: interaction.recommendation,
                  priority: interaction.severity === 'high' ? 'immediate' : 'urgent'
                }],
                status: 'requires-action'
              });

              await signal.save();
              signals.push(signal);
            }
          }
        }
      }

    } catch (error) {
      console.error('Error detectando interacciones:', error);
    }

    return signals;
  }

  /**
   * 4. Detectar riesgos de hospitalización
   */
  async detectHospitalizationRisks() {
    const signals = [];

    try {
      const patients = await User.find({
        role: 'patient',
        isActive: true
      });

      for (const patient of patients) {
        let riskScore = 0;
        const riskFactors = [];

        // Factor 1: Baja adherencia
        const adherence = patient.calculateAdherence(30);
        if (adherence < 50) {
          riskScore += 30;
          riskFactors.push('Adherencia muy baja (<50%)');
        } else if (adherence < 70) {
          riskScore += 15;
          riskFactors.push('Adherencia subóptima (<70%)');
        }

        // Factor 2: Eventos adversos no resueltos
        const activeAEs = patient.getActiveAdverseEvents();
        const severeAEs = activeAEs.filter(ae => ae.severity === 'grave');
        if (severeAEs.length > 0) {
          riskScore += 40;
          riskFactors.push(`${severeAEs.length} evento(s) adverso(s) grave(s) no resuelto(s)`);
        } else if (activeAEs.length > 0) {
          riskScore += 20;
          riskFactors.push(`${activeAEs.length} evento(s) adverso(s) activo(s)`);
        }

        // Factor 3: Edad avanzada
        const age = patient.getAge();
        if (age && age > 75) {
          riskScore += 15;
          riskFactors.push('Edad > 75 años');
        } else if (age && age > 65) {
          riskScore += 10;
          riskFactors.push('Edad > 65 años');
        }

        // Factor 4: Múltiples comorbilidades
        if (patient.diseases && patient.diseases.length >= 3) {
          riskScore += 20;
          riskFactors.push(`${patient.diseases.length} comorbilidades`);
        }

        // Si el riesgo es alto, generar señal
        if (riskScore >= 50) {
          const severity = riskScore >= 75 ? 'critical' : riskScore >= 60 ? 'high' : 'medium';

          const signal = new ClinicalSignal({
            signalType: 'hospitalization-risk',
            title: `Riesgo Elevado de Hospitalización: ${patient.name}`,
            description: `${patient.name} presenta un riesgo elevado de hospitalización (score: ${riskScore}/100). ` +
                        `Factores de riesgo identificados: ${riskFactors.join(', ')}.`,
            severity,
            confidence: 75,
            affectedEntities: {
              patients: [{
                patient: patient._id,
                riskScore: riskScore,
                contribution: 100
              }]
            },
            statistics: {
              sampleSize: 1,
              observedFrequency: riskScore
            },
            detection: {
              method: 'regression-analysis',
              algorithm: 'Hospitalization Risk Score',
              detectedBy: {
                type: 'automatic'
              }
            },
            hypothesis: {
              statement: 'El paciente tiene alto riesgo de hospitalización en los próximos 30-90 días',
              confounders: riskFactors,
              validationSteps: [
                'Evaluación clínica presencial',
                'Revisión de medicación',
                'Plan de intervención preventiva'
              ]
            },
            recommendations: [
              {
                action: 'clinical-review',
                description: 'Evaluación clínica urgente',
                priority: severity === 'critical' ? 'immediate' : 'urgent'
              },
              {
                action: 'implement-intervention',
                description: 'Plan de intervención preventiva',
                priority: 'urgent'
              }
            ],
            status: 'requires-action',
            impact: {
              clinical: severity === 'critical' ? 'major' : 'moderate',
              affectedPopulation: 1,
              publicHealth: 'medium'
            }
          });

          await signal.save();
          signals.push(signal);
        }
      }

    } catch (error) {
      console.error('Error detectando riesgos de hospitalización:', error);
    }

    return signals;
  }

  /**
   * 5. Detectar fallos terapéuticos
   */
  async detectTreatmentFailures() {
    const signals = [];

    try {
      // Buscar estudios activos con problemas de eficacia
      const studies = await Study.find({
        status: 'active',
        studyType: { $in: ['efectividad', 'eficacia'] }
      }).populate('cohort.patients.patient');

      for (const study of studies) {
        // Analizar pacientes del estudio
        let failureCount = 0;
        const failedPatients = [];

        for (const enrollment of study.cohort.patients) {
          const patient = enrollment.patient;
          if (!patient) continue;

          // Criterios de fallo terapéutico:
          // 1. Baja adherencia persistente
          // 2. Eventos adversos graves
          // 3. Falta de mejora clínica

          const adherence = patient.calculateAdherence(60);
          const activeAEs = patient.getActiveAdverseEvents();

          if (adherence < 60 || activeAEs.length > 2) {
            failureCount++;
            failedPatients.push(patient._id);
          }
        }

        const totalPatients = study.cohort.patients.length;
        const failureRate = totalPatients > 0 ? (failureCount / totalPatients) * 100 : 0;

        // Si más del 30% tiene fallo terapéutico, generar señal
        if (failureRate > 30 && failureCount >= 3) {
          const signal = new ClinicalSignal({
            signalType: 'treatment-failure',
            title: `Alta Tasa de Fallo Terapéutico: ${study.title}`,
            description: `Se ha detectado una alta tasa de fallo terapéutico en el estudio "${study.title}". ` +
                        `${failureCount} de ${totalPatients} pacientes (${failureRate.toFixed(1)}%) muestran signos de fallo terapéutico.`,
            severity: failureRate > 50 ? 'high' : 'medium',
            confidence: 70,
            affectedEntities: {
              patients: failedPatients.map(pId => ({
                patient: pId,
                riskScore: 70,
                contribution: 100 / failureCount
              })),
              studies: [study._id]
            },
            statistics: {
              sampleSize: totalPatients,
              observedFrequency: failureRate,
              expectedFrequency: 15,
              reportingOddsRatio: failureRate / 15
            },
            detection: {
              method: 'frequency-analysis',
              algorithm: 'Treatment Failure Detection',
              detectedBy: {
                type: 'automatic'
              }
            },
            hypothesis: {
              statement: 'El tratamiento actual puede no ser óptimo para una proporción significativa de pacientes',
              validationSteps: [
                'Revisar protocolos de tratamiento',
                'Analizar causas de fallo individual',
                'Considerar alternativas terapéuticas',
                'Evaluar necesidad de personalización'
              ]
            },
            recommendations: [
              {
                action: 'clinical-review',
                description: 'Revisión del protocolo de estudio',
                priority: 'urgent'
              },
              {
                action: 'adjust-treatment',
                description: 'Evaluar ajustes terapéuticos individualizados',
                priority: 'routine'
              }
            ],
            status: 'requires-action'
          });

          await signal.save();
          signals.push(signal);
        }
      }

    } catch (error) {
      console.error('Error detectando fallos terapéuticos:', error);
    }

    return signals;
  }

  /**
   * 6. Detectar anomalías estadísticas
   */
  async detectStatisticalAnomalies() {
    const signals = [];

    try {
      // Análisis de outliers positivos: pacientes con resultados excepcionalmente buenos
      const patients = await User.find({
        role: 'patient',
        isActive: true
      });

      const adherenceScores = patients
        .map(p => p.calculateAdherence(90))
        .filter(a => a > 0);

      if (adherenceScores.length > 0) {
        const mean = adherenceScores.reduce((sum, val) => sum + val, 0) / adherenceScores.length;
        const variance = adherenceScores.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / adherenceScores.length;
        const stdDev = Math.sqrt(variance);

        // Buscar outliers positivos (> 2 desviaciones estándar)
        const threshold = mean + (2 * stdDev);

        for (const patient of patients) {
          const adherence = patient.calculateAdherence(90);

          if (adherence > threshold && adherence >= 95) {
            const signal = new ClinicalSignal({
              signalType: 'positive-outlier',
              title: `Adherencia Excepcional: ${patient.name}`,
              description: `${patient.name} muestra una adherencia excepcional de ${adherence}%, ` +
                          `significativamente superior a la media (${mean.toFixed(1)}%). ` +
                          `Este caso puede servir como modelo de buenas prácticas.`,
              severity: 'low',
              confidence: 85,
              affectedEntities: {
                patients: [{
                  patient: patient._id,
                  riskScore: 0,  // No es un riesgo, es positivo
                  contribution: 100
                }]
              },
              statistics: {
                sampleSize: patients.length,
                observedFrequency: adherence,
                expectedFrequency: mean,
                trend: 'stable'
              },
              detection: {
                method: 'anomaly-detection',
                algorithm: 'Statistical Outlier Detection (Z-score > 2)',
                detectedBy: {
                  type: 'automatic'
                }
              },
              hypothesis: {
                statement: 'El paciente ha encontrado estrategias efectivas para mantener adherencia óptima',
                validationSteps: [
                  'Entrevistar al paciente sobre sus estrategias',
                  'Documentar mejores prácticas',
                  'Considerar compartir con otros pacientes'
                ]
              },
              recommendations: [{
                action: 'patient-communication',
                description: 'Documentar y compartir estrategias de éxito',
                priority: 'routine'
              }],
              status: 'new'
            });

            await signal.save();
            signals.push(signal);
          }
        }
      }

    } catch (error) {
      console.error('Error detectando anomalías estadísticas:', error);
    }

    return signals;
  }

  /**
   * Base de datos simplificada de interacciones conocidas
   */
  getKnownInteractions() {
    return {
      // Ejemplo: Anticoagulantes + AINEs
      'Warfarina|Ibuprofeno': {
        severity: 'high',
        description: 'Riesgo aumentado de sangrado',
        mechanism: 'Inhibición de agregación plaquetaria y desplazamiento de unión a proteínas',
        recommendation: 'Considerar alternativa analgésica o monitorización estrecha de INR',
        references: []
      },
      // Más interacciones se añadirían aquí o se consultarían desde API externa
    };
  }

  /**
   * Analizar señal específica por paciente
   */
  async analyzePatientSignals(patientId) {
    const patient = await User.findById(patientId);
    if (!patient) return [];

    const signals = [];

    // Análisis individual del paciente
    const adherence = patient.calculateAdherence(30);
    const activeAEs = patient.getActiveAdverseEvents();

    // Generar señales individuales si es necesario
    // ...

    return signals;
  }
}

module.exports = new SignalDetectionService();
