class FarmaFollowApp {
  constructor() {
    this.currentScreen = 'login';
    this.currentMedication = null;
    this.medications = [];
    this.reminders = [];
    this.consultations = [];
    this.users = [];
    this.activeReminder = null;
    this.faqCount = 0;
  }

  async init() {
    logger.log('Iniciando FarmaFollow...');
    
    // Inicializar notificaciones
    await notifications.init();
    
    // Verificar autenticación
    if (auth.isLoggedIn()) {
      if (auth.isAdmin()) {
        await this.showAdminDashboard();
      } else {
        await this.showPatientDashboard();
      }
    } else {
      this.showLoginScreen();
    }
    
    // Cargar recordatorios si está autenticado
    if (auth.isLoggedIn() && !auth.isAdmin()) {
      await notifications.loadReminders();
    }
  }

  // ===== NAVEGACIÓN =====
  
  showScreen(screenName) {
    this.currentScreen = screenName;
    this.updateHeader();
    this.render();
  }

  showLoginScreen() {
    this.showScreen('login');
  }

  updateHeader() {
    const title = document.getElementById('headerTitle');
    const backBtn = document.querySelector('.back-btn');
    
    const titles = {
      'login': 'FarmaFollow',
      'dashboard': auth.getUser() ? `Hola, ${auth.getUser().name.split(' ')[0]} 👋` : 'Dashboard',
      'admin': 'Panel Administrador',
      'medication': 'Medicamento',
      'video': 'Vídeo de Administración',
      'faq': 'FAQ y Consejos',
      'reminder': 'Recordatorios',
      'consult': 'Consulta Farmacéutica'
    };
    
    title.textContent = titles[this.currentScreen] || 'FarmaFollow';
    
    const mainScreens = ['login', 'dashboard', 'admin'];
    if (!mainScreens.includes(this.currentScreen)) {
      backBtn.classList.remove('hidden');
    } else {
      backBtn.classList.add('hidden');
    }
  }

  goBack() {
    const navigation = {
      'medication': 'dashboard',
      'video': 'medication',
      'faq': 'medication',
      'reminder': 'medication',
      'consult': 'medication'
    };
    
    const nextScreen = navigation[this.currentScreen] || 'dashboard';
    this.showScreen(nextScreen);
  }

  render() {
    const container = document.getElementById('app-content');
    
    switch(this.currentScreen) {
      case 'login':
        container.innerHTML = this.renderLoginScreen();
        break;
      case 'dashboard':
        this.renderDashboard(container);
        break;
      case 'admin':
        this.renderAdminDashboard(container);
        break;
      case 'medication':
        this.renderMedicationDetail(container);
        break;
      case 'video':
        this.renderVideoScreen(container);
        break;
      case 'faq':
        this.renderFAQScreen(container);
        break;
      case 'reminder':
        this.renderReminderScreen(container);
        break;
      case 'consult':
        this.renderConsultScreen(container);
        break;
    }
  }

  // ===== PANTALLA DE LOGIN =====
  
  renderLoginScreen() {
    return `
      <div class="login-form">
        <div id="loginMessage"></div>
        <div class="form-group">
          <label for="email">Email:</label>
          <input type="email" id="email" placeholder="tu@email.com">
        </div>
        <div class="form-group">
          <label for="password">Contraseña:</label>
          <input type="password" id="password" placeholder="Tu contraseña">
        </div>
        <div class="form-group hidden" id="nameGroup">
          <label for="name">Nombre completo:</label>
          <input type="text" id="name" placeholder="Tu nombre completo">
        </div>
        <button class="btn" onclick="app.handleLogin()">Iniciar Sesión</button>
        <button class="btn btn-secondary" onclick="app.toggleRegister()">
          ¿Primera vez? Registrarse
        </button>
      </div>
    `;
  }

  async handleLogin() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    
    if (!email || !password) {
      this.showMessage('Por favor completa todos los campos', 'error');
      return;
    }
    
