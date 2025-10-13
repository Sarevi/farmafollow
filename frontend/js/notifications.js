class NotificationManager {
  constructor() {
    this.reminders = [];
    this.permission = 'default';
    this.activeTimeouts = new Map();
  }

  async init() {
    // Verificar permisos
    if ('Notification' in window) {
      this.permission = Notification.permission;
    }

    // Registrar Service Worker
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        logger.log('Service Worker registrado:', registration);
      } catch (error) {
        logger.error('Error registrando Service Worker:', error);
      }
    }
  }

  async requestPermission() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === 'granted';
    }
    return false;
  }

  async loadReminders() {
    try {
      this.reminders = await api.getReminders();
      this.scheduleAllReminders();
    } catch (error) {
      logger.error('Error cargando recordatorios:', error);
    }
  }

  scheduleAllReminders() {
    // Cancelar timeouts existentes
    this.activeTimeouts.forEach(timeout => clearTimeout(timeout));
    this.activeTimeouts.clear();

    // Programar nuevos recordatorios
    this.reminders.forEach(reminder => {
      if (reminder.isActive) {
        this.scheduleReminder(reminder);
      }
    });
  }

  scheduleReminder(reminder) {
    const now = new Date();
    const nextTime = new Date(reminder.nextNotification);
    const timeUntil = nextTime.getTime() - now.getTime();

    if (timeUntil > 0) {
      const timeoutId = setTimeout(() => {
        this.showNotification(reminder);
      }, timeUntil);

      this.activeTimeouts.set(reminder.id || reminder._id, timeoutId);
      logger.log(`Recordatorio programado para: ${nextTime.toLocaleString()}`);
    }
  }

  async showNotification(reminder) {
    // Mostrar modal en la app
    app.showReminderModal(reminder);

    // Mostrar notificación del navegador si tiene permisos
    if (this.permission === 'granted') {
      try {
        const notification = new Notification('💊 FarmaFollow', {
          body: reminder.message || 'Es hora de tomar tu medicamento',
          icon: '/icon-192.png',
          badge: '/icon-72.png',
          vibrate: [200, 100, 200],
          requireInteraction: true,
          tag: `reminder-${reminder.id || reminder._id}`,
          data: reminder
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
          app.showReminderModal(reminder);
        };
      } catch (error) {
        logger.error('Error mostrando notificación:', error);
      }
    }
  }

  async confirmDose(reminderId) {
    try {
      const response = await api.updateDoseStatus(reminderId, 'taken');
      app.updateAdherence(response.adherence);
      await this.loadReminders();
      return response;
    } catch (error) {
      logger.error('Error confirmando dosis:', error);
      throw error;
    }
  }

  async skipDose(reminderId) {
    try {
      const response = await api.updateDoseStatus(reminderId, 'missed');
      app.updateAdherence(response.adherence);
      await this.loadReminders();
      return response;
    } catch (error) {
      logger.error('Error omitiendo dosis:', error);
      throw error;
    }
  }

  async postponeDose(reminderId) {
    try {
      const response = await api.updateDoseStatus(reminderId, 'postponed');
      
      // Reprogramar para 15 minutos después
      setTimeout(() => {
        const reminder = this.reminders.find(r => (r.id || r._id) === reminderId);
        if (reminder) {
          this.showNotification(reminder);
        }
      }, 15 * 60 * 1000);
      
      return response;
    } catch (error) {
      logger.error('Error posponiendo dosis:', error);
      throw error;
    }
  }
}

const notifications = new NotificationManager();