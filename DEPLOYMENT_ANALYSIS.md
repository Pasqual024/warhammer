# DEPLOYMENT_ANALYSIS

Fecha de preparacion: 2026-08-20.

Este documento describe el estado actual del proyecto para que otra IA o equipo tecnico pueda decidir la mejor estrategia de despliegue en produccion. No se ha migrado la arquitectura ni se ha cambiado la logica de la aplicacion.

## A. Stack tecnologico

- Framework frontend: Next.js 15 con App Router.
- Framework backend: API Routes de Next.js bajo `src/app/api/**`.
- Lenguajes: TypeScript, TSX, CSS.
- UI: React 19.
- Base de datos actual: SQLite.
- ORM: Prisma.
- Autenticacion: usuario y contrasena con `bcryptjs`; sesion propia firmada con HMAC-SHA256 en cookie `httpOnly`.
- Realtime/WebSockets: no hay WebSockets, SSE, Supabase Realtime ni Firebase Realtime. La app usa peticiones HTTP y recarga manual desde el cliente.
- PWA: `public/manifest.webmanifest` y `public/sw.js`.
- Iconos: `lucide-react`.
- Validacion auxiliar: `zod`.
- Mapas/tablero: imagen local en `public/mapa-campanya-png.png` mas SVG superpuesto en `src/components/BoardGrid.tsx`.
- Almacenamiento: tablas Prisma en SQLite; JSON serializado en columnas de texto para lista de ejercitos, diario y economia.
- Servicios externos actuales: ninguno.

Ejecucion local actual:

```bash
npm install
cp .env.example .env
npx prisma db push
npx prisma db seed
npm run dev
```

Abrir:

```txt
http://127.0.0.1:3000/login
```

Scripts relevantes en `package.json`:

```bash
npm run dev
npm run build
npm run start
npm test
npm run db:deploy
npm run prisma:generate
npm run prisma:seed
```

## B. Arquitectura

La aplicacion es una app full-stack Next.js:

```txt
Usuario -> navegador React/Next -> API Routes Next.js -> Prisma -> SQLite
```

Paginas principales:

- `/login`: pantalla de acceso.
- `/dashboard`: tablero privado del jugador.
- `/armies`: lista de ejercitos.
- `/economy`: invertir/ingresar.
- `/diary`: diario.
- `/encounters`: encuentros privados.
- `/admin`: panel de superadmin.

Rutas API principales:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `POST /api/me/password`
- `GET /api/game/current`
- `GET /api/board`
- `GET /api/my/moves`
- `POST /api/my/moves/toggle-cell`
- `POST /api/my/moves/submit`
- `GET /api/my/encounters`
- `GET /api/encounters/visible-cells`
- `POST /api/encounters/:id/mark-in-progress`
- `POST /api/encounters/:id/resolve`
- `GET /api/announcements/current-phase`
- `GET /api/profile-tabs`
- `PUT /api/profile-tabs`
- `GET /api/army-kills-ranking`
- `GET /api/army-experience-ranking`
- `POST /api/admin/recalculate-phase`
- `POST /api/admin/force-close-phase`
- `POST /api/admin/advance-phase`
- `POST /api/admin/reset-game`
- `POST /api/admin/config`
- `GET /api/admin/status`

El tablero comun se calcula desde los movimientos guardados en base de datos. Cada cliente solo envia la celda que quiere activar/desactivar. El backend obtiene la identidad real desde la cookie de sesion y no acepta `playerId`, `code` ni `factionName` enviados por el cliente para evitar suplantacion.

Cuando los 3 jugadores confirman movimientos:

1. Se bloquea la fase.
2. Se calculan sumas internas por casilla.
3. Se generan avisos publicos de zonas principal/secundarias.
4. Se crean encuentros privados si hay colision entre jugadores.
5. Si no hay encuentros, se avanza automaticamente a la siguiente fase/turno.
6. Si hay encuentros, se espera a resolverlos; al resolverse todos, se avanza automaticamente.
7. La ocupacion se arrastra a la siguiente fase/turno.

## C. Base de datos

Base de datos actual: SQLite con Prisma.

Conexion:

```env
DATABASE_URL=
```

En desarrollo se usa un archivo SQLite local. En el proyecto existe `prisma/dev.db`, pero no debe incluirse en ZIPs ni repositorios porque contiene datos reales de desarrollo y hashes de contrasenas.

