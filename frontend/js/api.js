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

  // ===== CUESTIONARIOS (Preparado para Fase 2) =====

  async getQuestionnaires() {
    return await this.request('/questionnaires');
  }

  async getQuestionnaire(questionnaireId) {
    return await this.request(`/questionnaires/${questionnaireId}`);
  }

  async createQuestionnaire(data) {
    return await this.request('/questionnaires', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateQuestionnaire(questionnaireId, data) {
    return await this.request(`/questionnaires/${questionnaireId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteQuestionnaire(questionnaireId) {
    return await this.request(`/questionnaires/${questionnaireId}`, {
      method: 'DELETE',
    });
  }

  async getQuestionnaireResponses(questionnaireId) {
    return await this.request(`/questionnaires/${questionnaireId}/responses`);
  }

  async submitQuestionnaireResponse(questionnaireId, responses) {
    return await this.request(`/questionnaires/${questionnaireId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ responses }),
    });
  }

  async getMyPendingQuestionnaires() {
    return await this.request('/questionnaires/pending');
  }
}

// Crear instancia global
const api = new API();