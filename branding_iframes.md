# Branding Iframes - Proctor

Documento de referencia para mantener consistente el branding del microfrontend de Proctor y su visualizacion embebida en iframe dentro del CRM.

## Alcance

- Microfrontend: `proctor-crm`
- Shell embebedor: `crm-geofal` modulo Proctor
- Flujo: CRM abre `https://proctor.geofal.com.pe` en dialog modal con `token` y opcionalmente `ensayo_id`

## Reglas visuales

- Mantener la paleta y tipografia definida en `src/index.css`.
- Reusar componentes base (`Section`, `Input`, `SelectField`) para consistencia con humedad/cbr.
- Mantener el orden visual de la hoja oficial `Template_Proctor.xlsx` en el formulario web.
- Mantener botonera final con accion doble: `Guardar` y `Guardar y Descargar`.

## Contrato iframe

- Entrada por query params: `token`, `ensayo_id`.
- Mensajes hijo -> padre: `TOKEN_REFRESH_REQUEST`, `CLOSE_MODAL`.
- Mensaje padre -> hijo: `TOKEN_REFRESH`.

## Archivos clave

- `proctor-crm/src/pages/ProctorForm.tsx`
- `proctor-crm/src/App.tsx`
- `proctor-crm/src/components/SessionGuard.tsx`
- `crm-geofal/src/components/dashboard/proctor-module.tsx`