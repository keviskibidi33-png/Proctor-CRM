# README - Automatizacion ligera Formulario -> Excel

## 1) Objetivo
Esta plantilla sirve para cualquier proyecto pequeno donde una pagina web capture datos y genere un archivo Excel con mapeo directo de campos a celdas.

Enfoque:
- Menor escala
- Menos codigo
- Logica simple
- Solo mapeo de digitos/campos

## 2) Stack recomendado (minimo)
- Frontend: HTML + JS (o React/Vite si ya existe)
- Backend: FastAPI
- Excel: `openpyxl`
- Validacion: Pydantic

Opcional:
- Base de datos: Supabase/Postgres solo si necesitas historial
- Sin BD: guardar solo archivos generados

## 3) Arquitectura minima
```text
web-form (1 pantalla)
   -> POST /api/export-excel
      -> valida payload
      -> aplica mapeo campo->celda
      -> guarda archivo .xlsx
      -> devuelve URL o descarga
```

## 4) Estructura sugerida
```text
project/
  backend/
    main.py
    schemas.py
    excel_service.py
    mapping.json
    templates/
      plantilla_base.xlsx
    output/
  frontend/
    index.html
    app.js
```

## 5) Mapeo de digitos/campos (core)
Archivo: `backend/mapping.json`

```json
{
  "numero_recepcion": { "cell": "B4", "type": "text" },
  "codigo_cliente": { "cell": "E4", "type": "text" },
  "edad_dias": { "cell": "C10", "type": "int" },
  "peso_kg": { "cell": "D10", "type": "float" },
  "observaciones": { "cell": "A20", "type": "text" }
}
```

Regla:
1. Campo del formulario
2. Tipo de dato
3. Celda destino en Excel

Con esto evitas logica compleja y mantienes el sistema facil de mantener.

## 6) Endpoint minimo (FastAPI)
Instalar:
```bash
pip install fastapi uvicorn openpyxl pydantic python-multipart
```

Ejecutar:
```bash
uvicorn main:app --reload
```

Contrato sugerido:
- `POST /api/export-excel`
- Body JSON: datos del formulario
- Response: archivo generado (stream) o `{"file_url": "..."}`

## 7) Flujo de frontend simple
1. Usuario llena formulario en una sola pagina.
2. Frontend envia JSON al backend.
3. Backend crea Excel usando `mapping.json`.
4. Frontend muestra boton de descarga.

## 8) Buenas practicas para no romper Excel
- No usar `pandas.DataFrame.to_excel()` sobre plantillas con formato.
- Usar `openpyxl.load_workbook(...)`.
- Si la plantilla tiene macros, abrir con `keep_vba=True`.
- Escribir solo en la celda top-left cuando hay celdas combinadas.
- Manejar `PermissionError` cuando el archivo esta abierto en Excel.
- Respetar tipos numericos: `int/float` reales, no strings.

## 9) Version ultra-ligera (sin backend complejo)
Si quieres aun menos codigo:
- Frontend unico
- FastAPI con 1 endpoint
- 1 plantilla Excel
- 1 `mapping.json`
- 1 servicio `excel_service.py`

Eso ya cubre automatizacion formulario -> Excel para casos pequenos/medianos.

## 10) Escalado futuro (solo si hace falta)
- Agregar autenticacion JWT
- Guardar trazabilidad en BD
- Versionado de plantillas
- Colas para generacion masiva

---

## Checklist rapido
- [ ] Plantilla Excel lista
- [ ] `mapping.json` definido
- [ ] Endpoint `POST /api/export-excel`
- [ ] Validacion de tipos en payload
- [ ] Descarga o URL de archivo funcionando
- [ ] Prueba con 3 formularios reales
