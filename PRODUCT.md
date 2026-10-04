# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Personal de salud (enfermeras, médicos, promotores) que capturan el padrón durante jornadas de despistaje de anemia en escuelas y comunidad.

## Product Purpose

Registrar pacientes (nombre, edad en meses, nivel de hemoglobina), clasificarlos con el evaluador de anemia y mantener el padrón sincronizado con Supabase. Éxito es: captura rápida en la jornada y datos completos y sincronizados al final.

## Positioning

El padrón local (Zustand + localStorage) es la fuente de verdad; Supabase es un réplica diferida con auth por usuario (correo/contraseña). Los guards de sync (in-flight, cooldown, skip-when-clean, paginado) hacen que la sincronización durante la misma sesión sea segura sin saturar la base.

## Operating Context

- Jornadas de campo de despistaje; flujo principal confirmado: captura con sincronización durante la sesión.
- UI y mensajes de error 100% en español (código y comentarios en inglés).
- Modo oscuro y modo claro confirmados como requisito.
- Plataforma: web (Tauri es wrapper de escritorio; el diseño es web).
- Sync es manual por decisión de producto, con RLS por usuario en Supabase (migration gated, sin aplicar aún).

## Capabilities and Constraints

- Registro con `nombre` obligatorio, `edadMeses` entero 6–59, `nivelHemoglobina` finito > 0 (reglas clínicas fijas, validadas en cliente y con CHECK constraints en la migration).
- Cap de 100 pacientes visibles por padrón; borrado es tombstone (dirty → push, limpio → GC).
- Diagnóstico (`diagnostico`) siempre recalculado desde hemoglobina, nunca confiado del remoto.
- Login/registro por correo+contraseña (Supabase Auth); Google OAuth descartado por ahora.
- Datos en localStorage sobreviven reinicios; sin credenciales la app corre en modo local completo (offline-first).

## Evidence on Hand

- `openspec/specs/` (padron-registry, supabase-sync, anemia-evaluation, padron-statistics) y `openspec/changes/archive/`.
- 122 tests vitest green; tsc limpio; build OK.
- Sin marketing, logo, ni assets de marca; sin testimonios ni datos clínicos reales. No fabricar ninguno.

## Product Principles

1. Sin internet la app sigue funcionando; la sync nunca es condición para capturar.
2. Las reglas clínicas (edad, Hb, cap) son invariantes: nada las relaja.
3. Español primero; el usuario de campo no ve inglés.
4. La sincronización debe ser barata y aburrida: sin spam, sin sorpresas, idempotente.
5. Interfaz operativa: escaneabilidad y targets grandes antes que expresión.

## Accessibility & Inclusion

- Modo oscuro/claro obligatorio (tokens de tema, no colores hardcodeados).
- Labels asociados a inputs, errores con `role=alert` y `aria-describedby` cableado en Nombre/Edad/Hb (create form y edit row); el hint de Nombre es siempre visible, los errores se añaden al describedby al fallar.
