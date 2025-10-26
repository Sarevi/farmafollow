// ===== API CLIENT PARA FARMAFOLLOW - COMPLETO =====

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

  async recordDose(reminderId, taken, notes = '') {
    const response = await fetch(`${this.baseURL}/reminders/${reminderId}/record-dose`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ taken, notes })
    });
    if (!response.ok) throw new Error('Error registrando dosis');
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
  
  async createConsultation(data) {
    const response = await fetch(`${this.baseURL}/consultations`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Error creando consulta');
    return await response.json();
  },

  async getMyConsultations() {
    const response = await fetch(`${this.baseURL}/consultations`, {
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error('Error obteniendo mis consultas');
    return await response.json();
  },

  // ===== ADMIN - CONSULTATIONS (FALTABAN ESTOS) =====
  
  async getAllConsultations() {
    const response = await fetch(`${this.baseURL}/consultations/all`, {
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error('Error obteniendo consultas');
    return await response.json();
  },

  async respondConsultation(consultationId, responseText) {
    const response = await fetch(`${this.baseURL}/consultations/${consultationId}/respond`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ response: responseText })
    });
    if (!response.ok) throw new Error('Error respondiendo consulta');
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
  }
};