Modelos Prisma:

- `Player`: jugadores y admin. Incluye `username`, `passwordHash`, faccion, color, codigo y rol.
- `Game`: partida activa, turno, fase y estado.
- `PlayerProfileTabs`: datos por jugador y partida para `armyListData` y `diaryData`.
- `PlayerTurnEconomy`: datos por jugador, partida y turno para `invertirData` e `ingresarData`.
- `Cell`: coordenadas del tablero.
- `SpecialZone`: zonas principal/secundarias.
- `SpecialZoneCell`: relacion zona-celda.
- `Move`: ocupacion por jugador, partida, turno, fase y celda.
- `PhaseSubmission`: confirmacion de movimientos por jugador/fase.
- `Encounter`: encuentro generado en una celda.
- `EncounterParticipant`: jugadores implicados en un encuentro.
- `EncounterResolutionConfirmation`: confirmaciones de resolucion.
- `PhaseAnnouncement`: avisos publicos calculados.

Relaciones principales:

- `Game` tiene muchos movimientos, confirmaciones, encuentros, avisos y perfiles.
- `Player` tiene movimientos, confirmaciones, encuentros y datos privados.
- `Encounter` pertenece a una partida/celda y tiene participantes.
- `Move` se identifica de forma unica por `gameId + turnNumber + phaseNumber + playerId + cellId`.
- `PlayerProfileTabs` es unico por `gameId + playerId`.
- `PlayerTurnEconomy` es unico por `gameId + playerId + turnNumber`.

Migraciones:

- No hay carpeta `prisma/migrations`.
- El proyecto usa `prisma db push`, no migraciones versionadas.
- Esto vale para desarrollo, pero en produccion conviene crear migraciones Prisma versionadas antes de desplegar cambios de esquema.

Migracion a PostgreSQL/Supabase:

- Es viable, pero no es automatica.
- Hay que cambiar `datasource db.provider` de `sqlite` a `postgresql`.
- Hay que generar migraciones, probar tipos/indices/unicidades y migrar datos.
- Las columnas JSON se guardan actualmente como `String`; podrian mantenerse como texto o migrarse a `Json` si se cambia a PostgreSQL.

## D. Usuarios y seguridad

Autenticacion:

- `POST /api/auth/login` recibe `username` y `password`.
- Busca `Player` por `username`.
- Compara contrasena con `bcryptjs`.
- Crea cookie `hidden_board_session` firmada con `SESSION_SECRET`.
- La cookie es `httpOnly`, `sameSite=lax`, `path=/` y puede ser `secure` si `COOKIE_SECURE=true`.

Identidad y permisos:

- El backend lee `playerId`, `username` y `role` desde la cookie firmada.
- Los endpoints privados usan `requireSession()` o `requireCurrentPlayer()`.
- Los endpoints de admin usan `requireSuperAdmin()`.
- Los movimientos no aceptan identidad manual desde el cliente.
- Un jugador solo ve sus propios movimientos.
- Un jugador solo ve encuentros donde participa.
- Los rankings de ejercito son publicos para usuarios autenticados.
- Los avisos publicos muestran presencia, pero no revelan todos los movimientos privados.

Riesgos evidentes al publicar:

- `SESSION_SECRET` tiene fallback de desarrollo si no se configura. En produccion debe ser obligatorio y largo.
- El seed de desarrollo contiene contrasenas iniciales. En produccion hay que sustituirlas/rotarlas inmediatamente.
- SQLite en disco local sin volumen persistente puede perder datos en PaaS.
- `prisma db push` en arranque es comodo, pero menos controlado que migraciones versionadas.
- No hay rate limiting en login.
- No se observa proteccion CSRF explicita; las cookies usan `sameSite=lax`, pero conviene revisar formularios mutadores para produccion.
- Los errores de API pueden devolver mensajes de error internos si una excepcion se propaga como `Error`.

## E. Sincronizacion del tablero

Estado compartido:

- El estado comun esta en la base de datos.
- Los movimientos se guardan en `Move`.
- Las confirmaciones se guardan en `PhaseSubmission`.
- Los encuentros se guardan en `Encounter` y `EncounterParticipant`.
- Los avisos se guardan en `PhaseAnnouncement`.
- El turno/fase actual se guarda en `Game`.

Como sabe cada usuario que ocurre:

