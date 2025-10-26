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
        this.currentScreen === 'my-consultations') {
      this.showScreen('dashboard');
    } else {
      this.showScreen('dashboard');
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

        <div class="option-card" onclick="app.showFAQ()">
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

  showFAQ() {
    const med = this.currentMedication;
    if (!med) return;

    const faqs = med.faqs || [
      { question: "¿Puedo tomar este medicamento con comida?", answer: "Sí, se recomienda tomar con alimentos para reducir efectos secundarios gastrointestinales.", tag: "💊 Administración" },
      { question: "¿Qué hago si olvido una dosis?", answer: "Si olvidas una dosis, tómala tan pronto como lo recuerdes. Si ya es casi la hora de la siguiente dosis, sáltala y continúa con tu horario regular.", tag: "⏰ Dosis olvidada" },
      { question: "¿Cuáles son los efectos secundarios más comunes?", answer: "Los efectos secundarios más comunes incluyen enrojecimiento facial, malestar estomacal y diarrea. Estos síntomas suelen mejorar con el tiempo.", tag: "⚕️ Efectos secundarios" },
      { question: "¿Puedo beber alcohol mientras tomo este medicamento?", answer: "El consumo moderado de alcohol generalmente es seguro, pero puede aumentar algunos efectos secundarios. Consulta con tu médico.", tag: "🍷 Interacciones" },
      { question: "¿Cuándo debo contactar al farmacéutico?", answer: "Contacta inmediatamente si experimentas: reacciones alérgicas graves, infecciones recurrentes, problemas hepáticos o cualquier síntoma que te preocupe.", tag: "🚨 Urgente" }
    ];

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 700px;">
        <div class="modal-header">
          <h2>❓ Preguntas Frecuentes</h2>
          <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
        </div>
        
        <div class="faq-container">
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
    document.body.appendChild(modal);
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
            <div class="month-name">Octubre 2025</div>
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

  generateCalendarDays() {
    const today = 25;
    let html = '';
    
    // Previous month days
    html += `<div class="day-cell other-month"><div class="day-number">29</div></div>`;
    html += `<div class="day-cell other-month"><div class="day-number">30</div></div>`;
    
    // Current month days with reminders
    for (let i = 1; i <= today; i++) {
      const classes = i === today ? 'day-cell today' : 'day-cell has-reminder';
      html += `<div class="${classes}"><div class="day-number">${i}</div></div>`;
    }
    
    // Future days
    for (let i = today + 1; i <= 31; i++) {
      html += `<div class="day-cell"><div class="day-number">${i}</div></div>`;
    }
    
    // Next month days
    html += `<div class="day-cell other-month"><div class="day-number">1</div></div>`;
    html += `<div class="day-cell other-month"><div class="day-number">2</div></div>`;
    
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
          <div class="chat-message pharmacist">
            <div class="chat-avatar">👨‍⚕️</div>
            <div>
              <div class="chat-bubble">
                ¡Hola! Soy tu farmacéutico. ¿En qué puedo ayudarte hoy con tu tratamiento?
              </div>
              <div class="chat-time">Ayer, 10:30 AM</div>
            </div>
          </div>

          <div class="chat-message user">
            <div class="chat-avatar">👤</div>
            <div>
              <div class="chat-bubble">
                Hola doctor, he notado algo de enrojecimiento en la cara después de tomar la medicación. ¿Es normal?
              </div>
              <div class="chat-time">Ayer, 10:32 AM</div>
            </div>
          </div>

          <div class="chat-message pharmacist">
            <div class="chat-avatar">👨‍⚕️</div>
            <div>
              <div class="chat-bubble">
                Sí, el enrojecimiento facial es un efecto secundario común. Suele mejorar con el tiempo. Te recomiendo:<br>
                • Tomar la medicación con alimentos<br>
                • Evitar bebidas calientes cerca de la toma<br>
                • El síntoma suele durar 30-60 minutos
              </div>
              <div class="chat-time">Ayer, 3:15 PM</div>
            </div>
          </div>

          <div class="chat-message user">
            <div class="chat-avatar">👤</div>
            <div>
              <div class="chat-bubble">
                Perfecto, muchas gracias por la información. Me quedo más tranquilo. 😊
              </div>
              <div class="chat-time">Ayer, 5:20 PM</div>
            </div>
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
      const [users, medications, consultations] = await Promise.all([
        api.getUsers(),
        api.getMedications(),
        api.getAllConsultations()
      ]);

      this.users = users;
      this.medications = medications;
      this.consultations = consultations;

      const pendingConsultations = consultations.filter(c => c.status === 'pending').length;
      const avgAdherence = users.length > 0 
        ? Math.round(users.reduce((sum, u) => sum + (u.adherenceRate || 0), 0) / users.length)
        : 0;

      container.innerHTML = `
        <div class="admin-header">
          <h1 class="admin-title">Panel de Administración</h1>
          <button class="btn btn-outline" onclick="app.logout()">
            Cerrar Sesión
          </button>
        </div>

        <div class="admin-stats">
          <div class="stat-card">
            <div class="stat-label">Total Pacientes</div>
            <div class="stat-value">${users.length}</div>
          </div>
          <div class="stat-card" style="background: linear-gradient(135deg, var(--success) 0%, #059669 100%);">
            <div class="stat-label">Medicamentos</div>
            <div class="stat-value">${medications.length}</div>
          </div>
          <div class="stat-card" style="background: linear-gradient(135deg, var(--warning) 0%, #d97706 100%);">
            <div class="stat-label">Consultas Pendientes</div>
            <div class="stat-value">${pendingConsultations}</div>
          </div>
          <div class="stat-card" style="background: linear-gradient(135deg, var(--cyan) 0%, var(--cyan-dark) 100%);">
            <div class="stat-label">Adherencia Media</div>
            <div class="stat-value">${avgAdherence}%</div>
          </div>
        </div>

        <div style="margin-top: 2rem;">
          <button class="btn btn-primary" onclick="app.showAdminSection('patients')" style="margin-right: 1rem;">
            👥 Gestionar Pacientes
          </button>
          <button class="btn btn-success" onclick="app.showAdminSection('medications')" style="margin-right: 1rem;">
            💊 Gestionar Medicamentos
          </button>
          <button class="btn btn-secondary" onclick="app.showAdminSection('consultations')">
            💬 Ver Consultas
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
    }
  }

  async renderPatients(container) {
    const users = await api.getUsers();
    
    container.innerHTML = `
      <div style="background: white; border-radius: 1rem; padding: 1.5rem; box-shadow: var(--shadow);">
        <h2>Gestión de Pacientes</h2>
        <div class="table-container" style="margin-top: 1.5rem;">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Medicamento</th>
                <th>Adherencia</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${users.map(user => `
                <tr>
                  <td>${user.name}</td>
                  <td>${user.email}</td>
                  <td>${user.medication?.name || '-'}</td>
                  <td>
                    <span class="badge ${user.adherenceRate >= 80 ? 'badge-success' : user.adherenceRate >= 60 ? 'badge-warning' : 'badge-danger'}">
                      ${user.adherenceRate || 0}%
                    </span>
                  </td>
                  <td>
                    <button class="btn btn-sm btn-outline" onclick="app.viewUserDetail('${user._id}')">
                      Ver
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

  async renderMedications(container) {
    const medications = await api.getMedications();
    
    container.innerHTML = `
      <div style="background: white; border-radius: 1rem; padding: 1.5rem; box-shadow: var(--shadow);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <h2>Gestión de Medicamentos</h2>
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
                <th>Pacientes</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${medications.map(med => `
                <tr>
                  <td><strong>${med.name}</strong></td>
                  <td>${med.description}</td>
                  <td>${med.assignedPatients || 0}</td>
                  <td>
                    <button class="btn btn-sm btn-outline" onclick="app.editMedication('${med._id}')">
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
      </div>
    `;
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