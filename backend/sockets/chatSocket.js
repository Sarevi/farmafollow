const jwt = require('jsonwebtoken');
const Chat = require('../models/Chat');
const Message = require('../models/Message');

// Store de usuarios conectados: { userId: socketId }
const connectedUsers = new Map();

function setupChatSocket(io) {
  // Middleware de autenticación para sockets
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Token de autenticación requerido'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;

      next();
    } catch (error) {
      console.error('Error de autenticación en socket:', error.message);
      next(new Error('Token inválido o expirado'));
    }
  });

  // Manejar conexiones
  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`✅ Usuario conectado: ${userId} (Socket: ${socket.id})`);

    // Registrar usuario conectado
    connectedUsers.set(userId, socket.id);

    // Emitir lista de usuarios online a todos
    io.emit('users-online', Array.from(connectedUsers.keys()));

    // ===== EVENTOS DEL CHAT =====

    // Unirse a un chat (room)
    socket.on('join-chat', async (chatId) => {
      try {
        // Verificar que el usuario tiene acceso a este chat
        const chat = await Chat.findOne({
          _id: chatId,
          participants: userId
        });

        if (!chat) {
          socket.emit('error', { message: 'No tienes acceso a este chat' });
          return;
        }

        socket.join(chatId);
        console.log(`👥 Usuario ${userId} se unió al chat ${chatId}`);

        // Notificar a otros usuarios del chat que este usuario se unió
        socket.to(chatId).emit('user-joined-chat', {
          userId,
          chatId,
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Error al unirse al chat:', error);
        socket.emit('error', { message: 'Error al unirse al chat' });
      }
    });

    // Salir de un chat (room)
    socket.on('leave-chat', (chatId) => {
      socket.leave(chatId);
      console.log(`👋 Usuario ${userId} salió del chat ${chatId}`);

      socket.to(chatId).emit('user-left-chat', {
        userId,
        chatId,
        timestamp: new Date()
      });
    });

    // Enviar mensaje
    socket.on('send-message', async (data) => {
      try {
        const { chatId, content, type = 'text' } = data;

        if (!content || !chatId) {
          socket.emit('error', { message: 'Contenido y chatId son requeridos' });
          return;
        }

        // Verificar acceso al chat
        const chat = await Chat.findOne({
          _id: chatId,
          participants: userId
        });

        if (!chat) {
          socket.emit('error', { message: 'No tienes acceso a este chat' });
          return;
        }

        // Crear mensaje en la base de datos
        const message = await Message.create({
          chatId,
          sender: userId,
          content,
          type,
          readBy: [userId] // El emisor siempre lo ha "leído"
        });

        // Poblar datos del sender
        await message.populate('sender', 'name email');

        // Actualizar último mensaje del chat
        chat.lastMessage = {
          content,
          sender: userId,
          timestamp: message.createdAt
        };
        chat.updatedAt = new Date();
        await chat.save();

        // Emitir mensaje a todos en el chat (incluyendo al emisor)
        io.to(chatId).emit('new-message', {
          ...message.toObject(),
          chatId
        });

        console.log(`💬 Mensaje enviado en chat ${chatId} por usuario ${userId}`);
      } catch (error) {
        console.error('Error enviando mensaje:', error);
        socket.emit('error', { message: 'Error enviando mensaje' });
      }
    });

    // Usuario está escribiendo
    socket.on('typing', async (data) => {
      try {
        const { chatId, isTyping } = data;

        // Verificar acceso al chat
        const chat = await Chat.findOne({
          _id: chatId,
          participants: userId
        });

        if (!chat) {
          return;
        }

        // Emitir a otros usuarios del chat (no al emisor)
        socket.to(chatId).emit('user-typing', {
          userId,
          chatId,
          isTyping,
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Error en evento typing:', error);
      }
    });

    // Marcar mensajes como leídos
    socket.on('mark-read', async (data) => {
      try {
        const { chatId, messageIds } = data;

        // Verificar acceso al chat
        const chat = await Chat.findOne({
          _id: chatId,
          participants: userId
        });

        if (!chat) {
          return;
        }

        // Actualizar mensajes
        await Message.updateMany(
          {
            _id: { $in: messageIds },
            chatId,
            readBy: { $ne: userId }
          },
          {
            $addToSet: { readBy: userId }
          }
        );

        // Notificar a otros usuarios del chat
        socket.to(chatId).emit('messages-read', {
          userId,
          chatId,
          messageIds,
          timestamp: new Date()
        });

        console.log(`✓ Mensajes marcados como leídos en chat ${chatId} por usuario ${userId}`);
      } catch (error) {
        console.error('Error marcando mensajes como leídos:', error);
      }
    });

    // Desconexión
    socket.on('disconnect', () => {
      connectedUsers.delete(userId);
      console.log(`❌ Usuario desconectado: ${userId} (Socket: ${socket.id})`);

      // Emitir lista actualizada de usuarios online
      io.emit('users-online', Array.from(connectedUsers.keys()));
    });

    // Manejar errores del socket
    socket.on('error', (error) => {
      console.error(`Error en socket ${socket.id}:`, error);
    });
  });

  console.log('✅ Manejadores de Socket.io configurados');
}

// Obtener usuarios conectados
function getConnectedUsers() {
  return Array.from(connectedUsers.keys());
}

// Verificar si un usuario está conectado
function isUserOnline(userId) {
  return connectedUsers.has(userId);
}

module.exports = {
  setupChatSocket,
  getConnectedUsers,
  isUserOnline
};
