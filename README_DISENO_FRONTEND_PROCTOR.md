# README - Diseno Frontend Proctor y su ajuste a Excel

## 1) Objetivo
Documentar como esta diseniado el frontend de Proctor y por que su estructura encaja con la hoja oficial `Template_Proctor.xlsx` sin perder formato ni consistencia de datos.

---

## 2) Vista general del modulo

- Frontend: `proctor-crm` (Vite + React + TypeScript + Tailwind).
- Formulario principal: `src/pages/ProctorForm.tsx`.
- API: `POST /api/proctor/excel` (guardar y/o descargar).
- Modo uso:
  - Nuevo ensayo.
  - Edicion por `?ensayo_id=<id>`.
  - Integracion embebida en CRM via iframe.

---

## 3) Como esta diseniado el frontend

El formulario no es "libre"; esta armado con la misma logica de bloques del formato de laboratorio:

1. Encabezado.
2. Tabla de Densidad humeda (5 puntos).
3. Tabla de Contenido de humedad / Densidad seca (5 puntos).
4. Descripcion de muestra + Condiciones del ensayo.
5. Tabla de tamices.
6. Equipos utilizados.
7. Revisado / Aprobado.
8. Panel lateral de progreso y resumen en vivo.

Esto permite que el operador capture en el mismo orden en que luego se imprime el Excel.

---

## 4) Por que el diseno se adecua a la hoja de calculo

### 4.1 Mismo modelo de columnas del ensayo

- El frontend fija 5 puntos (`Punto 1 ... Punto 5`).
- El backend escribe esos 5 puntos en columnas fijas del template: `D, F, G, H, I`.
- No hay columnas dinamicas, por eso no se rompe la maqueta del archivo.

### 4.2 Mismo orden de filas tecnicas

Las tablas de UI siguen el mismo orden de calculo del formato:

- Densidad humeda:
  - `A`, `B`, `C=A-B`, `D`, `X=C/D`.
- Humedad y densidad seca:
  - `E`, `F`, `Y=E-F`, `G`, `Z=F-G`, `W=Y/Z*100`, `Densidad seca`.

El backend replica exactamente esas operaciones antes de escribir en celdas.

### 4.3 Mapeo directo seccion -> celdas

Mapeo principal (resumen):

- Encabezado:
  - `muestra -> B9`
  - `numero_ot -> C9`
  - `fecha_ensayo -> F9`
  - `realizado_por -> H9`
- Puntos (5 columnas):
  - Filas `15-22` (densidad humeda)
  - Filas `24-33` (humedad / densidad seca)
- Descripcion y condiciones:
  - `C35:C46`
- Tamices:
  - Masa: `G37:G41`
  - `% retenido`: `H37:H41` (formulas)
  - `% acumulado`: `I37:I41` (formulas)
- Equipos:
  - `H44:H49`
- Firmas (revisado/aprobado):
  - Se inyectan en `drawing1.xml` para respetar cajas y posicion visual del template.

### 4.4 Tipos y normalizacion alineados con Excel

- Inputs numericos se guardan como `number | null` (no string).
- `numero_ot` y fechas se normalizan en frontend y tambien en backend.
- Selects usan `-` como estado no seleccionado, igual que el contrato backend.

Esto evita errores de tipo y reduce correcciones manuales en Excel.

### 4.5 Calculo en vivo sin romper plantilla

- Frontend calcula preview de:
  - Masa compactada.
  - Densidad humeda.
  - Contenido de humedad.
  - Densidad seca.
  - Totales y porcentajes de tamices.
- Backend recalcula y escribe valores + formulas cacheadas en Excel.

Resultado: el operador ve una pre-validacion en pantalla y el archivo final mantiene formulas/estilos oficiales.

### 4.6 UX pensada para captura tabular de laboratorio

- Navegacion con Enter (`data-enter-nav`) para avanzar campo por campo.
- `autoComplete="off"` y `data-lpignore="true"` para evitar autofill del navegador.
- Columnas sticky en tablas (`DESCRIPCION` y `UND`) para no perder contexto al desplazarse.
- Autosave local por borrador (`localStorage`) para no perder avance.
- Panel lateral con progreso por secciones para saber si el ensayo ya esta "completo".

---

## 5) Coherencia frontend <-> backend (estado del ensayo)

El panel de progreso del frontend sigue la misma idea del backend para marcar completitud:

- Encabezado completo.
- Condiciones seleccionadas.
- Minimo 4/5 puntos tecnicamente completos.
- Tamices base completos.
- Equipos completos.

Con eso se minimiza el caso "se ve completo en UI pero queda incompleto en BD/Excel".

---

## 6) Flujo operativo

1. Operador llena formulario Proctor.
2. Frontend calcula previews y valida campos minimos.
3. `POST /api/proctor/excel` con payload normalizado.
4. Backend genera archivo desde `Template_Proctor.xlsx` con estrategia ZIP/XML (preserva shapes, merges, estilos y formulas).
5. Frontend:
   - Guarda sin descarga, o
   - Descarga `PROCTOR_<numero_ot>_<fecha>.xlsx`.
6. Si esta embebido en CRM, el modulo envia `CLOSE_MODAL`.

---

## 7) Archivos clave

- Frontend:
  - `src/pages/ProctorForm.tsx`
  - `src/services/api.ts`
  - `src/types/index.ts`
  - `src/components/SessionGuard.tsx`
- Backend (referencia de mapeo Excel):
  - `api-geofal-crm/app/modules/proctor/excel.py`
  - `api-geofal-crm/app/modules/proctor/router.py`
  - `api-geofal-crm/app/modules/proctor/schemas.py`

---

## 8) Conclusiones

El frontend de Proctor esta diseniado como "espejo funcional" del formato de laboratorio, no como formulario generico. Esa decision hace que:

- la captura sea mas rapida para el operador,
- el payload llegue limpio y consistente,
- y el Excel final conserve estructura oficial sin retrabajo manual.
