class API {
  constructor() {
    this.baseURL = CONFIG.API_URL;
  }

  // ===== UTILIDADES =====
  
  getToken() {
    return localStorage.getItem('token');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const token = this.getToken();

    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    try {
      logger.log(`API Request: ${options.method || 'GET'} ${endpoint}`);
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error en la petición');
      }

      return await response.json();
    } catch (error) {
      logger.error(`API Error: ${endpoint}`, error);
      throw error;
    }
  }

  // ===== AUTENTICACIÓN =====

  async register(name, email, password, additionalData = {}) {
    const response = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ 
        name, 
        email, 
        password,
        ...additionalData 
      }),
    });

    if (response.token) {
      localStorage.setItem('token', response.token);
    }

    return response;
  }

  async login(email, password) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.token) {
      localStorage.setItem('token', response.token);
    }

    return response;
  }

  async getCurrentUser() {
    return await this.request('/auth/me');
  }

  async updateProfile(data) {
    return await this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async changePassword(currentPassword, newPassword) {
    return await this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // ===== USUARIOS =====

  async getUsers(filters = {}) {
    const params = new URLSearchParams();
    if (filters.medication) params.append('medication', filters.medication);
    if (filters.disease) params.append('disease', filters.disease);
    if (filters.minAdherence) params.append('minAdherence', filters.minAdherence);
    if (filters.maxAdherence) params.append('maxAdherence', filters.maxAdherence);
    if (filters.search) params.append('search', filters.search);

    const query = params.toString();
    return await this.request(`/users${query ? '?' + query : ''}`);
  }

  async getUser(userId) {
    return await this.request(`/users/${userId}`);
  }

  async getUserProfile(userId) {
    return await this.request(`/users/${userId}/profile`);
  }

  async updateUser(userId, data) {
    return await this.request(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(userId) {
    return await this.request(`/users/${userId}`, {
      method: 'DELETE',
    });
  }

  // Eventos adversos
  async addAdverseEvent(userId, eventData) {
    return await this.request(`/users/${userId}/adverse-events`, {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  }

  async updateAdverseEvent(userId, eventId, data) {
    return await this.request(`/users/${userId}/adverse-events/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAdverseEvent(userId, eventId) {
    return await this.request(`/users/${userId}/adverse-events/${eventId}`, {
      method: 'DELETE',
    });
  }

  // Notas del farmacéutico
  async addNote(userId, content) {
    return await this.request(`/users/${userId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async updateNote(userId, noteId, content) {
    return await this.request(`/users/${userId}/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  }

  async deleteNote(userId, noteId) {
    return await this.request(`/users/${userId}/notes/${noteId}`, {
      method: 'DELETE',
    });
  }

  // Adherencia
  async getUserAdherence(userId, days = 30) {
    return await this.request(`/users/${userId}/adherence?days=${days}`);
  }

  // ===== MEDICAMENTOS =====

  async getMedications(filters = {}) {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.indication) params.append('indication', filters.indication);
    if (filters.isActive !== undefined) params.append('isActive', filters.isActive);

    const query = params.toString();
    return await this.request(`/medications${query ? '?' + query : ''}`);
  }

  async getMedication(medicationId) {
    return await this.request(`/medications/${medicationId}`);
  }

  async createMedication(data) {
    return await this.request('/medications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMedication(medicationId, data) {
    return await this.request(`/medications/${medicationId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteMedication(medicationId) {
    return await this.request(`/medications/${medicationId}`, {
      method: 'DELETE',
    });
  }

  async assignMedication(medicationId, patientId) {
    return await this.request(`/medications/${medicationId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ patientId }),
    });
  }

  async unassignMedication(medicationId, patientId) {
    return await this.request(`/medications/${medicationId}/unassign`, {
      method: 'POST',
      body: JSON.stringify({ patientId }),
    });
  }

  async getMedicationPatients(medicationId) {
    return await this.request(`/medications/${medicationId}/patients`);
  }

  async getMedicationStats(medicationId) {
    return await this.request(`/medications/${medicationId}/stats`);
  }

  // FAQs de medicamentos
  async addMedicationFAQ(medicationId, question, answer) {
    return await this.request(`/medications/${medicationId}/faqs`, {
      method: 'POST',
      body: JSON.stringify({ question, answer }),
    });
  }

  async updateMedicationFAQ(medicationId, faqId, question, answer) {
    return await this.request(`/medications/${medicationId}/faqs/${faqId}`, {
      method: 'PUT',
      body: JSON.stringify({ question, answer }),
    });
  }

  async deleteMedicationFAQ(medicationId, faqId) {
    return await this.request(`/medications/${medicationId}/faqs/${faqId}`, {
      method: 'DELETE',
    });
  }

  async getMedicationIndications() {
    return await this.request('/medications/meta/indications');
  }

  // ===== RECORDATORIOS =====

  async getReminders() {
    return await this.request('/reminders');
  }

  async createReminder(data) {
    return await this.request('/reminders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateReminder(reminderId, data) {
    return await this.request(`/reminders/${reminderId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteReminder(reminderId) {
    return await this.request(`/reminders/${reminderId}`, {
      method: 'DELETE',
    });
  }

  async recordDose(reminderId, taken, notes = '') {
    return await this.request(`/reminders/${reminderId}/record-dose`, {
      method: 'POST',
      body: JSON.stringify({ taken, notes }),
    });
  }

  async getReminderHistory(reminderId) {
    return await this.request(`/reminders/${reminderId}/history`);
  }

  // ===== CONSULTAS =====

  async getConsultations() {
    return await this.request('/consultations');
  }

  async getAllConsultations() {
    return await this.request('/consultations/all');
  }

  async createConsultation(data) {
    return await this.request('/consultations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async respondConsultation(consultationId, response) {
    return await this.request(`/consultations/${consultationId}/respond`, {
      method: 'PUT',
      body: JSON.stringify({ response }),
    });
  }

  async deleteConsultation(consultationId) {
    return await this.request(`/consultations/${consultationId}`, {
      method: 'DELETE',
    });
  }

  // ===== ANALYTICS =====

  async getAnalytics() {
    return await this.request('/analytics');
  }

  async getAnalyticsByMedication() {
    return await this.request('/analytics/by-medication');
  }

  async getAnalyticsByDisease() {
    return await this.request('/analytics/by-disease');
  }

  async getLowAdherencePatients(threshold = 70) {
    return await this.request(`/analytics/low-adherence?threshold=${threshold}`);
  }

  async exportData(type) {
    // type: 'patients', 'medications', 'consultations', 'questionnaires'
    return await this.request(`/analytics/export?type=${type}`);
  }

  // ===== CUESTIONARIOS PROMS =====

  // Admin - Gestión de cuestionarios
  async getAllQuestionnaires() {
    return await this.request('/questionnaires/admin/all');
  }

  async createQuestionnaire(data) {
    return await this.request('/questionnaires/admin/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateQuestionnaire(questionnaireId, data) {
    return await this.request(`/questionnaires/admin/${questionnaireId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteQuestionnaire(questionnaireId) {
    return await this.request(`/questionnaires/admin/${questionnaireId}`, {
      method: 'DELETE',
    });
  }

  async activateQuestionnaire(questionnaireId) {
    return await this.request(`/questionnaires/admin/${questionnaireId}/activate`, {
      method: 'PUT',
    });
  }

  async assignQuestionnaire(questionnaireId, patientIds) {
    return await this.request(`/questionnaires/admin/${questionnaireId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ patientIds }),
    });
  }

  async getQuestionnaireResponses(questionnaireId, status = null) {
    const query = status ? `?status=${status}` : '';
    return await this.request(`/questionnaires/admin/${questionnaireId}/responses${query}`);
  }

  async getQuestionnaireStats(questionnaireId) {
    return await this.request(`/questionnaires/admin/${questionnaireId}/stats`);
  }

  async reviewQuestionnaireResponse(responseId, notes) {
    return await this.request(`/questionnaires/admin/responses/${responseId}/review`, {
      method: 'PUT',
      body: JSON.stringify({ notes }),
    });
  }

  // Paciente - Cuestionarios asignados
  async getMyQuestionnaires() {
    return await this.request('/questionnaires/my-questionnaires');
  }

  async getMyQuestionnaireHistory() {
    return await this.request('/questionnaires/my-history');
  }

  async getQuestionnaire(questionnaireId) {
    return await this.request(`/questionnaires/${questionnaireId}`);
  }

  async startQuestionnaire(questionnaireId) {
    return await this.request(`/questionnaires/${questionnaireId}/start`, {
      method: 'POST',
    });
  }

  async submitQuestionnaire(questionnaireId, responses) {
    return await this.request(`/questionnaires/${questionnaireId}/submit`, {
      method: 'PUT',
      body: JSON.stringify({ responses }),
    });
  }

  async saveQuestionnaireProgress(questionnaireId, responses) {
    return await this.request(`/questionnaires/${questionnaireId}/save-progress`, {
      method: 'PUT',
      body: JSON.stringify({ responses }),
    });
  }

  // Utilidades para cuestionarios
  async getQuestionnaireMedications() {
    return await this.request('/questionnaires/utils/medications');
  }

  async getQuestionnaireDiseases() {
    return await this.request('/questionnaires/utils/diseases');
  }

  // ===== HISTORIAL CLÍNICO =====

  // Crear registro de historial clínico
  async createClinicalRecord(patientId, data) {
    return await this.request(`/clinical-history/patient/${patientId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Obtener todo el historial de un paciente
  async getPatientClinicalHistory(patientId, options = {}) {
    const params = new URLSearchParams();
    if (options.startDate) params.append('startDate', options.startDate);
    if (options.endDate) params.append('endDate', options.endDate);
    if (options.limit) params.append('limit', options.limit);

    const query = params.toString();
    return await this.request(`/clinical-history/patient/${patientId}${query ? '?' + query : ''}`);
  }

  // Obtener registro más reciente de un paciente
  async getLatestClinicalRecord(patientId) {
    return await this.request(`/clinical-history/patient/${patientId}/latest`);
  }

  // Obtener un registro específico
  async getClinicalRecord(recordId) {
    return await this.request(`/clinical-history/record/${recordId}`);
  }

  // Actualizar un registro de historial
  async updateClinicalRecord(recordId, data) {
    return await this.request(`/clinical-history/record/${recordId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Eliminar (desactivar) un registro
  async deleteClinicalRecord(recordId) {
    return await this.request(`/clinical-history/record/${recordId}`, {
      method: 'DELETE',
    });
  }

  // Obtener evolución de un parámetro específico
  async getParameterEvolution(patientId, parameter, options = {}) {
    const params = new URLSearchParams();
    if (options.startDate) params.append('startDate', options.startDate);
    if (options.endDate) params.append('endDate', options.endDate);

    const query = params.toString();
    return await this.request(
      `/clinical-history/patient/${patientId}/evolution/${parameter}${query ? '?' + query : ''}`
    );
  }

  // Exportar historial completo
  async exportClinicalHistory(patientId, options = {}) {
    const params = new URLSearchParams();
    if (options.format) params.append('format', options.format); // 'json' o 'csv'
    if (options.anonymize) params.append('anonymize', 'true');

    const query = params.toString();
    return await this.request(
      `/clinical-history/patient/${patientId}/export${query ? '?' + query : ''}`
    );
  }

  // Comparar dos registros
  async compareClinicalRecords(recordId1, recordId2) {
    return await this.request('/clinical-history/compare', {
      method: 'POST',
      body: JSON.stringify({ recordId1, recordId2 }),
    });
  }

  // Obtener estadísticas poblacionales
  async getPopulationStats() {
    return await this.request('/clinical-history/stats/population');
  }

  // ===== ESTUDIOS RWE (Real World Evidence) =====

  // Obtener todos los estudios
  async getStudies(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.studyType) params.append('studyType', filters.studyType);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.skip) params.append('skip', filters.skip);

    const query = params.toString();
    return await this.request(`/studies${query ? '?' + query : ''}`);
  }

  // Obtener estudios activos
  async getActiveStudies() {
    return await this.request('/studies/active');
  }

  // Obtener estadísticas globales de estudios
  async getStudiesGlobalStats() {
    return await this.request('/studies/stats/global');
  }

  // Obtener un estudio específico
  async getStudy(studyId) {
    return await this.request(`/studies/${studyId}`);
  }

  // Crear nuevo estudio
  async createStudy(data) {
    return await this.request('/studies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Actualizar estudio
  async updateStudy(studyId, data) {
    return await this.request(`/studies/${studyId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Eliminar estudio
  async deleteStudy(studyId) {
    return await this.request(`/studies/${studyId}`, {
      method: 'DELETE',
    });
  }

  // Activar estudio
  async activateStudy(studyId) {
    return await this.request(`/studies/${studyId}/activate`, {
      method: 'POST',
    });
  }

  // Pausar estudio
  async pauseStudy(studyId) {
    return await this.request(`/studies/${studyId}/pause`, {
      method: 'POST',
    });
  }

  // Reanudar estudio
  async resumeStudy(studyId) {
    return await this.request(`/studies/${studyId}/resume`, {
      method: 'POST',
    });
  }

  // Completar estudio
  async completeStudy(studyId) {
    return await this.request(`/studies/${studyId}/complete`, {
      method: 'POST',
    });
  }

  // Generar cohorte automáticamente
  async generateStudyCohort(studyId) {
    return await this.request(`/studies/${studyId}/generate-cohort`, {
      method: 'POST',
    });
  }

  // Añadir paciente a cohorte
  async enrollPatientInStudy(studyId, patientId, baselineData = {}) {
    return await this.request(`/studies/${studyId}/enroll`, {
      method: 'POST',
      body: JSON.stringify({ patientId, baselineData }),
    });
  }

  // Añadir múltiples pacientes
  async enrollPatientsBatch(studyId, patientIds) {
    return await this.request(`/studies/${studyId}/enroll-batch`, {
      method: 'POST',
      body: JSON.stringify({ patientIds }),
    });
  }

  // Retirar paciente del estudio
  async withdrawPatientFromStudy(studyId, patientId, reason, notes = '') {
    return await this.request(`/studies/${studyId}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ patientId, reason, notes }),
    });
  }

  // Registrar seguimiento
  async recordStudyFollowUp(studyId, patientId, timePoint, data, questionnaireResponses = []) {
    return await this.request(`/studies/${studyId}/follow-up`, {
      method: 'POST',
      body: JSON.stringify({ patientId, timePoint, data, questionnaireResponses }),
    });
  }

  // Exportar datos del estudio
  async exportStudyData(studyId, format = 'json') {
    return await this.request(`/studies/${studyId}/export?format=${format}`);
  }

  // ===== INTERVENCIONES FARMACÉUTICAS =====

  // Obtener intervenciones
  async getInterventions(filters = {}) {
    const params = new URLSearchParams();
    if (filters.patient) params.append('patient', filters.patient);
    if (filters.pharmacist) params.append('pharmacist', filters.pharmacist);
    if (filters.type) params.append('type', filters.type);
    if (filters.status) params.append('status', filters.status);
    if (filters.outcomeStatus) params.append('outcomeStatus', filters.outcomeStatus);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.skip) params.append('skip', filters.skip);

    const query = params.toString();
    return await this.request(`/interventions${query ? '?' + query : ''}`);
  }

  // Obtener una intervención específica
  async getIntervention(interventionId) {
    return await this.request(`/interventions/${interventionId}`);
  }

  // Crear nueva intervención
  async createIntervention(data) {
    return await this.request('/interventions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Actualizar intervención
  async updateIntervention(interventionId, data) {
    return await this.request(`/interventions/${interventionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Eliminar intervención
  async deleteIntervention(interventionId) {
    return await this.request(`/interventions/${interventionId}`, {
      method: 'DELETE',
    });
  }

  // Evaluar resultado de intervención
  async evaluateIntervention(interventionId, successful, description, impactData = {}) {
    return await this.request(`/interventions/${interventionId}/evaluate`, {
      method: 'POST',
      body: JSON.stringify({ successful, description, impactData }),
    });
  }

  // Añadir seguimiento a intervención
  async addInterventionFollowUp(interventionId, notes, status) {
    return await this.request(`/interventions/${interventionId}/follow-up`, {
      method: 'POST',
      body: JSON.stringify({ notes, status }),
    });
  }

  // Completar intervención
  async completeIntervention(interventionId) {
    return await this.request(`/interventions/${interventionId}/complete`, {
      method: 'POST',
    });
  }

  // Cancelar intervención
  async cancelIntervention(interventionId, reason = '') {
    return await this.request(`/interventions/${interventionId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // Obtener estadísticas de intervenciones
  async getInterventionsStats(filters = {}) {
    const params = new URLSearchParams();
    if (filters.pharmacist) params.append('pharmacist', filters.pharmacist);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    const query = params.toString();
    return await this.request(`/interventions/stats${query ? '?' + query : ''}`);
  }

  // Obtener impacto de intervenciones
  async getInterventionsImpact(filters = {}) {
    const params = new URLSearchParams();
    if (filters.pharmacist) params.append('pharmacist', filters.pharmacist);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    const query = params.toString();
    return await this.request(`/interventions/impact${query ? '?' + query : ''}`);
  }

  // Obtener intervenciones por tipo
  async getInterventionsByType(type, options = {}) {
    const params = new URLSearchParams();
    if (options.pharmacist) params.append('pharmacist', options.pharmacist);
    if (options.startDate) params.append('startDate', options.startDate);
    if (options.endDate) params.append('endDate', options.endDate);

    const query = params.toString();
    return await this.request(`/interventions/by-type/${type}${query ? '?' + query : ''}`);
  }

  // Obtener intervenciones de un paciente
  async getPatientInterventions(patientId, options = {}) {
    const params = new URLSearchParams();
    if (options.startDate) params.append('startDate', options.startDate);
    if (options.endDate) params.append('endDate', options.endDate);
    if (options.limit) params.append('limit', options.limit);

    const query = params.toString();
    return await this.request(`/interventions/patient/${patientId}${query ? '?' + query : ''}`);
  }

  // ===== TIMELINE CLÍNICO UNIFICADO =====

  // Obtener timeline completo de un paciente
  async getPatientTimeline(patientId, options = {}) {
    const params = new URLSearchParams();
    if (options.startDate) params.append('startDate', options.startDate);
    if (options.endDate) params.append('endDate', options.endDate);
    if (options.eventTypes) params.append('eventTypes', options.eventTypes);
    if (options.limit) params.append('limit', options.limit);

    const query = params.toString();
    return await this.request(`/timeline/patient/${patientId}${query ? '?' + query : ''}`);
  }

  // Obtener resumen del timeline del paciente
  async getPatientTimelineSummary(patientId) {
    return await this.request(`/timeline/patient/${patientId}/summary`);
  }

  // Comparar timelines de múltiples pacientes
  async compareTimelines(patientIds, options = {}) {
    const params = new URLSearchParams();
    params.append('patientIds', patientIds.join(','));
    if (options.eventTypes) params.append('eventTypes', options.eventTypes);
    if (options.startDate) params.append('startDate', options.startDate);
    if (options.endDate) params.append('endDate', options.endDate);

    const query = params.toString();
    return await this.request(`/timeline/compare?${query}`);
  }

  // ===== CONSENTIMIENTOS DINÁMICOS (FASE B) =====

  // Crear consentimiento
  async createConsent(data) {
    return await this.request('/consents', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Firmar consentimiento
  async signConsent(consentId, signatureData) {
    return await this.request(`/consents/${consentId}/sign`, {
      method: 'POST',
      body: JSON.stringify(signatureData)
    });
  }

  // Otorgar propósito específico
  async grantConsentPurpose(consentId, purposeName, additionalData = {}) {
    return await this.request(`/consents/${consentId}/purposes/${purposeName}/grant`, {
      method: 'POST',
      body: JSON.stringify(additionalData)
    });
  }

  // Retirar propósito específico
  async withdrawConsentPurpose(consentId, purposeName, reason = '') {
    return await this.request(`/consents/${consentId}/purposes/${purposeName}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  // Autorizar estudio específico
  async authorizeStudyConsent(consentId, studyId) {
    return await this.request(`/consents/${consentId}/studies/${studyId}/authorize`, {
      method: 'POST'
    });
  }

  // Retirar autorización de estudio
  async withdrawStudyConsent(consentId, studyId) {
    return await this.request(`/consents/${consentId}/studies/${studyId}/withdraw`, {
      method: 'POST'
    });
  }

  // Retirar consentimiento completamente
  async withdrawConsent(consentId, reason = '') {
    return await this.request(`/consents/${consentId}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  // Obtener consentimiento activo de un paciente
  async getPatientConsent(patientId) {
    return await this.request(`/consents/patient/${patientId}`);
  }

  // Obtener todos los consentimientos de un paciente (historial)
  async getPatientConsentsHistory(patientId) {
    return await this.request(`/consents/patient/${patientId}/all`);
  }

  // Obtener consentimiento específico
  async getConsent(consentId) {
    return await this.request(`/consents/${consentId}`);
  }

  // Obtener auditoría de consentimiento
  async getConsentAudit(consentId) {
    return await this.request(`/consents/${consentId}/audit`);
  }

  // Verificar si paciente ha otorgado un propósito
  async checkConsentPurpose(patientId, purposeName) {
    return await this.request(`/consents/check/${patientId}/purpose/${purposeName}`);
  }

  // Verificar si paciente ha autorizado un estudio
  async checkStudyConsent(patientId, studyId) {
    return await this.request(`/consents/check/${patientId}/study/${studyId}`);
  }

  // Solicitar derecho al olvido (GDPR)
  async requestErasure(consentId, reason = '') {
    return await this.request(`/consents/${consentId}/gdpr/erasure`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  // Solicitar acceso a datos (GDPR)
  async requestDataAccess(consentId) {
    return await this.request(`/consents/${consentId}/gdpr/access`, {
      method: 'POST'
    });
  }

  // Solicitar portabilidad de datos (GDPR)
  async requestDataPortability(consentId, format = 'JSON') {
    return await this.request(`/consents/${consentId}/gdpr/portability`, {
      method: 'POST',
      body: JSON.stringify({ format })
    });
  }

  // Obtener estadísticas globales de consentimientos
  async getConsentStats() {
    return await this.request('/consents/stats/global');
  }

  // ===== EXPORTACIÓN CIENTÍFICA (FASE B) =====

  // Exportar estudio completo
  async exportStudy(studyId, options = {}) {
    const params = new URLSearchParams();
    if (options.format) params.append('format', options.format); // json, csv, omop, fhir
    if (options.anonymize !== undefined) params.append('anonymize', options.anonymize);
    if (options.includeMetadata !== undefined) params.append('includeMetadata', options.includeMetadata);
    if (options.strobeChecklist !== undefined) params.append('strobeChecklist', options.strobeChecklist);

    const query = params.toString();
    return await this.request(`/export/study/${studyId}${query ? '?' + query : ''}`);
  }

  // Descargar estudio exportado (para CSV)
  async downloadStudyExport(studyId, format = 'csv') {
    const token = this.getToken();
    const url = `${this.baseURL}/export/study/${studyId}?format=${format}&anonymize=true`;

    // Descargar archivo
    const link = document.createElement('a');
    link.href = url;
    link.download = `study_${studyId}_${format}_${Date.now()}.${format}`;
    link.click();
  }
}

// Crear instancia global
const api = new API();