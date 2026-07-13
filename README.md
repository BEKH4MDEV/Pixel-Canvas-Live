<div align="center">

# 🎨 Pixel Canvas Live

**El chat de tu live pinta. Tú diriges el show.**

[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](#-stack-t%C3%A9cnico)
[![React](https://img.shields.io/badge/React-Vite-61DAFB?logo=react&logoColor=white)](#-stack-t%C3%A9cnico)
[![Express](https://img.shields.io/badge/Express-Node%20%E2%89%A5%2020-000000?logo=express&logoColor=white)](#-stack-t%C3%A9cnico)
[![Prisma](https://img.shields.io/badge/Prisma-SQLite-2D3748?logo=prisma&logoColor=white)](#-stack-t%C3%A9cnico)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#-licencia)

</div>

---

**Pixel Canvas Live** convierte tu directo de TikTok en un lienzo colaborativo gigante. Cada
espectador puede pintar un píxel escribiendo un comando en el chat, o desatar figuras, lluvias de
color y reinicios enviando regalos. Tú lo proyectas en pantalla, y desde un panel privado
controlas la partida, ves quién va ganando y qué está pasando en tiempo real.

Pensado para creadores que quieren una dinámica nueva de interacción: algo visual, adictivo y
fácil de seguir tanto para quien lo mira como para quien lo juega.

<p align="center">
  <em>¿No tienes audiencia todavía o quieres probarlo antes del directo?</em><br/>
  Actívalo con un clic y una <strong>audiencia simulada</strong> pinta y manda regalos por ti,
  para que veas el lienzo cobrar vida antes de salir en vivo.
</p>

---

## 📺 Las dos pantallas

| | Para... | Qué ves |
|---|---|---|
| 🖼️ **Lienzo** | tu audiencia, en la transmisión | El lienzo a pantalla completa, listo para capturar: cuenta atrás, notificaciones de lo que se está pintando, y una pantalla de resultados cuando termina la partida. |
| 🔐 **Panel** | ti, el creador, en privado | Inicia y controla la partida, ajusta comandos/colores/figuras, configura qué hace cada regalo, y sigue las estadísticas en vivo, todo protegido con PIN. |

---

## ✨ Por qué mola

- **🎨 Pinta el chat, no tú.** Cada mensaje puede convertirse en un píxel en el lienzo, la
  audiencia construye el arte, no lo ven pasivamente.
- **🎁 Los regalos hacen ruido de verdad.** Configura qué efecto dispara cada regalo: figuras
  que se revelan en espiral, lluvias de color, reinicios sorpresa o el fin de la partida.
- **⚡ Todo en directo, sin lag perceptible.** El lienzo se actualiza al instante para todos los
  que lo estén viendo, sin recargar ni perder el hilo si alguien cambia de pestaña.
- **🕹️ Tú tienes el mando.** Pausa, reanuda, reconecta o finaliza la partida cuando quieras desde
  el panel, sin que la audiencia note fricción.
- **🎭 Pruébalo sin audiencia.** El modo de audiencia simulada te deja ensayar la dinámica antes
  de salir en vivo, o simplemente mantener el lienzo activo entre rachas de espectadores.
- **🔒 Solo tú controlas el panel.** Acceso protegido por PIN, con bloqueo automático si alguien
  intenta adivinarlo.
- **🔊 Personalízalo a tu estilo.** Sonidos propios para cada evento, colores y figuras a tu
  gusto, y un prefijo de comando que tú eliges.

---

## 🛠️ Por dentro

> A partir de aquí, la parte técnica, por si te interesa cómo está construido o quieres
> contribuir.

Monorepo **pnpm** con una frontera de tipos única y capas con dependencias en un solo sentido.

```
packages/contracts   Esquemas Zod + tipos (z.infer): configuración, estado del lienzo, eventos
                      (dos familias: canvas y admin), entidades y contratos HTTP. Única fuente de
                      verdad que comparten web y server.

apps/server           Express + TypeScript. Capas: http (rutas + validación Zod + middleware de
                      consola) → domain (motor de juego, GameStateService, puerto de plataforma) →
                      data (repositorios Prisma). realtime: dos buses + dos SSE + log-store en
                      memoria. auth: PIN bcrypt + sesión httpOnly firmada + lockout. SQLite/Prisma.

apps/web              React + Vite + TypeScript. lib: render imperativo del lienzo (rAF) y audio.
                      data: cliente HTTP (una petición por sección) + dos clientes SSE. routes/canvas
                      y routes/admin (secciones). Estado con TanStack Query + Zustand.
```

### Decisiones clave

- **Dos SSE, no uno.** El lienzo y el panel tienen necesidades muy distintas, así que cada uno
  tiene su propio bus (`canvasBus`, `adminBus`) y su propio endpoint (`/api/canvas/events`,
  `/api/admin/events`). Nada de pintado viaja por el SSE del panel.
- **Panel = HTTP + un poco de SSE.** Casi toda la administración es HTTP puro (una petición por
  sección, cacheada y refrescada al revisitar). El SSE del panel solo empuja tres cosas: estado
  de la partida, top de la ronda actual y la consola.
- **La consola vive en el servidor.** `log-store` es un buffer en memoria; cualquier módulo del
  backend puede escribir en él y la línea se empuja al panel. La carga inicial se obtiene por
  `GET /api/admin/live`.
- **Puerto de plataforma aislado.** El motor nunca importa TikTok. Se inyecta una `LivePlatform`;
  un evento simulado y uno real entran por exactamente el mismo pipeline.

### Flujo de un evento

```
Chat/regalo (TikTok real  ó  audiencia simulada)
      │  (mismo puerto LivePlatform)
      ▼
GameEngine  ──emite──►  canvasBus ──► SSE /api/canvas/events ──► render del lienzo (rAF)
      │
      ├──publica estado / top de ronda──►  adminBus ──► SSE /api/admin/events ──► panel
      └──registra acción/evento/error──►  log-store ──► adminBus ──► consola del panel
```

---

## 🧰 Stack técnico

<div align="center">

**TypeScript** (strict) · **React** + **Vite** · **Tailwind v4** · **Radix UI** ·
**TanStack Query** · **Zustand** · **Framer Motion** · **Zod** · **Express** ·
**Prisma** + **SQLite** · **bcryptjs** · **Pino** · **Helmet** · **tiktok-live-connector**

</div>

---

## 🚀 Cómo ejecutar

> **Requisitos:** Node ≥ 20 y pnpm

```bash
pnpm install
pnpm dev      # genera la BD + seed y levanta servidor (:3000) y web (:5173, proxy /api)
```

| Cara | URL | Notas |
|---|---|---|
| Panel | `http://localhost:5173/admin` | PIN por defecto: **`1234`** |
| Lienzo | `http://localhost:5173/canvas` | Refleja la partida en vivo |

Desde el panel, en **Estado y control**, pulsa **Iniciar partida**. Tras la cuenta atrás el
sistema se conecta al live configurado. Activa el toggle **Audiencia simulada** (misma sección)
para inyectar espectadores y regalos ficticios por el mismo pipeline que el chat real, mientras
la partida esté en directo y conectada.

### Scripts disponibles

| Comando | Descripción |
|---|---|
| `pnpm build` | Compila `contracts` + `web` |
| `pnpm start` | Arranca el servidor (sirve la API y, en prod, el front compilado) |
| `pnpm typecheck` | TypeScript estricto en todo el monorepo |
| `pnpm lint` | ESLint en todos los paquetes |
| `pnpm db:setup` | `prisma generate` + `db push` |
| `pnpm db:seed` | Re-ejecuta el seed idempotente |
| `pnpm unlock-admin` | Desbloquea el acceso del panel tras un lockout |
| `pnpm backup` | Copia de seguridad de la base SQLite |

---

## ⚙️ Configuración

Variables de entorno en `.env.example`. En desarrollo hay valores por defecto razonables; en
producción se exige `SESSION_SECRET` (el servidor valida al arrancar y aborta si falta).

| Variable | Descripción |
| --- | --- |
| `PORT` | Puerto del servidor (por defecto `3000`). |
| `NODE_ENV` | `development` \| `production` \| `test`. |
| `DATABASE_URL` | URL de SQLite para Prisma. |
| `UPLOADS_PATH` | Carpeta donde se guardan los sonidos subidos. |
| `SESSION_SECRET` | Secreto para firmar la cookie de sesión (obligatorio en producción, ≥ 16). |
| `FRONTEND_ORIGIN` | Origen permitido por CORS. |
| `LOG_FILE_PATH` | Ruta del log de Pino. |
| `PLATFORM_RECONNECT_*` | Retraso inicial, máximo de intentos y multiplicador de la reconexión con el live. |
| `PIN_*` | Parámetros del bloqueo por fuerza bruta del PIN (intentos por grupo, minutos de bloqueo, multiplicador, grupos máximos). |

> La configuración de juego (tamaño del lienzo, cooldown, duración, auto reinicio, canal, prefijo
> de comandos, sonidos, sesión, etc.) **no** vive en `.env`: se edita desde el panel y se
> persiste en la base de datos.

---

## 🎮 Cómo funciona

### Ciclo de una partida

1. **Inicio.** El admin pulsa *Iniciar partida* (o se auto-reinicia). Aparece una cuenta atrás de
   3 s y, por detrás, se intenta la conexión con el live. Si conecta antes de que acabe la
   cuenta, la partida arranca al terminar; si no, el lienzo muestra *Conectando al live* hasta
   lograrlo. Un fallo en esta primera conexión aborta el inicio.
2. **En directo.** Los comentarios que empiezan por `‹prefijo›‹comando›` (p. ej. `!p 10 20 rojo`)
   pintan; los regalos disparan su secuencia de efectos. Todo se refleja en el lienzo con
   animación.
3. **Pausa.** El servidor ignora chat y regalos (salvo el auto-registro de regalos, que sí
   ocurre) y el lienzo muestra *Partida en pausa*. La duración de la partida sigue corriendo.
4. **Reconexión.** Si el live se cae durante la partida, el servidor reintenta con backoff y el
   lienzo lo muestra; agotados los intentos, espera acción manual (*Reconectar*).
5. **Fin.** Por acción del admin, por un regalo con efecto de finalizar, o por duración cumplida:
   se borra el lienzo con animación y sonido, y aparece la ventana de **resultados** (quién
   finalizó → clasificación de la ronda). Si el auto reinicio está activo, la siguiente partida
   arranca sola.

### Comandos y cooldown

Un comando es `‹prefijo›‹nombre›` seguido de sus argumentos. El único tipo actual es *pintar
píxel* (`X Y color`). Se valida rango y color; los errores avisan en el lienzo (notificación) y
en la consola.

El **cooldown** es por usuario y solo afecta al live: mientras un espectador está en cooldown se
ignoran sus mensajes (incluidos los inválidos) y cualquier intento lo reinicia. Las acciones del
panel (*Herramientas*) son siempre instantáneas, sin cooldown. Al finalizar la partida el
cooldown de todos se reinicia.

### Regalos y efectos

Cada regalo del catálogo puede tener una **secuencia de efectos** (figura, lluvia, reinicio, fin
de partida) que se ejecutan en orden. Un regalo con varios efectos deja **una sola línea** de
resumen en la consola. Con el auto-registro activado, un regalo desconocido se añade solo al
catálogo.

### Audiencia simulada

`CombinedLivePlatform` envuelve el adaptador real de TikTok y el simulador y los presenta al
motor como una sola plataforma. La **conexión es siempre la del live real**: el toggle **no
altera nada** del comportamiento original (conexión, reconexión, pausa, cuenta atrás, fin…). El
toggle **Audiencia simulada** (Estado y control) solo decide si se inyectan eventos simulados:

- **OFF**, solo el live real (comportamiento por defecto).
- **ON**, además del live real, el simulador **inyecta eventos** por el mismo pipeline, como si
  vinieran del chat real. Solo los inyecta cuando la partida está en directo, conectada al live
  real y el lienzo visible esperando eventos (nada durante pausa, reconexión o cuenta atrás); si
  el live real no está conectado, no se inyecta nada.

El simulador imita un live real: tras cada evento espera un tiempo aleatorio (algunos casi
inmediatos, otros más lentos) y elige **80 % un píxel** en una posición aleatoria del área de
juego y **20 % un regalo** de un conjunto fijo. Todo entra por el mismo pipeline, así que para el
motor un evento simulado es indistinguible de uno real.

### Sonidos y sesión

Los sonidos son **globales** (píxel, figura, lluvia, reinicio y fin de partida) y se suben desde
el panel. La sesión del panel se protege con PIN, tiene duración configurable y puede expirar al
cerrar el navegador; al expirar o desaparecer, el panel redirige al login con un aviso. El
lienzo nunca depende de la sesión.

---

## 📁 Estructura del proyecto

<details>
<summary><strong>Ver árbol completo</strong></summary>

```
packages/contracts/src
  primitives.ts   Tipos base (colores, estados, escala, sonidos, logs…).
  config.ts       ClientConfig / AdminConfig.
  entities.ts     Comandos, colores, figuras, regalos, efectos, estadísticas.
  canvas.ts       GameSnapshot (panel) y CanvasState (lienzo).
  events.ts       Familias de eventos SSE: canvasEventSchemas / adminEventSchemas.
  api.ts          Contratos HTTP.

apps/server/src
  domain/         engine.ts (motor), game-state.ts (estado en memoria),
                  platform.ts (puerto + Mock + Combined), tiktok-platform.ts (adaptador real),
                  engine-instance.ts (inyección).
  realtime/       canvas-bus.ts, admin-bus.ts, log-store.ts, sse.ts.
  http/           app.ts, routes.ts, action-log.ts (consola de acciones), uploads.ts.
  auth/           auth.ts (PIN + sesión + lockout).
  db/             prisma.ts, repositories.ts.  prisma/  schema.prisma, seed.ts.

apps/web/src
  routes/canvas/  CanvasPage, CanvasView, useCanvasController (máquina de estados + overlays),
                  CanvasScreen, CountdownOverlay, ResultsWindow, NotificationOverlay.
  routes/admin/   AppShell, Login, secciones (Estado/Herramientas/Estadísticas/Lienzo/Conexión/
                  Comandos/Colores/Figuras/Regalos/Efectos/Sonidos/Seguridad), LogsConsole, LivePreview.
  data/           api.ts (HTTP), canvas-realtime.ts, admin-realtime.ts, sse-client.ts.
  lib/            canvas-renderer.ts (rAF), audio.ts, figures.ts, colors.ts.
  stores/         live-store, logs-store, toast-store (Zustand).
```

</details>

---

## 🤝 Contribuciones

Este es un proyecto para mi portafolio, pero los comentarios y sugerencias son bienvenidos.

- 🐛 Reporta errores mediante GitHub Issues
- 💡 Sugiere nuevas funcionalidades
- ⭐ Marca el repositorio con una estrella si te resulta útil

## 📜 Licencia

Licencia MIT. Consulta el archivo [LICENSE](./LICENSE) para más detalles.