    try {
      const isRegistering = !document.getElementById('nameGroup').classList.contains('hidden');
      
      if (isRegistering) {
        const name = document.getElementById('name').value.trim();
        if (!name) {
          this.showMessage('Por favor ingresa tu nombre completo', 'error');
          return;
        }
        
        await auth.register(name, email, password);
        this.showMessage('¡Cuenta creada exitosamente!', 'success');
      } else {
        await auth.login(email, password);
        this.showMessage('¡Bienvenido de vuelta!', 'success');
      }
      
      // Redirigir según el rol
      setTimeout(async () => {
        if (auth.isAdmin()) {
          await this.showAdminDashboard();
        } else {
          await this.showPatientDashboard();
        }
      }, 1000);
      
    } catch (error) {
      this.showMessage(error.message || 'Error al iniciar sesión', 'error');
    }
  }

  toggleRegister() {
    const nameGroup = document.getElementById('nameGroup');
    const btn = document.querySelector('.btn-secondary');
    const submitBtn = document.querySelector('.btn');
    
    if (nameGroup.classList.contains('hidden')) {
      nameGroup.classList.remove('hidden');
      btn.textContent = '¿Ya tienes cuenta? Iniciar Sesión';
      submitBtn.textContent = 'Registrarse';
    } else {
      nameGroup.classList.add('hidden');
      btn.textContent = '¿Primera vez? Registrarse';
      submitBtn.textContent = 'Iniciar Sesión';
    }
  }

  // ===== DASHBOARD PACIENTE =====
  
  async showPatientDashboard() {
    this.showScreen('dashboard');
    await this.loadPatientData();
  }

  async loadPatientData() {
    try {
      const profile = await api.getProfile();
      auth.updateUser(profile);
      
      this.reminders = await api.getReminders();
      notifications.reminders = this.reminders;
      notifications.scheduleAllReminders();
      
    } catch (error) {
      logger.error('Error cargando datos del paciente:', error);
    }
  }

  renderDashboard(container) {
    const user = auth.getUser();
    const today = new Date();
    const dateStr = today.toLocaleDateString('es-ES', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    container.innerHTML = `
      <div class="dashboard-card">
        <div class="stats-header">
          <h3 class="stats-title">Hoy</h3>
          <span class="date-text">${dateStr}</span>
        </div>
        
        <div class="stats-content">
          <div class="progress-circle">
            <svg width="100" height="100" style="transform: rotate(-90deg);">
              <circle cx="50" cy="50" r="40" stroke="var(--gray-200)" 
                      stroke-width="8" fill="none"></circle>
              <circle id="adherenceCircle" cx="50" cy="50" r="40" 
                      stroke="var(--success)" stroke-width="8" fill="none" 
                      stroke-dasharray="251.327" 
                      stroke-dashoffset="${251.327 - (251.327 * (user?.adherence || 0) / 100)}">
              </circle>
            </svg>
            <div class="progress-info">
              <div class="progress-label">adherencia</div>
              <div class="progress-value">${user?.adherence || 0}%</div>
            </div>
          </div>
          
          <div class="next-dose-info">
            <div class="next-dose-label">Próxima dosis</div>
            <div id="nextDoseTime" class="next-dose-time">--:--</div>
            <div id="nextDoseStatus" class="next-dose-status">--</div>
          </div>
        </div>
      </div>
      
      <div id="medicationSection"></div>
      
      <div style="margin-top: var(--space-8);">
        <button class="btn" onclick="auth.logout()" style="width: 100%; background: var(--error);">
          Cerrar Sesión
        </button>
      </div>
    `;
    
    this.updateNextDoseInfo();
    this.loadMedicationSection();
  }

  async loadMedicationSection() {
    const user = auth.getUser();
    const section = document.getElementById('medicationSection');
    
    if (user?.medication) {
      section.innerHTML = `
        <div class="dashboard-card">
          <h3 style="margin: 0 0 var(--space-4) 0; color: var(--gray-800); font-weight: 700;">
            Tu Medicamento
          </h3>
          <div class="medication-card" onclick="app.showMedicationDetail('${user.medication._id || user.medication}')">
            <div style="display: flex; align-items: center; gap: var(--space-4);">
              <div style="width: 50px; height: 50px; background: linear-gradient(135deg, var(--primary), var(--primary-light)); 
                          border-radius: var(--radius-xl); display: flex; align-items: center; 
                          justify-content: center; color: white; font-size: 1.5rem;">
                💊
              </div>
              <div style="flex: 1;">
                <div style="font-size: 1.2rem; font-weight: 600; color: var(--primary); margin-bottom: var(--space-1);">
                  ${user.medication.name || 'Medicamento'}
                </div>
                <p style="margin: 0; color: var(--gray-600); font-size: 0.95rem;">
                  ${user.medication.description || 'Sin descripción'}
                </p>
              </div>
              <div style="color: var(--primary); font-size: 1.5rem;">→</div>
            </div>
          </div>
        </div>
      `;
    } else {
      section.innerHTML = `
        <div class="dashboard-card">
          <h3 style="margin: 0 0 var(--space-4) 0; color: var(--gray-800); font-weight: 700;">
            Tu Medicamento
          </h3>
          <div style="text-align: center; padding: var(--space-8); background: var(--gray-50); 
                      border-radius: var(--radius-xl); border: 2px dashed var(--gray-200);">
            <div style="font-size: 3rem; margin-bottom: var(--space-4); opacity: 0.5;">💊</div>
            <h4 style="color: var(--gray-600);">Sin medicamento asignado</h4>
            <p style="color: var(--gray-500);">Contacta con tu farmacéutico</p>
          </div>
        </div>
      `;
    }
  }

  updateNextDoseInfo() {
    const timeEl = document.getElementById('nextDoseTime');
    const statusEl = document.getElementById('nextDoseStatus');
    
    if (!timeEl || !statusEl) return;
    
    if (this.reminders.length === 0) {
      timeEl.textContent = '--:--';
      statusEl.textContent = 'Sin recordatorios';
      statusEl.style.color = 'var(--gray-500)';
      return;
    }
    
    const now = new Date();
    let nextReminder = null;
    let shortestTime = Infinity;
    
    this.reminders.forEach(reminder => {
      if (reminder.isActive && reminder.nextNotification) {
        const nextTime = new Date(reminder.nextNotification);
        const timeUntil = nextTime.getTime() - now.getTime();
        
        if (timeUntil > 0 && timeUntil < shortestTime) {
          shortestTime = timeUntil;
          nextReminder = reminder;
        }
      }
    });
    
    if (nextReminder) {
      const nextTime = new Date(nextReminder.nextNotification);
      timeEl.textContent = nextTime.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      if (nextTime.toDateString() === today.toDateString()) {
        statusEl.textContent = 'Hoy';
      } else if (nextTime.toDateString() === tomorrow.toDateString()) {
        statusEl.textContent = 'Mañana';
      } else {
        statusEl.textContent = nextTime.toLocaleDateString('es-ES', { 
          weekday: 'short', 
          day: 'numeric', 
          month: 'short' 
        });
      }
      
      statusEl.style.color = 'var(--success)';
    } else {
      timeEl.textContent = '--:--';
      statusEl.textContent = 'Sin próximas dosis';
      statusEl.style.color = 'var(--gray-500)';
    }
  }

  updateAdherence(newAdherence) {
    const user = auth.getUser();
    user.adherence = newAdherence;
    auth.updateUser(user);
    
    const circle = document.getElementById('adherenceCircle');
    const percentageEl = document.querySelector('.progress-value');
    
    if (circle) {
      const circumference = 2 * Math.PI * 40;
      const offset = circumference - (newAdherence / 100) * circumference;
      circle.style.strokeDashoffset = offset;
      
      if (newAdherence >= 80) {
        circle.style.stroke = 'var(--success)';
      } else if (newAdherence >= 60) {
        circle.style.stroke = 'var(--warning)';
      } else {
        circle.style.stroke = 'var(--error)';
      }
    }
    
    if (percentageEl) {
      percentageEl.textContent = newAdherence + '%';
    }
  }

  // ===== DETALLE DE MEDICAMENTO =====
  
  async showMedicationDetail(medicationId) {
    this.currentMedication = medicationId;
    this.showScreen('medication');
    
    try {
      const medication = await api.getMedication(medicationId);
      this.currentMedicationData = medication;
    } catch (error) {
      logger.error('Error cargando medicamento:', error);
    }
  }

  renderMedicationDetail(container) {
    container.innerHTML = `
      <h2 style="margin-bottom: var(--space-6); color: var(--gray-800); font-weight: 700;">
        ${this.currentMedicationData?.name || 'Medicamento'}
      </h2>
      <div class="feature-grid">
        <div class="feature-card" onclick="app.showScreen('video')">
          <div class="feature-icon">🎥</div>
          <div class="feature-title">Vídeo de Administración</div>
        </div>
        <div class="feature-card" onclick="app.showScreen('faq')">
          <div class="feature-icon">❓</div>
          <div class="feature-title">FAQ y Consejos</div>
        </div>
        <div class="feature-card" onclick="app.showScreen('reminder')">
          <div class="feature-icon">⏰</div>
          <div class="feature-title">Programar Recordatorio</div>
        </div>
        <div class="feature-card" onclick="app.showScreen('consult')">
          <div class="feature-icon">💬</div>
          <div class="feature-title">Consulta Farmacéutica</div>
        </div>
      </div>
    `;
  }

  // ===== PANTALLA DE VIDEO =====
  
  renderVideoScreen(container) {
    const medication = this.currentMedicationData;
    
    if (!medication?.video?.url) {
      container.innerHTML = `
        <h2 style="margin-bottom: var(--space-6); color: var(--gray-800); font-weight: 700;">
          Vídeo de Administración
        </h2>
        <div style="background: linear-gradient(135deg, #fef3c7, #fde68a); 
                    padding: var(--space-8); text-align: center; 
                    border-radius: var(--radius-md); border: 1px solid #fcd34d;">
          <div style="font-size: 3rem; margin-bottom: var(--space-4);">📹</div>
          <h4 style="color: #92400e;">Vídeo no disponible</h4>
          <p style="color: #92400e;">El administrador aún no ha configurado un vídeo.</p>
        </div>
      `;
      return;
    }
    
    let videoHTML = '';
    const videoUrl = medication.video.url;
    
    if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
      let videoId = '';
      if (videoUrl.includes('youtu.be/')) {
        videoId = videoUrl.split('youtu.be/')[1].split('?')[0];
      } else if (videoUrl.includes('youtube.com/watch?v=')) {
        videoId = videoUrl.split('v=')[1].split('&')[0];
      }
      
      if (videoId) {
        videoHTML = `
          <div class="dashboard-card">
            <h4 style="color: var(--primary); margin-bottom: var(--space-4); font-weight: 600;">
              🎥 Vídeo de Administración
            </h4>
            <div style="position: relative; width: 100%; height: 0; padding-bottom: 56.25%; 
                        border-radius: var(--radius-md); overflow: hidden;">
              <iframe src="https://www.youtube.com/embed/${videoId}" 
                      style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;" 
                      frameborder="0" allowfullscreen></iframe>
            </div>
          </div>
        `;
      }
    } else {
      videoHTML = `
        <div class="dashboard-card">
          <h4 style="color: var(--primary); margin-bottom: var(--space-4); font-weight: 600;">
            🎥 Vídeo de Administración
          </h4>
          <video controls style="width: 100%; border-radius: var(--radius-md);">
            <source src="${videoUrl}" type="video/mp4">
            Tu navegador no soporta el elemento de video.
          </video>
        </div>
      `;
    }
    
    if (medication.video.description) {
      videoHTML += `
        <div style="background: linear-gradient(135deg, #dbeafe, #bfdbfe); 
                    padding: var(--space-4); border-radius: var(--radius-md); 
                    margin-top: var(--space-4); border: 1px solid #93c5fd;">
          <h5 style="color: #1e40af; margin-bottom: var(--space-2); font-weight: 600;">
            📝 Descripción:
          </h5>
          <p style="margin: 0; color: var(--gray-800);">
            ${medication.video.description}
          </p>
        </div>
      `;
    }
    
    container.innerHTML = `
      <h2 style="margin-bottom: var(--space-6); color: var(--gray-800); font-weight: 700;">
        Vídeo de Administración
      </h2>
      ${videoHTML}
    `;
  }

  // ===== PANTALLA DE FAQ =====
  
  renderFAQScreen(container) {
    const medication = this.currentMedicationData;
    
    if (!medication?.faqs || medication.faqs.length === 0) {
      container.innerHTML = `
        <h2 style="margin-bottom: var(--space-6); color: var(--gray-800); font-weight: 700;">
          FAQ y Consejos
        </h2>
        <div style="text-align: center; padding: var(--space-12) var(--space-8); 
                    background: var(--gray-50); border-radius: var(--radius-xl); 
                    border: 2px dashed var(--gray-200);">
          <div style="font-size: 3rem; margin-bottom: var(--space-4); opacity: 0.5;">❓</div>
          <h4 style="color: var(--gray-600);">No hay preguntas frecuentes</h4>
          <p style="color: var(--gray-500);">El administrador aún no ha configurado FAQs.</p>
        </div>
      `;
      return;
    }
    
    let faqsHTML = medication.faqs.map((faq, index) => `
      <div class="faq-item-patient" data-index="${index}">
        <div class="faq-question-patient" onclick="app.toggleFAQ(${index})">
          <h4 style="margin: 0; color: var(--primary); flex: 1; padding-right: var(--space-4);">
            ${faq.question}
          </h4>
          <div class="faq-arrow" id="arrow-${index}">▼</div>
        </div>
        <div class="faq-answer-patient" id="answer-${index}" style="max-height: 0;">
          <div style="padding: var(--space-4) 0;">
            <p style="margin: 0; line-height: 1.6; color: var(--gray-800);">
              ${faq.answer}
            </p>
          </div>
        </div>
      </div>
    `).join('');
    
    container.innerHTML = `
      <h2 style="margin-bottom: var(--space-6); color: var(--gray-800); font-weight: 700;">
        FAQ y Consejos
      </h2>
      <div style="text-align: center; margin-bottom: var(--space-8);">
        <h3 style="color: var(--primary); font-weight: 700;">
          ${medication.name.toUpperCase()}
        </h3>
        <p style="color: var(--gray-500);">Preguntas Frecuentes</p>
      </div>
      ${faqsHTML}
    `;
  }

  toggleFAQ(index) {
    const answer = document.getElementById('answer-' + index);
    const arrow = document.getElementById('arrow-' + index);
    
    if (!answer || !arrow) return;
    
    const isOpen = answer.style.maxHeight !== '0px' && answer.style.maxHeight !== '';
    
    document.querySelectorAll('.faq-answer-patient').forEach(a => {
      a.style.maxHeight = '0';
    });
    document.querySelectorAll('.faq-arrow').forEach(a => {
      a.style.transform = 'rotate(0deg)';
    });
    
    if (!isOpen) {
      answer.style.maxHeight = '500px';
      arrow.style.transform = 'rotate(180deg)';
    }
  }

  // ===== PANTALLA DE RECORDATORIOS =====
  
  async renderReminderScreen(container) {
    container.innerHTML = `
      <h2 style="margin-bottom: var(--space-6); color: var(--gray-800); font-weight: 700;">
        Programar Recordatorio
      </h2>
      
      <div class="form-group">
        <label for="reminderTime">Hora del recordatorio *</label>
        <input type="time" id="reminderTime" required>
      </div>
      
      <div class="form-group">
        <label for="reminderFrequency">Frecuencia *</label>
        <select id="reminderFrequency">
          <option value="">Selecciona una opción</option>
          <option value="daily">Diaria (cada día)</option>
          <option value="weekly">Semanal (cada semana)</option>
          <option value="biweekly">Cada 14 días</option>
          <option value="monthly">Cada 28 días</option>
          <option value="bimonthly">Cada 56 días</option>
        </select>
      </div>
      
      <button class="btn" onclick="app.saveReminder()" style="width: 100%; margin-bottom: var(--space-8);">
        📅 Crear Recordatorio
      </button>
      
      <h3 style="margin-top: var(--space-8); margin-bottom: var(--space-4); 
                 color: var(--gray-800); font-weight: 600;">
        Recordatorios Activos
      </h3>
      <div id="currentReminders"></div>
    `;
    
    await this.loadCurrentReminders();
  }

  async loadCurrentReminders() {
    const container = document.getElementById('currentReminders');
    if (!container) return;
    
    try {
      this.reminders = await api.getReminders();
      
      if (this.reminders.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: var(--space-8); 
                      background: var(--gray-50); border-radius: var(--radius-xl); 
                      border: 2px dashed var(--gray-200);">
            <div style="font-size: 2rem; margin-bottom: var(--space-4); opacity: 0.5;">⏰</div>
            <p style="color: var(--gray-600); margin: 0;">
              No tienes recordatorios configurados
            </p>
          </div>
        `;
        return;
      }
      
      const remindersHTML = this.reminders.map(reminder => {
        const frequencyText = {
          'daily': 'Diaria',
          'weekly': 'Semanal',
          'biweekly': 'Cada 14 días',
          'monthly': 'Cada 28 días',
          'bimonthly': 'Cada 56 días'
        };
        
        const nextTime = new Date(reminder.nextNotification);
        const nextStr = nextTime.toLocaleString('es-ES', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        return `
          <div class="dashboard-card" style="margin-bottom: var(--space-4);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; 
                        margin-bottom: var(--space-4);">
              <div style="flex: 1;">
                <h4 style="margin: 0 0 var(--space-2) 0; color: var(--primary); font-weight: 600;">
                  ⏰ ${reminder.time}
                </h4>
                <p style="margin: 0; color: var(--gray-600); font-size: 0.9rem;">
                  ${frequencyText[reminder.frequency]}
                </p>
                <p style="margin: var(--space-1) 0 0 0; color: var(--success); 
                         font-size: 0.8rem; font-weight: 600;">
                  📅 Próximo: ${nextStr}
                </p>
              </div>
              <button onclick="app.deleteReminder('${reminder._id}')" 
                      class="btn" style="background: var(--error); 
                      padding: var(--space-2) var(--space-3); font-size: 0.8rem;">
                Eliminar
              </button>
            </div>
          </div>
        `;
      }).join('');
      
      container.innerHTML = remindersHTML;
    } catch (error) {
      logger.error('Error cargando recordatorios:', error);
    }
  }

  async saveReminder() {
    const time = document.getElementById('reminderTime').value;
    const frequency = document.getElementById('reminderFrequency').value;
    
    if (!time || !frequency) {
      this.showMessage('Por favor completa todos los campos obligatorios', 'error');
      return;
    }
    
    try {
      const user = auth.getUser();
      const reminderData = {
        time,
        frequency,
        message: `Es hora de tomar tu ${this.currentMedicationData?.name || 'medicamento'}`,
        medicationId: this.currentMedication || user.medication?._id || user.medication
      };
      
      await api.createReminder(reminderData);
      
      if (notifications.permission !== 'granted') {
        const granted = await notifications.requestPermission();
        if (granted) {
          this.showMessage('🔔 ¡Notificaciones activadas!', 'success');
        }
      }
      
      await this.loadCurrentReminders();
      await notifications.loadReminders();
      
      document.getElementById('reminderTime').value = '';
      document.getElementById('reminderFrequency').value = '';
      
      this.showMessage('📅 ¡Recordatorio creado exitosamente!', 'success');
    } catch (error) {
      this.showMessage('Error al crear recordatorio: ' + error.message, 'error');
    }
  }

  async deleteReminder(reminderId) {
    if (!confirm('¿Estás seguro de que quieres eliminar este recordatorio?')) return;
    
    try {
      await api.deleteReminder(reminderId);
      await this.loadCurrentReminders();
      await notifications.loadReminders();
      
      this.showMessage('🗑️ Recordatorio eliminado', 'success');
    } catch (error) {
      this.showMessage('Error al eliminar recordatorio', 'error');
    }
  }

  // ===== PANTALLA DE CONSULTAS =====
  
  renderConsultScreen(container) {
    container.innerHTML = `
      <div style="text-align: center; margin-bottom: var(--space-8);">
        <div style="display: inline-flex; align-items: center; justify-content: center; 
                    width: 80px; height: 80px; 
                    background: linear-gradient(135deg, var(--primary), var(--primary-light)); 
                    border-radius: 50%; margin-bottom: var(--space-4);">
          <span style="font-size: 2.5rem;">💬</span>
        </div>
        <h2 style="margin: 0 0 var(--space-2) 0; color: var(--primary); 
                   font-size: 1.8rem; font-weight: 700;">
          Consulta Farmacéutica
        </h2>
        <p style="margin: 0; color: var(--gray-600); font-size: 1rem;">
          Tu farmacéutico está aquí para ayudarte
        </p>
      </div>
      
      <div class="dashboard-card">
        <div class="form-group">
          <label for="consultSubject">¿Sobre qué quieres consultar? *</label>
          <select id="consultSubject">
            <option value="">Selecciona el tema de tu consulta</option>
            <option value="efectos-secundarios">📸 Efectos secundarios</option>
            <option value="dosificacion">📸 Dudas sobre dosificación</option>
            <option value="interacciones">📸 Interacciones medicamentosas</option>
            <option value="horarios">📸 Horarios de administración</option>
            <option value="almacenamiento">📸 Almacenamiento del medicamento</option>
            <option value="olvido-dosis">📸 Qué hacer si olvido una dosis</option>
            <option value="otros">📸 Otros temas</option>
          </select>
        </div>
        
        <div class="form-group" style="margin-top: var(--space-6);">
          <label for="consultMessage">Describe tu consulta *</label>
          <textarea id="consultMessage" rows="5" 
                    placeholder="Cuéntanos tu consulta con el mayor detalle posible..."></textarea>
        </div>
        
        <div class="form-group" style="margin-top: var(--space-6);">
          <label for="consultContact">Tu contacto (opcional)</label>
          <input type="text" id="consultContact" placeholder="tu@email.com o +34 123 456 789">
        </div>
      </div>
      
      <button class="btn" onclick="app.sendConsult()" 
              style="width: 100%; padding: var(--space-6); font-size: 1.1rem; 
                     font-weight: 600; margin-bottom: var(--space-8);">
        <span style="display: flex; align-items: center; justify-content: center; gap: var(--space-3);">
          <span style="font-size: 1.2rem;">📧</span>
          Enviar Consulta al Farmacéutico
        </span>
      </button>
    `;
  }

  async sendConsult() {
    const subject = document.getElementById('consultSubject').value;
    const message = document.getElementById('consultMessage').value.trim();
    const contact = document.getElementById('consultContact').value.trim();
    
    if (!subject || !message) {
      this.showMessage('Por favor completa los campos obligatorios', 'error');
      return;
    }
    
    try {
      await api.createConsultation({
        subject,
        message,
        contact,
        urgency: subject === 'efectos-secundarios' ? 'high' : 'medium'
      });
      
      document.getElementById('consultSubject').value = '';
      document.getElementById('consultMessage').value = '';
      document.getElementById('consultContact').value = '';
      
      this.showMessage('📧 ¡Consulta enviada! Te responderemos en menos de 24 horas.', 'success');
      
      setTimeout(() => {
        this.showScreen('dashboard');
      }, 2000);
    } catch (error) {
      this.showMessage('Error al enviar consulta: ' + error.message, 'error');
    }
  }

  // ===== MODAL DE RECORDATORIO =====
  
  showReminderModal(reminder) {
    this.activeReminder = reminder;
    
    const modal = document.createElement('div');
    modal.id = 'notificationModal';
    modal.className = 'notification-modal';
    modal.innerHTML = `
      <div class="notification-content">
        <div style="font-size: 3rem; margin-bottom: var(--space-4);">⏰</div>
        <h3 style="color: var(--primary); margin-bottom: var(--space-4); font-weight: 700;">
          ¡Hora de tu medicamento!
        </h3>
        <p style="color: var(--gray-600); margin-bottom: var(--space-8);">
          ${reminder.message || 'Es hora de tomar tu dosis'}
        </p>
        
        <div style="display: flex; gap: var(--space-3);">
          <button onclick="app.confirmDose()" class="btn" 
                  style="flex: 1; background: var(--success);">
            ✅ Tomado
          </button>
          <button onclick="app.postponeDose()" class="btn" 
                  style="flex: 1; background: var(--warning);">
            ⏰ Posponer
          </button>
          <button onclick="app.skipDose()" class="btn" 
                  style="flex: 1; background: var(--error);">
            ❌ Omitir
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  async confirmDose() {
    if (!this.activeReminder) return;
    
    try {
      await notifications.confirmDose(this.activeReminder._id || this.activeReminder.id);
      this.closeReminderModal();
      this.showMessage('✅ ¡Dosis confirmada! Adherencia actualizada.', 'success');
      
      if (this.currentScreen === 'dashboard') {
        this.updateNextDoseInfo();
      }
    } catch (error) {
      this.showMessage('Error al confirmar dosis', 'error');
    }
  }

  async postponeDose() {
    if (!this.activeReminder) return;
    
    try {
      await notifications.postponeDose(this.activeReminder._id || this.activeReminder.id);
      this.closeReminderModal();
      this.showMessage('⏰ Recordatorio pospuesto 15 minutos', 'warning');
      
      if (this.currentScreen === 'dashboard') {
        this.updateNextDoseInfo();
      }
    } catch (error) {
      this.showMessage('Error al posponer dosis', 'error');
    }
  }

  async skipDose() {
    if (!this.activeReminder) return;
    
    try {
      await notifications.skipDose(this.activeReminder._id || this.activeReminder.id);
      this.closeReminderModal();
      this.showMessage('❌ Dosis omitida. Recuerda la importancia de la adherencia.', 'error');
      
      if (this.currentScreen === 'dashboard') {
        this.updateNextDoseInfo();
      }
    } catch (error) {
      this.showMessage('Error al omitir dosis', 'error');
    }
  }

  closeReminderModal() {
    const modal = document.getElementById('notificationModal');
    if (modal) {
      modal.remove();
    }
    this.activeReminder = null;
  }

  // ===== ADMIN DASHBOARD =====
  
  async showAdminDashboard() {
    this.showScreen('admin');
    await this.loadAdminData();
  }

  async loadAdminData() {
    try {
      this.users = await api.getUsers();
      this.medications = await api.getMedications();
      this.consultations = await api.getConsultations();
    } catch (error) {
      logger.error('Error cargando datos de admin:', error);
    }
  }

  renderAdminDashboard(container) {
    container.innerHTML = `
      <div class="admin-nav">
        <button class="active" onclick="app.showAdminSection(event, 'analytics')">📊 Analytics</button>
        <button onclick="app.showAdminSection(event, 'patients')">👥 Pacientes</button>
        <button onclick="app.showAdminSection(event, 'medications')">💊 Medicamentos</button>
        <button onclick="app.showAdminSection(event, 'consultations')">💬 Consultas</button>
      </div>
      
      <div id="adminContent"></div>
      
      <div style="margin-top: var(--space-8);">
        <button class="btn" onclick="auth.logout()" 
                style="width: 100%; background: var(--error);">
          Cerrar Sesión
        </button>
      </div>
    `;
    
    this.showAdminSection({target: document.querySelector('.admin-nav button')}, 'analytics');
  }

  async showAdminSection(event, section) {
    const buttons = document.querySelectorAll('.admin-nav button');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    const content = document.getElementById('adminContent');
    
    switch(section) {
      case 'analytics':
        await this.renderAnalytics(content);
        break;
      case 'patients':
        await this.renderPatients(content);
        break;
      case 'medications':
        await this.renderMedications(content);
        break;
      case 'consultations':
        await this.renderConsultations(content);
        break;
    }
  }

  async renderAnalytics(container) {
    try {
      const analytics = await api.getDashboardAnalytics();
      
      container.innerHTML = `
        <div class="analytics-dashboard">
          <div class="analytics-section">
            <h3 class="analytics-title">📈 Métricas Generales</h3>
            <div class="metrics-grid">
              <div class="metric-card">
                <div class="metric-value" style="color: var(--primary);">
                  ${analytics.metrics.totalPatients}
                </div>
                <div class="metric-label">Total Pacientes</div>
              </div>
              <div class="metric-card">
                <div class="metric-value" style="color: var(--success);">
                  ${analytics.metrics.globalAdherence}%
                </div>
                <div class="metric-label">Adherencia Global</div>
              </div>
              <div class="metric-card">
                <div class="metric-value" style="color: var(--error);">
                  ${analytics.metrics.riskPatients}
                </div>
                <div class="metric-label">Pacientes en Riesgo</div>
              </div>
              <div class="metric-card">
                <div class="metric-value" style="color: var(--warning);">
                  ${analytics.metrics.pendingConsultations}
                </div>
                <div class="metric-label">Consultas Pendientes</div>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (error) {
      container.innerHTML = '<p>Error cargando analytics</p>';
    }
  }

  async renderPatients(container) {
    try {
      const users = await api.getUsers();
      const medications = await api.getMedications();
      
      container.innerHTML = `
        <div class="analytics-section">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6);">
            <h3 class="analytics-title" style="margin: 0;">👥 Pacientes (${users.length})</h3>
            <button class="btn" onclick="app.showAddPatientForm()" style="padding: var(--space-3) var(--space-4);">
              + Nuevo Paciente
            </button>
          </div>
          
          <div id="addPatientForm" style="display: none; margin-bottom: var(--space-6);">
            <div class="dashboard-card">
              <h4 style="margin-bottom: var(--space-4);">Agregar Paciente</h4>
              <div class="form-group">
                <label>Nombre completo</label>
                <input type="text" id="newPatientName" placeholder="Nombre del paciente">
              </div>
              <div class="form-group">
                <label>Email</label>
                <input type="email" id="newPatientEmail" placeholder="email@ejemplo.com">
              </div>
              <div class="form-group">
                <label>Contraseña</label>
                <input type="password" id="newPatientPassword" placeholder="Contraseña">
              </div>
              <div class="form-group">
                <label>Medicamento</label>
                <select id="newPatientMedication">
                  <option value="">Sin medicamento</option>
                  ${medications.map(med => `<option value="${med._id}">${med.name}</option>`).join('')}
                </select>
              </div>
              <div style="display: flex; gap: var(--space-3); margin-top: var(--space-4);">
                <button class="btn" onclick="app.createPatient()" style="flex: 1;">Crear</button>
                <button class="btn btn-secondary" onclick="app.hideAddPatientForm()" style="flex: 1;">Cancelar</button>
              </div>
            </div>
          </div>
          
          ${users.length === 0 ? `
            <div style="text-align: center; padding: var(--space-12); background: var(--gray-50); border-radius: var(--radius-xl);">
              <div style="font-size: 3rem; margin-bottom: var(--space-4);">👥</div>
              <h4 style="color: var(--gray-600);">No hay pacientes registrados</h4>
            </div>
          ` : `
            <table class="data-table">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Medicamento</th>
                  <th>Adherencia</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${users.map(user => `
                  <tr>
                    <td>
                      <div style="font-weight: 600;">${user.name}</div>
                      <div style="font-size: 0.85rem; color: var(--gray-500);">${user.email}</div>
                    </td>
                    <td>${user.medication?.name || '<span style="color: var(--gray-400);">Sin asignar</span>'}</td>
                    <td>
                      <span class="badge ${user.adherence >= 80 ? 'success' : (user.adherence >= 60 ? 'warning' : 'error')}">
                        ${user.adherence}%
                      </span>
                    </td>
                    <td>
                      <button class="btn" onclick="app.showAssignMedicationModal('${user._id}')" 
                              style="padding: var(--space-2) var(--space-3); font-size: 0.85rem; margin-right: var(--space-2);">
                        Asignar Med.
                      </button>
                      <button class="btn" onclick="app.deletePatient('${user._id}')" 
                              style="padding: var(--space-2) var(--space-3); font-size: 0.85rem; background: var(--error);">
                        Eliminar
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      `;
    } catch (error) {
      container.innerHTML = '<p>Error cargando pacientes</p>';
    }
  }

  showAddPatientForm() {
    document.getElementById('addPatientForm').style.display = 'block';
  }

  hideAddPatientForm() {
    document.getElementById('addPatientForm').style.display = 'none';
    document.getElementById('newPatientName').value = '';
    document.getElementById('newPatientEmail').value = '';
    document.getElementById('newPatientPassword').value = '';
    document.getElementById('newPatientMedication').value = '';
  }

  async createPatient() {
    const name = document.getElementById('newPatientName').value.trim();
    const email = document.getElementById('newPatientEmail').value.trim();
    const password = document.getElementById('newPatientPassword').value.trim();
    const medicationId = document.getElementById('newPatientMedication').value;
    
    if (!name || !email || !password) {
      this.showMessage('Por favor completa todos los campos obligatorios', 'error');
      return;
    }
    
    try {
      await api.createUser({ name, email, password, medicationId });
      this.showMessage('✅ Paciente creado exitosamente', 'success');
      this.hideAddPatientForm();
      await this.loadAdminData();
      
      const content = document.getElementById('adminContent');
      await this.renderPatients(content);
    } catch (error) {
      this.showMessage('Error al crear paciente: ' + error.message, 'error');
    }
  }

  async deletePatient(userId) {
    if (!confirm('¿Estás seguro de eliminar este paciente? Esta acción no se puede deshacer.')) return;
    
    try {
      await api.deleteUser(userId);
      this.showMessage('🗑️ Paciente eliminado', 'success');
      await this.loadAdminData();
      
      const content = document.getElementById('adminContent');
      await this.renderPatients(content);
    } catch (error) {
      this.showMessage('Error al eliminar paciente', 'error');
    }
  }

  async showAssignMedicationModal(userId) {
    const medications = await api.getMedications();
    
    const modal = document.createElement('div');
    modal.className = 'notification-modal';
    modal.innerHTML = `
      <div class="notification-content">
        <h3 style="margin-bottom: var(--space-6);">Asignar Medicamento</h3>
        <select id="assignMedicationSelect" style="width: 100%; padding: var(--space-4); 
                border-radius: var(--radius-lg); border: 2px solid var(--gray-200); 
                margin-bottom: var(--space-6);">
          <option value="">Selecciona un medicamento</option>
          ${medications.map(med => `<option value="${med._id}">${med.name}</option>`).join('')}
        </select>
        <div style="display: flex; gap: var(--space-3);">
          <button class="btn" onclick="app.confirmAssignMedication('${userId}')" style="flex: 1;">
            Asignar
          </button>
          <button class="btn btn-secondary" onclick="this.closest('.notification-modal').remove()" style="flex: 1;">
            Cancelar
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  async confirmAssignMedication(userId) {
    const medicationId = document.getElementById('assignMedicationSelect').value;
    
    if (!medicationId) {
      this.showMessage('Por favor selecciona un medicamento', 'error');
      return;
    }
    
    try {
      await api.assignMedication(medicationId, userId);
      this.showMessage('✅ Medicamento asignado exitosamente', 'success');
      
      document.querySelector('.notification-modal').remove();
      
      await this.loadAdminData();
      const content = document.getElementById('adminContent');
      await this.renderPatients(content);
    } catch (error) {
      this.showMessage('Error al asignar medicamento', 'error');
    }
  }

  async renderMedications(container) {
    try {
      const medications = await api.getMedications();
      
      container.innerHTML = `
        <div class="analytics-section">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6);">
            <h3 class="analytics-title" style="margin: 0;">💊 Medicamentos (${medications.length})</h3>
            <button class="btn" onclick="app.showAddMedicationForm()" style="padding: var(--space-3) var(--space-4);">
              + Nuevo Medicamento
            </button>
          </div>
          
          <div id="addMedicationForm" style="display: none; margin-bottom: var(--space-6);">
            <div class="dashboard-card">
              <h4 style="margin-bottom: var(--space-4);">Agregar Medicamento</h4>
              <div class="form-group">
                <label>Nombre del medicamento *</label>
                <input type="text" id="newMedName" placeholder="Ej: Humira">
              </div>
              <div class="form-group">
                <label>Descripción *</label>
                <textarea id="newMedDescription" rows="3" placeholder="Descripción breve del medicamento"></textarea>
              </div>
              <div class="form-group">
                <label>URL del video (opcional)</label>
                <input type="url" id="newMedVideoUrl" placeholder="https://youtube.com/...">
              </div>
              <div class="form-group">
                <label>Descripción del video (opcional)</label>
                <textarea id="newMedVideoDesc" rows="2" placeholder="Instrucciones sobre el video"></textarea>
              </div>
              
              <h5 style="margin: var(--space-6) 0 var(--space-3) 0;">FAQs (Opcional)</h5>
              <div id="faqsList"></div>
              <button class="btn btn-secondary" onclick="app.addFAQField()" style="width: 100%; margin-bottom: var(--space-4);">
                + Agregar FAQ
              </button>
              
              <div style="display: flex; gap: var(--space-3); margin-top: var(--space-4);">
                <button class="btn" onclick="app.createMedication()" style="flex: 1;">Crear</button>
                <button class="btn btn-secondary" onclick="app.hideAddMedicationForm()" style="flex: 1;">Cancelar</button>
              </div>
            </div>
          </div>
          
          ${medications.length === 0 ? `
            <div style="text-align: center; padding: var(--space-12); background: var(--gray-50); border-radius: var(--radius-xl);">
              <div style="font-size: 3rem; margin-bottom: var(--space-4);">💊</div>
              <h4 style="color: var(--gray-600);">No hay medicamentos registrados</h4>
            </div>
          ` : `
            <div style="display: grid; gap: var(--space-4);">
              ${medications.map(med => `
                <div class="dashboard-card">
                  <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                      <h4 style="color: var(--primary); margin-bottom: var(--space-2);">${med.name}</h4>
                      <p style="color: var(--gray-600); margin-bottom: var(--space-3);">${med.description}</p>
                      <div style="display: flex; gap: var(--space-4); font-size: 0.9rem; color: var(--gray-500);">
                        <span>👥 ${med.patients?.length || 0} pacientes</span>
                        <span>❓ ${med.faqs?.length || 0} FAQs</span>
                        <span>${med.video?.url ? '🎥 Video' : ''}</span>
                      </div>
                    </div>
                    <button class="btn" onclick="app.deleteMedication('${med._id}')" 
                            style="padding: var(--space-2) var(--space-3); font-size: 0.85rem; background: var(--error);">
                      Eliminar
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      `;
    } catch (error) {
      container.innerHTML = '<p>Error cargando medicamentos</p>';
    }
  }

  showAddMedicationForm() {
    document.getElementById('addMedicationForm').style.display = 'block';
    this.faqCount = 0;
  }

  hideAddMedicationForm() {
    document.getElementById('addMedicationForm').style.display = 'none';
    document.getElementById('newMedName').value = '';
    document.getElementById('newMedDescription').value = '';
    document.getElementById('newMedVideoUrl').value = '';
    document.getElementById('newMedVideoDesc').value = '';
    document.getElementById('faqsList').innerHTML = '';
    this.faqCount = 0;
  }

  addFAQField() {
    const faqsList = document.getElementById('faqsList');
    this.faqCount = this.faqCount || 0;
    
    const faqDiv = document.createElement('div');
    faqDiv.className = 'faq-item';
    faqDiv.innerHTML = `
      <input type="text" placeholder="Pregunta" class="faq-question" 
             style="padding: var(--space-3); border: 2px solid var(--gray-200); 
             border-radius: var(--radius-md); margin-bottom: var(--space-2);">
      <textarea placeholder="Respuesta" class="faq-answer" rows="2" 
                style="padding: var(--space-3); border: 2px solid var(--gray-200); 
                border-radius: var(--radius-md);"></textarea>
    `;
    
    faqsList.appendChild(faqDiv);
    this.faqCount++;
  }

  async createMedication() {
    const name = document.getElementById('newMedName').value.trim();
    const description = document.getElementById('newMedDescription').value.trim();
    const videoUrl = document.getElementById('newMedVideoUrl').value.trim();
    const videoDesc = document.getElementById('newMedVideoDesc').value.trim();
    
    if (!name || !description) {
      this.showMessage('Por favor completa los campos obligatorios (nombre y descripción)', 'error');
      return;
    }
    
    const faqs = [];
    document.querySelectorAll('.faq-item').forEach(item => {
      const question = item.querySelector('.faq-question').value.trim();
      const answer = item.querySelector('.faq-answer').value.trim();
      if (question && answer) {
        faqs.push({ question, answer });
      }
    });
    
    const medicationData = {
      name,
      description,
      faqs
    };
    
    if (videoUrl) {
      medicationData.video = {
        url: videoUrl,
        description: videoDesc
      };
    }
    
    try {
      await api.createMedication(medicationData);
      this.showMessage('✅ Medicamento creado exitosamente', 'success');
      this.hideAddMedicationForm();
      await this.loadAdminData();
      
      const content = document.getElementById('adminContent');
      await this.renderMedications(content);
    } catch (error) {
      this.showMessage('Error al crear medicamento: ' + error.message, 'error');
    }
  }

  async deleteMedication(medicationId) {
    if (!confirm('¿Estás seguro de eliminar este medicamento? Se desasignará de todos los pacientes.')) return;
    
    try {
      await api.deleteMedication(medicationId);
      this.showMessage('🗑️ Medicamento eliminado', 'success');
      await this.loadAdminData();
      
      const content = document.getElementById('adminContent');
      await this.renderMedications(content);
    } catch (error) {
      this.showMessage('Error al eliminar medicamento', 'error');
    }
  }

  async renderConsultations(container) {
    try {
      const consultations = await api.getConsultations();
      
      const pending = consultations.filter(c => c.status === 'pending');
      
      container.innerHTML = `
        <div class="analytics-section">
          <h3 class="analytics-title">💬 Consultas Farmacéuticas</h3>
          
          <div style="background: linear-gradient(135deg, #fef3c7, #fde68a); padding: var(--space-4); 
                      border-radius: var(--radius-lg); margin-bottom: var(--space-6); border: 1px solid #fcd34d;">
            <h4 style="color: #92400e; margin-bottom: var(--space-2);">⚠️ ${pending.length} Consultas Pendientes</h4>
            <p style="color: #92400e; margin: 0; font-size: 0.9rem;">Responde lo antes posible</p>
          </div>
          
          ${consultations.length === 0 ? `
            <div style="text-align: center; padding: var(--space-12); background: var(--gray-50); border-radius: var(--radius-xl);">
              <div style="font-size: 3rem; margin-bottom: var(--space-4);">💬</div>
              <h4 style="color: var(--gray-600);">No hay consultas</h4>
            </div>
          ` : `
            ${consultations.map(consultation => `
              <div class="dashboard-card" style="margin-bottom: var(--space-4); 
                   border-left: 4px solid ${consultation.status === 'pending' ? 'var(--warning)' : 'var(--success)'};">
                <div style="display: flex; justify-content: between; align-items: start; margin-bottom: var(--space-4);">
                  <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-2);">
                      <h4 style="margin: 0; color: var(--primary);">${consultation.subject}</h4>
                      <span class="badge ${consultation.status === 'pending' ? 'warning' : 'success'}">
                        ${consultation.status === 'pending' ? 'Pendiente' : 'Resuelta'}
                      </span>
                    </div>
                    <p style="color: var(--gray-600); margin-bottom: var(--space-2); font-size: 0.9rem;">
                      👤 ${consultation.patient?.name || 'Paciente'} | 
                      📧 ${consultation.contact}
                    </p>
                    <p style="color: var(--gray-700); margin-bottom: var(--space-3);">
                      ${consultation.message}
                    </p>
                    
                    ${consultation.response ? `
                      <div style="background: var(--gray-50); padding: var(--space-4); border-radius: var(--radius-md); margin-top: var(--space-3);">
                        <div style="font-weight: 600; color: var(--success); margin-bottom: var(--space-2);">✅ Respuesta:</div>
                        <p style="margin: 0; color: var(--gray-700);">${consultation.response}</p>
                      </div>
                    ` : `
                      <div id="responseForm${consultation._id}" style="margin-top: var(--space-4);">
                        <textarea id="responseText${consultation._id}" rows="3" placeholder="Escribe tu respuesta..." 
                                  style="width: 100%; padding: var(--space-4); border: 2px solid var(--gray-200); 
                                  border-radius: var(--radius-lg); margin-bottom: var(--space-3);"></textarea>
                        <button class="btn" onclick="app.respondConsultation('${consultation._id}')" 
                                style="width: 100%;">
                          📤 Enviar Respuesta
                        </button>
                      </div>
                    `}
                  </div>
                </div>
              </div>
            `).join('')}
          `}
        </div>
      `;
    } catch (error) {
      container.innerHTML = '<p>Error cargando consultas</p>';
    }
  }

  async respondConsultation(consultationId) {
    const responseText = document.getElementById('responseText' + consultationId).value.trim();
    
    if (!responseText) {
      this.showMessage('Por favor escribe una respuesta', 'error');
      return;
    }
    
    try {
      await api.respondConsultation(consultationId, responseText);
      this.showMessage('✅ Respuesta enviada al paciente', 'success');
      await this.loadAdminData();
      
      const content = document.getElementById('adminContent');
      await this.renderConsultations(content);
    } catch (error) {
      this.showMessage('Error al enviar respuesta: ' + error.message, 'error');
    }
  }

  // ===== UTILIDADES =====
  
  showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'notification-message';
    messageDiv.textContent = message;
    
    const colors = {
      success: 'var(--success)',
      error: 'var(--error)',
      warning: 'var(--warning)',
      info: 'var(--primary)'
    };
    
    messageDiv.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${colors[type]};
      color: white;
      padding: var(--space-4) var(--space-6);
      border-radius: var(--radius-xl);
      z-index: 10001;
      font-weight: 600;
      box-shadow: var(--shadow-xl);
      max-width: 90%;
    `;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
      messageDiv.remove();
    }, 4000);
  }
}

// Inicialización de la aplicación
const app = new FarmaFollowApp();

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});