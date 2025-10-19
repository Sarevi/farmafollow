const mongoose = require('mongoose');

const medicationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  
  // ===== CAMPOS NUEVOS - FASE 1 =====
  
  // Información farmacológica
  activeIngredient: {
    type: String,
    trim: true,
    default: ''
  },
  
  // Reacciones adversas conocidas
  adverseReactions: [{
    type: String,
    trim: true
  }],
  
  // Indicaciones (enfermedades que trata)
  indications: [{
    type: String,
    trim: true
  }],
  
  // Contraindicaciones
  contraindications: {
    type: String,
    default: ''
  },
  
  // Forma farmacéutica (opcional)
  pharmaceuticalForm: {
    type: String,
    enum: ['comprimido', 'cápsula', 'jarabe', 'inyectable', 'tópico', 'inhalador', 'otro', ''],
    default: ''
  },
  
  // Dosis estándar (opcional, informativo)
  standardDose: {
    type: String,
    default: ''
  },
  
  // Via de administración
  administrationRoute: {
    type: String,
    enum: ['oral', 'intravenosa', 'intramuscular', 'subcutánea', 'tópica', 'inhalatoria', 'otra', ''],
    default: 'oral'
  },
  
  // ===== CAMPOS EXISTENTES =====
  
  videoUrl: {
    type: String,
    default: ''
  },
  faqs: [{
    question: {
      type: String,
      required: true
    },
    answer: {
      type: String,
      required: true
    }
  }],
  patients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware para actualizar updatedAt
medicationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Método para calcular adherencia promedio de pacientes
medicationSchema.methods.calculateAverageAdherence = async function() {
  if (!this.patients || this.patients.length === 0) return 100;
  
  try {
    const User = mongoose.model('User');
    const patients = await User.find({ _id: { $in: this.patients } });
    
    if (patients.length === 0) return 100;
    
    const adherenceRates = patients.map(patient => patient.calculateAdherence());
    const average = adherenceRates.reduce((sum, rate) => sum + rate, 0) / adherenceRates.length;
    
    return Math.round(average);
  } catch (error) {
    console.error('Error calculating average adherence:', error);
    return 0;
  }
};

// Método para contar eventos adversos relacionados
medicationSchema.methods.countAdverseEvents = async function() {
  try {
    const User = mongoose.model('User');
    const patients = await User.find({ _id: { $in: this.patients } });
    
    let totalEvents = 0;
    let unresolvedEvents = 0;
    
    patients.forEach(patient => {
      if (patient.adverseEvents && patient.adverseEvents.length > 0) {
        // Filtrar eventos relacionados con este medicamento
        const relatedEvents = patient.adverseEvents.filter(event => 
          event.medication && event.medication.toString() === this._id.toString()
        );
        
        totalEvents += relatedEvents.length;
        unresolvedEvents += relatedEvents.filter(e => !e.resolved).length;
      }
    });
    
    return {
      total: totalEvents,
      unresolved: unresolvedEvents,
      resolved: totalEvents - unresolvedEvents
    };
  } catch (error) {
    console.error('Error counting adverse events:', error);
    return { total: 0, unresolved: 0, resolved: 0 };
  }
};

// Método para obtener pacientes activos
medicationSchema.methods.getActivePatients = async function() {
  try {
    const User = mongoose.model('User');
    const patients = await User.find({ 
      _id: { $in: this.patients },
      isActive: true
    });
    
    return patients;
  } catch (error) {
    console.error('Error getting active patients:', error);
    return [];
  }
};

// Método para agregar paciente
medicationSchema.methods.addPatient = async function(patientId) {
  if (!this.patients.includes(patientId)) {
    this.patients.push(patientId);
    await this.save();
  }
};

// Método para remover paciente
medicationSchema.methods.removePatient = async function(patientId) {
  this.patients = this.patients.filter(id => id.toString() !== patientId.toString());
  await this.save();
};

// Virtual para obtener número de pacientes
medicationSchema.virtual('patientCount').get(function() {
  return this.patients ? this.patients.length : 0;
});

// Incluir virtuals en JSON
medicationSchema.set('toJSON', { virtuals: true });
medicationSchema.set('toObject', { virtuals: true });

// Índices para búsqueda
medicationSchema.index({ name: 'text', activeIngredient: 'text' });
medicationSchema.index({ indications: 1 });
medicationSchema.index({ isActive: 1 });

module.exports = mongoose.model('Medication', medicationSchema);