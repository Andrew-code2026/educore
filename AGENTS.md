# EduCore — instrucciones para agentes de código

Fuente única de instrucciones del proyecto. La leen Codex, Antigravity, Cursor y Copilot; Claude Code la carga desde `CLAUDE.md`. Edita aquí, no en copias.

EduCore es una plataforma escolar colombiana para directivos, docentes, estudiantes y acudientes. Es una sola app: Vite + React 19 en `client/`, Express + tRPC v11 en `server/`, código común en `shared/`, Drizzle ORM sobre MySQL 8 en `drizzle/`. TypeScript, pnpm y Vitest.

## Comandos

```bash
pnpm install --frozen-lockfile
pnpm dev                     # API y cliente en un solo puerto: PORT de .env (3000); si está ocupado, toma el siguiente
pnpm check                   # tsc --noEmit; no revisa los *.test.ts
pnpm test                    # vitest run, toda la suite
pnpm test server/creatorStats.test.ts                    # un archivo
pnpm test client/src/creator/structure.test.ts -t "sin búsqueda"   # un test por nombre
pnpm build                   # vite build + esbuild del servidor a dist/
pnpm db:migrate              # drizzle-kit migrate sobre DATABASE_URL; se puede repetir
```

- Tras arrancar `pnpm dev`, la primera carga de la página puede tardar cerca de un minuto mientras Vite compila.
- No hay linter. No corras `pnpm format` ni prettier: `.prettierrc` (printWidth 80) no coincide con el código y reescribe archivos enteros.

## Entorno local

- Copia `.env.example` a `.env`. Variables: `DATABASE_URL` (MySQL en `127.0.0.1:3307`, base `educore`), `JWT_SECRET`, `PORT`, `ANTHROPIC_API_KEY` (solo la usa el creador de recursos; sin ella no genera con IA) y, opcionales, `CREATOR_MODEL` y `CREATOR_DAILY_LIMIT`. El aviso `OAUTH_SERVER_URL is not configured` al arrancar es normal en local.
- La base de datos es el contenedor Docker `educore-mysql` (MySQL 8, puerto 3307 del host), definido en `docker-compose.yml`. La primera vez: `docker compose up -d`. Después de reiniciar el equipo queda apagado y todas las consultas fallan: `docker start educore-mysql`.
- `pnpm db:start`, `start-db.bat` y `start-database.bat` apuntan a un MariaDB portátil que ya no se usa; ignóralos.
- Base vacía: `pnpm db:migrate` (es `drizzle-kit migrate`) y luego `pnpm seed:mvp`. Sin la semilla, el ingreso demo responde «Identidad demo no disponible». `seed:mvp` borra y vuelve a sembrar los datos del colegio demo: no lo corras sobre datos que quieras conservar.
- Base existente: corre `pnpm db:migrate` después de traer `main`; se puede repetir sin riesgo. Las migraciones de tablas que el servidor también crea (0007 y 0008) son idempotentes: donde ya existen, solo quedan registradas.
- Si alguna vez corriste el viejo `pnpm db:push`: descarta todo lo que cambió en `drizzle/` (también `drizzle/meta/0007_snapshot.json`) y borra los `.sql` sin seguimiento. Si además llegó a aplicarse, borra de `__drizzle_migrations` la fila que agregó antes de correr `db:migrate`; si no, `db:migrate` puede saltarse 0007 y 0008.
- Ingreso local sin OAuth: el selector de rol de la pantalla de ingreso llama a `auth.loginDemo` (roles `admin`, `teacher`, `student`, `guardian`). Desde un script: `POST /api/trpc/auth.loginDemo` con `{"json":{"role":"teacher"}}` y guardar la cookie.

## Arquitectura

- `server/_core/index.ts` arranca Express, monta tRPC en `/api/trpc` y, en desarrollo, Vite como middleware. Todos los routers están en `server/routers.ts` (`auth`, `academic`, `gradeCenter`, `student`, `guardian`, `attendance`, `piar`, `creator`, …). El acceso a datos va en `server/db.ts` y `server/*Db.ts`; el esquema, en `drizzle/schema.ts`.
- Cliente: `client/src/App.tsx` tiene una sola ruta; `pages/Home.tsx` elige el módulo según la sección y el rol. Las URL de las secciones salen de `SECTION_PATHS` en `client/src/components/shell/routes.ts`: una sección nueva se declara ahí. Estudiante y acudiente ven su propio portal.
- Alias: `@/*` → `client/src/*`, `@shared/*` → `shared/*`. tRPC usa superjson; las suscripciones (progreso en vivo de la IA) van por SSE.

| Módulo | Dónde |
|---|---|
| Grade Center (calificaciones) | `client/src/gradecenter/`, `server/gradeCenterDb.ts` |
| Classroom (cursos y actividades) | `client/src/classroom/` |
| PIAR (ajustes razonables) | `client/src/piar/`, `server/piarDb.ts`, `shared/piar.ts` |
| Portal directivo (rectoría, coordinación, usuarios) | `client/src/admin/`, `server/identityModel.ts`, `server/userImport.ts` |
| Portal estudiante | `client/src/student/`, `server/studentPortalDb.ts` |
| Portal acudiente | `client/src/guardian/` |
| Creador de recursos con IA | `client/src/creator/`, `server/creator*.ts`, `shared/creator*.ts` |

## Convenciones

