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
    this.reminderCheckInterval = null;
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
          // Verificar cuestionarios pendientes ANTES de mostrar dashboard
          const hasPending = await this.checkPendingQuestionnaires();
          if (!hasPending) {
            this.showScreen('dashboard');
            this.startReminderChecker();
          }
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

  // ===== SISTEMA DE RECORDATORIOS =====
  
  startReminderChecker() {
    this.reminderCheckInterval = setInterval(() => {
      this.checkReminders();
    }, 30000);
    this.checkReminders();
  }

  stopReminderChecker() {
    if (this.reminderCheckInterval) {
      clearInterval(this.reminderCheckInterval);
      this.reminderCheckInterval = null;
    }
  }

  async checkReminders() {
    try {
      const reminders = await api.getReminders();
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const currentDay = now.getDay();

      reminders.forEach(reminder => {
        if (!reminder.isActive) return;
        if (reminder.time !== currentTime) return;

        let shouldNotify = false;
        
        if (reminder.frequency === 'daily') {
          shouldNotify = true;
        } else if (reminder.frequency === 'weekly' && reminder.daysOfWeek) {
          shouldNotify = reminder.daysOfWeek.includes(currentDay);
        }

        if (shouldNotify) {
          const lastNotified = localStorage.getItem(`reminder_${reminder._id}_last`);
          if (lastNotified) {
            const lastTime = new Date(lastNotified);
            const diffMinutes = (now - lastTime) / 1000 / 60;
            if (diffMinutes < 60) return;
          }

          localStorage.setItem(`reminder_${reminder._id}_last`, now.toISOString());
          this.showReminderNotification(reminder);
        }
      });
    } catch (error) {
      logger.error('Error verificando recordatorios:', error);
    }
  }

  async showReminderNotification(reminder) {
    const title = '💊 Hora de tomar tu medicación';
    const body = `${reminder.medication?.name || 'Medicamento'} - ${reminder.time}`;

    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body: body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: reminder._id,
        requireInteraction: true
      });

      notification.onclick = () => {
        window.focus();
        this.showReminderModal(reminder);
        notification.close();
      };
    }

    this.showReminderModal(reminder);
  }

  showReminderModal(reminder) {
    this.activeReminder = reminder;
    
    const existingModal = document.querySelector('.reminder-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'modal reminder-modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>💊 Hora de tu Medicación</h2>
        <div class="reminder-modal-body">
          <p class="medication-name">${reminder.medication?.name || 'Medicamento'}</p>
          <p class="reminder-time">⏰ ${reminder.time}</p>
          ${reminder.notes ? `<p class="reminder-notes">${reminder.notes}</p>` : ''}
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary btn-lg" onclick="app.confirmDose(true)">
            ✓ Tomado
          </button>
          <button class="btn btn-secondary" onclick="app.postponeDose()">
            ⏰ Posponer 15 min
          </button>
          <button class="btn btn-outline" onclick="app.dismissReminder()">
            ✗ Omitir
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  async confirmDose(taken) {
    if (!this.activeReminder) return;

    const modal = document.querySelector('.reminder-modal');
    if (modal) modal.remove();

    try {
      await api.recordDose(this.activeReminder._id, taken);
      this.showMessage('✅ Dosis registrada correctamente', 'success');
      
      if (this.currentScreen === 'reminders') {
        this.renderReminderCalendar();
      }
    } catch (error) {
      logger.error('Error registrando dosis:', error);
      this.showMessage('Error registrando dosis', 'error');
    }

    this.activeReminder = null;
  }

  postponeDose() {
    if (!this.activeReminder) return;

    const modal = document.querySelector('.reminder-modal');
    if (modal) modal.remove();

    setTimeout(() => {
      this.showReminderModal(this.activeReminder);
    }, 15 * 60 * 1000);

    this.showMessage('⏰ Recordatorio pospuesto 15 minutos', 'info');
    this.activeReminder = null;
  }

  dismissReminder() {
    const modal = document.querySelector('.reminder-modal');
    if (modal) modal.remove();
    this.activeReminder = null;
  }

  showScreen(screenName) {
    logger.log('Mostrando pantalla:', screenName);
    this.currentScreen = screenName;
    
    const app = document.getElementById('app');
    if (!app) {
      logger.error('Elemento #app no encontrado');
      return;
    }
    
    app.innerHTML = '';

    // Update header
    const header = document.querySelector('.header');
    const backBtn = document.querySelector('.back-btn');
    const logoutBtn = document.querySelector('.logout-btn');
    const headerTitle = document.getElementById('headerTitle');

    if (screenName === 'login' || screenName === 'register') {
      if (header) header.style.display = 'none';
    } else {
      if (header) header.style.display = 'flex';
      if (backBtn) {
        if (screenName === 'dashboard' || screenName === 'admin-dashboard') {
          backBtn.classList.add('hidden');
        } else {
          backBtn.classList.remove('hidden');
        }
      }
      // Show logout button for authenticated screens
      if (logoutBtn) {
        logoutBtn.classList.remove('hidden');
      }
    }

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
      case 'faq':
        this.renderFAQ(app);
        break;
      case 'reminders':
        this.renderReminders(app);
        break;
      case 'my-consultations':
        this.renderMyConsultations(app);
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

  goBack() {
    if (this.currentScreen === 'medication' ||
        this.currentScreen === 'reminders' ||
        this.currentScreen === 'consult' ||
        this.currentScreen === 'faq' ||
        this.currentScreen === 'my-consultations') {
      this.showScreen('dashboard');
    } else {
      this.showScreen('dashboard');
    }
  }

  logout() {
    // Clear user data and token
    this.user = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    // Redirect to login
    this.showScreen('login');
    this.showMessage('Sesión cerrada correctamente', 'success');
  }

  renderLogin(container) {
    container.innerHTML = `
      <div class="auth-container">
        <div class="auth-card">
          <div class="auth-header">
            <h1>💊 FarmaFollow</h1>
            <p>Seguimiento Farmacoterapéutico</p>
          </div>
          
          <form id="loginForm">
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" id="email" class="form-input" required>
            </div>
            
            <div class="form-group">
              <label class="form-label">Contraseña</label>
              <input type="password" id="password" class="form-input" required>
            </div>
            
            <button type="submit" class="btn btn-primary btn-block btn-lg">
              Iniciar Sesión
            </button>
          </form>
          
          <div class="auth-toggle">
            ¿Primera vez? <a class="auth-toggle-link" onclick="app.showScreen('register')">Regístrate aquí</a>
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
            <p>Crear Cuenta Nueva</p>
          </div>
          
          <form id="registerForm">
            <div class="form-group">
              <label class="form-label">Nombre Completo</label>
              <input type="text" id="name" class="form-input" required>
            </div>
            
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" id="email" class="form-input" required>
            </div>
            
            <div class="form-group">
              <label class="form-label">Contraseña (mínimo 6 caracteres)</label>
              <input type="password" id="password" class="form-input" required minlength="6">
            </div>
            
            <button type="submit" class="btn btn-primary btn-block btn-lg">
              Crear Cuenta
            </button>
          </form>
          
          <div class="auth-toggle">
            ¿Ya tienes cuenta? <a class="auth-toggle-link" onclick="app.showScreen('login')">Inicia sesión</a>
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
        // Verificar cuestionarios pendientes ANTES de mostrar dashboard
        const hasPending = await this.checkPendingQuestionnaires();
        if (!hasPending) {
          this.showScreen('dashboard');
          this.startReminderChecker();
        }
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

  async renderPatientDashboard(container) {
    try {
      const [medications, reminders] = await Promise.all([
        api.getMedications(),
        api.getReminders()
      ]);

      this.medications = medications;
      this.reminders = reminders;

      const adherence = this.user.adherenceRate || 87;
      const today = new Date();
      const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const dateStr = `${dayNames[today.getDay()]}, ${today.getDate()} de ${monthNames[today.getMonth()]} de ${today.getFullYear()}`;

      const activeReminders = reminders.filter(r => r.isActive);
      const nextReminder = activeReminders.length > 0 ? activeReminders[0] : null;

      container.innerHTML = `
        <div class="dashboard-header">
          <div class="greeting">¡Hola, ${this.user.name}! 👋</div>
          <div class="date-text">${dateStr}</div>
        </div>

        <div class="stats-card">
          <div class="adherence-circle">
            <div class="percentage">${adherence}%</div>
            <div class="label">Adherencia</div>
          </div>
          <div class="stat-row">
            <span class="stat-label">📅 Próxima dosis</span>
            <span class="stat-value">${nextReminder ? nextReminder.time : '--:--'}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">💊 Dosis hoy</span>
            <span class="stat-value">2 de 3</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">🔥 Racha actual</span>
            <span class="stat-value">12 días</span>
          </div>
        </div>

        <div class="section-title">💊 Tu Medicamento</div>
        <div class="medications-list" id="medicationsContainer"></div>
      `;

      const medicationsContainer = document.getElementById('medicationsContainer');

      if (medications.length === 0) {
        medicationsContainer.innerHTML = `
          <div class="empty-state">
            <p>No tienes medicamentos asignados</p>
            <p style="font-size: 0.9rem; color: var(--gray-600);">Tu farmacéutico te asignará un medicamento pronto</p>
          </div>
        `;
      } else {
        medications.forEach(med => {
          const card = document.createElement('div');
          card.className = 'medication-card';
          card.onclick = () => this.showMedicationDetail(med._id);
          card.innerHTML = `
            <div class="medication-icon">💊</div>
            <div class="medication-info">
              <div class="medication-name">${med.name}</div>
              <div class="medication-description">${med.description}</div>
            </div>
            <div class="medication-arrow">→</div>
          `;
          medicationsContainer.appendChild(card);
        });
      }

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
      <div class="medication-detail-header">
        <div class="medication-detail-icon">💊</div>
        <div class="medication-detail-name">${med.name}</div>
        <div class="medication-detail-desc">${med.description}</div>
      </div>

      <div class="options-grid">
        <div class="option-card" onclick="app.showMedicationVideo()">
          <div class="option-icon video">🎥</div>
          <div class="option-title">Video</div>
          <div class="option-description">Cómo administrar</div>
        </div>

        <div class="option-card" onclick="app.showScreen('faq')">
          <div class="option-icon faq">❓</div>
          <div class="option-title">FAQ</div>
          <div class="option-description">Preguntas comunes</div>
        </div>

        <div class="option-card" onclick="app.showScreen('reminders')">
          <div class="option-icon reminder">⏰</div>
          <div class="option-title">Recordatorios</div>
          <div class="option-description">Configura alertas</div>
        </div>

        <div class="option-card" onclick="app.showScreen('consult')">
          <div class="option-icon consult">💬</div>
          <div class="option-title">Consulta</div>
          <div class="option-description">Habla con farmacia</div>
        </div>
      </div>
    `;
  }

  showMedicationVideo() {
    const med = this.currentMedication;
    if (!med || !med.videoUrl) {
      this.showMessage('No hay video disponible para este medicamento', 'info');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 800px;">
        <div class="modal-header">
          <h2>Video de Administración</h2>
          <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
        </div>
        <div style="position: relative; padding-bottom: 56.25%; height: 0;">
          <iframe 
            src="${med.videoUrl}" 
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; border-radius: 0.5rem;"
            allowfullscreen>
          </iframe>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  renderFAQ(container) {
    const med = this.currentMedication;
    if (!med) {
      this.showScreen('dashboard');
      return;
    }

    const faqs = med.faqs || [
      { question: "¿Puedo tomar este medicamento con comida?", answer: "Sí, se recomienda tomar con alimentos para reducir efectos secundarios gastrointestinales.", tag: "💊 Administración" },
      { question: "¿Qué hago si olvido una dosis?", answer: "Si olvidas una dosis, tómala tan pronto como lo recuerdes. Si ya es casi la hora de la siguiente dosis, sáltala y continúa con tu horario regular.", tag: "⏰ Dosis olvidada" },
      { question: "¿Cuáles son los efectos secundarios más comunes?", answer: "Los efectos secundarios más comunes incluyen enrojecimiento facial, malestar estomacal y diarrea. Estos síntomas suelen mejorar con el tiempo.", tag: "⚕️ Efectos secundarios" },
      { question: "¿Puedo beber alcohol mientras tomo este medicamento?", answer: "El consumo moderado de alcohol generalmente es seguro, pero puede aumentar algunos efectos secundarios. Consulta con tu médico.", tag: "🍷 Interacciones" },
      { question: "¿Cuándo debo contactar al farmacéutico?", answer: "Contacta inmediatamente si experimentas: reacciones alérgicas graves, infecciones recurrentes, problemas hepáticos o cualquier síntoma que te preocupe.", tag: "🚨 Urgente" }
    ];

    container.innerHTML = `
      <div class="content">
        <div class="faq-container">
          <div style="background: linear-gradient(135deg, var(--warning) 0%, #d97706 100%); padding: 2rem; border-radius: 1rem; margin-bottom: 1.5rem; color: white; text-align: center;">
            <div style="font-size: 3rem; margin-bottom: 0.5rem;">❓</div>
            <h2 style="font-size: 1.8rem; font-weight: 700; margin: 0;">Preguntas Frecuentes</h2>
            <p style="font-size: 0.95rem; opacity: 0.9; margin-top: 0.5rem;">Encuentra respuestas a tus dudas sobre ${med.name}</p>
          </div>

          <div class="faq-list">
            ${faqs.map((faq, index) => `
              <div class="faq-item" data-index="${index}">
                <div class="faq-question" onclick="app.toggleFAQ(this)">
                  <div class="faq-q-content">
                    <div class="faq-icon">❓</div>
                    <div class="faq-q-text">${faq.question}</div>
                  </div>
                  <div class="faq-toggle">+</div>
                </div>
                <div class="faq-answer">
                  ${faq.answer}
                  ${faq.tag ? `<div class="faq-tag">${faq.tag}</div>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  toggleFAQ(element) {
    const faqItem = element.closest('.faq-item');
    const wasExpanded = faqItem.classList.contains('expanded');
    
    // Cerrar todas las FAQ
    document.querySelectorAll('.faq-item').forEach(item => {
      item.classList.remove('expanded');
    });
    
    // Si no estaba expandida, expandirla
    if (!wasExpanded) {
      faqItem.classList.add('expanded');
    }
  }

  renderReminders(container) {
    const med = this.currentMedication;
    
    container.innerHTML = `
      <div class="calendar-container">
        <div class="calendar-header">
          <div class="calendar-title">Configura tus horarios</div>
          <div class="calendar-subtitle">Selecciona los días y horas para tus recordatorios</div>
        </div>

        <div class="calendar-month">
          <div class="month-header">
            <div class="month-name">${this.getCurrentMonthName()}</div>
            <div class="month-nav">
              <button class="nav-btn">←</button>
              <button class="nav-btn">→</button>
            </div>
          </div>
          <div class="calendar-grid">
            <div class="day-header">LUN</div>
            <div class="day-header">MAR</div>
            <div class="day-header">MIÉ</div>
            <div class="day-header">JUE</div>
            <div class="day-header">VIE</div>
            <div class="day-header">SÁB</div>
            <div class="day-header">DOM</div>
            
            ${this.generateCalendarDays()}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 1.5rem;">
          <div>
            <div class="section-title" style="font-size: 1.1rem; margin-bottom: 1rem;">⏰ Horarios del día</div>
            <div class="time-grid">
              <div class="time-slot active" data-time="08:00">
                <div class="time-emoji">🌅</div>
                <div class="time-label">Mañana</div>
                <div class="time-value">08:00</div>
              </div>

              <div class="time-slot" data-time="14:00">
                <div class="time-emoji">☀️</div>
                <div class="time-label">Mediodía</div>
                <div class="time-value">14:00</div>
              </div>

              <div class="time-slot active" data-time="21:00">
                <div class="time-emoji">🌙</div>
                <div class="time-label">Noche</div>
                <div class="time-value">21:00</div>
              </div>
            </div>
          </div>

          <div>
            <div class="frequency-section">
              <div class="frequency-title">📅 Frecuencia de administración</div>
              <div class="frequency-options">
                <div class="frequency-btn" data-freq="daily">📆 Diaria</div>
                <div class="frequency-btn active" data-freq="weekly">📅 Semanal</div>
                <div class="frequency-btn" data-freq="biweekly">🗓️ Cada 2 semanas</div>
                <div class="frequency-btn" data-freq="monthly">📋 Cada 28 días</div>
              </div>
            </div>

            <button class="btn btn-success btn-block btn-lg" onclick="app.saveReminders()">
              💾 Guardar Recordatorios
            </button>
          </div>
        </div>
      </div>
    `;

    // Add event listeners for time slots
    document.querySelectorAll('.time-slot').forEach(slot => {
      slot.addEventListener('click', function() {
        this.classList.toggle('active');
      });
    });

    // Add event listeners for frequency buttons
    document.querySelectorAll('.frequency-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.frequency-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
      });
    });
  }

  getCurrentMonthName() {
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const now = new Date();
    return `${months[now.getMonth()]} ${now.getFullYear()}`;
  }

  generateCalendarDays() {
    const today = new Date().getDate();
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    let html = '';

    // Adjust to start from Monday (0 = Sunday, 1 = Monday, etc.)
    const startDay = firstDay === 0 ? 6 : firstDay - 1;

    // Previous month days
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      html += `<div class="day-cell other-month"><div class="day-number">${prevMonthDays - i}</div></div>`;
    }

    // Current month days - solo marcar el día actual con recordatorio
    for (let i = 1; i <= daysInMonth; i++) {
      let classes = 'day-cell';
      if (i === today) {
        classes += ' today has-reminder';
      }
      html += `<div class="${classes}"><div class="day-number">${i}</div></div>`;
    }

    // Next month days to complete the grid
    const totalCells = startDay + daysInMonth;
    const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remainingCells; i++) {
      html += `<div class="day-cell other-month"><div class="day-number">${i}</div></div>`;
    }

    return html;
  }

  async saveReminders() {
    const activeTimeSlots = Array.from(document.querySelectorAll('.time-slot.active'))
      .map(slot => slot.dataset.time);
    
    const activeFrequency = document.querySelector('.frequency-btn.active')?.dataset.freq || 'daily';

    if (activeTimeSlots.length === 0) {
      this.showMessage('Por favor selecciona al menos un horario', 'warning');
      return;
    }

    try {
      // Aquí iría la llamada a la API
      this.showMessage('✅ Recordatorios guardados correctamente', 'success');
      setTimeout(() => this.showScreen('dashboard'), 1500);
    } catch (error) {
      this.showMessage('Error guardando recordatorios: ' + error.message, 'error');
    }
  }

  renderConsult(container) {
    container.innerHTML = `
      <div class="consult-container">
        <div class="consult-header">
          <div class="consult-title">Envía tu Consulta</div>
          <div class="consult-subtitle">Te responderemos a la mayor brevedad</div>
        </div>

        <div class="response-time-badge">
          ⏱️ Tiempo de respuesta: 24 horas
        </div>

        <div class="chat-container" id="chatContainer">
          <div class="empty-state">
            <div style="font-size: 3rem; margin-bottom: 1rem;">💬</div>
            <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">No hay mensajes aún</div>
            <div>Escribe tu primera consulta para comenzar</div>
          </div>
        </div>

        <div class="chat-input-container">
          <input type="text" class="chat-input" id="chatInput" placeholder="Escribe tu consulta aquí...">
          <button class="chat-send-btn" onclick="app.sendConsultation()">📤</button>
        </div>
      </div>
    `;

    // Add enter key listener
    document.getElementById('chatInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendConsultation();
      }
    });
  }

  async sendConsultation() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();

    if (!message) return;

    // Add message to chat
    const chatContainer = document.getElementById('chatContainer');

    // Remove empty state if it exists
    const emptyState = chatContainer.querySelector('.empty-state');
    if (emptyState) {
      emptyState.remove();
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message user';
    messageDiv.innerHTML = `
      <div class="chat-avatar">👤</div>
      <div>
        <div class="chat-bubble">${message}</div>
        <div class="chat-time">Hoy, ${timeStr}</div>
      </div>
    `;
    chatContainer.appendChild(messageDiv);

    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Clear input
    input.value = '';

    try {
      // Aquí iría la llamada a la API
      this.showMessage('✅ Consulta enviada correctamente', 'success');
    } catch (error) {
      this.showMessage('Error enviando consulta: ' + error.message, 'error');
    }
  }

  renderMyConsultations(container) {
    container.innerHTML = `
      <div class="consult-container">
        <h2>Mis Consultas</h2>
        <div class="empty-state">
          No tienes consultas previas
        </div>
      </div>
    `;
  }

  // ===== ADMIN DASHBOARD =====
  
  async renderAdminDashboard(container) {
    try {
      const [users, medications, consultations, questionnaires] = await Promise.all([
        api.getUsers(),
        api.getMedications(),
        api.getAllConsultations(),
        api.getAllQuestionnaires().catch(() => [])
      ]);

      this.users = users;
      this.medications = medications;
      this.consultations = consultations;
      this.questionnaires = questionnaires;

      const pendingConsultations = consultations.filter(c => c.status === 'pending').length;
      const resolvedConsultations = consultations.filter(c => c.status === 'resolved').length;
      const activeMedications = medications.filter(m => m.isActive).length;
      const activeQuestionnaires = questionnaires.filter(q => q.status === 'active').length;

      const avgAdherence = users.length > 0
        ? Math.round(users.reduce((sum, u) => sum + (u.adherenceRate || 0), 0) / users.length)
        : 0;

      // Calculate low adherence count
      const lowAdherenceCount = users.filter(u => (u.adherenceRate || 0) < 60).length;
      const assignedQuestionnaires = questionnaires.filter(q => q.status === 'assigned').length;

      container.innerHTML = `
        <div class="admin-header">
          <h1 class="admin-title">📊 Panel de Administración</h1>
        </div>

        <div class="admin-stats">
          <!-- Total Pacientes Card -->
          <div class="stat-card-enhanced">
            <div class="stat-card-content">
              <div class="stat-icon-enhanced">👥</div>
              <div class="stat-details">
                <div class="stat-value">${users.length}</div>
                <div class="stat-label">Total Pacientes</div>
                <div class="stat-mini">
                  <span style="color: var(--success);">↑ ${users.filter(u => u.createdAt && new Date(u.createdAt) > new Date(Date.now() - 30*24*60*60*1000)).length}</span>
                  <span style="color: var(--gray-600); font-size: 0.75rem;">últimos 30 días</span>
                </div>
              </div>
            </div>
            <div class="stat-actions">
              <button class="stat-action-btn" onclick="app.showAdminSection('patients')">
                Ver todos
              </button>
              <button class="stat-action-btn" onclick="app.quickActionExportPatients()">
                Exportar
              </button>
            </div>
          </div>

          <!-- Medicamentos Activos Card -->
          <div class="stat-card-enhanced" style="border-left: 4px solid var(--success);">
            <div class="stat-card-content">
              <div class="stat-icon-enhanced" style="background: var(--success-light);">💊</div>
              <div class="stat-details">
                <div class="stat-value">${activeMedications}</div>
                <div class="stat-label">Medicamentos Activos</div>
                <div class="stat-mini">
                  <span style="color: var(--gray-600); font-size: 0.75rem;">${medications.length} en total</span>
                </div>
              </div>
            </div>
            <div class="stat-actions">
              <button class="stat-action-btn" onclick="app.showAdminSection('medications')">
                Gestionar
              </button>
              <button class="stat-action-btn" onclick="app.createMedication()">
                + Nuevo
              </button>
            </div>
          </div>

          <!-- Consultas Pendientes Card -->
          <div class="stat-card-enhanced" style="border-left: 4px solid var(--warning);">
            <div class="stat-card-content">
              <div class="stat-icon-enhanced" style="background: var(--warning-light);">💬</div>
              <div class="stat-details">
                <div class="stat-value">${pendingConsultations}</div>
                <div class="stat-label">Consultas Pendientes</div>
                <div class="stat-mini">
                  <span style="color: var(--success);">${resolvedConsultations} resueltas</span>
                  <span style="color: var(--gray-600); font-size: 0.75rem;">·</span>
                  <span style="color: var(--gray-600); font-size: 0.75rem;">${consultations.length} total</span>
                </div>
              </div>
            </div>
            <div class="stat-actions">
              <button class="stat-action-btn" onclick="app.quickActionPendingConsultations()">
                Responder
              </button>
              <button class="stat-action-btn" onclick="app.showAdminSection('consultations')">
                Ver todas
              </button>
            </div>
          </div>

          <!-- Adherencia Media Card -->
          <div class="stat-card-enhanced" style="border-left: 4px solid var(--cyan);">
            <div class="stat-card-content">
              <div class="stat-icon-enhanced" style="background: var(--cyan-light);">📈</div>
              <div class="stat-details">
                <div class="stat-value">${avgAdherence}%</div>
                <div class="stat-label">Adherencia Media</div>
                <div class="stat-mini">
                  ${lowAdherenceCount > 0 ? `<span style="color: var(--danger);">⚠️ ${lowAdherenceCount} pacientes < 60%</span>` : '<span style="color: var(--success);">✓ Todos adherentes</span>'}
                </div>
              </div>
            </div>
            <div class="stat-actions">
              <button class="stat-action-btn" onclick="app.quickActionLowAdherence()">
                Ver baja adherencia
              </button>
              <button class="stat-action-btn" onclick="app.exportToCSV('patients')">
                Exportar
              </button>
            </div>
          </div>

          <!-- Cuestionarios Card -->
          <div class="stat-card-enhanced" style="border-left: 4px solid #8b5cf6;">
            <div class="stat-card-content">
              <div class="stat-icon-enhanced" style="background: rgba(139, 92, 246, 0.1);">📋</div>
              <div class="stat-details">
                <div class="stat-value">${activeQuestionnaires}</div>
                <div class="stat-label">Cuestionarios Activos</div>
                <div class="stat-mini">
                  <span style="color: var(--warning);">${assignedQuestionnaires} asignados</span>
                  <span style="color: var(--gray-600); font-size: 0.75rem;">·</span>
                  <span style="color: var(--gray-600); font-size: 0.75rem;">${questionnaires.length} total</span>
                </div>
              </div>
            </div>
            <div class="stat-actions">
              <button class="stat-action-btn" onclick="app.showAdminSection('questionnaires')">
                Gestionar
              </button>
              <button class="stat-action-btn" onclick="app.createQuestionnaire()">
                + Nuevo
              </button>
            </div>
          </div>
        </div>

        <!-- Charts Section -->
        <div class="charts-grid" style="margin-top: 2rem;">
          <div class="chart-container">
            <h3 class="chart-title">📊 Adherencia en el Tiempo</h3>
            <canvas id="adherenceChart"></canvas>
          </div>
          <div class="chart-container">
            <h3 class="chart-title">🎯 Distribución de Enfermedades</h3>
            <canvas id="diseasesChart"></canvas>
          </div>
          <div class="chart-container">
            <h3 class="chart-title">💬 Evolución de Consultas</h3>
            <canvas id="consultationsChart"></canvas>
          </div>
          <div class="chart-container">
            <h3 class="chart-title">📋 Actividad de Cuestionarios</h3>
            <canvas id="questionnairesChart"></canvas>
          </div>
        </div>

        <div id="adminSectionContainer" style="margin-top: 2rem;"></div>
      `;

      // Initialize charts after DOM is ready
      setTimeout(() => this.initDashboardCharts(users, consultations, questionnaires), 100);

    } catch (error) {
      logger.error('Error cargando admin dashboard:', error);
      container.innerHTML = '<div class="error">Error cargando panel de administración</div>';
    }
  }

  initDashboardCharts(users, consultations, questionnaires) {
    // Destroy existing charts if they exist
    if (this.charts) {
      Object.values(this.charts).forEach(chart => chart?.destroy());
    }
    this.charts = {};

    // Chart 1: Adherencia en el Tiempo (Line Chart)
    const adherenceCtx = document.getElementById('adherenceChart');
    if (adherenceCtx) {
      // Generate last 6 months data
      const months = [];
      const adherenceData = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        months.push(date.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }));

        // Simulate adherence evolution (in real app, this would come from historical data)
        const baseAdherence = users.length > 0
          ? users.reduce((sum, u) => sum + (u.adherenceRate || 0), 0) / users.length
          : 0;
        adherenceData.push(Math.round(baseAdherence + (Math.random() * 10 - 5)));
      }

      this.charts.adherence = new Chart(adherenceCtx, {
        type: 'line',
        data: {
          labels: months,
          datasets: [{
            label: 'Adherencia Media (%)',
            data: adherenceData,
            borderColor: 'rgb(34, 197, 94)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            tension: 0.4,
            fill: true,
            pointRadius: 4,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => `${context.parsed.y}%`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: { callback: (value) => value + '%' }
            }
          }
        }
      });
    }

    // Chart 2: Distribución de Enfermedades (Doughnut Chart)
    const diseasesCtx = document.getElementById('diseasesChart');
    if (diseasesCtx) {
      const diseaseCount = {};
      users.forEach(user => {
        if (user.diseases && user.diseases.length > 0) {
          user.diseases.forEach(disease => {
            diseaseCount[disease] = (diseaseCount[disease] || 0) + 1;
          });
        }
      });

      const diseaseLabels = Object.keys(diseaseCount);
      const diseaseValues = Object.values(diseaseCount);
      const colors = [
        '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
        '#10b981', '#06b6d4', '#f97316', '#84cc16'
      ];

      this.charts.diseases = new Chart(diseasesCtx, {
        type: 'doughnut',
        data: {
          labels: diseaseLabels.length > 0 ? diseaseLabels : ['Sin datos'],
          datasets: [{
            data: diseaseValues.length > 0 ? diseaseValues : [1],
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { padding: 15, font: { size: 11 } }
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const label = context.label || '';
                  const value = context.parsed || 0;
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = Math.round((value / total) * 100);
                  return `${label}: ${value} (${percentage}%)`;
                }
              }
            }
          }
        }
      });
    }

    // Chart 3: Evolución de Consultas (Bar Chart)
    const consultationsCtx = document.getElementById('consultationsChart');
    if (consultationsCtx) {
      // Group consultations by month
      const last6Months = [];
      const pendingByMonth = [];
      const resolvedByMonth = [];

      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = date.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
        last6Months.push(monthKey);

        // Count consultations for this month
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        const monthConsultations = consultations.filter(c => {
          const cDate = new Date(c.createdAt);
          return cDate >= monthStart && cDate <= monthEnd;
        });

        pendingByMonth.push(monthConsultations.filter(c => c.status === 'pending').length);
        resolvedByMonth.push(monthConsultations.filter(c => c.status === 'resolved').length);
      }

      this.charts.consultations = new Chart(consultationsCtx, {
        type: 'bar',
        data: {
          labels: last6Months,
          datasets: [
            {
              label: 'Resueltas',
              data: resolvedByMonth,
              backgroundColor: 'rgba(34, 197, 94, 0.8)',
              borderColor: 'rgb(34, 197, 94)',
              borderWidth: 1
            },
            {
              label: 'Pendientes',
              data: pendingByMonth,
              backgroundColor: 'rgba(251, 146, 60, 0.8)',
              borderColor: 'rgb(251, 146, 60)',
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top' }
          },
          scales: {
            x: { stacked: true },
            y: {
              stacked: true,
              beginAtZero: true,
              ticks: { stepSize: 1 }
            }
          }
        }
      });
    }

    // Chart 4: Actividad de Cuestionarios (Line Chart)
    const questionnairesCtx = document.getElementById('questionnairesChart');
    if (questionnairesCtx) {
      const last6Months = [];
      const assignedByMonth = [];
      const completedByMonth = [];

      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = date.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
        last6Months.push(monthKey);

        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        const monthQuestionnaires = questionnaires.filter(q => {
          const qDate = new Date(q.createdAt);
          return qDate >= monthStart && qDate <= monthEnd;
        });

        assignedByMonth.push(monthQuestionnaires.filter(q => q.status === 'assigned' || q.status === 'in_progress').length);
        completedByMonth.push(monthQuestionnaires.filter(q => q.status === 'completed').length);
      }

      this.charts.questionnaires = new Chart(questionnairesCtx, {
        type: 'line',
        data: {
          labels: last6Months,
          datasets: [
            {
              label: 'Completados',
              data: completedByMonth,
              borderColor: 'rgb(34, 197, 94)',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              tension: 0.4,
              fill: true
            },
            {
              label: 'Asignados',
              data: assignedByMonth,
              borderColor: 'rgb(251, 146, 60)',
              backgroundColor: 'rgba(251, 146, 60, 0.1)',
              tension: 0.4,
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top' }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1 }
            }
          }
        }
      });
    }
  }

  async showAdminSection(section) {
    const container = document.getElementById('adminSectionContainer');

    switch(section) {
      case 'patients':
        await this.renderPatients(container);
        break;
      case 'medications':
        await this.renderMedications(container);
        break;
      case 'consultations':
        await this.renderConsultations(container);
        break;
      case 'questionnaires':
        await this.renderQuestionnaires(container);
        break;
    }
  }

  async renderPatients(container) {
    const users = await api.getUsers();
    const medications = await api.getMedications();

    container.innerHTML = `
      <div style="background: white; border-radius: 1rem; padding: 1.5rem; box-shadow: var(--shadow);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <h2>👥 Gestión de Pacientes</h2>
          <button class="btn btn-primary" onclick="app.showAddPatientModal()">
            + Nuevo Paciente
          </button>
        </div>

        <div style="margin-bottom: 1rem;">
          <input type="text" id="searchPatients" class="form-input" placeholder="🔍 Buscar pacientes..."
            onkeyup="app.filterPatients(this.value)">
        </div>

        <div class="table-container">
          <table id="patientsTable">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Medicamentos</th>
                <th>Enfermedades</th>
                <th>Adherencia</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${users.map(user => `
                <tr data-patient-name="${user.name.toLowerCase()}" data-patient-email="${user.email.toLowerCase()}">
                  <td>
                    <strong>${user.name}</strong>
                    ${user.phone ? `<br><small style="color: var(--gray-600);">📱 ${user.phone}</small>` : ''}
                  </td>
                  <td>${user.email}</td>
                  <td>
                    ${user.medications && user.medications.length > 0
                      ? user.medications.map(m => m.name || '-').join(', ')
                      : '<span style="color: var(--gray-400);">Sin asignar</span>'}
                  </td>
                  <td>
                    ${user.diseases && user.diseases.length > 0
                      ? user.diseases.slice(0, 2).join(', ') + (user.diseases.length > 2 ? '...' : '')
                      : '<span style="color: var(--gray-400);">-</span>'}
                  </td>
                  <td>
                    <span class="badge ${user.adherenceRate >= 80 ? 'badge-success' : user.adherenceRate >= 60 ? 'badge-warning' : 'badge-danger'}">
                      ${user.adherenceRate || 0}%
                    </span>
                  </td>
                  <td>
                    <button class="btn btn-sm btn-outline" onclick="app.viewPatientDetail('${user._id}')" title="Ver detalle">
                      👁️
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="app.editPatient('${user._id}')" title="Editar">
                      ✏️
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.allPatients = users;
    this.allMedications = medications;
  }

  filterPatients(searchTerm) {
    const rows = document.querySelectorAll('#patientsTable tbody tr');
    const term = searchTerm.toLowerCase();

    rows.forEach(row => {
      const name = row.getAttribute('data-patient-name');
      const email = row.getAttribute('data-patient-email');

      if (name.includes(term) || email.includes(term)) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  }

  showAddPatientModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header">
          <h2>➕ Nuevo Paciente</h2>
          <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
        </div>

        <form id="addPatientForm">
          <h3 style="margin-bottom: 1rem; color: var(--primary);">Datos Personales</h3>

          <div class="form-group">
            <label class="form-label">Nombre Completo *</label>
            <input type="text" id="patientName" class="form-input" required>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group">
              <label class="form-label">Email *</label>
              <input type="email" id="patientEmail" class="form-input" required>
            </div>

            <div class="form-group">
              <label class="form-label">Teléfono</label>
              <input type="tel" id="patientPhone" class="form-input">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group">
              <label class="form-label">Fecha de Nacimiento</label>
              <input type="date" id="patientDOB" class="form-input">
            </div>

            <div class="form-group">
              <label class="form-label">Género</label>
              <select id="patientGender" class="form-select">
                <option value="">Seleccionar...</option>
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
                <option value="other">Otro</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Contraseña *</label>
            <input type="password" id="patientPassword" class="form-input" required minlength="6">
            <small style="color: var(--gray-600);">Mínimo 6 caracteres</small>
          </div>

          <hr style="margin: 1.5rem 0; border: none; border-top: 2px solid var(--gray-200);">

          <h3 style="margin-bottom: 1rem; color: var(--primary);">Información Clínica</h3>

          <div class="form-group">
            <label class="form-label">Enfermedades</label>
            <input type="text" id="patientDiseases" class="form-input"
              placeholder="Ej: Artritis reumatoide, Diabetes tipo 2">
            <small style="color: var(--gray-600);">Separar con comas</small>
          </div>

          <div class="form-group">
            <label class="form-label">Medicamentos Asignados</label>
            <select id="patientMedications" class="form-select" multiple style="min-height: 100px;">
              ${this.allMedications.map(med => `
                <option value="${med._id}">${med.name}</option>
              `).join('')}
            </select>
            <small style="color: var(--gray-600);">Mantén Ctrl (Cmd en Mac) para seleccionar múltiples</small>
          </div>

          <div class="modal-actions">
            <button type="submit" class="btn btn-primary">Crear Paciente</button>
            <button type="button" class="btn btn-secondary"
              onclick="this.closest('.modal').remove()">Cancelar</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('addPatientForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.createPatient();
    });
  }

  async createPatient() {
    const name = document.getElementById('patientName').value;
    const email = document.getElementById('patientEmail').value;
    const phone = document.getElementById('patientPhone').value;
    const dateOfBirth = document.getElementById('patientDOB').value;
    const gender = document.getElementById('patientGender').value;
    const password = document.getElementById('patientPassword').value;
    const diseasesStr = document.getElementById('patientDiseases').value;
    const medicationSelect = document.getElementById('patientMedications');
    const medications = Array.from(medicationSelect.selectedOptions).map(opt => opt.value);

    const diseases = diseasesStr ? diseasesStr.split(',').map(d => d.trim()).filter(d => d) : [];

    try {
      await api.register(name, email, password, {
        phone,
        dateOfBirth,
        gender,
        diseases,
        medications,
        role: 'patient'
      });

      this.showMessage('✅ Paciente creado correctamente', 'success');
      document.querySelector('.modal').remove();
      this.showAdminSection('patients');
    } catch (error) {
      this.showMessage('Error creando paciente: ' + error.message, 'error');
    }
  }

  async editPatient(patientId) {
    try {
      // Cerrar modal actual si existe
      document.querySelector('.modal')?.remove();

      const [patient, medications, clinicalRecord] = await Promise.all([
        api.getUserProfile(patientId),
        api.getMedications(),
        api.getLatestClinicalRecord(patientId).catch(() => null)
      ]);

      const modal = document.createElement('div');
      modal.className = 'modal active';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 1000px; max-height: 90vh; overflow-y: auto;">
          <div class="modal-header">
            <h2>✏️ Editar Paciente: ${patient.patient?.name || 'Sin nombre'}</h2>
            <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
          </div>

          <div style="display: flex; gap: 1rem; margin-bottom: 1rem; border-bottom: 2px solid var(--gray-200);">
            <button class="tab-btn active" data-tab="basic" onclick="app.switchEditTab('basic')">
              📋 Datos Básicos
            </button>
            <button class="tab-btn" data-tab="clinical" onclick="app.switchEditTab('clinical')">
              🏥 Historia Clínica
            </button>
            <button class="tab-btn" data-tab="treatment" onclick="app.switchEditTab('treatment')">
              💊 Tratamiento
            </button>
            <button class="tab-btn" data-tab="activity" onclick="app.switchEditTab('activity')">
              📈 Actividad
            </button>
            <button class="tab-btn" data-tab="history" onclick="app.switchEditTab('history')">
              📚 Historial
            </button>
          </div>

          <form id="editPatientForm">
            <!-- TAB: Datos Básicos -->
            <div class="tab-content active" data-tab-content="basic">
              ${this.renderBasicInfoForm(patient.patient)}
            </div>

            <!-- TAB: Historia Clínica -->
            <div class="tab-content hidden" data-tab-content="clinical">
              ${this.renderClinicalHistoryForm(clinicalRecord)}
            </div>

            <!-- TAB: Tratamiento -->
            <div class="tab-content hidden" data-tab-content="treatment">
              ${this.renderTreatmentForm(clinicalRecord, medications)}
            </div>

            <!-- TAB: Actividad de la Enfermedad -->
            <div class="tab-content hidden" data-tab-content="activity">
              ${this.renderDiseaseActivityForm(clinicalRecord)}
            </div>

            <!-- TAB: Historial -->
            <div class="tab-content hidden" data-tab-content="history">
              <div id="clinicalHistoryList">Cargando historial...</div>
            </div>

            <div class="modal-actions" style="margin-top: 2rem; padding-top: 1rem; border-top: 2px solid var(--gray-200);">
              <button type="submit" class="btn btn-primary">💾 Guardar Cambios</button>
              <button type="button" class="btn" style="background: var(--cyan);" onclick="app.exportPatientData('${patientId}')">
                📥 Exportar Datos
              </button>
              <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      `;

      document.body.appendChild(modal);

      // Cargar historial si existe
      this.loadClinicalHistory(patientId);

      // Event listener para el formulario
      document.getElementById('editPatientForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.savePatientChanges(patientId, patient.patient, clinicalRecord);
      });

    } catch (error) {
      this.showMessage('Error cargando datos del paciente: ' + error.message, 'error');
    }
  }

  async viewPatientDetail(patientId) {
    try {
      const patient = await api.getUserProfile(patientId);

      const modal = document.createElement('div');
      modal.className = 'modal active';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
          <div class="modal-header">
            <h2>👤 Perfil de ${patient.name}</h2>
            <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
          </div>

          <div style="display: grid; gap: 1.5rem;">
            <div style="background: var(--gray-50); padding: 1.5rem; border-radius: 0.75rem;">
              <h3 style="margin-bottom: 1rem;">📋 Información Personal</h3>
              <div style="display: grid; gap: 0.5rem;">
                <p><strong>Email:</strong> ${patient.email}</p>
                ${patient.phone ? `<p><strong>Teléfono:</strong> ${patient.phone}</p>` : ''}
                ${patient.dateOfBirth ? `<p><strong>Fecha de Nacimiento:</strong> ${new Date(patient.dateOfBirth).toLocaleDateString('es-ES')}</p>` : ''}
                ${patient.gender ? `<p><strong>Género:</strong> ${patient.gender}</p>` : ''}
              </div>
            </div>

            ${patient.diseases && patient.diseases.length > 0 ? `
              <div style="background: var(--gray-50); padding: 1.5rem; border-radius: 0.75rem;">
                <h3 style="margin-bottom: 1rem;">🏥 Enfermedades</h3>
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                  ${patient.diseases.map(d => `
                    <span class="badge badge-warning">${d}</span>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            ${patient.medications && patient.medications.length > 0 ? `
              <div style="background: var(--gray-50); padding: 1.5rem; border-radius: 0.75rem;">
                <h3 style="margin-bottom: 1rem;">💊 Medicamentos</h3>
                <div style="display: grid; gap: 0.5rem;">
                  ${patient.medications.map(m => `
                    <p>• ${m.name || m}</p>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <div style="background: var(--gray-50); padding: 1.5rem; border-radius: 0.75rem;">
              <h3 style="margin-bottom: 1rem;">📈 Adherencia</h3>
              <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="font-size: 3rem; font-weight: 700; color: ${
                  (patient.adherenceRate || 0) >= 80 ? 'var(--success)' :
                  (patient.adherenceRate || 0) >= 60 ? 'var(--warning)' : 'var(--danger)'
                };">
                  ${patient.adherenceRate || 0}%
                </div>
                <div>
                  <p><strong>Estado:</strong> ${
                    (patient.adherenceRate || 0) >= 80 ? '✅ Excelente' :
                    (patient.adherenceRate || 0) >= 60 ? '⚠️ Mejorable' : '❌ Crítico'
                  }</p>
                </div>
              </div>
            </div>

            ${patient.adverseEvents && patient.adverseEvents.length > 0 ? `
              <div style="background: #fee2e2; padding: 1.5rem; border-radius: 0.75rem;">
                <h3 style="margin-bottom: 1rem; color: var(--danger);">⚠️ Eventos Adversos</h3>
                <div style="display: grid; gap: 0.75rem;">
                  ${patient.adverseEvents.slice(0, 3).map(e => `
                    <div style="padding: 0.75rem; background: white; border-radius: 0.5rem;">
                      <p><strong>${e.event}</strong></p>
                      <small style="color: var(--gray-600);">${new Date(e.date).toLocaleDateString('es-ES')}</small>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>

          <div class="modal-actions" style="margin-top: 1.5rem;">
            <button class="btn btn-primary" onclick="app.editPatient('${patientId}')">
              Editar Paciente
            </button>
            <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
              Cerrar
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
    } catch (error) {
      this.showMessage('Error cargando detalle del paciente: ' + error.message, 'error');
    }
  }

  async renderMedications(container) {
    const medications = await api.getMedications();

    container.innerHTML = `
      <div style="background: white; border-radius: 1rem; padding: 1.5rem; box-shadow: var(--shadow);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <h2>💊 Gestión de Medicamentos</h2>
          <button class="btn btn-primary" onclick="app.showAddMedicationModal()">
            + Nuevo Medicamento
          </button>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>FAQs</th>
                <th>Video</th>
                <th>Pacientes</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${medications.map(med => `
                <tr>
                  <td><strong>${med.name}</strong></td>
                  <td>${med.description}</td>
                  <td>${med.faqs && med.faqs.length > 0 ? med.faqs.length + ' preguntas' : '-'}</td>
                  <td>${med.videoUrl ? '🎥' : '-'}</td>
                  <td>${med.assignedPatients || 0}</td>
                  <td>
                    <button class="btn btn-sm btn-outline" onclick="app.viewMedicationDetail('${med._id}')" title="Ver detalle">
                      👁️
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="app.editMedication('${med._id}')" title="Editar">
                      ✏️
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="app.deleteMedication('${med._id}')" title="Eliminar">
                      🗑️
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  async viewMedicationDetail(medicationId) {
    try {
      const medication = await api.getMedication(medicationId);

      const modal = document.createElement('div');
      modal.className = 'modal active';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
          <div class="modal-header">
            <h2>💊 ${medication.name}</h2>
            <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
          </div>

          <div style="display: grid; gap: 1.5rem;">
            <div style="background: var(--gray-50); padding: 1.5rem; border-radius: 0.75rem;">
              <h3 style="margin-bottom: 1rem;">📋 Información General</h3>
              <p><strong>Descripción:</strong> ${medication.description}</p>
              ${medication.activeIngredient ? `<p><strong>Principio Activo:</strong> ${medication.activeIngredient}</p>` : ''}
              ${medication.videoUrl ? `<p><strong>Video:</strong> <a href="${medication.videoUrl}" target="_blank">Ver video 🎥</a></p>` : ''}
            </div>

            <div style="background: var(--gray-50); padding: 1.5rem; border-radius: 0.75rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3>❓ FAQs (${medication.faqs ? medication.faqs.length : 0})</h3>
                <button class="btn btn-sm btn-success" onclick="app.addFAQToMedication('${medicationId}')">
                  + Agregar FAQ
                </button>
              </div>
              ${medication.faqs && medication.faqs.length > 0 ? `
                <div style="display: grid; gap: 0.75rem;">
                  ${medication.faqs.map((faq, index) => `
                    <div style="padding: 1rem; background: white; border-radius: 0.5rem; border: 1px solid var(--gray-200);">
                      <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                          <p style="font-weight: 600; margin-bottom: 0.5rem;">${faq.question}</p>
                          <p style="color: var(--gray-600);">${faq.answer}</p>
                        </div>
                        <button class="btn btn-sm btn-danger" onclick="app.deleteFAQFromMedication('${medicationId}', '${faq._id}')" title="Eliminar">
                          🗑️
                        </button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : '<p style="color: var(--gray-500);">No hay preguntas frecuentes aún</p>'}
            </div>
          </div>

          <div class="modal-actions" style="margin-top: 1.5rem;">
            <button class="btn btn-primary" onclick="app.editMedication('${medicationId}')">
              Editar Medicamento
            </button>
            <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
              Cerrar
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
    } catch (error) {
      this.showMessage('Error cargando medicamento: ' + error.message, 'error');
    }
  }

  async addFAQToMedication(medicationId) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>➕ Nueva Pregunta FAQ</h2>
          <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
        </div>

        <form id="addFAQForm">
          <div class="form-group">
            <label class="form-label">Pregunta *</label>
            <input type="text" id="faqQuestion" class="form-input" required
              placeholder="¿Cuál es la pregunta?">
          </div>

          <div class="form-group">
            <label class="form-label">Respuesta *</label>
            <textarea id="faqAnswer" class="form-textarea" rows="4" required
              placeholder="Respuesta detallada..."></textarea>
          </div>

          <div class="modal-actions">
            <button type="submit" class="btn btn-success">Agregar</button>
            <button type="button" class="btn btn-secondary"
              onclick="this.closest('.modal').remove()">Cancelar</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('addFAQForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const question = document.getElementById('faqQuestion').value;
      const answer = document.getElementById('faqAnswer').value;

      try {
        await api.addMedicationFAQ(medicationId, question, answer);
        this.showMessage('✅ FAQ agregada correctamente', 'success');
        document.querySelectorAll('.modal').forEach(m => m.remove());
        this.viewMedicationDetail(medicationId);
      } catch (error) {
        this.showMessage('Error agregando FAQ: ' + error.message, 'error');
      }
    });
  }

  async deleteFAQFromMedication(medicationId, faqId) {
    if (!confirm('¿Eliminar esta pregunta?')) return;

    try {
      await api.deleteMedicationFAQ(medicationId, faqId);
      this.showMessage('FAQ eliminada', 'success');
      document.querySelector('.modal').remove();
      this.viewMedicationDetail(medicationId);
    } catch (error) {
      this.showMessage('Error eliminando FAQ: ' + error.message, 'error');
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
            <label class="form-label">Nombre del Medicamento *</label>
            <input type="text" id="medName" class="form-input" required>
          </div>
          
          <div class="form-group">
            <label class="form-label">Descripción *</label>
            <textarea id="medDescription" class="form-textarea" rows="3" required></textarea>
          </div>
          
          <div class="form-group">
            <label class="form-label">Principio Activo</label>
            <input type="text" id="medActiveIngredient" class="form-input">
          </div>
          
          <div class="form-group">
            <label class="form-label">URL del Video (YouTube)</label>
            <input type="url" id="medVideoUrl" class="form-input" placeholder="https://youtube.com/...">
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
    try {
      // Cerrar modal actual
      document.querySelector('.modal')?.remove();

      const medication = await api.getMedication(medicationId);

      const modal = document.createElement('div');
      modal.className = 'modal active';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
          <div class="modal-header">
            <h2>✏️ Editar Medicamento: ${medication.name}</h2>
            <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
          </div>

          <form id="editMedicationForm">
            <div class="form-group">
              <label class="form-label">Nombre del Medicamento *</label>
              <input type="text" id="editMedName" class="form-input" value="${medication.name}" required>
            </div>

            <div class="form-group">
              <label class="form-label">Descripción *</label>
              <textarea id="editMedDescription" class="form-textarea" rows="3" required>${medication.description}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Principio Activo</label>
              <input type="text" id="editMedActiveIngredient" class="form-input" value="${medication.activeIngredient || ''}">
            </div>

            <div class="form-group">
              <label class="form-label">URL del Video (YouTube)</label>
              <input type="url" id="editMedVideoUrl" class="form-input" value="${medication.videoUrl || ''}"
                placeholder="https://youtube.com/...">
            </div>

            <hr style="margin: 1.5rem 0;">

            <div style="background: var(--gray-50); padding: 1.5rem; border-radius: 0.75rem; margin-bottom: 1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="margin: 0;">❓ Preguntas Frecuentes (FAQs)</h3>
                <button type="button" class="btn btn-sm btn-success" onclick="app.addFAQInEditModal()">
                  + Agregar FAQ
                </button>
              </div>

              <div id="faqsEditList">
                ${medication.faqs && medication.faqs.length > 0 ? medication.faqs.map((faq, index) => `
                  <div class="faq-edit-item" data-faq-index="${index}" style="background: white; padding: 1rem; border-radius: 0.5rem; margin-bottom: 0.75rem; border: 1px solid var(--gray-200);">
                    <div style="display: flex; justify-content: between; align-items: start; gap: 0.5rem;">
                      <div style="flex: 1;">
                        <input type="text" class="form-input" style="margin-bottom: 0.5rem;"
                          value="${faq.question}" data-faq-question="${index}" placeholder="Pregunta">
                        <textarea class="form-textarea" rows="2"
                          data-faq-answer="${index}" placeholder="Respuesta">${faq.answer}</textarea>
                        <input type="hidden" data-faq-id="${index}" value="${faq._id || ''}">
                      </div>
                      <button type="button" class="btn btn-sm btn-danger" onclick="this.closest('.faq-edit-item').remove()" title="Eliminar">
                        🗑️
                      </button>
                    </div>
                  </div>
                `).join('') : '<p style="color: var(--gray-500); text-align: center;">No hay FAQs aún. Haz clic en "+ Agregar FAQ" para añadir.</p>'}
              </div>
            </div>

            <div class="modal-actions">
              <button type="submit" class="btn btn-primary">💾 Guardar Cambios</button>
              <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      `;

      document.body.appendChild(modal);

      document.getElementById('editMedicationForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveMedicationChanges(medicationId);
      });

    } catch (error) {
      this.showMessage('Error cargando medicamento: ' + error.message, 'error');
    }
  }

  addFAQInEditModal() {
    const container = document.getElementById('faqsEditList');

    // Remover mensaje de "no hay FAQs" si existe
    const emptyMsg = container.querySelector('p');
    if (emptyMsg) emptyMsg.remove();

    const index = container.querySelectorAll('.faq-edit-item').length;

    const faqItem = document.createElement('div');
    faqItem.className = 'faq-edit-item';
    faqItem.setAttribute('data-faq-index', index);
    faqItem.style = 'background: white; padding: 1rem; border-radius: 0.5rem; margin-bottom: 0.75rem; border: 1px solid var(--gray-200);';
    faqItem.innerHTML = `
      <div style="display: flex; justify-content: between; align-items: start; gap: 0.5rem;">
        <div style="flex: 1;">
          <input type="text" class="form-input" style="margin-bottom: 0.5rem;"
            data-faq-question="${index}" placeholder="Pregunta">
          <textarea class="form-textarea" rows="2"
            data-faq-answer="${index}" placeholder="Respuesta"></textarea>
          <input type="hidden" data-faq-id="${index}" value="">
        </div>
        <button type="button" class="btn btn-sm btn-danger" onclick="this.closest('.faq-edit-item').remove()" title="Eliminar">
          🗑️
        </button>
      </div>
    `;

    container.appendChild(faqItem);
  }

  async saveMedicationChanges(medicationId) {
    try {
      const name = document.getElementById('editMedName').value;
      const description = document.getElementById('editMedDescription').value;
      const activeIngredient = document.getElementById('editMedActiveIngredient').value;
      const videoUrl = document.getElementById('editMedVideoUrl').value;

      // Recoger FAQs
      const faqItems = document.querySelectorAll('.faq-edit-item');
      const faqs = [];

      faqItems.forEach((item, index) => {
        const question = item.querySelector(`[data-faq-question="${index}"]`)?.value;
        const answer = item.querySelector(`[data-faq-answer="${index}"]`)?.value;
        const faqId = item.querySelector(`[data-faq-id="${index}"]`)?.value;

        if (question && answer) {
          faqs.push({
            _id: faqId || undefined,
            question: question.trim(),
            answer: answer.trim()
          });
        }
      });

      // Actualizar medicamento
      await api.updateMedication(medicationId, {
        name,
        description,
        activeIngredient,
        videoUrl,
        faqs
      });

      this.showMessage('✅ Medicamento actualizado correctamente', 'success');
      document.querySelector('.modal').remove();
      this.showAdminSection('medications');

    } catch (error) {
      this.showMessage('Error guardando cambios: ' + error.message, 'error');
    }
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
        <div style="background: white; border-radius: 1rem; padding: 1.5rem; box-shadow: var(--shadow);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
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
      <div style="display: grid; gap: 1rem;">
        ${consultations.map(consult => `
          <div style="border: 2px solid var(--gray-200); border-radius: 0.75rem; padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
              <div>
                <h3 style="margin-bottom: 0.25rem;">${consult.patient?.name || 'Paciente'}</h3>
                <p style="color: var(--gray-600); font-size: 0.9rem;">${consult.patient?.email || ''}</p>
              </div>
              <div>
                <span class="badge ${consult.status === 'resolved' ? 'badge-success' : 'badge-warning'}">
                  ${consult.status === 'resolved' ? 'Resuelta' : 'Pendiente'}
                </span>
              </div>
            </div>
            
            <div>
              <p style="margin-bottom: 0.5rem;"><strong>Mensaje:</strong> ${consult.message}</p>
              <p style="color: var(--gray-600); font-size: 0.9rem;"><strong>Fecha:</strong> ${new Date(consult.createdAt).toLocaleDateString('es-ES')}</p>
            </div>
            
            ${consult.status === 'pending' ? `
              <div style="margin-top: 1rem;">
                <button class="btn btn-primary" onclick="app.showRespondModal('${consult._id}')">
                  Responder
                </button>
              </div>
            ` : `
              <div style="margin-top: 1rem; padding: 1rem; background: var(--gray-50); border-radius: 0.5rem;">
                <strong>Tu respuesta:</strong>
                <p style="margin-top: 0.5rem;">${consult.response}</p>
                <small style="color: var(--gray-600);">Respondido el ${new Date(consult.respondedAt).toLocaleDateString('es-ES')}</small>
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
            <label class="form-label">Tu Respuesta</label>
            <textarea id="responseText" class="form-textarea" rows="6" required 
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

  // ===== CUESTIONARIOS PROMS =====

  async renderQuestionnaires(container) {
    try {
      const questionnaires = await api.getAllQuestionnaires();

      container.innerHTML = `
        <div style="background: white; border-radius: 1rem; padding: 1.5rem; box-shadow: var(--shadow);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h2>📋 Cuestionarios PROMS</h2>
            <button class="btn btn-primary" onclick="app.showCreateQuestionnaireModal()">
              + Nuevo Cuestionario
            </button>
          </div>

          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Enviados/Completados</th>
                  <th>Tasa Respuesta</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${questionnaires.length === 0 ? `
                  <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem;">
                      No hay cuestionarios creados aún
                    </td>
                  </tr>
                ` : questionnaires.map(q => `
                  <tr>
                    <td><strong>${q.title}</strong></td>
                    <td><span class="badge badge-primary">${q.type}</span></td>
                    <td>
                      <span class="badge ${
                        q.status === 'active' ? 'badge-success' :
                        q.status === 'draft' ? 'badge-warning' : 'badge-secondary'
                      }">
                        ${q.status}
                      </span>
                    </td>
                    <td>${q.stats.sent} / ${q.stats.completed}</td>
                    <td>${q.responseRate || 0}%</td>
                    <td>
                      <button class="btn btn-sm btn-outline" onclick="app.viewQuestionnaireDetail('${q._id}')" title="Ver">
                        👁️
                      </button>
                      <button class="btn btn-sm btn-success" onclick="app.assignQuestionnaireModal('${q._id}')" title="Asignar">
                        📤
                      </button>
                      <button class="btn btn-sm btn-danger" onclick="app.deleteQuestionnaire('${q._id}')" title="Eliminar">
                        🗑️
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (error) {
      container.innerHTML = '<div class="error">Error cargando cuestionarios</div>';
    }
  }

  showCreateQuestionnaireModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header">
          <h2>📋 Nuevo Cuestionario PROMS</h2>
          <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
        </div>

        <form id="createQuestionnaireForm">
          <div class="form-group">
            <label class="form-label">Título del Cuestionario *</label>
            <input type="text" id="qTitle" class="form-input" required>
          </div>

          <div class="form-group">
            <label class="form-label">Descripción</label>
            <textarea id="qDescription" class="form-textarea" rows="3"></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Tipo de Cuestionario *</label>
            <select id="qType" class="form-select" required>
              <option value="adherencia">Adherencia</option>
              <option value="eventos-adversos">Eventos Adversos</option>
              <option value="calidad-vida">Calidad de Vida</option>
              <option value="eficacia">Eficacia del Tratamiento</option>
              <option value="satisfaccion">Satisfacción</option>
              <option value="personalizado">Personalizado</option>
            </select>
          </div>

          <hr style="margin: 1.5rem 0;">

          <h3 style="margin-bottom: 1rem;">Preguntas</h3>
          <div id="questionsList" style="display: grid; gap: 1rem;"></div>

          <button type="button" class="btn btn-secondary" onclick="app.addQuestionField()">
            + Agregar Pregunta
          </button>

          <hr style="margin: 1.5rem 0;">

          <h3 style="margin-bottom: 1rem;">Criterios de Asignación</h3>

          <div class="form-group">
            <label class="form-label">Medicamentos (opcional)</label>
            <select id="qMedications" class="form-select" multiple style="min-height: 80px;">
              <!-- Se llenarán dinámicamente -->
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Enfermedades (opcional, separar con comas)</label>
            <input type="text" id="qDiseases" class="form-input">
          </div>

          <div class="modal-actions">
            <button type="submit" class="btn btn-primary">Crear Cuestionario</button>
            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    // Cargar medicamentos para el selector
    api.getQuestionnaireMedications().then(meds => {
      const select = document.getElementById('qMedications');
      select.innerHTML = meds.map(m => `<option value="${m._id}">${m.name}</option>`).join('');
    });

    // Agregar primera pregunta por defecto
    this.questionCounter = 0;
    this.addQuestionField();

    document.getElementById('createQuestionnaireForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.createQuestionnaire();
    });
  }

  addQuestionField() {
    const container = document.getElementById('questionsList');
    const id = `q${this.questionCounter++}`;

    const questionDiv = document.createElement('div');
    questionDiv.className = 'question-field';
    questionDiv.innerHTML = `
      <div style="border: 2px solid var(--gray-200); padding: 1rem; border-radius: 0.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <strong>Pregunta ${this.questionCounter}</strong>
          <button type="button" class="btn btn-sm btn-danger" onclick="this.closest('.question-field').remove()">
            Eliminar
          </button>
        </div>

        <div class="form-group">
          <label class="form-label">Texto de la pregunta</label>
          <input type="text" name="qText_${id}" class="form-input" required>
        </div>

        <div class="form-group">
          <label class="form-label">Tipo de respuesta</label>
          <select name="qResponseType_${id}" class="form-select">
            <option value="text">Texto libre</option>
            <option value="multiple">Opción múltiple</option>
            <option value="scale">Escala (1-10)</option>
            <option value="yesno">Sí/No</option>
            <option value="number">Número</option>
            <option value="date">Fecha</option>
          </select>
        </div>
      </div>
    `;

    container.appendChild(questionDiv);
  }

  async createQuestionnaire() {
    const title = document.getElementById('qTitle').value;
    const description = document.getElementById('qDescription').value;
    const type = document.getElementById('qType').value;
    const medicationsSelect = document.getElementById('qMedications');
    const medications = Array.from(medicationsSelect.selectedOptions).map(opt => opt.value);
    const diseasesStr = document.getElementById('qDiseases').value;
    const diseases = diseasesStr ? diseasesStr.split(',').map(d => d.trim()).filter(d => d) : [];

    // Recoger preguntas
    const questions = [];
    const questionFields = document.querySelectorAll('.question-field');
    questionFields.forEach((field, index) => {
      const textInput = field.querySelector(`[name^="qText_"]`);
      const typeSelect = field.querySelector(`[name^="qResponseType_"]`);

      if (textInput && typeSelect) {
        questions.push({
          id: `q${index + 1}`,
          text: textInput.value,
          type: typeSelect.value,
          required: true
        });
      }
    });

    if (questions.length === 0) {
      this.showMessage('Debes agregar al menos una pregunta', 'warning');
      return;
    }

    try {
      await api.createQuestionnaire({
        title,
        description,
        type,
        questions,
        targetCriteria: {
          medications,
          diseases
        },
        status: 'draft',
        schedule: {
          type: 'once'
        }
      });

      this.showMessage('✅ Cuestionario creado correctamente', 'success');
      document.querySelector('.modal').remove();
      this.showAdminSection('questionnaires');
    } catch (error) {
      this.showMessage('Error creando cuestionario: ' + error.message, 'error');
    }
  }

  async viewQuestionnaireDetail(questionnaireId) {
    try {
      const [questionnaire, responses] = await Promise.all([
        api.getAllQuestionnaires().then(qs => qs.find(q => q._id === questionnaireId)),
        api.getQuestionnaireResponses(questionnaireId)
      ]);

      const modal = document.createElement('div');
      modal.className = 'modal active';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
          <div class="modal-header">
            <h2>📋 ${questionnaire.title}</h2>
            <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
          </div>

          <div style="display: grid; gap: 1.5rem;">
            <div style="background: var(--gray-50); padding: 1.5rem; border-radius: 0.75rem;">
              <h3>📊 Estadísticas</h3>
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-top: 1rem;">
                <div style="text-align: center;">
                  <div style="font-size: 2rem; font-weight: 700;">${questionnaire.stats.sent}</div>
                  <div style="color: var(--gray-600); font-size: 0.9rem;">Enviados</div>
                </div>
                <div style="text-align: center;">
                  <div style="font-size: 2rem; font-weight: 700;">${questionnaire.stats.completed}</div>
                  <div style="color: var(--gray-600); font-size: 0.9rem;">Completados</div>
                </div>
                <div style="text-align: center;">
                  <div style="font-size: 2rem; font-weight: 700;">${questionnaire.stats.pending}</div>
                  <div style="color: var(--gray-600); font-size: 0.9rem;">Pendientes</div>
                </div>
                <div style="text-align: center;">
                  <div style="font-size: 2rem; font-weight: 700;">${questionnaire.responseRate || 0}%</div>
                  <div style="color: var(--gray-600); font-size: 0.9rem;">Tasa Respuesta</div>
                </div>
              </div>
            </div>

            <div style="background: var(--gray-50); padding: 1.5rem; border-radius: 0.75rem;">
              <h3>❓ Preguntas (${questionnaire.questions.length})</h3>
              <div style="display: grid; gap: 0.75rem; margin-top: 1rem;">
                ${questionnaire.questions.map((q, i) => `
                  <div style="padding: 0.75rem; background: white; border-radius: 0.5rem;">
                    <strong>${i + 1}. ${q.text}</strong>
                    <span class="badge badge-secondary" style="margin-left: 0.5rem;">${q.type}</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <div style="background: var(--gray-50); padding: 1.5rem; border-radius: 0.75rem;">
              <h3>📝 Respuestas Recientes</h3>
              ${responses.length > 0 ? `
                <div style="display: grid; gap: 0.75rem; margin-top: 1rem;">
                  ${responses.slice(0, 5).map(r => `
                    <div style="padding: 0.75rem; background: white; border-radius: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                      <div>
                        <strong>${r.patient?.name || 'Paciente'}</strong>
                        <small style="color: var(--gray-600); display: block;">
                          ${r.completedAt ? new Date(r.completedAt).toLocaleDateString('es-ES') : 'En progreso'}
                        </small>
                      </div>
                      <span class="badge ${r.status === 'completed' ? 'badge-success' : 'badge-warning'}">
                        ${r.status}
                      </span>
                    </div>
                  `).join('')}
                </div>
              ` : '<p style="color: var(--gray-500); margin-top: 1rem;">No hay respuestas aún</p>'}
            </div>
          </div>

          <div class="modal-actions" style="margin-top: 1.5rem;">
            <button class="btn btn-success" onclick="app.assignQuestionnaireModal('${questionnaireId}')">
              Asignar a Pacientes
            </button>
            ${questionnaire.status === 'draft' ? `
              <button class="btn btn-primary" onclick="app.activateQuestionnaire('${questionnaireId}')">
                Activar
              </button>
            ` : ''}
            <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
              Cerrar
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
    } catch (error) {
      this.showMessage('Error cargando cuestionario: ' + error.message, 'error');
    }
  }

  async assignQuestionnaireModal(questionnaireId) {
    const [patients, medications] = await Promise.all([
      api.getUsers(),
      api.getMedications()
    ]);

    // Obtener enfermedades únicas
    const allDiseases = new Set();
    patients.forEach(p => {
      if (p.diseases && Array.isArray(p.diseases)) {
        p.diseases.forEach(d => allDiseases.add(d));
      }
    });
    const diseases = Array.from(allDiseases).sort();

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 600px;">
        <div class="modal-header">
          <h2>📤 Asignar Cuestionario</h2>
          <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
        </div>

        <form id="assignQuestionnaireForm">
          <div class="form-group">
            <label class="form-label">Tipo de Asignación</label>
            <select id="assignmentType" class="form-select" onchange="app.changeAssignmentType()">
              <option value="specific">Pacientes Específicos</option>
              <option value="medication">Todos con un Tratamiento</option>
              <option value="disease">Todos con una Enfermedad</option>
              <option value="all">Todos los Pacientes</option>
            </select>
          </div>

          <!-- Pacientes específicos -->
          <div id="specificPatientsSection" class="assignment-section">
            <div class="form-group">
              <label class="form-label">Selecciona Pacientes</label>
              <select id="selectedPatients" class="form-select" multiple style="min-height: 200px;">
                ${patients.map(p => `
                  <option value="${p._id}">${p.name} - ${p.email}</option>
                `).join('')}
              </select>
              <small style="color: var(--gray-600);">Mantén Ctrl (Cmd en Mac) para seleccionar múltiples</small>
            </div>
          </div>

          <!-- Por medicamento -->
          <div id="medicationSection" class="assignment-section hidden">
            <div class="form-group">
              <label class="form-label">Selecciona Medicamento/Tratamiento</label>
              <select id="selectedMedication" class="form-select">
                <option value="">Seleccionar...</option>
                ${medications.map(m => `
                  <option value="${m._id}">${m.name}</option>
                `).join('')}
              </select>
              <p id="medicationPatientsCount" style="margin-top: 0.5rem; color: var(--gray-600); font-size: 0.875rem;"></p>
            </div>
          </div>

          <!-- Por enfermedad -->
          <div id="diseaseSection" class="assignment-section hidden">
            <div class="form-group">
              <label class="form-label">Selecciona Enfermedad</label>
              <select id="selectedDisease" class="form-select">
                <option value="">Seleccionar...</option>
                ${diseases.map(d => `
                  <option value="${d}">${d}</option>
                `).join('')}
              </select>
              <p id="diseasePatientsCount" style="margin-top: 0.5rem; color: var(--gray-600); font-size: 0.875rem;"></p>
            </div>
          </div>

          <!-- Todos los pacientes -->
          <div id="allPatientsSection" class="assignment-section hidden">
            <div style="padding: 1rem; background: var(--warning); color: white; border-radius: 0.5rem;">
              <p style="margin: 0;">⚠️ Se asignará el cuestionario a <strong>TODOS los ${patients.length} pacientes</strong></p>
            </div>
          </div>

          <div class="modal-actions">
            <button type="submit" class="btn btn-success">📤 Asignar Cuestionario</button>
            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    document.getElementById('selectedMedication').addEventListener('change', async (e) => {
      const medicationId = e.target.value;
      if (medicationId) {
        const medication = await api.getMedication(medicationId);
        const count = medication.patients ? medication.patients.length : 0;
        document.getElementById('medicationPatientsCount').textContent =
          `Se asignará a ${count} paciente(s) con este tratamiento`;
      }
    });

    document.getElementById('selectedDisease').addEventListener('change', (e) => {
      const disease = e.target.value;
      if (disease) {
        const count = patients.filter(p => p.diseases && p.diseases.includes(disease)).length;
        document.getElementById('diseasePatientsCount').textContent =
          `Se asignará a ${count} paciente(s) con esta enfermedad`;
      }
    });

    document.getElementById('assignQuestionnaireForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.processQuestionnaireAssignment(questionnaireId, patients);
    });
  }

  changeAssignmentType() {
    const type = document.getElementById('assignmentType').value;

    // Ocultar todas las secciones
    document.querySelectorAll('.assignment-section').forEach(s => s.classList.add('hidden'));

    // Mostrar la sección correspondiente
    const sections = {
      'specific': 'specificPatientsSection',
      'medication': 'medicationSection',
      'disease': 'diseaseSection',
      'all': 'allPatientsSection'
    };

    document.getElementById(sections[type]).classList.remove('hidden');
  }

  async processQuestionnaireAssignment(questionnaireId, allPatients) {
    const type = document.getElementById('assignmentType').value;
    let patientIds = [];

    try {
      switch(type) {
        case 'specific':
          const select = document.getElementById('selectedPatients');
          patientIds = Array.from(select.selectedOptions).map(opt => opt.value);
          if (patientIds.length === 0) {
            this.showMessage('Selecciona al menos un paciente', 'warning');
            return;
          }
          break;

        case 'medication':
          const medicationId = document.getElementById('selectedMedication').value;
          if (!medicationId) {
            this.showMessage('Selecciona un medicamento', 'warning');
            return;
          }
          const medication = await api.getMedication(medicationId);
          patientIds = medication.patients || [];
          if (patientIds.length === 0) {
            this.showMessage('No hay pacientes con este medicamento', 'warning');
            return;
          }
          break;

        case 'disease':
          const disease = document.getElementById('selectedDisease').value;
          if (!disease) {
            this.showMessage('Selecciona una enfermedad', 'warning');
            return;
          }
          patientIds = allPatients
            .filter(p => p.diseases && p.diseases.includes(disease))
            .map(p => p._id);
          if (patientIds.length === 0) {
            this.showMessage('No hay pacientes con esta enfermedad', 'warning');
            return;
          }
          break;

        case 'all':
          patientIds = allPatients.map(p => p._id);
          break;
      }

      const result = await api.assignQuestionnaire(questionnaireId, patientIds);
      this.showMessage(`✅ Cuestionario asignado a ${result.assigned} paciente(s)`, 'success');
      document.querySelectorAll('.modal').forEach(m => m.remove());
      this.showAdminSection('questionnaires');

    } catch (error) {
      this.showMessage('Error asignando cuestionario: ' + error.message, 'error');
    }
  }

  async activateQuestionnaire(questionnaireId) {
    if (!confirm('¿Activar este cuestionario?')) return;

    try {
      await api.activateQuestionnaire(questionnaireId);
      this.showMessage('✅ Cuestionario activado', 'success');
      document.querySelector('.modal').remove();
      this.showAdminSection('questionnaires');
    } catch (error) {
      this.showMessage('Error activando cuestionario: ' + error.message, 'error');
    }
  }

  async deleteQuestionnaire(questionnaireId) {
    if (!confirm('¿Eliminar este cuestionario? Esto eliminará también todas las respuestas.')) return;

    try {
      await api.deleteQuestionnaire(questionnaireId);
      this.showMessage('Cuestionario eliminado', 'success');
      this.showAdminSection('questionnaires');
    } catch (error) {
      this.showMessage('Error eliminando cuestionario: ' + error.message, 'error');
    }
  }

  viewUserDetail(userId) {
    this.showMessage('Ver detalle de usuario - Próximamente', 'info');
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
    this.stopReminderChecker();
    this.showScreen('login');
  }

  // ===== FUNCIONES PARA EDICIÓN DE PACIENTES CON HISTORIAL CLÍNICO =====

  switchEditTab(tabName) {
    // Ocultar todos los tabs
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
      content.classList.add('hidden');
    });

    // Mostrar tab seleccionado
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    const content = document.querySelector(`[data-tab-content="${tabName}"]`);
    content.classList.remove('hidden');
    content.classList.add('active');
  }

  renderBasicInfoForm(patient) {
    return `
      <h3 style="margin-bottom: 1rem; color: var(--primary);">📋 Datos Personales</h3>

      <div class="form-group">
        <label class="form-label">Nombre Completo *</label>
        <input type="text" id="editPatientName" class="form-input" value="${patient?.name || ''}" required>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Email *</label>
          <input type="email" id="editPatientEmail" class="form-input" value="${patient?.email || ''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Teléfono</label>
          <input type="tel" id="editPatientPhone" class="form-input" value="${patient?.phone || ''}">
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Fecha de Nacimiento</label>
          <input type="date" id="editPatientDOB" class="form-input" value="${patient?.dateOfBirth ? new Date(patient.dateOfBirth).toISOString().split('T')[0] : ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Género</label>
          <select id="editPatientGender" class="form-select">
            <option value="">Seleccionar...</option>
            <option value="masculino" ${patient?.gender === 'masculino' ? 'selected' : ''}>Masculino</option>
            <option value="femenino" ${patient?.gender === 'femenino' ? 'selected' : ''}>Femenino</option>
            <option value="otro" ${patient?.gender === 'otro' ? 'selected' : ''}>Otro</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Enfermedades</label>
        <input type="text" id="editPatientDiseases" class="form-input" value="${patient?.diseases?.join(', ') || ''}"
          placeholder="Ej: Artritis reumatoide, Diabetes tipo 2">
        <small style="color: var(--gray-600);">Separar con comas</small>
      </div>
    `;
  }

  renderClinicalHistoryForm(record) {
    return `
      <h3 style="margin-bottom: 1rem; color: var(--primary);">🏥 Historia Clínica</h3>

      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Peso (kg)</label>
          <input type="number" id="clinicalWeight" class="form-input" step="0.1"
            value="${record?.demographics?.weight || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Altura (cm)</label>
          <input type="number" id="clinicalHeight" class="form-input" step="0.1"
            value="${record?.demographics?.height || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">IMC</label>
          <input type="number" id="clinicalBMI" class="form-input" step="0.1" readonly
            value="${record?.demographics?.bmi || ''}">
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Profesión</label>
          <input type="text" id="clinicalProfession" class="form-input"
            value="${record?.demographics?.profession || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Situación Laboral</label>
          <select id="clinicalEmployment" class="form-select">
            <option value="">Seleccionar...</option>
            <option value="empleado" ${record?.demographics?.employmentStatus === 'empleado' ? 'selected' : ''}>Empleado</option>
            <option value="desempleado" ${record?.demographics?.employmentStatus === 'desempleado' ? 'selected' : ''}>Desempleado</option>
            <option value="jubilado" ${record?.demographics?.employmentStatus === 'jubilado' ? 'selected' : ''}>Jubilado</option>
            <option value="estudiante" ${record?.demographics?.employmentStatus === 'estudiante' ? 'selected' : ''}>Estudiante</option>
          </select>
        </div>
      </div>

      <h4 style="margin-top: 1.5rem; margin-bottom: 1rem; color: var(--primary);">Artritis Reumatoide</h4>

      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Fecha Diagnóstico AR</label>
          <input type="date" id="clinicalARDate" class="form-input"
            value="${record?.clinicalHistory?.arDiagnosisDate ? new Date(record.clinicalHistory.arDiagnosisDate).toISOString().split('T')[0] : ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Factor Reumatoide</label>
          <select id="clinicalRF" class="form-select">
            <option value="">No realizado</option>
            <option value="positivo" ${record?.clinicalHistory?.rheumatoidFactor === 'positivo' ? 'selected' : ''}>Positivo</option>
            <option value="negativo" ${record?.clinicalHistory?.rheumatoidFactor === 'negativo' ? 'selected' : ''}>Negativo</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Anti-CCP</label>
          <select id="clinicalAntiCCP" class="form-select">
            <option value="">No realizado</option>
            <option value="positivo" ${record?.clinicalHistory?.antiCCP === 'positivo' ? 'selected' : ''}>Positivo</option>
            <option value="negativo" ${record?.clinicalHistory?.antiCCP === 'negativo' ? 'selected' : ''}>Negativo</option>
          </select>
        </div>
      </div>

      <h4 style="margin-top: 1.5rem; margin-bottom: 1rem; color: var(--primary);">Comorbilidades y Alergias</h4>

      <div class="form-group">
        <label class="form-label">Comorbilidades</label>
        <textarea id="clinicalComorbidities" class="form-input" rows="3"
          placeholder="Ej: Hipertensión controlada, Diabetes tipo 2">${record?.clinicalHistory?.comorbidities?.map(c => c.condition).join(', ') || ''}</textarea>
        <small style="color: var(--gray-600);">Separar con comas</small>
      </div>

      <div class="form-group">
        <label class="form-label">Alergias Medicamentosas</label>
        <textarea id="clinicalAllergies" class="form-input" rows="3"
          placeholder="Ej: Penicilina - Reacción cutánea (moderada)">${record?.clinicalHistory?.allergies?.map(a => `${a.medication} - ${a.reaction} (${a.severity})`).join(', ') || ''}</textarea>
        <small style="color: var(--gray-600);">Formato: Medicamento - Reacción (severidad)</small>
      </div>
    `;
  }

  renderTreatmentForm(record, medications) {
    return `
      <h3 style="margin-bottom: 1rem; color: var(--primary);">💊 Tratamiento Actual</h3>

      <h4 style="margin-top: 1rem; margin-bottom: 0.5rem;">FAME (Fármacos Antirreumáticos)</h4>
      <div id="fameList">
        ${record?.currentTreatment?.fame?.map((f, i) => `
          <div class="treatment-item" style="background: var(--gray-50); padding: 1rem; border-radius: 0.5rem; margin-bottom: 0.5rem;">
            <input type="text" placeholder="Nombre medicamento" class="form-input" style="margin-bottom: 0.5rem;"
              value="${f.medicationName || ''}" data-fame-name="${i}">
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem;">
              <input type="text" placeholder="Dosis" class="form-input" value="${f.dose || ''}" data-fame-dose="${i}">
              <input type="text" placeholder="Frecuencia" class="form-input" value="${f.frequency || ''}" data-fame-freq="${i}">
              <input type="text" placeholder="Vía" class="form-input" value="${f.route || ''}" data-fame-route="${i}">
            </div>
          </div>
        `).join('') || '<p style="color: var(--gray-600);">No hay FAME registrados</p>'}
      </div>
      <button type="button" class="btn btn-sm btn-outline" onclick="app.addTreatmentItem('fame')" style="margin-top: 0.5rem;">+ Añadir FAME</button>

      <h4 style="margin-top: 1.5rem; margin-bottom: 0.5rem;">Biológicos</h4>
      <div id="biologicsList">
        ${record?.currentTreatment?.biologics?.map((b, i) => `
          <div class="treatment-item" style="background: var(--gray-50); padding: 1rem; border-radius: 0.5rem; margin-bottom: 0.5rem;">
            <input type="text" placeholder="Nombre medicamento" class="form-input" style="margin-bottom: 0.5rem;"
              value="${b.medicationName || ''}" data-biologic-name="${i}">
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem;">
              <select class="form-select" data-biologic-type="${i}">
                <option value="">Tipo...</option>
                <option value="anti-TNF" ${b.type === 'anti-TNF' ? 'selected' : ''}>Anti-TNF</option>
                <option value="anti-IL6" ${b.type === 'anti-IL6' ? 'selected' : ''}>Anti-IL6</option>
                <option value="anti-JAK" ${b.type === 'anti-JAK' ? 'selected' : ''}>Anti-JAK</option>
              </select>
              <input type="text" placeholder="Dosis" class="form-input" value="${b.dose || ''}" data-biologic-dose="${i}">
              <input type="text" placeholder="Frecuencia" class="form-input" value="${b.frequency || ''}" data-biologic-freq="${i}">
            </div>
          </div>
        `).join('') || '<p style="color: var(--gray-600);">No hay biológicos registrados</p>'}
      </div>
      <button type="button" class="btn btn-sm btn-outline" onclick="app.addTreatmentItem('biologic')" style="margin-top: 0.5rem;">+ Añadir Biológico</button>

      <h4 style="margin-top: 1.5rem; margin-bottom: 0.5rem;">Suplementos</h4>
      <div class="form-group">
        <textarea id="treatmentSupplements" class="form-input" rows="2"
          placeholder="Ej: Ácido fólico 5mg/día, Calcio + Vitamina D 1 comp/día">${record?.currentTreatment?.supplements?.map(s => `${s.name} ${s.dose} ${s.frequency}`).join(', ') || ''}</textarea>
      </div>
    `;
  }

  renderDiseaseActivityForm(record) {
    return `
      <h3 style="margin-bottom: 1rem; color: var(--primary);">📈 Actividad de la Enfermedad</h3>

      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Articulaciones Dolorosas</label>
          <input type="number" id="activityTenderJoints" class="form-input"
            value="${record?.diseaseActivity?.tenderJointsCount || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Articulaciones Inflamadas</label>
          <input type="number" id="activitySwollenJoints" class="form-input"
            value="${record?.diseaseActivity?.swollenJointsCount || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Rigidez Matutina (min)</label>
          <input type="number" id="activityMorningStiffness" class="form-input"
            value="${record?.diseaseActivity?.morningStiffness?.duration || ''}">
        </div>
      </div>

      <h4 style="margin-top: 1.5rem; margin-bottom: 1rem;">DAS28 y Marcadores</h4>

      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">DAS28 Score</label>
          <input type="number" id="activityDAS28" class="form-input" step="0.1"
            value="${record?.diseaseActivity?.das28?.score || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">VSG (mm/h)</label>
          <input type="number" id="activityVSG" class="form-input"
            value="${record?.diseaseActivity?.labResults?.vsg || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">PCR (mg/L)</label>
          <input type="number" id="activityCRP" class="form-input" step="0.1"
            value="${record?.diseaseActivity?.labResults?.crp || ''}">
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">HAQ Score (0-3)</label>
          <input type="number" id="activityHAQ" class="form-input" step="0.1" min="0" max="3"
            value="${record?.diseaseActivity?.haq?.score || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Dolor EVA (0-10)</label>
          <input type="number" id="activityPain" class="form-input" step="0.5" min="0" max="10"
            value="${record?.diseaseActivity?.painScale?.score || ''}">
        </div>
      </div>

      <h4 style="margin-top: 1.5rem; margin-bottom: 1rem;">Adherencia y Efectos Adversos</h4>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Adherencia General</label>
          <select id="adherenceOverall" class="form-select">
            <option value="">Seleccionar...</option>
            <option value="excelente" ${record?.adherenceEvaluation?.overallAdherence === 'excelente' ? 'selected' : ''}>Excelente</option>
            <option value="buena" ${record?.adherenceEvaluation?.overallAdherence === 'buena' ? 'selected' : ''}>Buena</option>
            <option value="regular" ${record?.adherenceEvaluation?.overallAdherence === 'regular' ? 'selected' : ''}>Regular</option>
            <option value="mala" ${record?.adherenceEvaluation?.overallAdherence === 'mala' ? 'selected' : ''}>Mala</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Adherencia % (0-100)</label>
          <input type="number" id="adherencePercentage" class="form-input" min="0" max="100"
            value="${record?.adherenceEvaluation?.adherencePercentage || ''}">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Efectos Adversos Actuales</label>
        <textarea id="adherenceAdverse" class="form-input" rows="3"
          placeholder="Ej: Náuseas leves (relacionado con metotrexato)">${record?.adherenceEvaluation?.currentAdverseEffects?.map(e => `${e.effect} ${e.severity} (${e.relatedMedication})`).join(', ') || ''}</textarea>
      </div>

      <div class="form-group">
        <label class="form-label">Notas del Profesional</label>
        <textarea id="professionalNotes" class="form-input" rows="4"
          placeholder="Observaciones, plan de seguimiento, intervenciones...">${record?.professionalNotes?.clinicalNotes || ''}</textarea>
      </div>
    `;
  }

  addTreatmentItem(type) {
    const container = document.getElementById(type === 'fame' ? 'fameList' : 'biologicsList');
    const index = container.querySelectorAll('.treatment-item').length;

    const item = document.createElement('div');
    item.className = 'treatment-item';
    item.style = 'background: var(--gray-50); padding: 1rem; border-radius: 0.5rem; margin-bottom: 0.5rem;';

    if (type === 'fame') {
      item.innerHTML = `
        <input type="text" placeholder="Nombre medicamento" class="form-input" style="margin-bottom: 0.5rem;" data-fame-name="${index}">
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem;">
          <input type="text" placeholder="Dosis" class="form-input" data-fame-dose="${index}">
          <input type="text" placeholder="Frecuencia" class="form-input" data-fame-freq="${index}">
          <input type="text" placeholder="Vía" class="form-input" data-fame-route="${index}">
        </div>
      `;
    } else {
      item.innerHTML = `
        <input type="text" placeholder="Nombre medicamento" class="form-input" style="margin-bottom: 0.5rem;" data-biologic-name="${index}">
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem;">
          <select class="form-select" data-biologic-type="${index}">
            <option value="">Tipo...</option>
            <option value="anti-TNF">Anti-TNF</option>
            <option value="anti-IL6">Anti-IL6</option>
            <option value="anti-JAK">Anti-JAK</option>
          </select>
          <input type="text" placeholder="Dosis" class="form-input" data-biologic-dose="${index}">
          <input type="text" placeholder="Frecuencia" class="form-input" data-biologic-freq="${index}">
        </div>
      `;
    }

    container.appendChild(item);
  }

  async loadClinicalHistory(patientId) {
    try {
      const history = await api.getPatientClinicalHistory(patientId, { limit: 10 });
      const container = document.getElementById('clinicalHistoryList');

      if (!history || history.length === 0) {
        container.innerHTML = '<p style="color: var(--gray-600);">No hay registros anteriores</p>';
        return;
      }

      container.innerHTML = `
        <h3 style="margin-bottom: 1rem;">📚 Historial Clínico</h3>
        <div style="display: grid; gap: 1rem;">
          ${history.map(record => `
            <div style="background: var(--gray-50); padding: 1rem; border-radius: 0.75rem; cursor: pointer;"
              onclick="app.viewHistoricalRecord('${record._id}')">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <strong>${new Date(record.recordDate).toLocaleDateString('es-ES')}</strong>
                  <p style="font-size: 0.875rem; color: var(--gray-600); margin-top: 0.25rem;">
                    ${record.diseaseActivity?.das28?.score ? `DAS28: ${record.diseaseActivity.das28.score}` : ''}
                    ${record.demographics?.weight ? `| Peso: ${record.demographics.weight}kg` : ''}
                    ${record.adherenceEvaluation?.adherencePercentage ? `| Adherencia: ${record.adherenceEvaluation.adherencePercentage}%` : ''}
                  </p>
                </div>
                <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); app.compareRecords('${record._id}')">
                  🔍 Comparar
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (error) {
      document.getElementById('clinicalHistoryList').innerHTML =
        '<p style="color: var(--danger);">Error cargando historial</p>';
    }
  }

  async savePatientChanges(patientId, patient, existingRecord) {
    try {
      // 1. Actualizar datos básicos del usuario
      const basicData = {
        name: document.getElementById('editPatientName').value,
        email: document.getElementById('editPatientEmail').value,
        phone: document.getElementById('editPatientPhone').value,
        dateOfBirth: document.getElementById('editPatientDOB').value || null,
        gender: document.getElementById('editPatientGender').value || null,
        diseases: document.getElementById('editPatientDiseases').value.split(',').map(d => d.trim()).filter(d => d)
      };

      await api.updateUser(patientId, basicData);

      // 2. Crear nuevo registro de historial clínico
      const clinicalData = this.collectClinicalData();

      if (Object.keys(clinicalData).length > 0) {
        await api.createClinicalRecord(patientId, clinicalData);
      }

      this.showMessage('✅ Paciente actualizado correctamente', 'success');
      document.querySelector('.modal').remove();
      this.showAdminSection('patients');

    } catch (error) {
      this.showMessage('Error guardando cambios: ' + error.message, 'error');
    }
  }

  collectClinicalData() {
    const data = {
      demographics: {},
      clinicalHistory: {},
      currentTreatment: {
        fame: [],
        biologics: [],
        supplements: []
      },
      diseaseActivity: {},
      adherenceEvaluation: {},
      professionalNotes: {}
    };

    // Demografía
    const weight = document.getElementById('clinicalWeight')?.value;
    const height = document.getElementById('clinicalHeight')?.value;
    if (weight) data.demographics.weight = parseFloat(weight);
    if (height) data.demographics.height = parseFloat(height);

    const profession = document.getElementById('clinicalProfession')?.value;
    if (profession) data.demographics.profession = profession;

    const employment = document.getElementById('clinicalEmployment')?.value;
    if (employment) data.demographics.employmentStatus = employment;

    // Historia Clínica
    const arDate = document.getElementById('clinicalARDate')?.value;
    if (arDate) data.clinicalHistory.arDiagnosisDate = arDate;

    const rf = document.getElementById('clinicalRF')?.value;
    if (rf) data.clinicalHistory.rheumatoidFactor = rf;

    const antiCCP = document.getElementById('clinicalAntiCCP')?.value;
    if (antiCCP) data.clinicalHistory.antiCCP = antiCCP;

    // Actividad de la enfermedad
    const tenderJoints = document.getElementById('activityTenderJoints')?.value;
    if (tenderJoints) data.diseaseActivity.tenderJointsCount = parseInt(tenderJoints);

    const swollenJoints = document.getElementById('activitySwollenJoints')?.value;
    if (swollenJoints) data.diseaseActivity.swollenJointsCount = parseInt(swollenJoints);

    const das28 = document.getElementById('activityDAS28')?.value;
    if (das28) {
      data.diseaseActivity.das28 = {
        score: parseFloat(das28),
        classification: this.classifyDAS28(parseFloat(das28))
      };
    }

    const vsg = document.getElementById('activityVSG')?.value;
    const crp = document.getElementById('activityCRP')?.value;
    if (vsg || crp) {
      data.diseaseActivity.labResults = {};
      if (vsg) data.diseaseActivity.labResults.vsg = parseFloat(vsg);
      if (crp) data.diseaseActivity.labResults.crp = parseFloat(crp);
      data.diseaseActivity.labResults.date = new Date();
    }

    // Adherencia
    const adherenceOverall = document.getElementById('adherenceOverall')?.value;
    if (adherenceOverall) data.adherenceEvaluation.overallAdherence = adherenceOverall;

    const adherencePerc = document.getElementById('adherencePercentage')?.value;
    if (adherencePerc) data.adherenceEvaluation.adherencePercentage = parseInt(adherencePerc);

    // Notas profesionales
    const notes = document.getElementById('professionalNotes')?.value;
    if (notes) data.professionalNotes.clinicalNotes = notes;

    return data;
  }

  classifyDAS28(score) {
    if (score < 2.6) return 'remision';
    if (score < 3.2) return 'baja';
    if (score < 5.1) return 'moderada';
    return 'alta';
  }

  async exportPatientData(patientId) {
    try {
      const data = await api.exportClinicalHistory(patientId, { format: 'json' });

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `historial_paciente_${patientId}_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      this.showMessage('✅ Datos exportados correctamente', 'success');
    } catch (error) {
      this.showMessage('Error exportando datos: ' + error.message, 'error');
    }
  }

  async viewHistoricalRecord(recordId) {
    // Implementar visualización de registro histórico individual
    this.showMessage('Visualización de registro histórico en desarrollo', 'info');
  }

  async compareRecords(recordId) {
    // Implementar comparación de registros
    this.showMessage('Comparación de registros en desarrollo', 'info');
  }

  // ===== SISTEMA DE CUESTIONARIOS PENDIENTES =====

  async checkPendingQuestionnaires() {
    try {
      const questionnaires = await api.getMyQuestionnaires();

      // Filtrar solo los que están pendientes (asignados pero no completados)
      const pending = questionnaires.filter(q => q.status === 'assigned' || q.status === 'in_progress');

      if (pending.length > 0) {
        // Hay cuestionarios pendientes, mostrar alerta
        this.showQuestionnaireAlert(pending);
        return true; // Indica que hay pendientes
      }

      return false; // No hay pendientes
    } catch (error) {
      logger.error('Error verificando cuestionarios pendientes:', error);
      return false; // En caso de error, continuar normal
    }
  }

  showQuestionnaireAlert(pendingQuestionnaires) {
    const container = document.getElementById('app');
    const firstQuestionnaire = pendingQuestionnaires[0];

    container.innerHTML = `
      <div class="questionnaire-alert-screen">
        <div class="questionnaire-alert-card">
          <div class="alert-icon">📋</div>

          <h1 class="alert-title">¡Tienes ${pendingQuestionnaires.length} cuestionario(s) pendiente(s)!</h1>

          <p class="alert-description">
            Tu equipo médico ha solicitado que completes el siguiente cuestionario para hacer un mejor seguimiento de tu tratamiento.
          </p>

          <div class="alert-questionnaire-info">
            <h3>${firstQuestionnaire.questionnaire?.title || 'Cuestionario'}</h3>
            <p style="color: var(--gray-600); margin-top: 0.5rem;">
              ${firstQuestionnaire.questionnaire?.description || 'Cuestionario de seguimiento'}
            </p>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 1rem; color: var(--gray-600);">
              <span>📝 ${firstQuestionnaire.questionnaire?.questions?.length || 0} preguntas</span>
              <span>•</span>
              <span>⏱️ Tiempo estimado: 5-10 minutos</span>
            </div>
          </div>

          <div class="alert-actions">
            <button class="btn btn-primary btn-large" onclick="app.startPendingQuestionnaire('${firstQuestionnaire._id}')">
              ✅ Completar Ahora
            </button>
            ${pendingQuestionnaires.length > 1 ? `
              <p style="margin-top: 1rem; font-size: 0.875rem; color: var(--gray-600);">
                Tienes ${pendingQuestionnaires.length - 1} cuestionario(s) más después de este
              </p>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  async startPendingQuestionnaire(responseId) {
    try {
      // Obtener el cuestionario completo
      const response = await api.startQuestionnaire(responseId);
      this.currentQuestionnaireResponse = response;

      // Mostrar cuestionario en página completa
      this.showQuestionnaireFullPage(response);

    } catch (error) {
      this.showMessage('Error cargando cuestionario: ' + error.message, 'error');
      // Si hay error, permitir acceso al dashboard
      this.showScreen('dashboard');
      this.startReminderChecker();
    }
  }

  showQuestionnaireFullPage(response) {
    const container = document.getElementById('app');
    const questionnaire = response.questionnaire;
    const questions = questionnaire.questions || [];

    container.innerHTML = `
      <div class="questionnaire-full-page">
        <div class="questionnaire-header">
          <div class="questionnaire-progress">
            <div class="progress-bar">
              <div class="progress-fill" id="questionnaireProgress" style="width: 0%"></div>
            </div>
            <span id="progressText">0 de ${questions.length} respondidas</span>
          </div>
        </div>

        <div class="questionnaire-container">
          <div class="questionnaire-title-section">
            <h1>${questionnaire.title}</h1>
            <p style="color: var(--gray-600); margin-top: 0.5rem;">
              ${questionnaire.description}
            </p>
          </div>

          <form id="questionnaireFullForm" class="questionnaire-form">
            ${questions.map((q, index) => this.renderQuestionField(q, index)).join('')}

            <div class="questionnaire-actions" style="margin-top: 2rem; padding-top: 2rem; border-top: 2px solid var(--gray-200);">
              <button type="submit" class="btn btn-primary btn-large">
                📤 Enviar Cuestionario
              </button>
              <p style="margin-top: 1rem; font-size: 0.875rem; color: var(--gray-600); text-align: center;">
                Por favor, revisa todas tus respuestas antes de enviar
              </p>
            </div>
          </form>
        </div>
      </div>
    `;

    // Event listeners para actualizar el progreso
    const form = document.getElementById('questionnaireFullForm');
    const inputs = form.querySelectorAll('input, select, textarea');

    inputs.forEach(input => {
      input.addEventListener('change', () => this.updateQuestionnaireProgress(questions.length));
    });

    // Submit del formulario
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.submitQuestionnaireResponse(response._id, questions);
    });
  }

  renderQuestionField(question, index) {
    const baseHTML = `
      <div class="question-item" data-question-index="${index}">
        <label class="question-label">
          <span class="question-number">${index + 1}.</span>
          ${question.question}
          ${question.required ? '<span style="color: var(--danger);">*</span>' : ''}
        </label>
    `;

    let inputHTML = '';

    switch(question.type) {
      case 'text':
        inputHTML = `<input type="text" name="question_${index}" class="form-input" ${question.required ? 'required' : ''} placeholder="Tu respuesta...">`;
        break;

      case 'number':
        inputHTML = `<input type="number" name="question_${index}" class="form-input" ${question.required ? 'required' : ''} placeholder="Número...">`;
        break;

      case 'multiple':
        inputHTML = `
          <select name="question_${index}" class="form-select" ${question.required ? 'required' : ''}>
            <option value="">Selecciona una opción...</option>
            ${(question.options || []).map(opt => `
              <option value="${opt}">${opt}</option>
            `).join('')}
          </select>
        `;
        break;

      case 'scale':
        const min = question.scaleMin || 0;
        const max = question.scaleMax || 10;
        inputHTML = `
          <div class="scale-input">
            <input type="range" name="question_${index}" class="form-range"
              min="${min}" max="${max}" value="${min}"
              oninput="document.getElementById('scale_value_${index}').textContent = this.value"
              ${question.required ? 'required' : ''}>
            <div class="scale-labels">
              <span>${min}</span>
              <span id="scale_value_${index}">${min}</span>
              <span>${max}</span>
            </div>
          </div>
        `;
        break;

      case 'yesno':
        inputHTML = `
          <div class="radio-group">
            <label class="radio-label">
              <input type="radio" name="question_${index}" value="Sí" ${question.required ? 'required' : ''}>
              <span>Sí</span>
            </label>
            <label class="radio-label">
              <input type="radio" name="question_${index}" value="No" ${question.required ? 'required' : ''}>
              <span>No</span>
            </label>
          </div>
        `;
        break;

      case 'date':
        inputHTML = `<input type="date" name="question_${index}" class="form-input" ${question.required ? 'required' : ''}>`;
        break;

      default:
        inputHTML = `<textarea name="question_${index}" class="form-textarea" rows="3" ${question.required ? 'required' : ''} placeholder="Tu respuesta..."></textarea>`;
    }

    return baseHTML + inputHTML + '</div>';
  }

  updateQuestionnaireProgress(totalQuestions) {
    const form = document.getElementById('questionnaireFullForm');
    const questions = form.querySelectorAll('.question-item');
    let answered = 0;

    questions.forEach(questionDiv => {
      const inputs = questionDiv.querySelectorAll('input, select, textarea');
      let hasValue = false;

      inputs.forEach(input => {
        if (input.type === 'radio') {
          const radioGroup = form.querySelectorAll(`input[name="${input.name}"]`);
          hasValue = Array.from(radioGroup).some(r => r.checked);
        } else {
          hasValue = input.value && input.value.trim() !== '';
        }
      });

      if (hasValue) answered++;
    });

    const percentage = (answered / totalQuestions) * 100;
    document.getElementById('questionnaireProgress').style.width = `${percentage}%`;
    document.getElementById('progressText').textContent = `${answered} de ${totalQuestions} respondidas`;
  }

  async submitQuestionnaireResponse(responseId, questions) {
    const form = document.getElementById('questionnaireFullForm');
    const responses = [];

    questions.forEach((q, index) => {
      const input = form.querySelector(`[name="question_${index}"]`);
      let answer = '';

      if (input.type === 'radio') {
        const checked = form.querySelector(`[name="question_${index}"]:checked`);
        answer = checked ? checked.value : '';
      } else {
        answer = input.value;
      }

      responses.push({
        question: q.question,
        answer: answer,
        questionType: q.type
      });
    });

    try {
      await api.submitQuestionnaire(responseId, responses);

      // Mostrar mensaje de éxito
      this.showSuccessScreen();

      // Después de 2 segundos, verificar si hay más cuestionarios pendientes
      setTimeout(async () => {
        const hasPending = await this.checkPendingQuestionnaires();
        if (!hasPending) {
          // No hay más pendientes, ir al dashboard
          this.showScreen('dashboard');
          this.startReminderChecker();
        }
      }, 2000);

    } catch (error) {
      this.showMessage('Error enviando cuestionario: ' + error.message, 'error');
    }
  }

  showSuccessScreen() {
    const container = document.getElementById('app');
    container.innerHTML = `
      <div class="questionnaire-alert-screen">
        <div class="questionnaire-alert-card">
          <div class="alert-icon" style="background: var(--success);">✅</div>
          <h1 class="alert-title">¡Cuestionario Completado!</h1>
          <p class="alert-description">
            Gracias por completar el cuestionario. Tus respuestas han sido enviadas correctamente y ayudarán a tu equipo médico a realizar un mejor seguimiento de tu tratamiento.
          </p>
          <div style="text-align: center; margin-top: 1.5rem; color: var(--gray-600);">
            <p>Redirigiendo al dashboard...</p>
          </div>
        </div>
      </div>
    `;
  }

  // ===== DARK MODE =====

  toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');

    // Persistir preferencia
    localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');

    // Cambiar icono
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
      themeBtn.textContent = isDark ? '☀️' : '🌙';
    }
  }

  loadDarkModePreference() {
    const darkMode = localStorage.getItem('darkMode');
    if (darkMode === 'enabled') {
      document.body.classList.add('dark-mode');
      const themeBtn = document.getElementById('themeToggle');
      if (themeBtn) themeBtn.textContent = '☀️';
    }
  }

  // ===== SISTEMA DE NOTIFICACIONES =====

  notifications = [];

  updateNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    const unreadCount = this.notifications.filter(n => !n.read).length;

    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  }

  async loadNotifications() {
    // Cargar notificaciones desde las consultas pendientes y otros eventos
    try {
      if (this.user.role === 'admin') {
        const [consultations, questionnaires] = await Promise.all([
          api.getAllConsultations().catch(() => []),
          api.getAllQuestionnaires().catch(() => [])
        ]);

        this.notifications = [];

        // Notificaciones de consultas pendientes
        const pendingConsults = consultations.filter(c => c.status === 'pending');
        pendingConsults.forEach(c => {
          this.notifications.push({
            id: `consult-${c._id}`,
            title: 'Nueva consulta',
            message: `Consulta de paciente: ${c.message?.substring(0, 50)}...`,
            time: this.getTimeAgo(c.createdAt),
            read: false,
            action: () => this.showAdminSection('consultations')
          });
        });

        // Notificaciones de cuestionarios sin responder
        const activeQuest = questionnaires.filter(q => q.status === 'active');
        if (activeQuest.length > 0) {
          this.notifications.push({
            id: 'quest-active',
            title: 'Cuestionarios activos',
            message: `Tienes ${activeQuest.length} cuestionario(s) activo(s)`,
            time: 'Ahora',
            read: false,
            action: () => this.showAdminSection('questionnaires')
          });
        }
      }

      this.updateNotificationBadge();
    } catch (error) {
      logger.error('Error cargando notificaciones:', error);
    }
  }

  toggleNotifications() {
    // Crear panel si no existe
    let panel = document.getElementById('notificationsPanel');

    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'notificationsPanel';
      panel.className = 'notifications-panel';
      panel.innerHTML = `
        <div class="notifications-header">
          <h3>Notificaciones</h3>
          <button class="mark-all-read" onclick="app.markAllAsRead()">Marcar todas como leídas</button>
        </div>
        <div class="notifications-list" id="notificationsList">
          ${this.renderNotifications()}
        </div>
      `;
      document.body.appendChild(panel);
    }

    panel.classList.toggle('active');

    // Cerrar al hacer click fuera
    if (panel.classList.contains('active')) {
      setTimeout(() => {
        document.addEventListener('click', function closePanel(e) {
          if (!panel.contains(e.target) && !document.getElementById('notificationBtn').contains(e.target)) {
            panel.classList.remove('active');
            document.removeEventListener('click', closePanel);
          }
        });
      }, 100);
    }
  }

  renderNotifications() {
    if (this.notifications.length === 0) {
      return '<div style="padding: 2rem; text-align: center; color: var(--gray-500);">No hay notificaciones</div>';
    }

    return this.notifications.map(n => `
      <div class="notification-item ${n.read ? '' : 'unread'}" onclick="app.handleNotificationClick('${n.id}')">
        <div class="notification-title">${n.title}</div>
        <div class="notification-message">${n.message}</div>
        <div class="notification-time">${n.time}</div>
      </div>
    `).join('');
  }

  handleNotificationClick(notificationId) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      this.updateNotificationBadge();

      // Ejecutar acción
      if (notification.action) {
        notification.action();
      }

      // Cerrar panel
      document.getElementById('notificationsPanel')?.classList.remove('active');
    }
  }

  markAllAsRead() {
    this.notifications.forEach(n => n.read = true);
    this.updateNotificationBadge();

    const list = document.getElementById('notificationsList');
    if (list) {
      list.innerHTML = this.renderNotifications();
    }
  }

  getTimeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);

    if (seconds < 60) return 'Ahora';
    if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
    if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)} h`;
    return `Hace ${Math.floor(seconds / 86400)} días`;
  }

  // ===== EXPORTACIÓN DE DATOS =====

  async exportToCSV(type) {
    try {
      let data = [];
      let headers = [];
      let filename = '';

      switch(type) {
        case 'patients':
          const users = await api.getUsers();
          headers = ['Nombre', 'Email', 'Teléfono', 'Adherencia %', 'Enfermedades'];
          data = users.map(u => [
            u.name,
            u.email,
            u.phone || '',
            u.adherenceRate || 0,
            (u.diseases || []).join('; ')
          ]);
          filename = 'pacientes';
          break;

        case 'consultations':
          const consultations = await api.getAllConsultations();
          headers = ['Fecha', 'Paciente', 'Mensaje', 'Estado', 'Respuesta'];
          data = consultations.map(c => [
            new Date(c.createdAt).toLocaleDateString('es-ES'),
            c.patient?.name || 'Desconocido',
            c.message,
            c.status,
            c.response || ''
          ]);
          filename = 'consultas';
          break;

        case 'questionnaires':
          const questionnaires = await api.getAllQuestionnaires();
          headers = ['Título', 'Tipo', 'Estado', 'Preguntas', 'Creado'];
          data = questionnaires.map(q => [
            q.title,
            q.type,
            q.status,
            q.questions?.length || 0,
            new Date(q.createdAt).toLocaleDateString('es-ES')
          ]);
          filename = 'cuestionarios';
          break;
      }

      this.downloadCSV(headers, data, filename);
      this.showMessage('✅ Datos exportados correctamente', 'success');

    } catch (error) {
      this.showMessage('Error exportando datos: ' + error.message, 'error');
    }
  }

  downloadCSV(headers, rows, filename) {
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ===== ACCIONES RÁPIDAS =====

  quickActionLowAdherence() {
    this.showAdminSection('patients');
    // Filtrar por baja adherencia (implementar filtro después)
    this.showMessage('Mostrando pacientes con baja adherencia...', 'info');
  }

  quickActionPendingConsultations() {
    this.showAdminSection('consultations');
  }

  quickActionExportPatients() {
    this.exportToCSV('patients');
  }

  // ===== BÚSQUEDA GLOBAL =====

  searchTimeout = null;

  initGlobalSearch() {
    const searchInput = document.getElementById('globalSearch');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
      clearTimeout(this.searchTimeout);
      const query = e.target.value.trim();

      if (query.length === 0) {
        this.hideSearchResults();
        return;
      }

      // Debounce search
      this.searchTimeout = setTimeout(() => {
        this.performGlobalSearch(query);
      }, 300);
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container') && !e.target.closest('.search-results')) {
        this.hideSearchResults();
      }
    });
  }

  async performGlobalSearch(query) {
    try {
      const users = await api.getUsers();
      const lowerQuery = query.toLowerCase();

      // Search in patients
      const results = users.filter(user => {
        return user.name.toLowerCase().includes(lowerQuery) ||
               user.email.toLowerCase().includes(lowerQuery) ||
               (user.phone && user.phone.includes(query)) ||
               (user.diseases && user.diseases.some(d => d.toLowerCase().includes(lowerQuery))) ||
               (user.medications && user.medications.some(m => m.name && m.name.toLowerCase().includes(lowerQuery)));
      });

      this.showSearchResults(results, query);
    } catch (error) {
      logger.error('Error en búsqueda global:', error);
    }
  }

  showSearchResults(results, query) {
    // Remove existing results
    this.hideSearchResults();

    const searchContainer = document.querySelector('.search-container');
    if (!searchContainer) return;

    const resultsDiv = document.createElement('div');
    resultsDiv.className = 'search-results';
    resultsDiv.id = 'globalSearchResults';

    if (results.length === 0) {
      resultsDiv.innerHTML = `
        <div class="search-result-item" style="text-align: center; color: var(--gray-500);">
          No se encontraron resultados para "${query}"
        </div>
      `;
    } else {
      resultsDiv.innerHTML = `
        <div class="search-results-header">
          <strong>Pacientes (${results.length})</strong>
        </div>
        ${results.slice(0, 10).map(user => `
          <div class="search-result-item" onclick="app.viewPatientFromSearch('${user._id}')">
            <div class="search-result-icon">👤</div>
            <div class="search-result-content">
              <div class="search-result-title">${this.highlightMatch(user.name, query)}</div>
              <div class="search-result-subtitle">
                ${user.email} ${user.diseases && user.diseases.length > 0 ? '· ' + user.diseases.join(', ') : ''}
              </div>
            </div>
            <div class="search-result-badge ${user.adherenceRate >= 80 ? 'badge-success' : user.adherenceRate >= 60 ? 'badge-warning' : 'badge-danger'}">
              ${user.adherenceRate || 0}%
            </div>
          </div>
        `).join('')}
        ${results.length > 10 ? `<div class="search-results-footer">+ ${results.length - 10} más resultados</div>` : ''}
      `;
    }

    searchContainer.appendChild(resultsDiv);
  }

  hideSearchResults() {
    const existingResults = document.getElementById('globalSearchResults');
    if (existingResults) {
      existingResults.remove();
    }
  }

  highlightMatch(text, query) {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark style="background: #fef08a; padding: 0 2px; border-radius: 2px;">$1</mark>');
  }

  viewPatientFromSearch(patientId) {
    this.hideSearchResults();
    document.getElementById('globalSearch').value = '';
    this.viewPatientDetail(patientId);
  }

  // ===== ATAJOS DE TECLADO =====

  initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Skip if typing in input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        // Except for ESC and Enter
        if (e.key !== 'Escape' && e.key !== 'Enter') {
          return;
        }
      }

      // ESC: Cerrar modales y paneles
      if (e.key === 'Escape') {
        // Close modals
        const modal = document.querySelector('.modal.active');
        if (modal) {
          modal.remove();
          return;
        }

        // Close notifications
        const notifPanel = document.querySelector('.notifications-panel.active');
        if (notifPanel) {
          this.toggleNotifications();
          return;
        }

        // Close search results
        this.hideSearchResults();
        return;
      }

      // Only process shortcuts with Ctrl/Cmd
      if (!e.ctrlKey && !e.metaKey) return;

      // Prevent browser defaults for our shortcuts
      const shortcuts = ['p', 'm', 'c', 'q', 's', 'd', 'e', 'k'];
      if (shortcuts.includes(e.key.toLowerCase())) {
        e.preventDefault();
      }

      // Shortcuts solo para admin
      if (this.user && this.user.role === 'admin') {
        switch(e.key.toLowerCase()) {
          case 'p': // Ctrl+P: Pacientes
            this.goBack();
            setTimeout(() => this.showAdminSection('patients'), 100);
            break;

          case 'm': // Ctrl+M: Medicamentos
            this.goBack();
            setTimeout(() => this.showAdminSection('medications'), 100);
            break;

          case 'c': // Ctrl+C: Consultas (evitar conflicto con copy, solo si no hay selección)
            if (window.getSelection().toString().length === 0) {
              this.goBack();
              setTimeout(() => this.showAdminSection('consultations'), 100);
            }
            break;

          case 'q': // Ctrl+Q: Cuestionarios
            this.goBack();
            setTimeout(() => this.showAdminSection('questionnaires'), 100);
            break;

          case 's': // Ctrl+S: Focus en búsqueda
            const searchInput = document.getElementById('globalSearch');
            if (searchInput) {
              searchInput.focus();
              searchInput.select();
            }
            break;

          case 'd': // Ctrl+D: Toggle Dark Mode
            this.toggleDarkMode();
            break;

          case 'e': // Ctrl+E: Exportar pacientes
            this.exportToCSV('patients');
            break;

          case 'k': // Ctrl+K: Mostrar atajos (help)
            this.showKeyboardShortcutsHelp();
            break;
        }
      }

      // Shortcuts para todos los usuarios
      switch(e.key.toLowerCase()) {
        case 'd':
          if (!this.user || this.user.role !== 'admin') {
            this.toggleDarkMode();
          }
          break;

        case 'k':
          if (!this.user || this.user.role !== 'admin') {
            this.showKeyboardShortcutsHelp();
          }
          break;
      }
    });
  }

  showKeyboardShortcutsHelp() {
    const modal = document.createElement('div');
    modal.className = 'modal active';

    const adminShortcuts = this.user && this.user.role === 'admin' ? `
      <div class="shortcut-category">
        <h3>⚡ Navegación</h3>
        <div class="shortcut-item">
          <kbd>Ctrl</kbd> + <kbd>P</kbd>
          <span>Gestionar Pacientes</span>
        </div>
        <div class="shortcut-item">
          <kbd>Ctrl</kbd> + <kbd>M</kbd>
          <span>Gestionar Medicamentos</span>
        </div>
        <div class="shortcut-item">
          <kbd>Ctrl</kbd> + <kbd>C</kbd>
          <span>Ver Consultas</span>
        </div>
        <div class="shortcut-item">
          <kbd>Ctrl</kbd> + <kbd>Q</kbd>
          <span>Cuestionarios PROMS</span>
        </div>
      </div>

      <div class="shortcut-category">
        <h3>🔧 Acciones</h3>
        <div class="shortcut-item">
          <kbd>Ctrl</kbd> + <kbd>S</kbd>
          <span>Focus en Búsqueda</span>
        </div>
        <div class="shortcut-item">
          <kbd>Ctrl</kbd> + <kbd>E</kbd>
          <span>Exportar Pacientes</span>
        </div>
      </div>
    ` : '';

    modal.innerHTML = `
      <div class="modal-content" style="max-width: 600px;">
        <div class="modal-header">
          <h2>⌨️ Atajos de Teclado</h2>
          <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
        </div>

        <div class="shortcuts-help">
          ${adminShortcuts}

          <div class="shortcut-category">
            <h3>🎨 General</h3>
            <div class="shortcut-item">
              <kbd>Ctrl</kbd> + <kbd>D</kbd>
              <span>Toggle Modo Oscuro</span>
            </div>
            <div class="shortcut-item">
              <kbd>Ctrl</kbd> + <kbd>K</kbd>
              <span>Mostrar Atajos</span>
            </div>
            <div class="shortcut-item">
              <kbd>Esc</kbd>
              <span>Cerrar Modales/Paneles</span>
            </div>
          </div>

          <p style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--gray-200); color: var(--gray-600); font-size: 0.875rem; text-align: center;">
            💡 En Mac, usa <kbd>⌘ Cmd</kbd> en lugar de <kbd>Ctrl</kbd>
          </p>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  // ===== INICIALIZACIÓN DE MEJORAS =====

  initEnhancements() {
    // Cargar preferencia de dark mode
    this.loadDarkModePreference();

    // Inicializar atajos de teclado
    this.initKeyboardShortcuts();

    // Mostrar elementos del header si es admin
    if (this.user && this.user.role === 'admin') {
      const elements = ['globalSearchContainer', 'notificationBtn', 'themeToggle'];
      elements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('hidden');
      });

      // Inicializar búsqueda global
      this.initGlobalSearch();

      // Cargar notificaciones
      this.loadNotifications();

      // Actualizar notificaciones cada 5 minutos
      setInterval(() => this.loadNotifications(), 300000);
    } else if (this.user) {
      // Para pacientes, solo mostrar el toggle de tema
      const themeToggle = document.getElementById('themeToggle');
      if (themeToggle) themeToggle.classList.remove('hidden');
    }
  }
}


const app = new FarmaFollowApp();
document.addEventListener('DOMContentLoaded', () => app.init());