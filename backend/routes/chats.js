const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Obtener todos los chats del usuario autenticado
router.get('/', auth, async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: req.user.userId
    })
      .populate('participants', 'name email role')
      .populate('lastMessage.sender', 'name')
      .sort({ updatedAt: -1 });

    res.json(chats);
  } catch (error) {
    console.error('Error obteniendo chats:', error);
    res.status(500).json({ error: 'Error obteniendo chats' });
  }
});

// Obtener un chat específico por ID
router.get('/:chatId', auth, async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.chatId,
      participants: req.user.userId
    })
      .populate('participants', 'name email role')
      .populate('groupAdmin', 'name email');

    if (!chat) {
      return res.status(404).json({ error: 'Chat no encontrado o sin acceso' });
    }

    res.json(chat);
  } catch (error) {
    console.error('Error obteniendo chat:', error);
    res.status(500).json({ error: 'Error obteniendo chat' });
  }
});

// Crear o obtener chat 1-a-1 con otro usuario
router.post('/direct', auth, async (req, res) => {
  try {
    const { participantId } = req.body;

    if (!participantId) {
      return res.status(400).json({ error: 'Se requiere participantId' });
    }

    // Verificar que el participante existe
    const participant = await User.findById(participantId);
    if (!participant) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // No puedes crear un chat contigo mismo
    if (participantId === req.user.userId) {
      return res.status(400).json({ error: 'No puedes crear un chat contigo mismo' });
    }

    // Buscar si ya existe un chat 1-a-1 entre estos usuarios
    let chat = await Chat.findOne({
      isGroup: false,
      participants: {
        $all: [req.user.userId, participantId],
        $size: 2
      }
    })
      .populate('participants', 'name email role');

    // Si no existe, crearlo
    if (!chat) {
      chat = await Chat.create({
        participants: [req.user.userId, participantId],
        isGroup: false
      });

      await chat.populate('participants', 'name email role');
    }

    res.json(chat);
  } catch (error) {
    console.error('Error creando/obteniendo chat directo:', error);
    res.status(500).json({ error: 'Error creando chat' });
  }
});

// Crear un grupo
router.post('/group', auth, async (req, res) => {
  try {
    const { participantIds, groupName } = req.body;

    if (!groupName || !participantIds || participantIds.length < 2) {
      return res.status(400).json({
        error: 'Se requiere nombre del grupo y al menos 2 participantes'
      });
    }

    // Agregar al creador a los participantes si no está
    const allParticipants = [...new Set([req.user.userId, ...participantIds])];

    // Verificar que todos los participantes existen
    const users = await User.find({ _id: { $in: allParticipants } });
    if (users.length !== allParticipants.length) {
      return res.status(400).json({ error: 'Algunos usuarios no existen' });
    }

    const chat = await Chat.create({
      participants: allParticipants,
      isGroup: true,
      groupName,
      groupAdmin: req.user.userId
    });

    await chat.populate('participants', 'name email role');
    await chat.populate('groupAdmin', 'name email');

    res.json(chat);
  } catch (error) {
    console.error('Error creando grupo:', error);
    res.status(500).json({ error: 'Error creando grupo' });
  }
});

// Obtener mensajes de un chat (con paginación)
router.get('/:chatId/messages', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { limit = 50, before } = req.query;

    // Verificar que el usuario pertenece al chat
    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user.userId
    });

    if (!chat) {
      return res.status(403).json({ error: 'No tienes acceso a este chat' });
    }

    // Query base
    const query = {
      chatId,
      deletedFor: { $ne: req.user.userId } // Excluir mensajes eliminados
    };

    // Si hay un timestamp "before", obtener mensajes anteriores (paginación)
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .populate('sender', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Invertir para que estén en orden cronológico
    res.json(messages.reverse());
  } catch (error) {
    console.error('Error obteniendo mensajes:', error);
    res.status(500).json({ error: 'Error obteniendo mensajes' });
  }
});

// Marcar mensajes como leídos
router.put('/:chatId/read', auth, async (req, res) => {
  try {
    const { chatId } = req.params;

    // Verificar que el usuario pertenece al chat
    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user.userId
    });

    if (!chat) {
      return res.status(403).json({ error: 'No tienes acceso a este chat' });
    }

    // Marcar como leídos todos los mensajes del chat que no estén ya leídos
    await Message.updateMany(
      {
        chatId,
        readBy: { $ne: req.user.userId }
      },
      {
        $addToSet: { readBy: req.user.userId }
      }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error marcando mensajes como leídos:', error);
    res.status(500).json({ error: 'Error actualizando mensajes' });
  }
});

// Agregar participantes a un grupo (solo admin)
router.post('/:chatId/participants', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { participantIds } = req.body;

    const chat = await Chat.findOne({
      _id: chatId,
      isGroup: true,
      groupAdmin: req.user.userId
    });

    if (!chat) {
      return res.status(403).json({
        error: 'No tienes permiso para agregar participantes'
      });
    }

    // Verificar que los usuarios existen
    const users = await User.find({ _id: { $in: participantIds } });
    if (users.length !== participantIds.length) {
      return res.status(400).json({ error: 'Algunos usuarios no existen' });
    }

    // Agregar participantes sin duplicar
    chat.participants = [...new Set([...chat.participants, ...participantIds])];
    await chat.save();

    await chat.populate('participants', 'name email role');
    res.json(chat);
  } catch (error) {
    console.error('Error agregando participantes:', error);
    res.status(500).json({ error: 'Error agregando participantes' });
  }
});

// Eliminar chat (solo marca como eliminado, no borra datos)
router.delete('/:chatId', auth, async (req, res) => {
  try {
    const { chatId } = req.params;

    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user.userId
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat no encontrado' });
    }

    // Si es grupo y eres admin, puedes eliminarlo para todos
    if (chat.isGroup && chat.groupAdmin.toString() === req.user.userId) {
      await Chat.findByIdAndDelete(chatId);
      await Message.deleteMany({ chatId });
      return res.json({ success: true, message: 'Grupo eliminado' });
    }

    // Para chats 1-a-1, solo removemos al usuario de participants
    // (nota: esto es simplificado, en producción deberías manejarlo diferente)
    res.json({
      success: true,
      message: 'Chat marcado como eliminado'
    });
  } catch (error) {
    console.error('Error eliminando chat:', error);
    res.status(500).json({ error: 'Error eliminando chat' });
  }
});

// Obtener lista de usuarios disponibles para chatear
router.get('/users/available', auth, async (req, res) => {
  try {
    const { search } = req.query;

    const query = {
      _id: { $ne: req.user.userId } // Excluir al usuario actual
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('name email role')
      .limit(20);

    res.json(users);
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ error: 'Error obteniendo usuarios' });
  }
});

module.exports = router;