- Idioma: todo lo que ve el usuario va en español (textos, mensajes de `TRPCError`, que el cliente muestra tal cual), igual que comentarios y commits. Funciones y variables en inglés; los valores de dominio, en español (`guia`, `taller`, `evaluacion`, `?estudiante=`).
- Acceso por rol: los procedimientos reciben `role` en el input (rol demo) y lo primero que hacen es llamar a una guarda de `server/routers.ts` (`requirePermission`, `requireAcademicActor`, `requirePiarActor`, `requireStudentActor`, `requireLearnerActor`, `requireCreatorActor`). La guarda resuelve el actor desde la sesión o el rol demo y revisa `hasPermission` de `server/identityModel.ts`; con `isMutation = true` exige sesión. No uses `input.role` sin guarda y filtra los datos por `actor.schoolId` (y por dueño cuando aplica).
- Tablas al primer uso: para que las bases locales que no han corrido `db:migrate` sigan funcionando, las tablas recientes también se crean con `CREATE TABLE IF NOT EXISTS` en una función `ensure…Table` con bandera de módulo (`ensureCreatorTables`, `ensurePiarTable`, `ensureCourseResourcesTable`, `ensureAttendanceTables`), que cada función de datos llama al empezar. Una tabla nueva sigue el mismo patrón: esquema, migración idempotente y función `ensure…`. Columnas nuevas en tablas viejas: `ensureRuntimeColumns` en `server/db.ts`.
- Migraciones: al cambiar `drizzle/schema.ts`, corre `pnpm exec drizzle-kit generate --name=<tema>` y sube el SQL, el snapshot y el journal. Si el servidor también crea esa tabla o columna, reescribe el SQL generado para que sea idempotente, como `drizzle/0008_runtime_tables.sql`: `CREATE TABLE IF NOT EXISTS` con los índices dentro (MySQL no tiene `CREATE INDEX IF NOT EXISTS`) y las columnas con el `ALTER` condicional de ese archivo (tampoco hay `ADD COLUMN IF NOT EXISTS`). Mantén iguales el esquema, la migración y la función `ensure…`. `server/drizzleMigrations.test.ts` falla si el esquema tiene cambios sin migración, si un SQL de `drizzle/` no está en el journal o si el `CREATE TABLE` de una función `ensure…` no es el mismo de su migración. El test no ejecuta el SQL: pruébalo en una base temporal del contenedor antes de subirlo.
- CSS por módulo: Tailwind 4 y shadcn/ui (`client/src/components/ui/`) para piezas genéricas; cada módulo tiene su hoja con prefijo propio (`crt-` creador, `pia-` PIAR, `stp-` estudiante, `gc-` Grade Center, `adm-` directivo, `ccw-`/`ccl-` Classroom, `edc-` shell). Los estilos nuevos van en la hoja del módulo y con su prefijo. El tema oscuro cuelga de `.dark`.
- Creador de recursos: la IA solo escribe con herramientas (`server/creatorTools.ts`); cada una se traduce en una operación sobre el documento (`shared/creatorOps.ts`) que `shared/creatorValidate.ts` revisa antes de aplicarla: que el LaTeX compile en KaTeX, que los puntos estén sobre su curva, que las tablas cuadren. Si falla, el error vuelve al modelo para que corrija en el mismo turno. Lo que se puede calcular (puntos, tablas, estadísticas) lo calcula el código a partir de la especificación, no se le cree al modelo. Un bloque o figura nueva necesita su validación y sus tests. `CREATOR_SYSTEM_PROMPT` (`server/creatorAgent.ts`) no lleva fechas ni datos del recurso, para que la API sirva el prefijo desde caché. Antes de diseñar algo nuevo del creador, lee `docs/creador-referentes.md`: qué hacen Diffit, Chalkie y MagicSchool, qué se tomó, qué se descartó y qué falta.
- Tests: Vitest solo recoge `server/**/*.test.ts` y `client/**/*.test.ts(x)`, en entorno node. Los tests de código de `shared/` van en `server/` (por ejemplo `server/creatorStats.test.ts`): uno puesto en `shared/` no corre. Las suites que usan `createCaller` o `getDb` escriben en la base local real: necesitan el contenedor encendido y pueden fallar por datos que dejaron otros; antes de culpar a tu cambio, corre el mismo archivo en `main`. `server/security.test.ts` falla a ratos por tiempo de espera también en `main`: repítelo solo antes de concluir. No las corras mientras arranca el servidor de desarrollo.

## Git

- Ramas `feat/<tema>` o `fix/<tema>` desde `main` actualizado. PR contra `main` en el repositorio `Andrew-code2026/educore`, no desde forks.
- Commits estilo Conventional Commits en español y con ámbito: `feat(creator): …`, `fix(guardian): …`.
- Los PR se fusionan con commit de merge. Para poner una rama al día se fusiona `origin/main` en ella.

## Trampas conocidas

- Worktrees de git: no traen `node_modules` ni `.env`. Corre `pnpm install --frozen-lockfile --prefer-offline` y copia el `.env`. Si después la página muere con `Cannot read properties of null (reading 'useContext')`, borra `node_modules/.vite` y reinicia.
- En Windows, un script pasado por heredoc en Git Bash pierde un nivel de barras invertidas (`\\` → `\`), lo que rompe regex y LaTeX sin dar error. Escribe esos scripts en un archivo con el editor y revisa el resultado.
- Quienes prueban en local comparten el docente demo y la base: crea recursos de prueba con título único y borra solo los ids que creaste.
- Para comprobar el creador en un navegador automatizado, usa la skill `.agents/skills/verificar-creador/` (lee su `SKILL.md`): trae scripts para entrar con el rol demo, crear y borrar un recurso de prueba, abrirlo y capturarlo sin que el editor se remonte.
