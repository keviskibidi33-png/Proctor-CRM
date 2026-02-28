import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Beaker, ChevronDown, Download, Loader2, Trash2 } from 'lucide-react'
import { getLLPEnsayoDetail, saveAndDownloadLLPExcel, saveLLPEnsayo } from '@/services/api'
import type { LLPPayload, LLPPuntoRow } from '@/types'

const POINT_HEADERS = ['1', '2', '3', '1', '2']
const DRAFT_KEY = 'llp_form_draft_v1'
const DEBOUNCE_MS = 700

const METODO_LIQUIDO = ['-', 'MULTIPUNTO', 'UNIPUNTO'] as const
const HERRAMIENTA = ['-', 'METAL', 'PLASTICO'] as const
const DISPOSITIVO = ['-', 'MANUAL', 'MECANICO'] as const
const LAMINACION = ['-', 'MANUAL', 'DISPOSITIVO DE LAMINACION'] as const
const PREPARACION = ['-', 'HUMEDO', 'SECADO AL AIRE', 'SECADO AL HORNO'] as const
const CONDICION = ['-', 'ALTERADO', 'INTACTO'] as const
const EQ_BALANZA = ['-', 'EQP-0045'] as const
const EQ_HORNO = ['-', 'EQP-0049'] as const
const EQ_COPA = ['-', 'EQP-0048'] as const
const EQ_RANURADOR = ['-', 'EQP-0107'] as const
const REVISADO = ['-', 'FABIAN LA ROSA'] as const
const APROBADO = ['-', 'IRMA COAQUIRA'] as const

const emptyPoint = (): LLPPuntoRow => ({
    recipiente_numero: '',
    numero_golpes: null,
    masa_recipiente_suelo_humedo: null,
    masa_recipiente_suelo_seco: null,
    masa_recipiente_suelo_seco_1: null,
    masa_recipiente: null,
})

const initialState = (): LLPPayload => ({
    muestra: '',
    numero_ot: '',
    fecha_ensayo: '',
    realizado_por: '',
    metodo_ensayo_limite_liquido: '-',
    herramienta_ranurado_limite_liquido: '-',
    dispositivo_limite_liquido: '-',
    metodo_laminacion_limite_plastico: '-',
    contenido_humedad_muestra_inicial_pct: null,
    proceso_seleccion_muestra: '',
    metodo_preparacion_muestra: '-',
    tipo_muestra: '',
    condicion_muestra: '-',
    tamano_maximo_visual_in: '',
    porcentaje_retenido_tamiz_40_pct: null,
    forma_particula: '',
    puntos: Array.from({ length: 5 }, () => emptyPoint()),
    balanza_001g_codigo: '-',
    horno_110_codigo: '-',
    copa_casagrande_codigo: '-',
    ranurador_codigo: '-',
    observaciones: '',
    revisado_por: '-',
    revisado_fecha: '',
    aprobado_por: '-',
    aprobado_fecha: '',
})

const parseNum = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
}

const getEnsayoId = (): number | null => {
    const raw = new URLSearchParams(window.location.search).get('ensayo_id')
    if (!raw) return null
    const n = Number(raw)
    return Number.isInteger(n) && n > 0 ? n : null
}

const compute = (row: LLPPuntoRow) => {
    const agua = row.masa_recipiente_suelo_humedo != null && row.masa_recipiente_suelo_seco_1 != null
        ? Number((row.masa_recipiente_suelo_humedo - row.masa_recipiente_suelo_seco_1).toFixed(2))
        : null
    const seco = row.masa_recipiente_suelo_seco_1 != null && row.masa_recipiente != null
        ? Number((row.masa_recipiente_suelo_seco_1 - row.masa_recipiente).toFixed(2))
        : null
    const humedad = agua != null && seco != null && seco !== 0 ? Number(((agua / seco) * 100).toFixed(2)) : null
    return { agua, seco, humedad }
}

const avg = (values: Array<number | null | undefined>) => {
    const valid = values.filter((x): x is number => x != null && Number.isFinite(x))
    if (!valid.length) return null
    return Number((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2))
}