- El cliente carga `/api/game/current`, `/api/board`, `/api/my/moves`, `/api/announcements/current-phase`, `/api/my/encounters`, `/api/encounters/visible-cells` y rankings.
- En `DashboardClient.tsx` hay un boton manual de actualizar que vuelve a pedir estos endpoints.
- Al confirmar movimientos o cambiar una casilla, el cliente actualiza su estado llamando al backend y recargando datos.
- No hay push automatico servidor-cliente.

Realtime/WebSockets:

- No se usa WebSocket, polling periodico, SSE, Supabase Realtime ni Firebase.
- Para sincronizacion realmente instantanea entre dispositivos haria falta anadir polling periodico, SSE, WebSockets o realtime gestionado.

Informacion publica:

- Turno, fase y estado.
- Estado de confirmacion de cada faccion.
- Avisos publicos de presencia.
- Ranking de muertes y experiencia.
- Casillas de encuentro visibles cuando el estado lo permite.

Informacion privada:

- Movimientos/casillas seleccionadas de cada jugador.
- Encuentros privados solo para participantes.
- Lista de ejercitos, economia y diario de cada jugador, salvo datos agregados usados por rankings publicos.

Como se evita acceso indebido:

- Las rutas consultan la sesion y filtran por `playerId`.
- `GET /api/my/moves` usa el `player.id` autenticado.
- `GET /api/my/encounters` filtra por participante, salvo superadmin.
- `PUT /api/profile-tabs` guarda datos solo para el jugador autenticado.
- `toggle-cell` rechaza claves de identidad manual (`code`, `playerCode`, `playerId`, `factionCode`, `factionName`).

Concurrencia:

- Prisma/SQLite aplica restricciones unicas para evitar duplicados.
- No hay sistema explicito de bloqueo optimista, versionado de filas ni resolucion avanzada de conflictos.
- Si dos usuarios actualizan a la vez celdas distintas, deberia funcionar.
- Si un mismo usuario abre dos dispositivos y cambia la misma celda simultaneamente, puede ganar la ultima escritura.
- Si dos procesos intentan avanzar fase simultaneamente, podria haber carreras si se escala horizontalmente sin transacciones/locks adicionales.

Perdida de conexion:

- Si un usuario pierde conexion, los datos ya guardados permanecen en base de datos.
- Al reconectar o pulsar actualizar, el cliente recupera el estado desde APIs.
- No hay cola offline ni sincronizacion local posterior.

## F. Variables de entorno

Variables realmente detectadas:

```env
DATABASE_URL=
SESSION_SECRET=
COOKIE_SECURE=
```

Notas:

- `DATABASE_URL` es obligatoria para Prisma.
- `SESSION_SECRET` debe ser un secreto largo y aleatorio en produccion.
- `COOKIE_SECURE=true` debe usarse si la app se sirve por HTTPS.
- `NODE_ENV` lo gestiona normalmente Next.js/hosting; no hace falta definirlo manualmente salvo casos especiales.

## G. Requisitos de produccion

Necesario para funcionar fuera de localhost:

- Runtime Node.js compatible con Next.js App Router y API Routes.
- Build command: `npm run build`.
- Start command: `npm run start` o equivalente.
- Base de datos persistente compartida.
- Variables de entorno: `DATABASE_URL`, `SESSION_SECRET`, `COOKIE_SECURE`.
- HTTPS para cookies seguras en produccion.
- Dominio: no es estrictamente obligatorio si el proveedor entrega subdominio HTTPS, pero es recomendable para usuarios reales.
- Persistencia de assets: los mapas ya estan en `public`, no requieren storage externo.
- Cron jobs: no detectados.
- WebSockets/realtime: no requeridos por la implementacion actual, pero recomendables si se quiere sincronizacion instantanea.

Si se mantiene SQLite:

- El proveedor debe permitir disco persistente montado.
- La app no deberia escalar a varias replicas escribiendo al mismo SQLite sin validar bloqueo y consistencia.

Si se migra a PostgreSQL:

- Se necesita migracion de Prisma.
- Permite mejor concurrencia, backups, acceso compartido y escalado.

## H. Problemas potenciales para produccion

