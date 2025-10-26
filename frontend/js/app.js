class FarmaFollowApp {
  constructor() {
    this.currentScreen = 'login';
    this.currentMedication = null;
    this.medications = [];
    this.reminders = [];
    this.consultations = [];
    this.users = [];
    this.activeReminder = null;
    this.user = null;
    this.filters = {
      medication: '',
      disease: '',
      adherence: '',
      search: ''
    };
  }

  async init() {
    logger.log('Inicializando aplicación...');
    
    const token = localStorage.getItem('token');
    if (token) {
      try {
        this.user = await api.getCurrentUser();
        if (this.user.role === 'admin') {
          this.showScreen('admin-dashboard');
        } else {
          this.showScreen('dashboard');
        }
      } catch (error) {
        logger.error('Error verificando autenticación:', error);
        this.showScreen('login');
      }
    } else {
      this.showScreen('login');
    }

    this.setupEventListeners();
    await notifications.requestPermission();
  }

  setupEventListeners() {
    window.addEventListener('reminderNotification', (e) => {
      this.showReminderModal(e.detail);
    });
  }

  showScreen(screenName) {
    logger.log('Mostrando pantalla:', screenName);
    this.currentScreen = screenName;
    
    const app = document.getElementById('app');
    app.innerHTML = '';

    switch (screenName) {
      case 'login':
        this.renderLogin(app);
        break;
      case 'register':
        this.renderRegister(app);
        break;
      case 'dashboard':
        this.renderPatientDashboard(app);
        break;
      case 'medication':
        this.renderMedicationDetail(app);
        break;
      case 'reminders':
        this.renderReminders(app);
        break;
      case 'consult':
        this.renderConsult(app);
        break;
      case 'admin-dashboard':
        this.renderAdminDashboard(app);
        break;
      default:
        this.renderLogin(app);
    }
  }

  renderLogin(container) {
    container.innerHTML = `
      <div class="auth-container">
        <div class="auth-card">
          <div class="auth-header">
            <h1>💊 FarmaFollow</h1>
            <p>Seguimiento Farmacoterapéutico</p>
          </div>
          
          <form id="loginForm" class="auth-form">
            <div class="form-group">
              <label for="email">Email</label>
              <input type="email" id="email" required>
            </div>
            
            <div class="form-group">
              <label for="password">Contraseña</label>
              <input type="password" id="password" required>
            </div>
            
            <button type="submit" class="btn btn-primary btn-block">
              Iniciar Sesión
            </button>
          </form>
          
          <div class="auth-footer">
            <p>¿Primera vez? <a href="#" onclick="app.showScreen('register')">Registrarse</a></p>
          </div>
        </div>
      </div>
    `;

    document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
  }

  renderRegister(container) {
    container.innerHTML = `
      <div class="auth-container">
        <div class="auth-card">
          <div class="auth-header">
            <h1>💊 FarmaFollow</h1>
            <p>Crear Cuenta</p>
          </div>
          
          <form id="registerForm" class="auth-form">
            <div class="form-group">
              <label for="name">Nombre Completo</label>
              <input type="text" id="name" required>
            </div>
            
            <div class="form-group">
              <label for="email">Email</label>
              <input type="email" id="email" required>
            </div>
            
            <div class="form-group">
              <label for="password">Contraseña (mínimo 6 caracteres)</label>
              <input type="password" id="password" required minlength="6">
            </div>
            
            <button type="submit" class="btn btn-primary btn-block">
              Registrarse
            </button>
          </form>
          
          <div class="auth-footer">
            <p>¿Ya tienes cuenta? <a href="#" onclick="app.showScreen('login')">Iniciar Sesión</a></p>
          </div>
        </div>
      </div>
    `;

    document.getElementById('registerForm').addEventListener('submit', (e) => this.handleRegister(e));
  }

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
      const response = await api.login(email, password);
      this.user = response.user;
      
      if (this.user.role === 'admin') {
        this.showScreen('admin-dashboard');
      } else {
        this.showScreen('dashboard');
      }
    } catch (error) {
      this.showMessage('Error: ' + error.message, 'error');
    }
  }

  async handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
      await api.register(name, email, password);
      this.showMessage('¡Registro exitoso! Por favor inicia sesión.', 'success');
      setTimeout(() => this.showScreen('login'), 2000);
    } catch (error) {
      this.showMessage('Error: ' + error.message, 'error');
    }
  }

  // PANEL DE PACIENTE
  async renderPatientDashboard(container) {
    try {
      const [medications, reminders] = await Promise.all([
        api.getMedications(),
        api.getReminders()
      ]);

      this.medications = medications;
      this.reminders = reminders;

      const adherence = this.user.adherenceRate || 100;

      container.innerHTML = `
        <div class="dashboard">
          <div class="dashboard-header">
            <h1>Hola, ${this.user.name} 👋</h1>
            <button class="btn btn-secondary" onclick="app.logout()">
              Cerrar Sesión
            </button>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-icon">💊</div>
              <div class="stat-content">
                <h3>${medications.length}</h3>
                <p>Medicamentos</p>
              </div>
            </div>
            
            <div class="stat-card">
              <div class="stat-icon">📊</div>
              <div class="stat-content">
                <h3>${adherence}%</h3>
                <p>Adherencia</p>
              </div>
            </div>
            
            <div class="stat-card">
              <div class="stat-icon">🔔</div>
              <div class="stat-content">
                <h3>${reminders.filter(r => r.isActive).length}</h3>
                <p>Recordatorios</p>
              </div>
            </div>
          </div>

          <div id="medicationsContainer" class="medications-container"></div>
          
          <div class="card" style="margin-top: 2rem;">
            <h3>💬 Mis Consultas</h3>
            <div id="patientConsultations" class="consultations-list">
              <div class="loading">Cargando consultas...</div>
            </div>
            <button class="btn btn-primary" onclick="app.showScreen('consult')">
              📝 Nueva Consulta
            </button>
          </div>
        </div>
      `;

      const medicationsContainer = document.getElementById('medicationsContainer');

      if (medications.length === 0) {
        medicationsContainer.innerHTML = `
          <div class="empty-state">
            <p>📭 Sin medicamento asignado</p>
            <p style="color: var(--text-secondary);">Tu farmacéutico te asignará un medicamento pronto.</p>
          </div>
        `;
      } else {
        medications.forEach(med => {
          const card = document.createElement('div');
          card.className = 'medication-card';
          card.innerHTML = `
            <div class="medication-header">
              <h3>${med.name}</h3>
            </div>
            <p class="medication-description">${med.description}</p>
            <div class="medication-actions">
              <button class="btn btn-primary" onclick="app.showMedicationDetail('${med._id}')">
                Ver Detalles
              </button>
              <button class="btn btn-secondary" onclick="app.showScreen('reminders')">
                Recordatorios
              </button>
              <button class="btn btn-secondary" onclick="app.showScreen('consult')">
                Consultar
              </button>
            </div>
          `;
          medicationsContainer.appendChild(card);
        });
      }

      this.loadConsultations();

    } catch (error) {
      logger.error('Error cargando dashboard:', error);
      container.innerHTML = '<div class="error">Error cargando dashboard</div>';
    }
  }

  async showMedicationDetail(medicationId) {
    this.currentMedication = this.medications.find(m => m._id === medicationId);
    this.showScreen('medication');
  }

  renderMedicationDetail(container) {
    const med = this.currentMedication;
    if (!med) {
      this.showScreen('dashboard');
      return;
    }

    container.innerHTML = `
      <div class="medication-detail">
        <div class="detail-header">
          <button class="btn btn-secondary" onclick="app.showScreen('dashboard')">
            ← Volver
          </button>
          <h1>${med.name}</h1>
        </div>

        <div class="detail-content">
          <section class="detail-section">
            <h2>📝 Descripción</h2>
            <p>${med.description}</p>
          </section>

          ${med.videoUrl ? `
            <section class="detail-section">
              <h2>🎥 Video de Administración</h2>
              <div class="video-container">
                <iframe 
                  src="${med.videoUrl}" 
                  frameborder="0" 
                  allowfullscreen>
                </iframe>
              </div>
            </section>
          ` : ''}

          ${med.faqs && med.faqs.length > 0 ? `
            <section class="detail-section">
              <h2>❓ Preguntas Frecuentes</h2>
              <div class="faqs">
                ${med.faqs.map(faq => `
                  <div class="faq-item">
                    <h3>${faq.question}</h3>
                    <p>${faq.answer}</p>
                  </div>
                `).join('')}
              </div>
            </section>
          ` : ''}

          <section class="detail-section">
            <h2>💬 ¿Tienes dudas?</h2>
            <button class="btn btn-primary" onclick="app.showScreen('consult')">
              Consultar al Farmacéutico
            </button>
          </section>
        </div>
      </div>
    `;
  }

  renderReminders(container) {
    container.innerHTML = `
      <div class="reminders-screen">
        <div class="screen-header">
          <button class="btn btn-secondary" onclick="app.showScreen('dashboard')">
            ← Volver
          </button>
          <h1>🔔 Recordatorios</h1>
        </div>

        <div id="remindersList" class="reminders-list"></div>
      </div>
    `;

    this.renderRemindersList();
  }

  async renderRemindersList() {
    const container = document.getElementById('remindersList');
    if (!container) return;

    try {
      this.reminders = await api.getReminders();

      if (this.reminders.length === 0) {
        container.innerHTML = '<div class="empty-state">No tienes recordatorios configurados</div>';
        return;
      }

      container.innerHTML = this.reminders.map(reminder => `
        <div class="reminder-card ${reminder.isActive ? 'active' : 'inactive'}">
          <div class="reminder-info">
            <h3>${reminder.medication?.name || 'Medicamento'}</h3>
            <p>🕐 ${reminder.time}</p>
            <p>📅 ${this.getFrequencyText(reminder.frequency)}</p>
          </div>
          <div class="reminder-actions">
            <button 
              class="btn ${reminder.isActive ? 'btn-secondary' : 'btn-primary'}" 
              onclick="app.toggleReminder('${reminder._id}')">
              ${reminder.isActive ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        </div>
      `).join('');
    } catch (error) {
      container.innerHTML = '<div class="error">Error cargando recordatorios</div>';
    }
  }

  getFrequencyText(frequency) {
    const frequencies = {
      'daily': 'Todos los días',
      'weekly': 'Semanal',
      'custom': 'Personalizado'
    };
    return frequencies[frequency] || frequency;
  }

  async toggleReminder(reminderId) {
    try {
      const reminder = this.reminders.find(r => r._id === reminderId);
      await api.updateReminder(reminderId, { isActive: !reminder.isActive });
      await this.renderRemindersList();
      this.showMessage('Recordatorio actualizado', 'success');
    } catch (error) {
      this.showMessage('Error actualizando recordatorio', 'error');
    }
  }

  renderConsult(container) {
    container.innerHTML = `
      <div class="consult-screen">
        <div class="screen-header">
          <button class="btn btn-secondary" onclick="app.showScreen('dashboard')">
            ← Volver
          </button>
          <h1>💬 Consultar al Farmacéutico</h1>
        </div>

        <form id="consultForm" class="consult-form">
          <div class="form-group">
            <label for="consultSubject">Asunto</label>
            <select id="consultSubject" required>
              <option value="">Selecciona un asunto</option>
              <option value="dosificacion">Dosis y Administración</option>
              <option value="efectos-secundarios">Efectos Secundarios</option>
              <option value="interacciones">Interacciones</option>
              <option value="almacenamiento">Almacenamiento</option>
              <option value="otros">Otros</option>
            </select>
          </div>

          <div class="form-group">
            <label for="consultMessage">Mensaje *</label>
            <textarea id="consultMessage" rows="6" required 
              placeholder="Describe tu consulta..."></textarea>
          </div>

          <div class="form-group">
            <label for="consultContact">Teléfono de Contacto (opcional)</label>
            <input type="tel" id="consultContact" placeholder="123456789">
          </div>

          <button type="submit" class="btn btn-primary">
            Enviar Consulta
          </button>
        </form>
      </div>
    `;

    document.getElementById('consultForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.sendConsult();
    });
  }

  async sendConsult() {
    const subject = document.getElementById('consultSubject').value;
    const message = document.getElementById('consultMessage').value.trim();
    const contact = document.getElementById('consultContact').value.trim();
    
    if (!subject || !message) {
      this.showMessage('Por favor completa los campos obligatorios', 'error');
      return;
    }
    
    const submitBtn = document.querySelector('.btn-primary');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '⏳ Enviando...';
    submitBtn.disabled = true;
    
    try {
      await api.createConsultation({
        subject,
        message,
        contact,
        urgency: subject === 'efectos-secundarios' ? 'high' : 'medium'
      });
      
      this.showMessage('✅ ¡Consulta enviada correctamente! Puedes verla en "Mis Consultas". Te responderemos pronto.', 'success');
      
      setTimeout(() => {
        this.showScreen('dashboard');
        this.loadConsultations();
      }, 3000);
    } catch (error) {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
      this.showMessage('❌ Error al enviar consulta: ' + error.message, 'error');
    }
  }

  async loadConsultations() {
    const container = document.getElementById('patientConsultations');
    if (!container) return;
    
    try {
      const consultations = await api.getConsultations();
      
      if (consultations.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <p>📭 No tienes consultas todavía</p>
            <p style="color: var(--text-secondary); font-size: 0.9rem;">
              Haz una consulta al farmacéutico usando el botón de abajo
            </p>
          </div>
        `;
        return;
      }
      
      container.innerHTML = consultations.map(consult => `
        <div class="consultation-item ${consult.status === 'resolved' ? 'resolved' : 'pending'}">
          <div class="consultation-header">
            <div>
              <strong>${this.getSubjectText(consult.subject)}</strong>
              <span class="consultation-date">${new Date(consult.createdAt).toLocaleDateString('es-ES')}</span>
            </div>
            <span class="badge ${consult.status === 'resolved' ? 'badge-success' : 'badge-warning'}">
              ${consult.status === 'resolved' ? '✅ Respondida' : '⏳ Pendiente'}
            </span>
          </div>
          
          <div class="consultation-message">
            <p><strong>Tu consulta:</strong></p>
            <p>${consult.message}</p>
          </div>
          
          ${consult.response ? `
            <div class="consultation-response">
              <p><strong>💊 Respuesta del Farmacéutico:</strong></p>
              <p>${consult.response}</p>
              <small style="color: var(--text-secondary);">
                Respondido el ${new Date(consult.respondedAt).toLocaleDateString('es-ES')}
              </small>
            </div>
          ` : `
            <div class="consultation-pending">
              <p>⏳ Aún no hay respuesta. Te notificaremos cuando el farmacéutico responda.</p>
            </div>
          `}
        </div>
      `).join('');
      
    } catch (error) {
      container.innerHTML = `
        <div class="error-state">
          <p>❌ Error al cargar consultas</p>
          <button class="btn btn-secondary" onclick="app.loadConsultations()">
            Reintentar
          </button>
        </div>
      `;
    }
  }

  getSubjectText(subject) {
    const subjects = {
      'dosificacion': '💊 Dosis y Administración',
      'efectos-secundarios': '⚠️ Efectos Secundarios',
      'interacciones': '🔄 Interacciones',
      'almacenamiento': '📦 Almacenamiento',
      'otros': '❓ Otra Consulta'
    };
    return subjects[subject] || subject;
  }

  showReminderModal(reminder) {
    this.activeReminder = reminder;
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>🔔 Recordatorio de Medicación</h2>
        <div class="reminder-modal-body">
          <p class="medication-name">${reminder.medication?.name}</p>
          <p class="reminder-time">Es hora de tomar tu medicación</p>
          <p class="reminder-notes">${reminder.notes || ''}</p>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="app.confirmDose(true)">
            ✓ Tomado
          </button>
          <button class="btn btn-secondary" onclick="app.confirmDose(false)">
            ✗ Posponer
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  async confirmDose(taken) {
    const modal = document.querySelector('.modal');
    if (modal) modal.remove();

    if (this.activeReminder && taken) {
      try {
        await api.recordDose(this.activeReminder._id, taken);
        this.showMessage('Dosis registrada correctamente', 'success');
      } catch (error) {
        logger.error('Error registrando dosis:', error);
      }
    }

    this.activeReminder = null;
  }

  // ===== PANEL DE ADMINISTRADOR =====

  async renderAdminDashboard(container) {
    try {
      container.innerHTML = `
        <div class="admin-dashboard">
          <div class="admin-header">
            <h1>Panel de Administración 👨‍⚕️</h1>
            <button class="btn btn-secondary" onclick="app.logout()">
              Cerrar Sesión
            </button>
          </div>

          <div class="admin-nav">
            <button class="nav-btn active" data-section="analytics">
              📊 Analytics
            </button>
            <button class="nav-btn" data-section="patients">
              👥 Pacientes
            </button>
            <button class="nav-btn" data-section="medications">
              💊 Medicamentos
            </button>
            <button class="nav-btn" data-section="consultations">
              💬 Consultas
            </button>
          </div>

          <div id="adminContent" class="admin-content"></div>
        </div>
      `;

      // Setup nav buttons
      document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');
          this.showAdminSection(e.target.dataset.section);
        });
      });

      this.showAdminSection('analytics');
    } catch (error) {
      logger.error('Error cargando panel admin:', error);
      container.innerHTML = '<div class="error">Error cargando panel de administración</div>';
    }
  }

  async showAdminSection(section) {
    const container = document.getElementById('adminContent');
    if (!container) return;

    container.innerHTML = '<div class="loading">Cargando...</div>';

    switch (section) {
      case 'analytics':
        await this.renderAnalytics(container);
        break;
      case 'patients':
        await this.renderPatients(container);
        break;
      case 'medications':
        await this.renderMedications(container);
        break;
      case 'consultations':
        await this.renderConsultations(container);
        break;
    }
  }

  async renderAnalytics(container) {
    try {
      const analytics = await api.getAnalytics();

      const m = analytics.generalMetrics;

      container.innerHTML = `
        <div class="analytics-section">
          <h2>📊 Estadísticas Generales</h2>
          
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-icon">👥</div>
              <div class="stat-content">
                <h3>${m.totalPatients || 0}</h3>
                <p>Pacientes Totales</p>
              </div>
            </div>
            
            <div class="stat-card">
              <div class="stat-icon">💊</div>
              <div class="stat-content">
                <h3>${m.totalMedications || 0}</h3>
                <p>Medicamentos</p>
              </div>
            </div>
            
            <div class="stat-card">
              <div class="stat-icon">📊</div>
              <div class="stat-content">
                <h3>${m.averageAdherence || 0}%</h3>
                <p>Adherencia Promedio</p>
              </div>
            </div>
            
            <div class="stat-card">
              <div class="stat-icon">💬</div>
              <div class="stat-content">
                <h3>${m.pendingConsultations || 0}</h3>
                <p>Consultas Pendientes</p>
              </div>
            </div>

            <div class="stat-card">
              <div class="stat-icon">⚠️</div>
              <div class="stat-content">
                <h3>${m.unresolvedAdverseEvents || 0}</h3>
                <p>Eventos Adversos</p>
              </div>
            </div>
          </div>

          ${analytics.alerts && analytics.alerts.length > 0 ? `
            <div class="alerts-section" style="margin-top: 2rem;">
              <h3>⚠️ Alertas</h3>
              <div class="alerts-list">
                ${analytics.alerts.map(alert => `
                  <div class="alert alert-${alert.type}">
                    ${alert.message}
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;
    } catch (error) {
      container.innerHTML = '<div class="error">Error cargando analytics</div>';
    }
  }

  async renderPatients(container) {
    try {
      container.innerHTML = `
        <div class="patients-section">
          <h2>👥 Gestión de Pacientes</h2>
          
          <div class="filters-bar">
            <input type="text" id="searchPatients" placeholder="🔍 Buscar por nombre o email..." class="search-input">
            <select id="filterMedication" class="filter-select">
              <option value="">Todos los medicamentos</option>
            </select>
            <select id="filterDisease" class="filter-select">
              <option value="">Todas las enfermedades</option>
            </select>
            <select id="filterAdherence" class="filter-select">
              <option value="">Toda adherencia</option>
              <option value="70-100">Buena (70-100%)</option>
              <option value="0-70">Baja (<70%)</option>
            </select>
          </div>

          <div id="patientsTable"></div>
        </div>
      `;

      // Cargar datos
      const [users, medications] = await Promise.all([
        api.getUsers(),
        api.getMedications()
      ]);

      // Poblar filtros
      const medicationFilter = document.getElementById('filterMedication');
      medications.forEach(med => {
        const option = document.createElement('option');
        option.value = med._id;
        option.textContent = med.name;
        medicationFilter.appendChild(option);
      });

      const diseases = [...new Set(users.flatMap(u => u.diseases || []))];
      const diseaseFilter = document.getElementById('filterDisease');
      diseases.forEach(disease => {
        const option = document.createElement('option');
        option.value = disease;
        option.textContent = disease;
        diseaseFilter.appendChild(option);
      });

      // Event listeners para filtros
      document.getElementById('searchPatients').addEventListener('input', () => this.filterPatients(users, medications));
      document.getElementById('filterMedication').addEventListener('change', () => this.filterPatients(users, medications));
      document.getElementById('filterDisease').addEventListener('change', () => this.filterPatients(users, medications));
      document.getElementById('filterAdherence').addEventListener('change', () => this.filterPatients(users, medications));

      // Renderizar tabla inicial
      this.filterPatients(users, medications);

    } catch (error) {
      container.innerHTML = '<div class="error">Error cargando pacientes</div>';
    }
  }

  filterPatients(users, medications) {
    const search = document.getElementById('searchPatients')?.value.toLowerCase() || '';
    const medFilter = document.getElementById('filterMedication')?.value || '';
    const diseaseFilter = document.getElementById('filterDisease')?.value || '';
    const adherenceFilter = document.getElementById('filterAdherence')?.value || '';

    let filtered = users;

    // Filtro de búsqueda
    if (search) {
      filtered = filtered.filter(u => 
        u.name.toLowerCase().includes(search) || 
        u.email.toLowerCase().includes(search)
      );
    }

    // Filtro de medicamento
    if (medFilter) {
      const med = medications.find(m => m._id === medFilter);
      if (med && med.patients) {
        const patientIds = med.patients.map(p => p._id || p);
        filtered = filtered.filter(u => patientIds.includes(u._id));
      }
    }

    // Filtro de enfermedad
    if (diseaseFilter) {
      filtered = filtered.filter(u => u.diseases && u.diseases.includes(diseaseFilter));
    }

    // Filtro de adherencia
    if (adherenceFilter) {
      const [min, max] = adherenceFilter.split('-').map(Number);
      filtered = filtered.filter(u => {
        const adh = u.adherenceRate || 100;
        return adh >= min && adh <= max;
      });
    }

    // Renderizar tabla
    this.renderPatientsTable(filtered, medications);
  }

  renderPatientsTable(users, medications) {
    const container = document.getElementById('patientsTable');
    if (!container) return;

    if (users.length === 0) {
      container.innerHTML = '<div class="empty-state">No se encontraron pacientes</div>';
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Email</th>
            <th>Medicamento</th>
            <th>Enfermedad</th>
            <th>Adherencia</th>
            <th>Última Dosis</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(user => {
            const userMeds = medications.filter(m => m.patients && m.patients.some(p => (p._id || p) === user._id));
            const adherence = user.adherenceRate || 100;
            const adherenceClass = adherence >= 70 ? 'success' : 'danger';
            
            return `
              <tr>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${userMeds.map(m => m.name).join(', ') || '-'}</td>
                <td>${user.diseases?.join(', ') || '-'}</td>
                <td><span class="badge badge-${adherenceClass}">${adherence}%</span></td>
                <td>${user.lastDose ? new Date(user.lastDose.takenAt).toLocaleDateString('es-ES') : '-'}</td>
                <td>
                  <button class="btn btn-sm btn-secondary" onclick="app.showPatientProfile('${user._id}')">
                    Ver Perfil
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  async showPatientProfile(patientId) {
    this.showMessage('Funcionalidad de perfil completo disponible en Fase 4', 'info');
  }

  async renderMedications(container) {
    try {
      const medications = await api.getMedications();

      container.innerHTML = `
        <div class="medications-section">
          <div class="section-header">
            <h2>💊 Gestión de Medicamentos</h2>
            <button class="btn btn-primary" onclick="app.showAddMedicationModal()">
              + Nuevo Medicamento
            </button>
          </div>
          
          <table class="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Principio Activo</th>
                <th>Indicaciones</th>
                <th>Pacientes</th>
                <th>Adherencia</th>
                <th>Eventos Adversos</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${medications.map(med => `
                <tr>
                  <td><strong>${med.name}</strong></td>
                  <td>${med.activeIngredient || '-'}</td>
                  <td>${med.indications?.slice(0, 2).join(', ') || '-'}</td>
                  <td>${med.patientCount || 0}</td>
                  <td>${med.averageAdherence || 100}%</td>
                  <td>${med.adverseEventsCount?.total || 0}</td>
                  <td>
                    <button class="btn btn-sm btn-secondary" onclick="app.editMedication('${med._id}')">
                      Editar
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="app.deleteMedication('${med._id}')">
                      Eliminar
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (error) {
      container.innerHTML = '<div class="error">Error cargando medicamentos</div>';
    }
  }

  showAddMedicationModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Nuevo Medicamento</h2>
          <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
        </div>
        
        <form id="addMedicationForm">
          <div class="form-group">
            <label>Nombre del Medicamento *</label>
            <input type="text" id="medName" required>
          </div>
          
          <div class="form-group">
            <label>Descripción *</label>
            <textarea id="medDescription" rows="3" required></textarea>
          </div>
          
          <div class="form-group">
            <label>Principio Activo</label>
            <input type="text" id="medActiveIngredient">
          </div>
          
          <div class="form-group">
            <label>URL del Video (YouTube)</label>
            <input type="url" id="medVideoUrl" placeholder="https://youtube.com/...">
          </div>
          
          <div class="modal-actions">
            <button type="submit" class="btn btn-primary">Crear</button>
            <button type="button" class="btn btn-secondary" 
              onclick="this.closest('.modal').remove()">Cancelar</button>
          </div>
        </form>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('addMedicationForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.createMedication();
    });
  }

  async createMedication() {
    const name = document.getElementById('medName').value;
    const description = document.getElementById('medDescription').value;
    const activeIngredient = document.getElementById('medActiveIngredient').value;
    const videoUrl = document.getElementById('medVideoUrl').value;

    try {
      await api.createMedication({ 
        name, 
        description, 
        activeIngredient,
        videoUrl 
      });
      this.showMessage('Medicamento creado correctamente', 'success');
      document.querySelector('.modal').remove();
      this.showAdminSection('medications');
    } catch (error) {
      this.showMessage('Error creando medicamento: ' + error.message, 'error');
    }
  }

  async editMedication(medicationId) {
    this.showMessage('Funcionalidad de edición disponible próximamente', 'info');
  }

  async deleteMedication(medicationId) {
    if (!confirm('¿Estás seguro de eliminar este medicamento?')) return;

    try {
      await api.deleteMedication(medicationId);
      this.showMessage('Medicamento eliminado', 'success');
      this.showAdminSection('medications');
    } catch (error) {
      this.showMessage('Error eliminando medicamento: ' + error.message, 'error');
    }
  }

  async renderConsultations(container) {
    try {
      const consultations = await api.getAllConsultations();

      container.innerHTML = `
        <div class="consultations-section">
          <div class="section-header">
            <h2>💬 Gestión de Consultas</h2>
            <button id="toggleResolvedBtn" class="btn btn-secondary" onclick="app.toggleResolvedConsultations()">
              Ver Resueltas
            </button>
          </div>
          
          <div id="consultationsContainer"></div>
        </div>
      `;

      this.showPendingConsultations = true;
      this.renderConsultationsList(consultations);

    } catch (error) {
      container.innerHTML = '<div class="error">Error cargando consultas</div>';
    }
  }

  toggleResolvedConsultations() {
    this.showPendingConsultations = !this.showPendingConsultations;
    const btn = document.getElementById('toggleResolvedBtn');
    btn.textContent = this.showPendingConsultations ? 'Ver Resueltas' : 'Ver Pendientes';
    
    api.getAllConsultations().then(consultations => {
      this.renderConsultationsList(consultations);
    });
  }

  renderConsultationsList(allConsultations) {
    const container = document.getElementById('consultationsContainer');
    if (!container) return;

    const consultations = this.showPendingConsultations
      ? allConsultations.filter(c => c.status === 'pending')
      : allConsultations.filter(c => c.status === 'resolved');

    if (consultations.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          No hay consultas ${this.showPendingConsultations ? 'pendientes' : 'resueltas'}
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="consultations-admin-list">
        ${consultations.map(consult => `
          <div class="consultation-admin-card ${consult.status}">
            <div class="consultation-admin-header">
              <div>
                <h3>${consult.patient?.name || 'Paciente'}</h3>
                <p>${consult.patient?.email || ''}</p>
              </div>
              <div>
                <span class="badge badge-${consult.status === 'resolved' ? 'success' : 'warning'}">
                  ${consult.status === 'resolved' ? 'Resuelta' : 'Pendiente'}
                </span>
                ${consult.urgency === 'high' ? '<span class="badge badge-danger">Urgente</span>' : ''}
              </div>
            </div>
            
            <div class="consultation-admin-body">
              <p><strong>Asunto:</strong> ${this.getSubjectText(consult.subject)}</p>
              <p><strong>Mensaje:</strong> ${consult.message}</p>
              ${consult.contact ? `<p><strong>Contacto:</strong> ${consult.contact}</p>` : ''}
              <p><strong>Fecha:</strong> ${new Date(consult.createdAt).toLocaleDateString('es-ES')}</p>
            </div>
            
            ${consult.status === 'pending' ? `
              <div class="consultation-admin-actions">
                <button class="btn btn-primary" 
                  onclick="app.showRespondModal('${consult._id}')">
                  Responder
                </button>
              </div>
            ` : `
              <div class="consultation-response-view">
                <strong>Tu respuesta:</strong>
                <p>${consult.response}</p>
                <small>Respondido el ${new Date(consult.respondedAt).toLocaleDateString('es-ES')}</small>
              </div>
            `}
          </div>
        `).join('')}
      </div>
    `;
  }

  showRespondModal(consultationId) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Responder Consulta</h2>
          <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
        </div>
        
        <form id="respondForm">
          <div class="form-group">
            <label>Tu Respuesta</label>
            <textarea id="responseText" rows="6" required 
              placeholder="Escribe tu respuesta al paciente..."></textarea>
          </div>
          
          <div class="modal-actions">
            <button type="submit" class="btn btn-primary">Enviar Respuesta</button>
            <button type="button" class="btn btn-secondary" 
              onclick="this.closest('.modal').remove()">Cancelar</button>
          </div>
        </form>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('respondForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.respondConsultation(consultationId);
    });
  }

  async respondConsultation(consultationId) {
    const response = document.getElementById('responseText').value;

    try {
      await api.respondConsultation(consultationId, response);
      this.showMessage('Respuesta enviada correctamente', 'success');
      document.querySelector('.modal').remove();
      this.showAdminSection('consultations');
    } catch (error) {
      this.showMessage('Error enviando respuesta: ' + error.message, 'error');
    }
  }

  showMessage(message, type = 'info') {
    const messageEl = document.createElement('div');
    messageEl.className = `message message-${type}`;
    messageEl.textContent = message;
    
    document.body.appendChild(messageEl);
    
    setTimeout(() => {
      messageEl.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      messageEl.classList.remove('show');
      setTimeout(() => messageEl.remove(), 300);
    }, 5000);
  }

  logout() {
    localStorage.removeItem('token');
    this.user = null;
    this.showScreen('login');
  }
}

const app = new FarmaFollowApp();
document.addEventListener('DOMContentLoaded', () => app.init());