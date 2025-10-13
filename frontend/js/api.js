class API {
  constructor() {
    this.baseURL = CONFIG.API_URL;
    this.token = localStorage.getItem('token');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    if (this.token) {
      config.headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error en la petición');
      }

      return data;
    } catch (error) {
      logger.error('API Error:', error);
      throw error;
    }
  }

  // Auth
  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    
    this.token = data.token;
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    return data.user;
  }

  async register(name, email, password) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    
    this.token = data.token;
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    return data.user;
  }

  logout() {
    this.token = null;
    localStorage.clear();
  }

  // Users
  async getProfile() {
    return await this.request('/users/profile');
  }

  async updateProfile(data) {
    return await this.request('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async getUsers() {
    return await this.request('/users');
  }

  async createUser(userData) {
    return await this.request('/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  async deleteUser(userId) {
    return await this.request(`/users/${userId}`, {
      method: 'DELETE'
    });
  }

  // Medications
  async getMedications() {
    return await this.request('/medications');
  }

  async getMedication(id) {
    return await this.request(`/medications/${id}`);
  }

  async createMedication(data) {
    return await this.request('/medications', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateMedication(id, data) {
    return await this.request(`/medications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteMedication(id) {
    return await this.request(`/medications/${id}`, {
      method: 'DELETE'
    });
  }

  async assignMedication(medicationId, patientId) {
    return await this.request(`/medications/${medicationId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ patientId })
    });
  }

  // Reminders
  async getReminders() {
    return await this.request('/reminders');
  }

  async createReminder(data) {
    return await this.request('/reminders', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateDoseStatus(reminderId, status) {
    return await this.request(`/reminders/${reminderId}/dose`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  async deleteReminder(id) {
    return await this.request(`/reminders/${id}`, {
      method: 'DELETE'
    });
  }

  // Consultations
  async getConsultations() {
    return await this.request('/consultations');
  }

  async createConsultation(data) {
    return await this.request('/consultations', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async respondConsultation(id, response) {
    return await this.request(`/consultations/${id}/respond`, {
      method: 'PUT',
      body: JSON.stringify({ response })
    });
  }

  // Analytics
  async getDashboardAnalytics() {
    return await this.request('/analytics/dashboard');
  }

  async getMedicationAnalytics() {
    return await this.request('/analytics/medications');
  }

  async getAlerts() {
    return await this.request('/analytics/alerts');
  }
}

// Instancia global
const api = new API();