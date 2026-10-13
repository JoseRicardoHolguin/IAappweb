# Póster Lab

Actividad de creación de pósters para el proyecto de tesis. Frontend React y Vite; backend Express existente.

## Ejecutar el editor

```powershell
cd Front
npm install
npm run dev
```

Abre la URL que indique Vite. El editor funciona sin iniciar el backend.

## Actividad

1. Lee las instrucciones y comienza para descubrir un tema aleatorio.
2. Arrastra textos, formas o stickers al lienzo; también puedes añadirlos con un clic.
3. Usa Seleccionar para mover elementos y el panel Detalles para cambiar tamaño, texto o color, traer al frente o eliminar.
4. Usa Pincel para dibujar con color y grosor ajustables.
5. Deshacer recupera hasta 40 cambios de la sesión. Descarga PNG exporta a 1440 × 1920 píxeles.

El borrador se guarda automáticamente en localStorage del navegador. Nueva actividad pide confirmación antes de reemplazarlo. Los stickers son emojis y su aspecto depende del sistema operativo.

Los temas en `Front/src/App.jsx` son provisionales. Esta versión no incluye generación con IA, evaluación ni envío de entregas al servidor; esos requisitos deben definirse para la tesis.

## Comprobaciones

En `Front`: `npm run build` y `npm run lint`.
