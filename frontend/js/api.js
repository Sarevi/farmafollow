// ===== API CLIENT PARA FARMAFOLLOW =====

const api = {
  baseURL: '/api',
  
  getHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };
  },

  // ===== AUTH =====
  
  async login(email, password) {
    const response = await fetch(`${this.baseURL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error en login');
    }
    return await response.json();
  },

  async register(data) {
    const response = await fetch(`${this.baseURL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error en registro');
    }
    return await response.json();
  },

  async getCurrentUser() {
    const response = await fetch(`${this.baseURL}/auth/me`, {
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error('Error obteniendo usuario');
    return await response.json();
  },

  async updateProfile(data) {
    const response = await fetch(`${this.baseURL}/auth/profile`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Error actualizando perfil');
    return await response.json();
  },

  // ===== MEDICATIONS =====
  
  async getMedications() {
    const response = await fetch(`${this.baseURL}/medications`, {
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error('Error obteniendo medicamentos');
    return await response.json();
  },

  async getMedication(id) {
    const response = await fetch(`${this.baseURL}/medications/${id}`, {
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error('Error obteniendo medicamento');
    return await response.json();
  },

  async createMedication(data) {
    const response = await fetch(`${this.baseURL}/medications`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Error creando medicamento');
    return await response.json();
  },

  async updateMedication(id, data) {
    const response = await fetch(`${this.baseURL}/medications/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Error actualizando medicamento');
    return await response.json();
  },

  async deleteMedication(id) {
    const response = await fetch(`${this.baseURL}/medications/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error('Error eliminando medicamento');
    return await response.json();
  },

  // ===== REMINDERS =====
  
  async getReminders() {
    const response = await fetch(`${this.baseURL}/reminders`, {
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error('Error obteniendo recordatorios');
    return await response.json();
  },

  async getReminder(id) {
    const response = await fetch(`${this.baseURL}/reminders/${id}`, {
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error('Error obteniendo recordatorio');
    return await response.json();
  },

  async createReminder(data) {
    const response = await fetch(`${this.baseURL}/reminders`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Error creando recordatorio');
    return await response.json();
  },

  async updateReminder(id, data) {
    const response = await fetch(`${this.baseURL}/reminders/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Error actualizando recordatorio');
    return await response.json();
  },

  async deleteReminder(id) {
    const response = await fetch(`${this.baseURL}/reminders/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error('Error eliminando recordatorio');
    return await response.json();
  },

  async recordDose(reminderId, taken, notes = '') {
    const response = await fetch(`${this.baseURL}/reminders/${reminderId}/record-dose`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ taken, notes })
    });
    if (!response.ok) throw new Error('Error registrando dosis');
    return await response.json();
  },

  async getReminderHistory(reminderId) {
    const response = await fetch(`${this.baseURL}/reminders/${reminderId}/history`, {
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error('Error obteniendo historial');
    return await response.json();
  },

  async getAdherenceStats() {
    const response = await fetch(`${this.baseURL}/reminders/stats/adherence`, {
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error('Error obteniendo estadísticas');
    return await response.json();
  },

  // ===== CONSULTATIONS =====
  
  async getConsultations() {
    const response = await fetch(`${this.baseURL}/consultations`, {
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error('Error obteniendo consultas');
    return await response.json();
  },

  async getConsultation(id) {
    const response = await fetch(`${this.baseURL}/consultations/${id}`, {
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error('Error obteniendo consulta');
    return await response.json();
  },

  async createConsultation(data) {
    const response = await fetch(`${this.baseURL}/consultations`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Error creando consulta');
    return await response.json();
  },

  async updateConsultation(id, data) {
    const response = await fetch(`${this.baseURL}/consultations/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Error actualizando consulta');
    return await response.json();
  },

  async addMessage(consultationId, message) {
    const response = await fetch(`${this.baseURL}/consultations/${consultationId}/messages`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ message })
    });
    if (!response.ok) throw new Error('Error enviando mensaje');
    return await response.json();
  },

  // ===== ANALYTICS (ADMIN) =====
  
  async getAnalytics() {
    const response = await fetch(`${this.baseURL}/analytics`, {
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error('Error obteniendo analytics');
    return await response.json();
  },

  async getAdherenceReport() {
    const response = await fetch(`${this.baseURL}/analytics/adherence`, {
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error('Error obteniendo reporte de adherencia');
    return await response.json();
  },

  // ===== USERS (ADMIN) =====
  
  async getUsers() {
    const response = await fetch(`${this.baseURL}/users`, {
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error('Error obteniendo usuarios');
    return await response.json();
  },

  async getUser(id) {
    const response = await fetch(`${this.baseURL}/users/${id}`, {
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error('Error obteniendo usuario');
    return await response.json();
  },

  async updateUser(id, data) {
    const response = await fetch(`${this.baseURL}/users/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Error actualizando usuario');
    return await response.json();
  },

  async deleteUser(id) {
    const response = await fetch(`${this.baseURL}/users/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error('Error eliminando usuario');
    return await response.json();
  },

  // ===== CUESTIONARIOS (NUEVOS) =====

  // Paciente - Cuestionarios pendientes
  async getPendingQuestionnaires() {
    const response = await fetch(`${this.baseURL}/questionnaires/pending/list`, {
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error('Error obteniendo cuestionarios pendientes');
    return await response.json();
  },

  // Paciente - Enviar respuesta
  async submitQuestionnaire(responseId, responses) {
    const response = await fetch(`${this.baseURL}/questionnaires/${responseId}/respond`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ responses })
    });
    if (!response.ok) throw new Error('Error enviando cuestionario');
    return await response.json();
  },

  // Paciente - Mis respuestas completadas
  async getMyQuestionnaireResponses() {
    const response = await fetch(`${this.baseURL}/questionnaires/my-responses`, {
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error('Error obteniendo mis respuestas');
    return await response.json();
  },

  // Admin - Crear cuestionario
  async createQuestionnaire(data) {
    const response = await fetch(`${this.baseURL}/questionnaires`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Error creando cuestionario');
    return await response.json();
  },

  // Admin - Obtener todos los cuestionarios
  async getQuestionnaires() {
    const response = await fetch(`${this.baseURL}/questionnaires`, {
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error('Error obteniendo cuestionarios');
    return await response.json();
  },

  // Admin - Obtener un cuestionario específico
  async getQuestionnaire(id) {
    const response = await fetch(`${this.baseURL}/questionnaires/${id}`, {
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error('Error obteniendo cuestionario');
    return await response.json();
  },

  // Admin - Ver respuestas de un cuestionario
  async getQuestionnaireResponses(questionnaireId) {
    const response = await fetch(`${this.baseURL}/questionnaires/${questionnaireId}/responses`, {
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error('Error obteniendo respuestas');
    return await response.json();
  },

  // Admin - Actualizar cuestionario
  async updateQuestionnaire(questionnaireId, data) {
    const response = await fetch(`${this.baseURL}/questionnaires/${questionnaireId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Error actualizando cuestionario');
    return await response.json();
  },

  // Admin - Eliminar cuestionario
  async deleteQuestionnaire(questionnaireId) {
    const response = await fetch(`${this.baseURL}/questionnaires/${questionnaireId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error('Error eliminando cuestionario');
    return await response.json();
  }
};