export default function LLPForm() {
    const [form, setForm] = useState<LLPPayload>(() => initialState())
    const [loading, setLoading] = useState(false)
    const [loadingEdit, setLoadingEdit] = useState(false)
    const [editingEnsayoId, setEditingEnsayoId] = useState<number | null>(() => getEnsayoId())

    const calc = useMemo(() => form.puntos.map(p => compute(p)), [form.puntos])
    const ll = useMemo(() => avg(calc.slice(0, 3).map(x => x.humedad)), [calc])
    const lp = useMemo(() => avg(calc.slice(3).map(x => x.humedad)), [calc])
    const ip = useMemo(() => (ll != null && lp != null ? Number((ll - lp).toFixed(2)) : null), [ll, lp])

    const setField = useCallback(<K extends keyof LLPPayload>(key: K, value: LLPPayload[K]) => {
        setForm(prev => ({ ...prev, [key]: value }))
    }, [])

    const setPoint = useCallback((idx: number, key: keyof LLPPuntoRow, raw: string) => {
        setForm(prev => {
            const next = [...prev.puntos]
            const row = { ...next[idx] }
            if (key === 'recipiente_numero') row[key] = raw
            if (key === 'numero_golpes') row[key] = raw === '' ? null : Math.round(Number(raw))
            if (key !== 'recipiente_numero' && key !== 'numero_golpes') row[key] = parseNum(raw)
            next[idx] = row
            return { ...prev, puntos: next }
        })
    }, [])

    useEffect(() => {
        const raw = localStorage.getItem(`${DRAFT_KEY}:${editingEnsayoId ?? 'new'}`)
        if (!raw) return
        try { setForm({ ...initialState(), ...JSON.parse(raw) }) } catch { /* ignore */ }
    }, [editingEnsayoId])

    useEffect(() => {
        const timer = window.setTimeout(() => {
            localStorage.setItem(`${DRAFT_KEY}:${editingEnsayoId ?? 'new'}`, JSON.stringify(form))
        }, DEBOUNCE_MS)
        return () => window.clearTimeout(timer)
    }, [editingEnsayoId, form])

    useEffect(() => {
        if (!editingEnsayoId) return
        let cancelled = false
        const run = async () => {
            setLoadingEdit(true)
            try {
                const detail = await getLLPEnsayoDetail(editingEnsayoId)
                if (!cancelled && detail.payload) setForm({ ...initialState(), ...detail.payload })
            } catch { toast.error('No se pudo cargar ensayo LLP para edición.') } finally {
                if (!cancelled) setLoadingEdit(false)
            }
        }
        void run()
        return () => { cancelled = true }
    }, [editingEnsayoId])

    const clearAll = useCallback(() => {
        if (!window.confirm('Se limpiarán los datos no guardados. ¿Deseas continuar?')) return
        localStorage.removeItem(`${DRAFT_KEY}:${editingEnsayoId ?? 'new'}`)
        setForm(initialState())
    }, [editingEnsayoId])

    const save = useCallback(async (download: boolean) => {
        if (!form.muestra || !form.numero_ot || !form.realizado_por) {
            toast.error('Complete Muestra, N OT y Realizado por.')
            return
        }
        setLoading(true)
        try {
            const payload: LLPPayload = {
                ...form,
                puntos: form.puntos.map((p, idx) => ({ ...p, numero_golpes: idx < 3 ? parseNum(p.numero_golpes) : null })),
            }
            if (download) {
                const { blob } = await saveAndDownloadLLPExcel(payload, editingEnsayoId ?? undefined)
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `LLP_${payload.numero_ot}_${new Date().toISOString().slice(0, 10)}.xlsx`
                a.click()
                URL.revokeObjectURL(url)
            } else {
                await saveLLPEnsayo(payload, editingEnsayoId ?? undefined)
            }
            localStorage.removeItem(`${DRAFT_KEY}:${editingEnsayoId ?? 'new'}`)
            setForm(initialState())
            setEditingEnsayoId(null)
            if (window.parent !== window) window.parent.postMessage({ type: 'CLOSE_MODAL' }, '*')
            toast.success(download ? 'LLP guardado y descargado.' : 'LLP guardado.')
        } catch (error: unknown) {
            let msg = error instanceof Error ? error.message : 'Error desconocido'
            if (axios.isAxiosError(error) && typeof error.response?.data?.detail === 'string') msg = error.response.data.detail
            toast.error(`Error guardando LLP: ${msg}`)
        } finally {
            setLoading(false)
        }
    }, [editingEnsayoId, form])

    const renderText = (label: string, value: string, onChange: (v: string) => void, placeholder?: string) => (
        <div><label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label><input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" data-lpignore="true" className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" /></div>
    )

    const renderNum = (label: string, value: number | null | undefined, onChange: (v: string) => void) => (
        <div><label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label><input type="number" step="any" value={value ?? ''} onChange={e => onChange(e.target.value)} autoComplete="off" data-lpignore="true" className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" /></div>
    )

    const renderSelect = (label: string, value: string, options: readonly string[], onChange: (v: string) => void) => (
        <div><label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label><div className="relative"><select value={value} onChange={e => onChange(e.target.value)} className="w-full h-9 pl-3 pr-8 rounded-md border border-input bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring">{options.map(o => <option key={o} value={o}>{o}</option>)}</select><ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" /></div></div>
    )

    return (
        <div className="max-w-[1780px] mx-auto p-4 md:p-6">
            <div className="flex items-center gap-3 mb-6"><div className="p-2 rounded-lg bg-primary/10"><Beaker className="h-6 w-6 text-primary" /></div><div><h1 className="text-xl font-bold text-foreground">Limite Liquido / Limite Plastico - ASTM D4318-17e1</h1><p className="text-sm text-muted-foreground">Formulario operativo LLP</p></div></div>
            <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-5">
                <div className="space-y-5">
                    {loadingEdit ? <div className="h-10 rounded-lg border border-border bg-muted/40 px-3 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Cargando ensayo...</div> : null}

                    <div className="bg-card border border-border rounded-lg shadow-sm"><div className="px-4 py-2.5 border-b border-border bg-muted/50 rounded-t-lg"><h2 className="text-sm font-semibold text-foreground">Encabezado</h2></div><div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">{renderText('Muestra *', form.muestra, v => setField('muestra', v), '123-SU-26')}{renderText('N OT *', form.numero_ot, v => setField('numero_ot', v), '1234-26')}{renderText('Fecha ensayo', form.fecha_ensayo, v => setField('fecha_ensayo', v), 'DD/MM/AA')}{renderText('Realizado por *', form.realizado_por, v => setField('realizado_por', v))}</div></div>

                    <div className="bg-card border border-border rounded-lg shadow-sm"><div className="px-4 py-2.5 border-b border-border bg-muted/50 rounded-t-lg"><h2 className="text-sm font-semibold text-foreground">Condiciones / Descripción</h2></div><div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <div className="space-y-3">{renderSelect('Método ensayo LL', form.metodo_ensayo_limite_liquido, METODO_LIQUIDO, v => setField('metodo_ensayo_limite_liquido', v as LLPPayload['metodo_ensayo_limite_liquido']))}{renderSelect('Herramienta ranurado', form.herramienta_ranurado_limite_liquido, HERRAMIENTA, v => setField('herramienta_ranurado_limite_liquido', v as LLPPayload['herramienta_ranurado_limite_liquido']))}{renderSelect('Dispositivo LL', form.dispositivo_limite_liquido, DISPOSITIVO, v => setField('dispositivo_limite_liquido', v as LLPPayload['dispositivo_limite_liquido']))}{renderSelect('Método laminación LP', form.metodo_laminacion_limite_plastico, LAMINACION, v => setField('metodo_laminacion_limite_plastico', v as LLPPayload['metodo_laminacion_limite_plastico']))}{renderNum('Contenido humedad inicial (%)', form.contenido_humedad_muestra_inicial_pct, v => setField('contenido_humedad_muestra_inicial_pct', parseNum(v)))}{renderText('Proceso selección muestra', form.proceso_seleccion_muestra || '', v => setField('proceso_seleccion_muestra', v))}{renderSelect('Preparación muestra', form.metodo_preparacion_muestra, PREPARACION, v => setField('metodo_preparacion_muestra', v as LLPPayload['metodo_preparacion_muestra']))}</div>
                        <div className="space-y-3">{renderText('Tipo de muestra', form.tipo_muestra || '', v => setField('tipo_muestra', v))}{renderSelect('Condición muestra', form.condicion_muestra, CONDICION, v => setField('condicion_muestra', v as LLPPayload['condicion_muestra']))}{renderText('Tamaño máximo visual (in)', form.tamano_maximo_visual_in || '', v => setField('tamano_maximo_visual_in', v))}{renderNum('% retenido tamiz No.40', form.porcentaje_retenido_tamiz_40_pct, v => setField('porcentaje_retenido_tamiz_40_pct', parseNum(v)))}{renderText('Forma de partícula', form.forma_particula || '', v => setField('forma_particula', v))}</div>
                    </div></div>

                    <div className="bg-card border border-border rounded-lg shadow-sm"><div className="px-4 py-2.5 border-b border-border bg-muted/50 rounded-t-lg"><h2 className="text-sm font-semibold text-foreground">Tabla principal</h2></div><div className="p-4 overflow-x-auto"><table className="w-full min-w-[1100px] text-sm"><thead className="bg-muted/40 text-xs font-semibold text-muted-foreground"><tr><th className="w-80 px-3 py-2 border-b border-r border-border text-left" rowSpan={2}>DESCRIPCIÓN</th><th className="w-16 px-2 py-2 border-b border-r border-border text-center" rowSpan={2}>UND</th><th className="px-2 py-2 border-b border-r border-border text-center" colSpan={3}>LIMITE LIQUIDO</th><th className="px-2 py-2 border-b text-center" colSpan={2}>LIMITE PLASTICO</th></tr><tr>{POINT_HEADERS.map((h, i) => <th key={i} className="w-36 px-2 py-2 border-b border-r border-border text-center last:border-r-0">{h}</th>)}</tr></thead>
                        <tbody>
                            <tr><td className="px-3 py-2 border-b border-r border-border">Recipiente N°</td><td className="px-2 py-2 border-b border-r border-border text-center"></td>{form.puntos.map((p, i) => <td key={`r-${i}`} className="px-2 py-2 border-b border-r border-border last:border-r-0"><input type="text" value={p.recipiente_numero || ''} onChange={e => setPoint(i, 'recipiente_numero', e.target.value)} className="w-full h-8 px-2 rounded-md border border-input bg-background text-sm text-center" /></td>)}</tr>
                            <tr><td className="px-3 py-2 border-b border-r border-border">N° de golpes</td><td className="px-2 py-2 border-b border-r border-border text-center"></td>{form.puntos.map((p, i) => <td key={`g-${i}`} className="px-2 py-2 border-b border-r border-border last:border-r-0">{i < 3 ? <input type="number" value={p.numero_golpes ?? ''} onChange={e => setPoint(i, 'numero_golpes', e.target.value)} className="w-full h-8 px-2 rounded-md border border-input bg-background text-sm text-center" /> : <div className="h-8 rounded-md border border-input bg-muted/30 flex items-center justify-center">---</div>}</td>)}</tr>
                            {[
                                ['Masa recipiente y suelo húmedo', 'masa_recipiente_suelo_humedo'],
                                ['Masa recipiente y suelo seco', 'masa_recipiente_suelo_seco'],
                                ['Masa recipiente y suelo seco 1', 'masa_recipiente_suelo_seco_1'],
                                ['Masa del recipiente', 'masa_recipiente'],
                            ].map(([label, key]) => <tr key={key}><td className="px-3 py-2 border-b border-r border-border">{label}</td><td className="px-2 py-2 border-b border-r border-border text-center">g</td>{form.puntos.map((p, i) => <td key={`${key}-${i}`} className="px-2 py-2 border-b border-r border-border last:border-r-0"><input type="number" step="any" value={(p as any)[key] ?? ''} onChange={e => setPoint(i, key as keyof LLPPuntoRow, e.target.value)} className="w-full h-8 px-2 rounded-md border border-input bg-background text-sm text-center" /></td>)}</tr>)}
                            <tr><td className="px-3 py-2 border-b border-r border-border">Masa del agua (C-E)</td><td className="px-2 py-2 border-b border-r border-border text-center">g</td>{calc.map((c, i) => <td key={`a-${i}`} className="px-2 py-2 border-b border-r border-border last:border-r-0"><div className="h-8 rounded-md border border-input bg-muted/30 flex items-center justify-center">{c.agua ?? '-'}</div></td>)}</tr>
                            <tr><td className="px-3 py-2 border-b border-r border-border">Masa del suelo seco (E-F)</td><td className="px-2 py-2 border-b border-r border-border text-center">g</td>{calc.map((c, i) => <td key={`s-${i}`} className="px-2 py-2 border-b border-r border-border last:border-r-0"><div className="h-8 rounded-md border border-input bg-muted/30 flex items-center justify-center">{c.seco ?? '-'}</div></td>)}</tr>
                            <tr><td className="px-3 py-2 border-b border-r border-border">% Humedad (G/H*100)</td><td className="px-2 py-2 border-b border-r border-border text-center">%</td>{calc.map((c, i) => <td key={`h-${i}`} className="px-2 py-2 border-b border-r border-border last:border-r-0"><div className="h-8 rounded-md border border-primary bg-primary/5 text-primary font-semibold flex items-center justify-center">{c.humedad ?? '-'}</div></td>)}</tr>
                        </tbody></table></div></div>

                    <div className="bg-card border border-border rounded-lg shadow-sm"><div className="px-4 py-2.5 border-b border-border bg-muted/50 rounded-t-lg"><h2 className="text-sm font-semibold text-foreground">Equipos / observaciones / firmas</h2></div><div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-4"><div className="space-y-3">{renderSelect('Balanza 0.01 g', form.balanza_001g_codigo || '-', EQ_BALANZA, v => setField('balanza_001g_codigo', v))}{renderSelect('Horno 110 C', form.horno_110_codigo || '-', EQ_HORNO, v => setField('horno_110_codigo', v))}{renderSelect('Copa casagrande', form.copa_casagrande_codigo || '-', EQ_COPA, v => setField('copa_casagrande_codigo', v))}{renderSelect('Ranurador', form.ranurador_codigo || '-', EQ_RANURADOR, v => setField('ranurador_codigo', v))}</div><div className="space-y-3"><div><label className="block text-xs font-medium text-muted-foreground mb-1">Observaciones</label><textarea value={form.observaciones || ''} onChange={e => setField('observaciones', e.target.value)} rows={4} className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none" /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{renderSelect('Revisado por', form.revisado_por || '-', REVISADO, v => setField('revisado_por', v))}{renderSelect('Aprobado por', form.aprobado_por || '-', APROBADO, v => setField('aprobado_por', v))}{renderText('Fecha revisado', form.revisado_fecha || '', v => setField('revisado_fecha', v), 'DD/MM/AA')}{renderText('Fecha aprobado', form.aprobado_fecha || '', v => setField('aprobado_fecha', v), 'DD/MM/AA')}</div></div></div></div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <button onClick={clearAll} disabled={loading} className="h-11 rounded-lg border border-input bg-background text-foreground font-medium hover:bg-muted/60 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"><Trash2 className="h-4 w-4" />Limpiar todo</button>
                        <button onClick={() => void save(false)} disabled={loading} className="h-11 rounded-lg border border-primary text-primary font-semibold hover:bg-primary/10 transition-colors disabled:opacity-50">{loading ? 'Guardando...' : 'Guardar'}</button>
                        <button onClick={() => void save(true)} disabled={loading} className="h-11 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">{loading ? <><Loader2 className="h-4 w-4 animate-spin" />Procesando...</> : <><Download className="h-4 w-4" />Guardar y descargar Excel</>}</button>
                    </div>
                </div>

                <aside className="hidden xl:block">
                    <div className="sticky top-4 bg-card border border-border rounded-lg shadow-sm p-4 text-xs space-y-4">
                        <h3 className="text-sm font-semibold text-foreground">Formulario / Tabla de informacion</h3>
                        <table className="w-full border border-border"><tbody><tr className="border-b"><td className="px-2 py-2">LL promedio</td><td className="px-2 py-2 text-right font-semibold">{ll ?? '-'}</td></tr><tr className="border-b"><td className="px-2 py-2">LP promedio</td><td className="px-2 py-2 text-right font-semibold">{lp ?? '-'}</td></tr><tr><td className="px-2 py-2">Indice plasticidad</td><td className="px-2 py-2 text-right font-semibold">{ip ?? '-'}</td></tr></tbody></table>
                        <table className="w-full border border-border"><thead className="bg-muted/40"><tr><th className="px-2 py-2 text-left">Punto</th><th className="px-2 py-2 text-center">Humedad %</th></tr></thead><tbody>{POINT_HEADERS.map((h, i) => <tr key={i} className="border-t"><td className="px-2 py-2">{i < 3 ? `LL ${h}` : `LP ${h}`}</td><td className="px-2 py-2 text-center">{calc[i]?.humedad ?? '-'}</td></tr>)}</tbody></table>
                    </div>
                </aside>
            </div>
        </div>
    )
}
