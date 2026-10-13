# Póster Lab

Editor de pósters para el proyecto de tesis. React/Vite y Express/SQLite.

## Iniciar (dos terminales)

Backend:
```powershell
cd Back
npm install
npm run dev
```

Frontend:
```powershell
cd Front
npm install
npm run dev
```

Abre la URL que indique Vite. El frontend envía `/api` al backend en `127.0.0.1:3000`.

## Actividad y entrega

1. Ingresa un código de participante, por ejemplo `P001` (letras, números, guion o guion bajo; hasta 40 caracteres).
2. Comienza la actividad: se registra la hora de inicio y aparece un tema aleatorio provisional.
3. Arrastra textos, formas y stickers; usa el pincel para dibujar. Selecciona elementos para moverlos, cambiar tamaño/color/texto, traer al frente o eliminar. Deshacer conserva hasta 40 cambios en la sesión.
4. Descargar PNG guarda una copia local de 1440 × 1920 píxeles.
5. Entregar póster solicita confirmación, envía la imagen y muestra el folio al recibir respuesta del servidor. La versión entregada queda bloqueada para editar. Nueva actividad permite comenzar otro envío.
6. Consultar entregas → ingresa como administrador → Actualizar muestra participante, tema, inicio, entrega, duración y un enlace para descargar cada PNG.

El borrador y el comprobante se guardan en localStorage. Un error de red permite reintentar; el identificador de actividad evita duplicados. Para borradores de la versión anterior se solicita el código y registrar inicio ahora; no se reconstruye el tiempo anterior.

## Almacenamiento

- PNG: `Back/data/posters/`.
- Metadatos SQLite: `Back/data/entregas.sqlite`.
- Estos archivos se excluyen de Git. Para respaldar, detén el backend y copia toda la carpeta `Back/data`.
- La entrega tiene fecha del servidor. La hora de inicio proviene del navegador; la duración es tiempo transcurrido, incluye pausas/cierres y depende de que el reloj del participante sea correcto. Se aceptan actividades de hasta 30 días.
- El servidor valida formato PNG, integridad, dimensiones y límite de 8 MB de imagen.

## Uso local

En desarrollo ambos escuchan en `127.0.0.1`. Configura `Back/.env` desde `.env.example` con `ADMIN_PASSWORD` (12 a 200 caracteres) y `APP_ORIGIN=http://127.0.0.1:5173`. Reinicia el backend. Consulta y PNG requieren sesión de administrador; sin contraseña configurada quedan cerrados. La sesión usa cookie HttpOnly, expira a las 8 horas y permite cerrar sesión. No exponer el servidor de desarrollo mediante túneles.

Los stickers son emojis cuyo aspecto depende del sistema. Los temas en `Front/src/App.jsx` son provisionales. Esta versión no incluye generación con IA ni evaluación automática.

## Publicación

Consulta [DEPLOY.md](DEPLOY.md). `render.yaml` prepara Express y el frontend en un servicio con disco persistente. En producción `DATA_DIR` define la carpeta de datos; por defecto local se conserva `Back/data`. La publicación aún requiere configurar la cuenta, el repositorio, la contraseña y la URL de Render.

## Comprobaciones

- En `Front`: `npm run build` y `npm run lint`.
- En `Back`: `npm test` comprueba entrega, reintentos, validación, descarga y persistencia con datos temporales.

