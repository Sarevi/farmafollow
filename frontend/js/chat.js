// Módulo de Chat con Socket.io
const ChatModule = {
  socket: null,
  currentChatId: null,
  currentUser: null,
  chats: [],
  messages: {},
  typingTimeouts: {},

  // Inicializar Socket.io
  init() {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No hay token de autenticación');
      return;
    }

    // Conectar a Socket.io
    this.socket = io(API_CONFIG.API_URL.replace('/api', ''), {
      auth: { token }
    });

    // Eventos de conexión
    this.socket.on('connect', () => {
      console.log('✅ Conectado a Socket.io');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Desconectado de Socket.io');
    });

    this.socket.on('error', (error) => {
      console.error('Error de Socket.io:', error);
      this.showError(error.message || 'Error de conexión');
    });

    // Eventos del chat
    this.setupChatEvents();
  },

  // Configurar eventos del chat
  setupChatEvents() {
    // Nuevo mensaje
    this.socket.on('new-message', (message) => {
      this.handleNewMessage(message);
    });

    // Usuario escribiendo
    this.socket.on('user-typing', (data) => {
      this.handleUserTyping(data);
    });

    // Mensajes leídos
    this.socket.on('messages-read', (data) => {
      this.handleMessagesRead(data);
    });

    // Usuarios online
    this.socket.on('users-online', (userIds) => {
      this.updateOnlineUsers(userIds);
    });
  },

  // Desconectar Socket.io
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  },

  // ===== RENDERIZADO DE UI =====

  // Renderizar vista principal de chats
  async renderChatList() {
    try {
      const response = await fetch(`${API_CONFIG.API_URL}/chats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Error cargando chats');

      this.chats = await response.json();

      return `
        <div class="chat-container">
          <div class="chat-sidebar">
            <div class="chat-header">
              <h2>💬 Mensajes</h2>
              <button class="btn-primary" onclick="ChatModule.showNewChatModal()">
                + Nuevo Chat
              </button>
            </div>
            <div class="chat-list">
              ${this.chats.length === 0
                ? '<p class="no-chats">No tienes conversaciones aún</p>'
                : this.chats.map(chat => this.renderChatItem(chat)).join('')
              }
            </div>
          </div>
          <div class="chat-main">
            <div class="chat-welcome">
              <h2>Bienvenido al Chat</h2>
              <p>Selecciona una conversación o inicia una nueva</p>
            </div>
          </div>
        </div>
      `;
    } catch (error) {
      console.error('Error cargando chats:', error);
      return '<p class="error">Error cargando chats</p>';
    }
  },

  // Renderizar item de chat en la lista
  renderChatItem(chat) {
    const otherUser = chat.isGroup
      ? null
      : chat.participants.find(p => p._id !== this.currentUser?._id);

    const chatName = chat.isGroup ? chat.groupName : otherUser?.name || 'Usuario';
    const lastMessageText = chat.lastMessage?.content || 'Sin mensajes';
    const lastMessageTime = chat.lastMessage?.timestamp
      ? this.formatTime(new Date(chat.lastMessage.timestamp))
      : '';

    return `
      <div class="chat-item ${this.currentChatId === chat._id ? 'active' : ''}"
           onclick="ChatModule.openChat('${chat._id}')">
        <div class="chat-item-avatar">
          ${chat.isGroup ? '👥' : '👤'}
        </div>
        <div class="chat-item-content">
          <div class="chat-item-header">
            <h3>${chatName}</h3>
            <span class="chat-item-time">${lastMessageTime}</span>
          </div>
          <p class="chat-item-last-message">${this.truncate(lastMessageText, 50)}</p>
        </div>
      </div>
    `;
  },

  // Abrir un chat
  async openChat(chatId) {
    try {
      this.currentChatId = chatId;

      // Salir del chat anterior
      if (this.socket && this.currentChatId) {
        this.socket.emit('leave-chat', this.currentChatId);
      }

      // Unirse al nuevo chat
      this.socket.emit('join-chat', chatId);

      // Obtener mensajes
      const response = await fetch(`${API_CONFIG.API_URL}/chats/${chatId}/messages`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Error cargando mensajes');

      const messages = await response.json();
      this.messages[chatId] = messages;

      // Marcar mensajes como leídos
      await this.markMessagesAsRead(chatId);

      // Re-renderizar
      this.renderChatWindow(chatId);
    } catch (error) {
      console.error('Error abriendo chat:', error);
      this.showError('Error abriendo chat');
    }
  },

  // Renderizar ventana de chat
  renderChatWindow(chatId) {
    const chat = this.chats.find(c => c._id === chatId);
    if (!chat) return;

    const otherUser = chat.isGroup
      ? null
      : chat.participants.find(p => p._id !== this.currentUser?._id);

    const chatName = chat.isGroup ? chat.groupName : otherUser?.name || 'Usuario';
    const messages = this.messages[chatId] || [];

    const chatMain = document.querySelector('.chat-main');
    if (!chatMain) return;

    chatMain.innerHTML = `
      <div class="chat-window">
        <div class="chat-window-header">
          <div>
            <h3>${chatName}</h3>
            <span class="chat-status" id="chatStatus">
              ${chat.isGroup ? `${chat.participants.length} participantes` : 'Online'}
            </span>
          </div>
          <button onclick="ChatModule.closeChat()" class="btn-secondary">✕</button>
        </div>
        <div class="chat-messages" id="chatMessages">
          ${messages.map(msg => this.renderMessage(msg)).join('')}
        </div>
        <div class="chat-typing" id="chatTyping"></div>
        <div class="chat-input-container">
          <textarea
            id="chatInput"
            placeholder="Escribe un mensaje..."
            onkeydown="ChatModule.handleInputKeydown(event)"
            oninput="ChatModule.handleInputChange()"
          ></textarea>
          <button onclick="ChatModule.sendMessage()" class="btn-primary">
            Enviar ➤
          </button>
        </div>
      </div>
    `;

    // Scroll al final
    this.scrollToBottom();

    // Actualizar lista de chats
    this.updateChatList();
  },

  // Renderizar mensaje
  renderMessage(message) {
    const isOwn = message.sender._id === this.currentUser?._id;
    const time = this.formatTime(new Date(message.createdAt));

    return `
      <div class="message ${isOwn ? 'message-own' : 'message-other'}">
        <div class="message-content">
          ${!isOwn ? `<strong>${message.sender.name}:</strong> ` : ''}
          ${this.escapeHtml(message.content)}
          <span class="message-time">${time}</span>
        </div>
      </div>
    `;
  },

  // Enviar mensaje
  async sendMessage() {
    const input = document.getElementById('chatInput');
    if (!input) return;

    const content = input.value.trim();
    if (!content || !this.currentChatId) return;

    // Enviar por Socket.io
    this.socket.emit('send-message', {
      chatId: this.currentChatId,
      content
    });

    // Limpiar input
    input.value = '';
    input.style.height = 'auto';

    // Detener indicador de "escribiendo"
    this.socket.emit('typing', {
      chatId: this.currentChatId,
      isTyping: false
    });
  },

  // Manejar nuevo mensaje
  handleNewMessage(message) {
    const chatId = message.chatId;

    // Agregar mensaje al array
    if (!this.messages[chatId]) {
      this.messages[chatId] = [];
    }
    this.messages[chatId].push(message);

    // Si es el chat actual, renderizar
    if (this.currentChatId === chatId) {
      const messagesContainer = document.getElementById('chatMessages');
      if (messagesContainer) {
        messagesContainer.innerHTML += this.renderMessage(message);
        this.scrollToBottom();
      }

      // Marcar como leído
      this.markMessagesAsRead(chatId);
    }

    // Actualizar lista de chats
    const chatIndex = this.chats.findIndex(c => c._id === chatId);
    if (chatIndex !== -1) {
      this.chats[chatIndex].lastMessage = {
        content: message.content,
        sender: message.sender._id,
        timestamp: message.createdAt
      };
      this.updateChatList();
    }
  },

  // Manejar usuario escribiendo
  handleUserTyping(data) {
    if (data.chatId !== this.currentChatId) return;

    const typingDiv = document.getElementById('chatTyping');
    if (!typingDiv) return;

    if (data.isTyping) {
      // Obtener nombre del usuario
      const chat = this.chats.find(c => c._id === data.chatId);
      const user = chat?.participants.find(p => p._id === data.userId);
      const userName = user?.name || 'Alguien';

      typingDiv.textContent = `${userName} está escribiendo...`;
      typingDiv.style.display = 'block';

      // Limpiar después de 3 segundos
      clearTimeout(this.typingTimeouts[data.userId]);
      this.typingTimeouts[data.userId] = setTimeout(() => {
        typingDiv.style.display = 'none';
      }, 3000);
    } else {
      typingDiv.style.display = 'none';
    }
  },

  // Manejar mensajes leídos
  handleMessagesRead(data) {
    // Aquí podrías actualizar UI para mostrar "✓✓" como WhatsApp
    console.log('Mensajes leídos:', data);
  },

  // Actualizar usuarios online
  updateOnlineUsers(userIds) {
    this.onlineUsers = userIds;
    // Actualizar UI si es necesario
  },

  // Marcar mensajes como leídos
  async markMessagesAsRead(chatId) {
    try {
      await fetch(`${API_CONFIG.API_URL}/chats/${chatId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
    } catch (error) {
      console.error('Error marcando mensajes como leídos:', error);
    }
  },

  // Manejar keydown en input
  handleInputKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  },

  // Manejar cambio en input (indicador de "escribiendo")
  handleInputChange() {
    if (!this.currentChatId) return;

    // Emitir evento de "escribiendo"
    this.socket.emit('typing', {
      chatId: this.currentChatId,
      isTyping: true
    });

    // Detener después de 1 segundo sin escribir
    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.socket.emit('typing', {
        chatId: this.currentChatId,
        isTyping: false
      });
    }, 1000);
  },

  // Cerrar chat
  closeChat() {
    if (this.currentChatId) {
      this.socket.emit('leave-chat', this.currentChatId);
      this.currentChatId = null;
    }

    const chatMain = document.querySelector('.chat-main');
    if (chatMain) {
      chatMain.innerHTML = `
        <div class="chat-welcome">
          <h2>Bienvenido al Chat</h2>
          <p>Selecciona una conversación o inicia una nueva</p>
        </div>
      `;
    }

    this.updateChatList();
  },

  // Mostrar modal de nuevo chat
  async showNewChatModal() {
    // Obtener usuarios disponibles
    try {
      const response = await fetch(`${API_CONFIG.API_URL}/chats/users/available`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Error cargando usuarios');

      const users = await response.json();

      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <h2>Nuevo Chat</h2>
            <button onclick="this.closest('.modal-overlay').remove()">✕</button>
          </div>
          <div class="modal-body">
            <input type="text" id="userSearch" placeholder="Buscar usuario..." class="form-control">
            <div class="user-list">
              ${users.map(user => `
                <div class="user-item" onclick="ChatModule.createDirectChat('${user._id}', this.closest('.modal-overlay'))">
                  <span>👤 ${user.name}</span>
                  <span class="user-role">${user.role}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // Búsqueda de usuarios
      const searchInput = document.getElementById('userSearch');
      searchInput.addEventListener('input', (e) => {
        const search = e.target.value.toLowerCase();
        const items = modal.querySelectorAll('.user-item');
        items.forEach(item => {
          const text = item.textContent.toLowerCase();
          item.style.display = text.includes(search) ? 'flex' : 'none';
        });
      });
    } catch (error) {
      console.error('Error mostrando modal:', error);
      this.showError('Error cargando usuarios');
    }
  },

  // Crear chat directo
  async createDirectChat(participantId, modal) {
    try {
      const response = await fetch(`${API_CONFIG.API_URL}/chats/direct`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ participantId })
      });

      if (!response.ok) throw new Error('Error creando chat');

      const chat = await response.json();

      // Agregar a la lista si es nuevo
      if (!this.chats.find(c => c._id === chat._id)) {
        this.chats.unshift(chat);
      }

      // Cerrar modal
      modal.remove();

      // Abrir chat
      this.openChat(chat._id);
    } catch (error) {
      console.error('Error creando chat:', error);
      this.showError('Error creando chat');
    }
  },

  // Actualizar lista de chats
  updateChatList() {
    const chatList = document.querySelector('.chat-list');
    if (!chatList) return;

    chatList.innerHTML = this.chats.length === 0
      ? '<p class="no-chats">No tienes conversaciones aún</p>'
      : this.chats.map(chat => this.renderChatItem(chat)).join('');
  },

  // ===== UTILIDADES =====

  scrollToBottom() {
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  },

  formatTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;

    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
  },

  truncate(str, length) {
    return str.length > length ? str.substring(0, length) + '...' : str;
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  showError(message) {
    alert(message); // TODO: Mejorar con un toast notification
  }
};

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Se inicializará desde app.js cuando el usuario haga login
  });
}