- SQLite local: no es ideal para produccion en plataformas serverless o con filesystem efimero.
- `prisma/dev.db`: archivo de datos local que no debe subirse.
- No hay migraciones versionadas; se usa `db push`.
- `start` ejecuta `prisma db push && prisma db seed && next start`; en produccion puede ser mejor separar migraciones/seed del arranque web.
- El seed contiene contrasenas iniciales en el codigo fuente; deben cambiarse o parametrizarse antes de produccion.
- `SESSION_SECRET` tiene fallback inseguro de desarrollo.
- No hay rate limiting ni bloqueo por intentos fallidos de login.
- No hay CSRF explicito para POST/PUT mutadores.
- No hay realtime: dos usuarios no ven cambios instantaneamente salvo recarga/acciones.
- No hay control avanzado de conflictos simultaneos.
- Si se escala horizontalmente, el avance de fase puede necesitar transacciones mas estrictas o bloqueo por partida.
- Hay textos con problemas de codificacion visibles en algunos archivos (`CAMPAÃ‘A`, `contraseÃ±a`, etc.); no bloquea despliegue, pero conviene revisar encoding UTF-8.
- Algunos textos README heredados mencionan datos antiguos de zonas especiales que no coinciden con el codigo actual reducido; para produccion conviene alinear documentacion.
- No se detectan URLs hardcodeadas a `localhost` en codigo runtime, solo en README.
- No hay configuracion CORS; al ser frontend y API en el mismo dominio no hace falta. Si se separan dominios, habra que configurarlo.
- PWA/service worker puede cachear assets; conviene probar actualizaciones en produccion.
- Next.js debe escuchar en el `PORT` del proveedor; `next start` lo hace si el proveedor define `PORT`, aunque conviene documentarlo.

## I. Opciones de hosting

Precios consultados el 2026-08-19 en fuentes oficiales:

- Vercel Pricing: https://vercel.com/pricing
- Railway Pricing: https://docs.railway.com/pricing/plans
- Railway networking/WebSockets: https://docs.railway.com/networking/public-networking/specs-and-limits
- Supabase Pricing: https://supabase.com/pricing
- Render Pricing/Docs: https://render.com/pricing, https://render.com/docs/web-services, https://render.com/docs/websocket
- Cloudflare Workers Pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Fly.io Pricing: https://fly.io/docs/about/pricing/
- DigitalOcean Droplets: https://www.digitalocean.com/products/droplets

### Vercel

- Partes alojables: Next.js frontend y API Routes.
- Compatibilidad: muy buena con Next.js.
- Base de datos: necesita servicio externo, por ejemplo Supabase/Postgres, Neon, Prisma Postgres, etc.
- Realtime: posible con soluciones externas; WebSocket en Vercel ha mejorado, pero para juego con estado compartido puede ser mas simple usar Postgres + polling/SSE o servicio realtime externo.
- HTTPS: incluido.
- Coste aproximado: Hobby $0; Pro $20/mes mas base de datos externa.
- Ventajas: despliegue Next.js facil, HTTPS, previews, GitHub directo.
- Inconvenientes: SQLite local no encaja bien; requiere migrar DB a servicio persistente; cuidado con funciones serverless y conexiones Prisma.

### Cloudflare

- Partes alojables: frontend estatico/Workers si se adapta.
- Compatibilidad: Next.js completo con API Routes Node/Prisma no encaja sin adaptacion.
- Base de datos: D1, Durable Objects, Hyperdrive/Postgres externo o Supabase.
- Realtime: Workers soporta WebSockets; Durable Objects son adecuados para coordinar salas/partidas, pero exigiria redisenar parte del backend.
- HTTPS: incluido.
- Coste aproximado: Workers Free limitado; Workers Paid desde $5/mes.
- Ventajas: coste bajo, red global, WebSockets/Durable Objects.
- Inconvenientes: migracion mas grande; Prisma/SQLite actual no es plug-and-play.

### Supabase

- Partes alojables: base de datos PostgreSQL, Auth opcional, Realtime opcional.
- Compatibilidad: buena como base de datos si se migra Prisma a PostgreSQL.
- Realtime: Supabase Realtime podria publicar cambios de tablas.
- Hosting frontend/backend: no sustituye por si solo al hosting Next.js.
- Coste aproximado: Free para pruebas; Pro desde $25/mes.
- Ventajas: Postgres gestionado, backups en Pro, realtime disponible.
- Inconvenientes: hay que migrar SQLite a PostgreSQL; si se usa Supabase Auth se reharian partes de autenticacion.

