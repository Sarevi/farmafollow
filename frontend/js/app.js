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
          this.showScreen('dashboard');
          this.startReminderChecker();
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
        this.showScreen('dashboard');
        this.startReminderChecker();
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

      // Calcular pacientes con baja adherencia
      const lowAdherenceCount = users.filter(u => (u.adherenceRate || 0) < 70).length;

      container.innerHTML = `
        <div class="admin-header">
          <h1 class="admin-title">📊 Panel de Administración</h1>
        </div>

        <div class="admin-stats">
          <div class="stat-card">
            <div class="stat-icon" style="font-size: 2rem; margin-bottom: 0.5rem;">👥</div>
            <div class="stat-value">${users.length}</div>
            <div class="stat-label">Total Pacientes</div>
          </div>
          <div class="stat-card" style="background: linear-gradient(135deg, var(--success) 0%, #059669 100%);">
            <div class="stat-icon" style="font-size: 2rem; margin-bottom: 0.5rem;">💊</div>
            <div class="stat-value">${activeMedications}</div>
            <div class="stat-label">Medicamentos Activos</div>
          </div>
          <div class="stat-card" style="background: linear-gradient(135deg, var(--warning) 0%, #d97706 100%);">
            <div class="stat-icon" style="font-size: 2rem; margin-bottom: 0.5rem;">💬</div>
            <div class="stat-value">${pendingConsultations}</div>
            <div class="stat-label">Consultas Pendientes</div>
          </div>
          <div class="stat-card" style="background: linear-gradient(135deg, var(--cyan) 0%, var(--cyan-dark) 100%);">
            <div class="stat-icon" style="font-size: 2rem; margin-bottom: 0.5rem;">📈</div>
            <div class="stat-value">${avgAdherence}%</div>
            <div class="stat-label">Adherencia Media</div>
          </div>
          <div class="stat-card" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);">
            <div class="stat-icon" style="font-size: 2rem; margin-bottom: 0.5rem;">📋</div>
            <div class="stat-value">${activeQuestionnaires}</div>
            <div class="stat-label">Cuestionarios Activos</div>
          </div>
          <div class="stat-card" style="background: linear-gradient(135deg, var(--danger) 0%, #dc2626 100%);">
            <div class="stat-icon" style="font-size: 2rem; margin-bottom: 0.5rem;">⚠️</div>
            <div class="stat-value">${lowAdherenceCount}</div>
            <div class="stat-label">Adherencia Baja</div>
          </div>
        </div>

        <div style="margin-top: 2rem; display: flex; flex-wrap: wrap; gap: 1rem;">
          <button class="btn btn-primary" onclick="app.showAdminSection('patients')">
            👥 Gestionar Pacientes
          </button>
          <button class="btn btn-success" onclick="app.showAdminSection('medications')">
            💊 Gestionar Medicamentos
          </button>
          <button class="btn btn-secondary" onclick="app.showAdminSection('consultations')">
            💬 Ver Consultas
          </button>
          <button class="btn" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white;" onclick="app.showAdminSection('questionnaires')">
            📋 Cuestionarios PROMS
          </button>
        </div>

        <div id="adminSectionContainer" style="margin-top: 2rem;"></div>
      `;

    } catch (error) {
      logger.error('Error cargando admin dashboard:', error);
      container.innerHTML = '<div class="error">Error cargando panel de administración</div>';
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
    // TODO: Implementar modal de edición similar al de creación
    this.showMessage('Funcionalidad de edición disponible próximamente', 'info');
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
    const patients = await api.getUsers();

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>📤 Asignar Cuestionario</h2>
          <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
        </div>

        <form id="assignQuestionnaireForm">
          <div class="form-group">
            <label class="form-label">Selecciona Pacientes</label>
            <select id="selectedPatients" class="form-select" multiple style="min-height: 200px;" required>
              ${patients.map(p => `
                <option value="${p._id}">${p.name} - ${p.email}</option>
              `).join('')}
            </select>
            <small style="color: var(--gray-600);">Mantén Ctrl (Cmd en Mac) para seleccionar múltiples</small>
          </div>

          <div class="modal-actions">
            <button type="submit" class="btn btn-success">Asignar</button>
            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('assignQuestionnaireForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const select = document.getElementById('selectedPatients');
      const patientIds = Array.from(select.selectedOptions).map(opt => opt.value);

      if (patientIds.length === 0) {
        this.showMessage('Selecciona al menos un paciente', 'warning');
        return;
      }

      try {
        const result = await api.assignQuestionnaire(questionnaireId, patientIds);
        this.showMessage(`✅ Cuestionario asignado a ${result.assigned} paciente(s)`, 'success');
        document.querySelectorAll('.modal').forEach(m => m.remove());
        this.showAdminSection('questionnaires');
      } catch (error) {
        this.showMessage('Error asignando cuestionario: ' + error.message, 'error');
      }
    });
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
}

const app = new FarmaFollowApp();
document.addEventListener('DOMContentLoaded', () => app.init());