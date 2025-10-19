const jwt = require('jsonwebtoken');

// Middleware de autenticación
const auth = async (req, res, next) => {
  try {
    // Obtener token del header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }
    
    const token = authHeader.substring(7); // Remover "Bearer "
    
    // Verificar token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded; // { userId, role }
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
    
  } catch (error) {
    console.error('Error en middleware de autenticación:', error);
    res.status(500).json({ error: 'Error en autenticación' });
  }
};

// Exportar como función directa
module.exports = auth;