### Railway

- Partes alojables: app Next.js Node y base de datos o volumen.
- Compatibilidad: buena con Next.js como proceso Node persistente.
- Base de datos: puede empezar con SQLite sobre Volume; mejor con PostgreSQL gestionado al crecer.
- Realtime/WebSockets: Railway soporta WebSockets sobre HTTP/1.1 y conexiones largas.
- HTTPS: incluido en subdominio Railway y dominios configurados.
- Coste aproximado: Free limitado; Hobby $5/mes con credito incluido; recursos extra por uso.
- Ventajas: despliegue sencillo desde GitHub, proceso persistente, volumen posible, facil evolucion a Postgres.
- Inconvenientes: SQLite con volumen limita escalado horizontal; separar migraciones/seed seria recomendable.

### Render

- Partes alojables: Web Service Node para Next.js, Postgres gestionado, discos persistentes.
- Compatibilidad: buena como servicio Node.
- Realtime/WebSockets: Render Web Services soportan WebSockets.
- Base de datos: Render Postgres o disco persistente para SQLite en servicios de pago.
- HTTPS: incluido.
- Coste aproximado: Free para pruebas con limitaciones; planes de workspace nuevos; compute/base de datos segun instancia. Legacy Postgres Starter era $7/mes como referencia historica; revisar precios actuales antes de comprar.
- Ventajas: web service persistente, Postgres gestionado, TLS, GitHub.
- Inconvenientes: free no recomendado para produccion; SQLite requiere disco persistente de pago; precios exactos dependen de instancia.

### Fly.io

- Partes alojables: app Next.js en VM ligera; volumen persistente; Postgres/servicio externo.
- Compatibilidad: buena con Node si se crea Dockerfile o config Fly.
- Realtime/WebSockets: adecuado para procesos persistentes.
- Base de datos: volumen SQLite posible para una instancia; Postgres externo recomendado para escalado.
- HTTPS: incluido con certificados Fly.
- Coste aproximado: VMs shared-cpu pequenas desde pocos dolares/mes segun region/RAM; por ejemplo shared-cpu-1x con 512MB ronda pocos dolares mensuales.
- Ventajas: flexible, barato, cercano a VPS pero gestionado.
- Inconvenientes: mas tecnico que Railway/Vercel; hay que preparar deploy/configuracion.

### VPS tradicional

- Partes alojables: todo en una maquina.
- Compatibilidad: total con Node, Prisma, SQLite o PostgreSQL.
- Realtime/WebSockets: completo.
- Base de datos: SQLite local o PostgreSQL en la misma maquina.
- HTTPS: configurar Nginx/Caddy/Traefik + Let's Encrypt.
- Coste aproximado: desde $4-$6/mes en proveedores tipo DigitalOcean para VM basica; mas backups/monitorizacion.
- Ventajas: control total y coste bajo.
- Inconvenientes: mantenimiento, seguridad, backups, actualizaciones, despliegue manual.

## RECOMENDACION

### Opcion recomendada para empezar

Railway con una sola replica y SQLite sobre Volume, o Railway con PostgreSQL gestionado si se acepta una migracion pequena.

Motivo:

- Es la ruta mas cercana al proyecto actual.
- Mantiene Next.js como proceso Node.
- Soporta HTTPS y procesos persistentes.
- Permite empezar sin reescribir el tablero ni la autenticacion.
- Para 3 usuarios simultaneos, una sola instancia es suficiente inicialmente.

Coste aproximado:

- Railway Hobby: alrededor de $5/mes minimo, mas uso si excede el credito incluido.
- Si se usa PostgreSQL gestionado, sumar el coste del servicio/uso de base de datos.

### Opcion de coste minimo

Railway Hobby con SQLite + Volume, una sola replica.

Condiciones:

- Hacer backups periodicos del archivo SQLite.
- No escalar a multiples replicas.
- Mantener `COOKIE_SECURE=true`.
- Usar un `SESSION_SECRET` real.

Coste aproximado: desde $5/mes, sujeto a uso.

### Opcion recomendada si la aplicacion crece

Vercel o Railway para Next.js + PostgreSQL gestionado en Supabase/Railway/Render + canal realtime.

Motivo:

- PostgreSQL resuelve mejor persistencia y concurrencia.
- Se pueden anadir migraciones Prisma versionadas.
- Para sincronizacion instantanea, se puede anadir polling corto, SSE, WebSockets o Supabase Realtime.

