# Guía de Despliegue - FarmaFollow

## Despliegue en Render.com

### Requisitos Previos

1. **Cuenta en Render.com**: https://render.com/
2. **Base de datos MongoDB**:
   - Opción recomendada: MongoDB Atlas (https://cloud.mongodb.com/)
   - Plan gratuito disponible

### Pasos para Desplegar

#### 1. Configurar MongoDB Atlas

1. Crea una cuenta en MongoDB Atlas
2. Crea un nuevo cluster (puedes usar el tier gratuito M0)
3. Configura un usuario de base de datos:
   - Database Access → Add New Database User
   - Guarda el usuario y contraseña
4. Configura Network Access:
   - Network Access → Add IP Address
   - Selecciona "Allow Access from Anywhere" (0.0.0.0/0)
5. Obtén la cadena de conexión:
   - Clusters → Connect → Connect your application
   - Copia la URI (se ve como: `mongodb+srv://...`)

#### 2. Desplegar en Render

##### Opción A: Usando el archivo render.yaml (Recomendado)

1. Haz fork de este repositorio o conecta tu repositorio a Render
2. En Render Dashboard, crea un nuevo "Blueprint"
3. Conecta tu repositorio de GitHub
4. Render detectará automáticamente el archivo `render.yaml`
5. Configura las variables de entorno en el Dashboard de Render:
   - `MONGODB_URI`: Tu URI de MongoDB Atlas
   - `JWT_SECRET`: Se generará automáticamente
6. Haz clic en "Apply" para desplegar

##### Opción B: Configuración Manual

1. En Render Dashboard, crea un nuevo "Web Service"
2. Conecta tu repositorio de GitHub
3. Configura el servicio:
   - **Name**: farmafollow-backend
   - **Runtime**: Node
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`
   - **Environment Variables**:
     ```
     NODE_ENV=production
     MONGODB_URI=<tu-mongodb-uri>
     JWT_SECRET=<genera-un-secreto-seguro>
     PORT=5000
     ```
4. Haz clic en "Create Web Service"

### 3. Verificar el Despliegue

Una vez desplegado, visita:
- `https://tu-app.onrender.com/api/health` - Debería devolver `{"status": "ok"}`
- `https://tu-app.onrender.com/` - Debería mostrar la aplicación FarmaFollow

### Solución de Problemas Comunes

#### Error 403 Forbidden

**Causa**: El servicio no está configurado correctamente o las variables de entorno están faltantes.

**Solución**:
1. Verifica que `MONGODB_URI` esté configurada correctamente en las variables de entorno de Render
2. Revisa los logs en Render Dashboard → Logs
3. Asegúrate de que MongoDB Atlas permita conexiones desde cualquier IP (0.0.0.0/0)
4. Verifica que el usuario de MongoDB tenga permisos de lectura/escritura

#### Error de Conexión a MongoDB

**Síntomas**: El servidor inicia pero no puede conectarse a la base de datos.

**Solución**:
1. Verifica que la URI de MongoDB sea correcta
2. Asegúrate de reemplazar `<password>` con tu contraseña real
3. Verifica que MongoDB Atlas permita conexiones desde Render
4. Revisa los logs del servidor para más detalles

#### El sitio carga pero no funciona

**Solución**:
1. Abre las herramientas de desarrollo del navegador (F12)
2. Revisa la consola en busca de errores
3. Verifica que las llamadas a `/api/*` se estén completando correctamente
4. Asegúrate de que `NODE_ENV=production` esté configurado

### Variables de Entorno Requeridas

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `NODE_ENV` | Entorno de ejecución | `production` |
| `MONGODB_URI` | URI de conexión a MongoDB | `mongodb+srv://user:pass@cluster.mongodb.net/farmafollow` |
| `JWT_SECRET` | Clave secreta para tokens JWT | Cadena aleatoria de 32+ caracteres |
| `PORT` | Puerto del servidor (Render lo asigna automáticamente) | `5000` |

### Generar JWT_SECRET Seguro

Ejecuta este comando en tu terminal:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Monitoreo y Logs

- **Logs en tiempo real**: Render Dashboard → Tu servicio → Logs
- **Health check**: `https://tu-app.onrender.com/api/health`
- **Métricas**: Render Dashboard → Tu servicio → Metrics

### Actualización del Sitio

Render despliega automáticamente cuando haces push a la rama configurada (generalmente `main` o `master`). Para desplegar manualmente:

1. Ve a Render Dashboard → Tu servicio
2. Haz clic en "Manual Deploy" → "Deploy latest commit"

### Consideraciones de Seguridad

1. **NUNCA** subas archivos `.env` al repositorio
2. Usa contraseñas seguras para MongoDB
3. Rota el `JWT_SECRET` periódicamente
4. Mantén las dependencias actualizadas: `npm audit`
5. Configura correctamente CORS si necesitas acceso desde otros dominios

### Soporte

Para problemas con:
- **Render**: https://render.com/docs
- **MongoDB Atlas**: https://docs.atlas.mongodb.com/
- **Este proyecto**: Abre un issue en GitHub
