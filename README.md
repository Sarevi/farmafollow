# 💊 FarmaFollow

Plataforma integral de seguimiento farmacoterapéutico y gestión de estudios observacionales del mundo real (Real-World Evidence - RWE).

## 🚀 Características Principales

### 📊 Seguimiento Farmacoterapéutico
- Gestión de pacientes y medicamentos
- Sistema de recordatorios inteligentes
- Historial clínico completo
- Análisis de adherencia y efectividad

### 🔬 Estudios RWE (Real-World Evidence)
- Constructor de estudios observacionales
- Timeline clínico visual unificado
- Intervenciones farmacéuticas documentadas
- Exportación a estándares científicos (STROBE, FAIR, OMOP CDM, FHIR)

### 🧠 Inteligencia Clínica
- Detección automática de patrones
- Señales de alerta temprana
- Análisis predictivo de adherencia
- Dashboard de métricas en tiempo real

### 📋 Cuestionarios y Consentimientos
- PROs estandarizados (EQ-5D-5L, SF-36, PHQ-9, etc.)
- Consentimientos dinámicos (GDPR, HIPAA, ICH-GCP)
- Sistema de recordatorios automatizado
- Análisis comparativo de resultados

### 🎨 Interfaz Moderna
- Diseño responsive (móvil/tablet/desktop)
- Tema oscuro/claro
- PWA (Progressive Web App)
- Búsqueda global con resultados en tiempo real
- Atajos de teclado para navegación rápida

## 🛠️ Tecnologías

### Backend
- **Node.js** + **Express.js** - API REST
- **MongoDB** + **Mongoose** - Base de datos NoSQL
- **JWT** - Autenticación y autorización
- **bcryptjs** - Encriptación de contraseñas
- **Nodemailer** - Envío de emails

### Frontend
- **Vanilla JavaScript** - Sin frameworks pesados
- **Chart.js** - Visualizaciones interactivas
- **CSS3** + **CSS Grid/Flexbox** - Diseño responsive
- **Service Worker** - Funcionalidad offline (PWA)

## 📦 Instalación Local

### Requisitos Previos
- Node.js >= 16.0.0
- MongoDB (local o MongoDB Atlas)
- npm o yarn

### 1. Clonar el Repositorio

```bash
git clone https://github.com/Sarevi/farmafollow.git
cd farmafollow
```

### 2. Configurar el Backend

```bash
cd backend
npm install
```

Crea un archivo `.env` basado en `.env.example`:

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales:

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/farmafollow
JWT_SECRET=tu_secreto_super_seguro_aqui
```

### 3. Iniciar el Servidor

```bash
# Modo desarrollo (con nodemon)
npm run dev

# Modo producción
npm start
```

El servidor estará disponible en `http://localhost:5000`

### 4. Abrir el Frontend

Abre `frontend/index.html` en tu navegador, o usa un servidor local:

```bash
# Opción 1: Python
cd frontend
python -m http.server 8000

# Opción 2: Node.js http-server
npx http-server frontend -p 8000
```

Visita `http://localhost:8000`

## 🌐 Despliegue en Producción

Consulta la [Guía de Despliegue](DEPLOYMENT.md) para instrucciones detalladas sobre cómo desplegar en:
- **Render.com** (Recomendado para el backend)
- **Netlify/Vercel** (Opcionales para el frontend)
- **MongoDB Atlas** (Base de datos en la nube)

### Despliegue Rápido en Render

1. Crea una cuenta en [Render.com](https://render.com/)
2. Conecta tu repositorio de GitHub
3. Render detectará automáticamente el archivo `render.yaml`
4. Configura las variables de entorno (especialmente `MONGODB_URI`)
5. ¡Despliega!

## 📱 Uso de la Aplicación

### Primera Vez

1. **Registro**: Crea una cuenta con email y contraseña
2. **Login**: Inicia sesión con tus credenciales
3. **Dashboard**: Explora las diferentes secciones del menú

### Usuarios de Ejemplo (Desarrollo)

Puedes crear usuarios manualmente o usar la API:

```bash
POST /api/auth/register
{
  "name": "Dr. Juan Pérez",
  "email": "juan@farmafollow.com",
  "password": "password123",
  "role": "pharmacist"
}
```

### Roles Disponibles

- **patient**: Paciente (puede ver su propio historial)
- **pharmacist**: Farmacéutico (acceso completo)
- **admin**: Administrador (gestión de usuarios)

## 🔧 Desarrollo

### Estructura del Proyecto

```
farmafollow/
├── backend/
│   ├── models/          # Modelos de MongoDB
│   ├── routes/          # Rutas de la API
│   ├── middleware/      # Middlewares (auth, etc.)
│   ├── services/        # Lógica de negocio
│   ├── server.js        # Punto de entrada
│   └── package.json
├── frontend/
│   ├── js/              # JavaScript modules
│   ├── css/             # Estilos
│   ├── index.html       # Página principal
│   └── manifest.json    # PWA manifest
├── render.yaml          # Configuración de Render
├── DEPLOYMENT.md        # Guía de despliegue
└── README.md           # Este archivo
```

### Scripts Disponibles

```bash
# Backend
npm start          # Iniciar servidor (producción)
npm run dev        # Iniciar servidor (desarrollo con nodemon)

# Generar JWT Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Variables de Entorno

Ver `backend/.env.example` para la lista completa de variables de entorno necesarias.

## 🐛 Solución de Problemas

### Error: "Cannot connect to MongoDB"

**Solución**: Verifica que MongoDB esté corriendo y que `MONGODB_URI` sea correcta.

```bash
# MongoDB local
mongod

# Verificar conexión
mongo mongodb://localhost:27017/farmafollow
```

### Error 403 en Render.com

**Causa**: Variables de entorno no configuradas.

**Solución**: Configura `MONGODB_URI` en el Dashboard de Render.

### La aplicación no carga

**Solución**:
1. Verifica que el backend esté corriendo: `http://localhost:5000/api/health`
2. Revisa la consola del navegador (F12) en busca de errores
3. Asegúrate de que `config.js` tenga la URL correcta de la API

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

ISC License - Ver el archivo `package.json` para más detalles.

## 👥 Autores

- **Equipo FarmaFollow** - Desarrollo inicial

## 🙏 Agradecimientos

- Chart.js por las visualizaciones
- MongoDB por la base de datos
- Render.com por el hosting gratuito
- La comunidad de farmacéuticos que inspira este proyecto

## 📞 Soporte

¿Problemas? ¿Preguntas?
- 📖 Lee la [Guía de Despliegue](DEPLOYMENT.md)
- 🐛 Reporta bugs en [GitHub Issues](https://github.com/Sarevi/farmafollow/issues)
- 📧 Contacta al equipo de desarrollo

---

**Hecho con ❤️ para mejorar el seguimiento farmacoterapéutico**