Coste aproximado:

- Vercel Pro $20/mes + Supabase Pro $25/mes si se necesita Pro.
- Railway Pro/Hobby + Postgres segun uso.
- Render/Fly alternativas validas si se prioriza proceso persistente y WebSockets.

## PLAN DE DESPLIEGUE

Pasos recomendados sin ejecutarlos:

1. Crear repositorio GitHub limpio.
2. Subir codigo fuente, `public`, `prisma/schema.prisma`, `prisma/seed.ts`, tests, configs, `package.json`, lockfile, `.gitignore`, `.env.example`, README y este informe.
3. No subir `.env`, `.env.local`, `node_modules`, `.next`, `dist`, `build`, `coverage`, `prisma/dev.db`, `work` ni `outputs`.
4. Elegir proveedor inicial.
5. Crear servicio web Node/Next.js.
6. Configurar build command: `npm run build`.
7. Configurar start command: `npm run start` o separar migracion/seed en comando previo.
8. Configurar variables:

```env
DATABASE_URL=
SESSION_SECRET=
COOKIE_SECURE=true
```

9. Si se mantiene SQLite:
   - Crear volumen persistente.
   - Montarlo en una ruta estable.
   - Usar `DATABASE_URL=file:/ruta-del-volumen/dev.db`.
   - Mantener una sola replica.
   - Configurar backups.

10. Si se migra a PostgreSQL:
    - Cambiar `provider` en Prisma a `postgresql`.
    - Crear migraciones versionadas.
    - Crear base gestionada.
    - Ejecutar migraciones.
    - Migrar datos si existen datos reales que conservar.
    - Validar indices, constraints y transacciones.

11. Configurar HTTPS:
    - Usar subdominio HTTPS del proveedor o dominio propio.
    - Dejar `COOKIE_SECURE=true`.

12. Configurar dominio:
    - No es imprescindible si se usa subdominio del proveedor.
    - Si se usa dominio propio, configurar DNS y certificados.

13. CORS:
    - Si frontend y API quedan en el mismo dominio, no requiere CORS especial.
    - Si se separan dominios, definir origen permitido y cookies credentials.

14. Autenticacion:
    - Cambiar/rotar contrasenas iniciales.
    - Usar `SESSION_SECRET` fuerte.
    - Revisar rate limiting de login.
    - Considerar CSRF para mutaciones.

15. Realtime:
    - Para version inicial, usar boton actualizar o polling.
    - Para tiempo real real, implementar SSE/WebSocket/Supabase Realtime.
    - Si se usan WebSockets, elegir proveedor con procesos persistentes o servicio realtime gestionado.

16. Build y deployment:
    - Ejecutar `npm test`.
    - Ejecutar `npm run build`.
    - Desplegar.
    - Revisar logs.

17. Pruebas con 3 usuarios:
    - Login de Altos, Oscuros y Silvanos.
    - Seleccion/deseleccion de casillas.
    - Confirmacion simultanea de los 3.
    - Generacion de avisos.
    - Generacion/resolucion de encuentros.
    - Avance automatico de fase/turno.
    - Persistencia tras reiniciar servicio.

18. Comprobaciones de seguridad:
    - Verificar que un usuario no ve movimientos privados de otro.
    - Verificar que no se acepta `playerId` manual en mutaciones.
    - Verificar cookies `httpOnly` y `secure`.
    - Verificar que `.env` y base de datos local no estan en el repositorio.
    - Verificar que el ZIP/repositorio no contiene secretos.

## Comprobacion del ZIP de analisis

El ZIP debe incluir:

- `src/`
- `public/`
- `prisma/schema.prisma`
- `prisma/seed.ts` sanitizado en la copia empaquetada.
- `tests/`
- `package.json`
- `package-lock.json`
- `.env.example`
- `.gitignore`
- `README.md` sanitizado en la copia empaquetada.
- `DEPLOYMENT_ANALYSIS.md`
- `next.config.ts`
- `tsconfig.json`
- `postcss.config.mjs`
- `next-env.d.ts`

El ZIP no debe incluir:

- `.env`
- `.env.local`
- `node_modules/`
- `.next/`
- `prisma/dev.db`
- `work/`
- `outputs/`
- `.git/`
- cookies, certificados privados, tokens o claves reales.
