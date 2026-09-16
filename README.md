# Tablero Oculto

Aplicacion web/PWA para gestionar un juego de rol por turnos con 3 jugadores y tablero oculto. Sustituye la logica de las macros del Excel por permisos, sesiones y vistas privadas.

## Stack

- Next.js + TypeScript
- React
- Tailwind CSS
- Prisma ORM
- SQLite en desarrollo
- Sesiones con cookie `httpOnly`
- PWA con manifest y service worker

## Instalacion

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Abrir `http://localhost:3000`.

## Variables de entorno

```env
DATABASE_URL="file:./dev.db"
SESSION_SECRET="change-this-development-secret"
COOKIE_SECURE="false"
```

En produccion con HTTPS, cambia `COOKIE_SECURE` a `"true"`. Tambien cambia `SESSION_SECRET` y las contrasenas iniciales. Para PostgreSQL, cambia `DATABASE_URL` y el proveedor en `prisma/schema.prisma`.

## Preparacion para GitHub

Sube al repositorio solo el codigo y archivos de configuracion necesarios:

```txt
mi-web/
  package.json
  package-lock.json
  src/
  public/
  prisma/
    schema.prisma
    seed.ts
  .env.example
  .gitignore
  README.md
```

No subas secretos ni artefactos locales:

- `.env`
- `.env.local`
- `node_modules`
- `.next`
- `dist`
- `build`
- `prisma/dev.db`

El archivo `.env.example` solo contiene valores de ejemplo. Los secretos reales se configuran manualmente en Railway.

## Despliegue en Railway

Railway puede leer este proyecto desde GitHub como una app Next.js con npm.

Comandos:

```bash
npm install
npm run build
npm run start
```

El script `build` ejecuta `prisma generate` antes de compilar Next.js.

El script `start` ejecuta:

```bash
prisma db push && prisma db seed && next start
```

Esto prepara las tablas y datos iniciales antes de arrancar la web. El seed usa `upsert`, por lo que puede ejecutarse de nuevo sin duplicar jugadores ni zonas.

Variables que debes configurar manualmente en Railway:

```env
DATABASE_URL="file:/data/dev.db"
SESSION_SECRET="pon-aqui-un-secreto-largo-y-aleatorio"
COOKIE_SECURE="true"
```

Importante para Railway:

- El proyecto usa SQLite actualmente.
- Para que SQLite no pierda datos en Railway, crea un Volume y montalo en `/data`.
- Usa `DATABASE_URL="file:/data/dev.db"` si montas ese Volume.
- No uses una URL de PostgreSQL con el esquema actual sin cambiar antes `provider = "sqlite"` en `prisma/schema.prisma`.
- Si mas adelante quieres PostgreSQL gestionado, habra que hacer una migracion especifica del esquema Prisma.

## Comandos

```bash
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
npm test
```

## Usuarios de prueba

| Usuario | Faccion | Codigo | Contrasena |
| --- | --- | --- | --- |
| `altos` | Altos Elfos | 1 | `altos123` |
| `oscuros` | Elfos Oscuros | 2 | `oscuros123` |
| `silvanos` | Elfos Silvanos | 4 | `silvanos123` |
| `admin` | Superadmin | - | `admin123` |

## Codigos de faccion

La app nunca acepta el codigo de faccion enviado por el cliente. El backend lo obtiene desde la sesion.

| Suma | Significado |
| --- | --- |
| 0 | Nadie ocupa la casilla |
| 1 | Solo Altos Elfos |
| 2 | Solo Elfos Oscuros |
| 4 | Solo Elfos Silvanos |
| 3 | Altos Elfos + Elfos Oscuros |
| 5 | Altos Elfos + Elfos Silvanos |
| 6 | Elfos Oscuros + Elfos Silvanos |
| 7 | Los tres jugadores |

## Tablero

El motor genera coordenadas `A:S` y filas `4:35`. Hay 608 coordenadas totales y 314 activas:

- Fila 4: `A:S`
- Filas impares 5-35: `A, C, E, G, I, K, M, O, Q, S`
- Filas pares 6-34: `B, D, F, H, J, L, N, P, R`

Las zonas especiales se conservan aunque alguna coordenada heredada del Excel sea inactiva; solo las casillas activas pueden recibir movimientos.

## Zonas especiales

Principal:

```txt
I17, I18, I19, I20,
J16, J17, J18, J19, J20, J21,
K17, K18, K19, K20
```

Regla: muestra presencia y coordenada exacta, sin identidad del jugador.

Secundarias:

```txt
E11, E12, E23, E24, I31, I32,
P26, P27, P18, P19, L8, L9
```

Regla: una faccion se muestra con nombre/color. Varias facciones muestran `WAR`; los usuarios implicados ven la lista privada de facciones en su encuentro.

Colores iniciales:

- Altos Elfos: Azul
- Elfos Oscuros: Morado
- Elfos Silvanos: Verde

## Flujo de turno y fase

Cada turno tiene 3 fases. La partida arrastra ocupacion entre fases y turnos: al avanzar, la app copia las casillas ocupadas a la siguiente fase para que cada jugador pueda mantenerlas o retirarlas.

Estados:

- `movement_open`
- `waiting_for_players`
- `calculating_results`
- `results_available`
- `encounters_pending`
- `phase_closed`

Cuando los 3 jugadores confirman:

1. La fase bloquea movimientos.
2. Se calculan sumas internas por casilla.
3. Se generan avisos de Principal y Secundarias.
4. Se crean encuentros privados.
5. Si hay encuentros, la fase queda en `encounters_pending`.
6. Cuando todos los encuentros estan resueltos, la app avanza a la siguiente fase.

## Rutas

- `/login`
- `/dashboard`
- `/encounters`
- `/admin`

Cada usuario puede cambiar su propia contrasena desde el panel lateral de `/dashboard`.

API principal:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/game/current`
- `GET /api/board`
- `GET /api/my/moves`
- `POST /api/my/moves/toggle-cell`
- `POST /api/my/moves/submit`
- `GET /api/my/encounters`
- `POST /api/encounters/:id/mark-in-progress`
- `POST /api/encounters/:id/resolve`
- `GET /api/announcements/current-phase`
- `POST /api/admin/recalculate-phase`
- `POST /api/admin/force-close-phase`
- `POST /api/admin/advance-phase`
- `POST /api/admin/reset-game`
- `POST /api/admin/config`

## Seguridad

- Un jugador solo ve sus movimientos.
- Un jugador solo ve encuentros donde participa.
- El tablero combinado solo existe internamente en el backend.
- Los movimientos quedan bloqueados tras confirmar.
- Las rutas API validan sesion y rol.
- El cliente no puede enviar `code`, `playerCode` ni `playerId` para suplantar faccion.

## Tests

```bash
npm test
```

Cubren generacion de tablero, combinaciones 1/2/4, participantes, simbolos de encuentros, presencia en zonas y reglas basicas de privacidad.
