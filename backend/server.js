require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging de requests en desarrollo
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Conectar a MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch((err) => console.error('❌ Error conectando MongoDB:', err));

// Servir archivos estáticos del frontend en producción (PRIMERO)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend')));
}

// Rutas de API (DESPUÉS de static pero ANTES del catch-all)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/medications', require('./routes/medications'));
app.use('/api/reminders', require('./routes/reminders'));
app.use('/api/consultations', require('./routes/consultations'));
app.use('/api/analytics', require('./routes/analytics'));

// Rutas de cuestionarios - HABILITADO
app.use('/api/questionnaires', require('./routes/questionnaires'));

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'FarmaFollow API funcionando correctamente',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Catch-all route SOLO para rutas que NO son API (DEBE IR AL FINAL)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    // Solo servir index.html si NO es una ruta de API
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '../frontend/index.html'));
    } else {
      res.status(404).json({ error: 'API route not found' });
    }
  });
}

// Manejo de errores 404 (desarrollo)
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    res.status(404).json({ error: 'Ruta no encontrada' });
  } else {
    next();
  }
});

// Manejo de errores generales
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'production' ? 'Ha ocurrido un error' : err.message
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📊 Entorno: ${process.env.NODE_ENV || 'development'}`);
});