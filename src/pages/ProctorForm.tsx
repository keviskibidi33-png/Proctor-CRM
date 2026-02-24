import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { ChevronDown, Download, Loader2, FlaskConical, Beaker, Trash2 } from 'lucide-react'
import {
    getProctorEnsayoDetail,
    saveAndDownloadProctorExcel,
    saveProctorEnsayo,
} from '@/services/api'
import type { ProctorPayload, ProctorEnsayoDetail, ProctorPunto } from '@/types'

const POINT_COLUMNS = ['Punto 1', 'Punto 2', 'Punto 3', 'Punto 4', 'Punto 5']
const SIEVE_LABELS = ['19 mm (3/4 in)', '9.5 mm (3/8 in)', '4.75 mm (No. 4)', 'Menor (No. 4)', 'Total']
const FIXED_NUMERO_CAPAS = 5

const CONDICION_MUESTRA_OPTIONS: Array<'-' | 'ALTERADO' | 'INTACTA'> = ['-', 'ALTERADO', 'INTACTA']
const METODO_ENSAYO_OPTIONS: Array<'-' | 'A' | 'B' | 'C'> = ['-', 'A', 'B', 'C']
const METODO_PREPARACION_OPTIONS: Array<'-' | 'HUMEDO' | 'SECO'> = ['-', 'HUMEDO', 'SECO']
const APISONADOR_OPTIONS: Array<'-' | 'MANUAL' | 'MECANICO'> = ['-', 'MANUAL', 'MECANICO']
const SI_NO_OPTIONS: Array<'-' | 'SI' | 'NO'> = ['-', 'SI', 'NO']
const GOLPES_OPTIONS: Array<'-' | '25' | '56'> = ['-', '25', '56']
const TAMIZ_METODO_OPTIONS = ['-', 'INS-0050 (3/4in)', 'INS-0053 (No 4)', 'INS-0052 (3/8in)'] as const
const BALANZA_1G_OPTIONS = ['-', 'EQP-0054'] as const
const BALANZA_01G_OPTIONS = ['-', 'EQP-0046'] as const
const HORNO_110_OPTIONS = ['-', 'EQP-0049'] as const
const MOLDE_OPTIONS = ['-', 'INS-0195 (MOLDE 6in)', 'INS-0114 (MOLDE 4in)'] as const
const PISON_OPTIONS = ['-', 'INS-0196'] as const

const REVISADO_POR_OPTIONS = ['-', 'FABIAN LA ROSA']
const APROBADO_POR_OPTIONS = ['-', 'IRMA COAQUIRA']
const PROCTOR_DRAFT_STORAGE_PREFIX = 'proctor_form_draft_v1'
const AUTOSAVE_DEBOUNCE_MS = 700

interface ProctorDraftSnapshot {
    version: number
    updatedAt: string
    form: Partial<ProctorPayload>
}

const getDraftStorageKey = (ensayoId: number | null) =>
    `${PROCTOR_DRAFT_STORAGE_PREFIX}:${ensayoId ?? 'new'}`

const getCurrentYearShort = () => new Date().getFullYear().toString().slice(-2)

const normalizeMuestraCode = (raw: string): string => {
    const value = raw.trim().toUpperCase()
    if (!value) return ''

    const compact = value.replace(/\s+/g, '')
    const year = getCurrentYearShort()
    const match = compact.match(/^(\d+)(?:-SU)?(?:-(\d{2}))?$/)
    if (match) {
        return `${match[1]}-SU-${match[2] || year}`
    }
    return value
}

const normalizeNumeroOtCode = (raw: string): string => {
    const value = raw.trim().toUpperCase()
    if (!value) return ''

    const compact = value.replace(/\s+/g, '')
    const year = getCurrentYearShort()
    const patterns = [
        /^(?:N?OT-)?(\d+)(?:-(\d{2}))?$/,
        /^(\d+)(?:-(?:N?OT))?(?:-(\d{2}))?$/,
    ]

    for (const pattern of patterns) {
        const match = compact.match(pattern)
        if (match) {
            return `${match[1]}-${match[2] || year}`
        }
    }

    return value
}

const normalizeFlexibleDate = (raw: string): string => {
    const value = raw.trim()
    if (!value) return ''

    const digits = value.replace(/\D/g, '')
    const year = getCurrentYearShort()
    const pad2 = (part: string) => part.padStart(2, '0').slice(-2)
    const build = (d: string, m: string, y: string = year) => `${pad2(d)}/${pad2(m)}/${pad2(y)}`

    if (value.includes('/')) {
        const [d = '', m = '', yRaw = ''] = value.split('/').map(part => part.trim())
        if (!d || !m) return value
        let yy = yRaw.replace(/\D/g, '')
        if (yy.length === 4) yy = yy.slice(-2)
        if (yy.length === 1) yy = `0${yy}`
        if (!yy) yy = year
        return build(d, m, yy)
    }

    if (digits.length === 2) return build(digits[0], digits[1])
    if (digits.length === 3) return build(digits[0], digits.slice(1, 3))
    if (digits.length === 4) return build(digits.slice(0, 2), digits.slice(2, 4))
    if (digits.length === 5) return build(digits[0], digits.slice(1, 3), digits.slice(3, 5))
    if (digits.length === 6) return build(digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6))
    if (digits.length >= 8) return build(digits.slice(0, 2), digits.slice(2, 4), digits.slice(6, 8))

    return value
}

const toOptionalNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
}

const normalizeNumeroGolpes = (value: unknown): number | null => {
    const parsed = toOptionalNumber(value)
    return parsed === 25 || parsed === 56 ? parsed : null
}

const emptyPoint = (index: number): ProctorPunto => ({
    prueba_numero: index + 1,
    numero_capas: FIXED_NUMERO_CAPAS,
    numero_golpes: null,
    masa_suelo_humedo_molde_a: null,
    masa_molde_compactacion_b: null,
    masa_suelo_compactado_c: null,
    volumen_molde_compactacion_d: null,
    densidad_humeda_x: null,
    tara_numero: '',
    masa_recipiente_suelo_humedo_e: null,
    masa_recipiente_suelo_seco_1: null,
    masa_recipiente_suelo_seco_2: null,
    masa_recipiente_suelo_seco_3_f: null,
    masa_agua_y: null,
    masa_recipiente_g: null,
    masa_suelo_seco_z: null,
    contenido_humedad_moldeo_w: null,
    densidad_seca: null,
})

const emptySieveArray = () => Array.from({ length: 5 }, () => null as number | null)

const buildInitialState = (): ProctorPayload => ({
    muestra: '',
    numero_ot: '',
    fecha_ensayo: '',
    realizado_por: '',
    puntos: Array.from({ length: 5 }, (_, idx) => emptyPoint(idx)),
    tipo_muestra: '',
    condicion_muestra: '-',
    tamano_maximo_particula_in: '',
    forma_particula: '',
    clasificacion_sucs_visual: '',
    metodo_ensayo: '-',
    metodo_preparacion: '-',
    tipo_apisonador: '-',
    contenido_humedad_natural_pct: null,
    excluyo_material_muestra: '-',
    tamiz_masa_retenida_g: emptySieveArray(),
    tamiz_porcentaje_retenido: emptySieveArray(),
    tamiz_porcentaje_retenido_acumulado: emptySieveArray(),
    tamiz_utilizado_metodo_codigo: '-',
    balanza_1g_codigo: '-',
    balanza_codigo: '-',
    horno_110_codigo: '-',
    molde_codigo: '-',
    pison_codigo: '-',
    observaciones: '',
    revisado_por: '-',
    revisado_fecha: '',
    aprobado_por: '-',
    aprobado_fecha: '',
})

const normalizeNumberArray = (value: Array<number | null> | undefined, length: number): Array<number | null> => {
    return Array.from({ length }, (_, idx) => toOptionalNumber(value?.[idx]))
}

const normalizePoint = (value: ProctorPunto | undefined, index: number): ProctorPunto => {
    const merged = { ...emptyPoint(index), ...(value || {}) }
    return {
        ...merged,
        prueba_numero: index + 1,
        numero_capas: FIXED_NUMERO_CAPAS,
        numero_golpes: normalizeNumeroGolpes(merged.numero_golpes),
        masa_suelo_humedo_molde_a: toOptionalNumber(merged.masa_suelo_humedo_molde_a),
        masa_molde_compactacion_b: toOptionalNumber(merged.masa_molde_compactacion_b),
        masa_suelo_compactado_c: toOptionalNumber(merged.masa_suelo_compactado_c),
        volumen_molde_compactacion_d: toOptionalNumber(merged.volumen_molde_compactacion_d),
        densidad_humeda_x: toOptionalNumber(merged.densidad_humeda_x),
        tara_numero: (merged.tara_numero || ''),
        masa_recipiente_suelo_humedo_e: toOptionalNumber(merged.masa_recipiente_suelo_humedo_e),
        masa_recipiente_suelo_seco_1: toOptionalNumber(merged.masa_recipiente_suelo_seco_1),
        masa_recipiente_suelo_seco_2: toOptionalNumber(merged.masa_recipiente_suelo_seco_2),
        masa_recipiente_suelo_seco_3_f: toOptionalNumber(merged.masa_recipiente_suelo_seco_3_f),
        masa_agua_y: toOptionalNumber(merged.masa_agua_y),
        masa_recipiente_g: toOptionalNumber(merged.masa_recipiente_g),
        masa_suelo_seco_z: toOptionalNumber(merged.masa_suelo_seco_z),
        contenido_humedad_moldeo_w: toOptionalNumber(merged.contenido_humedad_moldeo_w),
        densidad_seca: toOptionalNumber(merged.densidad_seca),
    }
}

const normalizeSelect = <T extends string>(raw: unknown, options: readonly T[], fallback: T): T => {
    const text = String(raw || '').trim().toUpperCase() as T
    return options.includes(text) ? text : fallback
}

const hydrateProctorFormState = (candidate: Partial<ProctorPayload>): ProctorPayload => {
    const merged = { ...buildInitialState(), ...(candidate || {}) }
    return {
        ...merged,
        puntos: Array.from({ length: 5 }, (_, idx) => normalizePoint(merged.puntos?.[idx], idx)),
        tamiz_masa_retenida_g: normalizeNumberArray(merged.tamiz_masa_retenida_g, 5),
        tamiz_porcentaje_retenido: normalizeNumberArray(merged.tamiz_porcentaje_retenido, 5),
        tamiz_porcentaje_retenido_acumulado: normalizeNumberArray(merged.tamiz_porcentaje_retenido_acumulado, 5),
        condicion_muestra: normalizeSelect(merged.condicion_muestra, CONDICION_MUESTRA_OPTIONS, '-'),
        metodo_ensayo: normalizeSelect(merged.metodo_ensayo, METODO_ENSAYO_OPTIONS, '-'),
        metodo_preparacion: normalizeSelect(merged.metodo_preparacion, METODO_PREPARACION_OPTIONS, '-'),
        tipo_apisonador: normalizeSelect(merged.tipo_apisonador, APISONADOR_OPTIONS, '-'),
        excluyo_material_muestra: normalizeSelect(merged.excluyo_material_muestra, SI_NO_OPTIONS, '-'),
        contenido_humedad_natural_pct: toOptionalNumber(merged.contenido_humedad_natural_pct),
        tamiz_utilizado_metodo_codigo: normalizeSelect(merged.tamiz_utilizado_metodo_codigo, TAMIZ_METODO_OPTIONS, '-'),
        balanza_1g_codigo: normalizeSelect(merged.balanza_1g_codigo, BALANZA_1G_OPTIONS, '-'),
        balanza_codigo: normalizeSelect(merged.balanza_codigo, BALANZA_01G_OPTIONS, '-'),
        horno_110_codigo: normalizeSelect(merged.horno_110_codigo, HORNO_110_OPTIONS, '-'),
        molde_codigo: normalizeSelect(merged.molde_codigo, MOLDE_OPTIONS, '-'),
        pison_codigo: normalizeSelect(merged.pison_codigo, PISON_OPTIONS, '-'),
    }
}

const normalizeTextValue = (value: unknown): string => String(value ?? '').trim()

const getComparableProctorFormState = (form: ProctorPayload): ProctorPayload => {
    const hydrated = hydrateProctorFormState(form)
    return {
        ...hydrated,
        muestra: normalizeTextValue(hydrated.muestra),
        numero_ot: normalizeTextValue(hydrated.numero_ot),
        fecha_ensayo: normalizeTextValue(hydrated.fecha_ensayo),
        realizado_por: normalizeTextValue(hydrated.realizado_por),
        tipo_muestra: normalizeTextValue(hydrated.tipo_muestra),
        condicion_muestra: normalizeTextValue(hydrated.condicion_muestra),
        tamano_maximo_particula_in: normalizeTextValue(hydrated.tamano_maximo_particula_in),
        forma_particula: normalizeTextValue(hydrated.forma_particula),
        clasificacion_sucs_visual: normalizeTextValue(hydrated.clasificacion_sucs_visual),
        tamiz_utilizado_metodo_codigo: normalizeTextValue(hydrated.tamiz_utilizado_metodo_codigo) || '-',
        balanza_1g_codigo: normalizeTextValue(hydrated.balanza_1g_codigo) || '-',
        balanza_codigo: normalizeTextValue(hydrated.balanza_codigo) || '-',
        horno_110_codigo: normalizeTextValue(hydrated.horno_110_codigo) || '-',
        molde_codigo: normalizeTextValue(hydrated.molde_codigo) || '-',
        pison_codigo: normalizeTextValue(hydrated.pison_codigo) || '-',
        observaciones: normalizeTextValue(hydrated.observaciones),
        revisado_por: normalizeTextValue(hydrated.revisado_por) || '-',
        revisado_fecha: normalizeTextValue(hydrated.revisado_fecha),
        aprobado_por: normalizeTextValue(hydrated.aprobado_por) || '-',
        aprobado_fecha: normalizeTextValue(hydrated.aprobado_fecha),
        puntos: hydrated.puntos.map((point, idx) => ({
            ...normalizePoint(point, idx),
            tara_numero: normalizeTextValue(point.tara_numero),
        })),
    }
}

const areFormsEquivalent = (left: ProctorPayload, right: ProctorPayload): boolean => {
    return JSON.stringify(getComparableProctorFormState(left)) === JSON.stringify(getComparableProctorFormState(right))
}

const isFormAtInitialState = (form: ProctorPayload): boolean => {
    return areFormsEquivalent(form, buildInitialState())
}

const getEnsayoIdFromQuery = (): number | null => {
    const raw = new URLSearchParams(window.location.search).get('ensayo_id')
    if (!raw) return null
    const parsed = Number(raw)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

interface PointComputed {
    masa_suelo_compactado_c: number | null
    densidad_humeda_x: number | null
    masa_agua_y: number | null
    masa_suelo_seco_z: number | null
    contenido_humedad_moldeo_w: number | null
    densidad_seca: number | null
}

const computePoint = (point: ProctorPunto): PointComputed => {
    const masaCompactado =
        toOptionalNumber(point.masa_suelo_compactado_c) ??
        (
            point.masa_suelo_humedo_molde_a != null && point.masa_molde_compactacion_b != null
                ? Number((point.masa_suelo_humedo_molde_a - point.masa_molde_compactacion_b).toFixed(2))
                : null
        )

    const densidadHumeda =
        toOptionalNumber(point.densidad_humeda_x) ??
        (
            masaCompactado != null && point.volumen_molde_compactacion_d != null && point.volumen_molde_compactacion_d !== 0
                ? Number((masaCompactado / point.volumen_molde_compactacion_d).toFixed(3))
                : null
        )

    const masaAgua =
        toOptionalNumber(point.masa_agua_y) ??
        (
            point.masa_recipiente_suelo_humedo_e != null && point.masa_recipiente_suelo_seco_3_f != null
                ? Number((point.masa_recipiente_suelo_humedo_e - point.masa_recipiente_suelo_seco_3_f).toFixed(2))
                : null
        )

    const masaSueloSeco =
        toOptionalNumber(point.masa_suelo_seco_z) ??
        (
            point.masa_recipiente_suelo_seco_3_f != null && point.masa_recipiente_g != null
                ? Number((point.masa_recipiente_suelo_seco_3_f - point.masa_recipiente_g).toFixed(2))
                : null
        )

    const contenidoHumedad =
        toOptionalNumber(point.contenido_humedad_moldeo_w) ??
        (
            masaAgua != null && masaSueloSeco != null && masaSueloSeco !== 0
                ? Number(((masaAgua / masaSueloSeco) * 100).toFixed(2))
                : null
        )

    const densidadSeca =
        toOptionalNumber(point.densidad_seca) ??
        (
            densidadHumeda != null && contenidoHumedad != null
                ? Number((densidadHumeda / (1 + contenidoHumedad / 100)).toFixed(3))
                : null
        )

    return {
        masa_suelo_compactado_c: masaCompactado,
        densidad_humeda_x: densidadHumeda,
        masa_agua_y: masaAgua,
        masa_suelo_seco_z: masaSueloSeco,
        contenido_humedad_moldeo_w: contenidoHumedad,
        densidad_seca: densidadSeca,
    }
}

const computeSievePreview = (form: ProctorPayload) => {
    const mass = [...form.tamiz_masa_retenida_g]
    const pct = [...form.tamiz_porcentaje_retenido]
    const acc = [...form.tamiz_porcentaje_retenido_acumulado]

    if (mass[4] == null && mass.slice(0, 4).every(v => v != null)) {
        mass[4] = Number((mass.slice(0, 4).reduce<number>((sum, value) => sum + (value ?? 0), 0)).toFixed(2))
    }

    const totalIndex = mass.length - 1
    const total = mass[totalIndex] && mass[totalIndex] !== 0 ? mass[totalIndex] : null
    if (total) {
        let running = 0
        for (let idx = 0; idx < totalIndex; idx += 1) {
            if (pct[idx] == null && mass[idx] != null) {
                pct[idx] = Number((((mass[idx] || 0) / total) * 100).toFixed(2))
            }
            if (pct[idx] != null) {
                running += pct[idx] || 0
                if (acc[idx] == null) {
                    acc[idx] = Number(running.toFixed(2))
                }
            }
        }

        if (pct[totalIndex] == null) pct[totalIndex] = 100
        if (acc[totalIndex] == null) acc[totalIndex] = 100
    }

    return { mass, pct, acc }
}

type PointNumberKey =
    | 'prueba_numero'
    | 'numero_capas'
    | 'numero_golpes'
    | 'masa_suelo_humedo_molde_a'
    | 'masa_molde_compactacion_b'
    | 'volumen_molde_compactacion_d'
    | 'masa_recipiente_suelo_humedo_e'
    | 'masa_recipiente_suelo_seco_1'
    | 'masa_recipiente_suelo_seco_2'
    | 'masa_recipiente_suelo_seco_3_f'
    | 'masa_recipiente_g'

type SieveArrayKey = 'tamiz_masa_retenida_g' | 'tamiz_porcentaje_retenido' | 'tamiz_porcentaje_retenido_acumulado'

export default function ProctorForm() {
    const [form, setForm] = useState<ProctorPayload>(() => buildInitialState())
    const [loading, setLoading] = useState(false)
    const [editingEnsayoId, setEditingEnsayoId] = useState<number | null>(() => getEnsayoIdFromQuery())
    const [loadingEnsayo, setLoadingEnsayo] = useState(false)
    const [isClearDraftModalOpen, setIsClearDraftModalOpen] = useState(false)
    const hydratedFromServerRef = useRef<ProctorPayload | null>(null)
    const restoredDraftKeysRef = useRef<Set<string>>(new Set())
    const draftStorageKey = useMemo(() => getDraftStorageKey(editingEnsayoId), [editingEnsayoId])

    const set = useCallback(<K extends keyof ProctorPayload>(key: K, value: ProctorPayload[K]) => {
        setForm(prev => ({ ...prev, [key]: value }))
    }, [])

    const setNum = useCallback((key: keyof ProctorPayload, raw: string) => {
        const val = raw === '' ? null : Number(raw)
        setForm(prev => ({ ...prev, [key]: Number.isFinite(val) ? val : null }))
    }, [])

    const setPointNumber = useCallback((index: number, key: PointNumberKey, raw: string) => {
        const val = raw === '' ? null : Number(raw)
        setForm(prev => {
            const next = [...prev.puntos]
            const row = { ...next[index] }
            row[key] = Number.isFinite(val) ? val : null
            next[index] = row
            return { ...prev, puntos: next }
        })
    }, [])

    const setPointGolpes = useCallback((index: number, raw: string) => {
        const nextValue = raw === '-' ? null : Number(raw)
        setForm(prev => {
            const next = [...prev.puntos]
            const row = { ...next[index] }
            row.numero_golpes = nextValue === 25 || nextValue === 56 ? nextValue : null
            next[index] = row
            return { ...prev, puntos: next }
        })
    }, [])

    const setPointText = useCallback((index: number, key: 'tara_numero', raw: string) => {
        setForm(prev => {
            const next = [...prev.puntos]
            const row = { ...next[index] }
            row[key] = raw
            next[index] = row
            return { ...prev, puntos: next }
        })
    }, [])

    const setSieveValue = useCallback((key: SieveArrayKey, index: number, raw: string) => {
        const val = raw === '' ? null : Number(raw)
        setForm(prev => {
            const next = [...prev[key]]
            next[index] = Number.isFinite(val) ? val : null
            return { ...prev, [key]: next }
        })
    }, [])

    const applyFormattedField = useCallback((
        key: 'muestra' | 'numero_ot' | 'fecha_ensayo' | 'revisado_fecha' | 'aprobado_fecha',
        formatter: (raw: string) => string,
    ) => {
        setForm(prev => {
            const current = String(prev[key] ?? '')
            const formatted = formatter(current)
            if (formatted === current) return prev
            return { ...prev, [key]: formatted }
        })
    }, [])

    const computedPoints = useMemo(() => {
        return form.puntos.map((point) => computePoint(point))
    }, [form.puntos])

    const densidadSecaMaxima = useMemo(() => {
        const densidades = computedPoints
            .map((point) => point.densidad_seca)
            .filter((value): value is number => value != null)
        if (!densidades.length) return null
        return Math.max(...densidades)
    }, [computedPoints])

    const sievePreview = useMemo(() => computeSievePreview(form), [form])

    const progressSummary = useMemo(() => {
        const headerReady = Boolean(
            form.muestra.trim() &&
            form.numero_ot.trim() &&
            form.fecha_ensayo.trim() &&
            form.realizado_por.trim(),
        )

        const descripcionReady = Boolean(
            (form.tipo_muestra || '').trim() &&
            (form.condicion_muestra || '').trim() &&
            form.condicion_muestra !== '-' &&
            (form.tamano_maximo_particula_in || '').trim() &&
            (form.forma_particula || '').trim() &&
            (form.clasificacion_sucs_visual || '').trim(),
        )

        const condicionesReady = Boolean(
            form.metodo_ensayo !== '-' &&
            form.metodo_preparacion !== '-' &&
            form.tipo_apisonador !== '-' &&
            form.excluyo_material_muestra !== '-' &&
            form.contenido_humedad_natural_pct != null,
        )

        const puntosCompletos = computedPoints.filter((point, idx) => {
            const row = form.puntos[idx]
            return Boolean(
                row.numero_capas != null &&
                row.numero_golpes != null &&
                row.masa_suelo_humedo_molde_a != null &&
                row.masa_molde_compactacion_b != null &&
                row.volumen_molde_compactacion_d != null &&
                (row.tara_numero || '').trim() &&
                row.masa_recipiente_suelo_humedo_e != null &&
                row.masa_recipiente_suelo_seco_3_f != null &&
                row.masa_recipiente_g != null &&
                point.contenido_humedad_moldeo_w != null &&
                point.densidad_seca != null
            )
        }).length

        const tamicesReady = sievePreview.mass.slice(0, 4).every((v) => v != null)
        const equiposReady = Boolean(
            [form.tamiz_utilizado_metodo_codigo, form.balanza_1g_codigo, form.balanza_codigo, form.horno_110_codigo, form.molde_codigo, form.pison_codigo]
                .every((v) => (v || '').trim() && v !== '-'),
        )

        const firmasReady = Boolean(
            (form.revisado_por || '-') !== '-' &&
            (form.aprobado_por || '-') !== '-' &&
            (form.revisado_fecha || '').trim() &&
            (form.aprobado_fecha || '').trim(),
        )

        const sections = [
            { label: 'Encabezado', ready: headerReady },
            { label: 'Descripcion', ready: descripcionReady },
            { label: 'Condiciones', ready: condicionesReady },
            { label: 'Puntos completos', ready: puntosCompletos >= 4, detail: `${puntosCompletos}/5` },
            { label: 'Tamices', ready: tamicesReady },
            { label: 'Equipos', ready: equiposReady },
            { label: 'Firmas', ready: firmasReady },
        ]

        const readyCount = sections.filter((item) => item.ready).length
        const completion = Math.round((readyCount / sections.length) * 100)

        return {
            sections,
            completion,
        }
    }, [computedPoints, form, sievePreview])

    const pointTablePreview = useMemo(() => {
        return POINT_COLUMNS.map((label, idx) => ({
            label,
            humedad: computedPoints[idx]?.contenido_humedad_moldeo_w,
            densidad: computedPoints[idx]?.densidad_seca,
        }))
    }, [computedPoints])

    const sieveTablePreview = useMemo(() => {
        return SIEVE_LABELS.map((label, idx) => ({
            label,
            masa: sievePreview.mass[idx],
            pct: sievePreview.pct[idx],
            acc: sievePreview.acc[idx],
        }))
    }, [sievePreview])

    useEffect(() => {
        if (!editingEnsayoId) return

        let cancelled = false
        const loadForEdit = async () => {
            setLoadingEnsayo(true)
            try {
                const detail: ProctorEnsayoDetail = await getProctorEnsayoDetail(editingEnsayoId)
                if (!detail.payload) {
                    toast.error('El ensayo seleccionado no tiene payload guardado para edicion.')
                    return
                }

                if (!cancelled) {
                    const nextState = hydrateProctorFormState(detail.payload)
                    hydratedFromServerRef.current = nextState
                    setForm(nextState)
                }
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Error desconocido'
                toast.error(`No se pudo cargar ensayo para edicion: ${message}`)
            } finally {
                if (!cancelled) {
                    setLoadingEnsayo(false)
                }
            }
        }

        void loadForEdit()
        return () => {
            cancelled = true
        }
    }, [editingEnsayoId])

    useEffect(() => {
        if (typeof window === 'undefined') return
        if (loadingEnsayo) return
        if (restoredDraftKeysRef.current.has(draftStorageKey)) return

        restoredDraftKeysRef.current.add(draftStorageKey)
        const raw = localStorage.getItem(draftStorageKey)
        if (!raw) return

        try {
            const parsed = JSON.parse(raw) as ProctorDraftSnapshot
            if (!parsed || typeof parsed !== 'object' || typeof parsed.form !== 'object') {
                localStorage.removeItem(draftStorageKey)
                return
            }

            const hydratedDraft = hydrateProctorFormState(parsed.form)

            if (editingEnsayoId && hydratedFromServerRef.current && areFormsEquivalent(hydratedDraft, hydratedFromServerRef.current)) {
                localStorage.removeItem(draftStorageKey)
                return
            }

            setForm(hydratedDraft)
            toast.success('Se restauró un borrador local.')
        } catch {
            localStorage.removeItem(draftStorageKey)
        }
    }, [draftStorageKey, editingEnsayoId, loadingEnsayo])

    useEffect(() => {
        if (typeof window === 'undefined') return
        if (loadingEnsayo) return

        const timeoutId = window.setTimeout(() => {
            const sameAsServer = Boolean(
                editingEnsayoId &&
                hydratedFromServerRef.current &&
                areFormsEquivalent(form, hydratedFromServerRef.current)
            )

            if (isFormAtInitialState(form) || sameAsServer) {
                localStorage.removeItem(draftStorageKey)
                return
            }

            const snapshot: ProctorDraftSnapshot = {
                version: 1,
                updatedAt: new Date().toISOString(),
                form,
            }
            localStorage.setItem(draftStorageKey, JSON.stringify(snapshot))
        }, AUTOSAVE_DEBOUNCE_MS)

        return () => window.clearTimeout(timeoutId)
    }, [draftStorageKey, editingEnsayoId, form, loadingEnsayo])

    useEffect(() => {
        if (!isClearDraftModalOpen) return
        const onEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsClearDraftModalOpen(false)
            }
        }
        window.addEventListener('keydown', onEscape)
        return () => window.removeEventListener('keydown', onEscape)
    }, [isClearDraftModalOpen])

    const buildPayload = useCallback((): ProctorPayload => {
        const mergedPoints = form.puntos.map((point, idx) => ({
            ...point,
            prueba_numero: idx + 1,
            numero_capas: FIXED_NUMERO_CAPAS,
            numero_golpes: normalizeNumeroGolpes(point.numero_golpes),
            ...computedPoints[idx],
        }))

        return {
            ...form,
            puntos: mergedPoints,
            tamiz_masa_retenida_g: sievePreview.mass,
            tamiz_porcentaje_retenido: sievePreview.pct,
            tamiz_porcentaje_retenido_acumulado: sievePreview.acc,
        }
    }, [computedPoints, form, sievePreview])

    const downloadBlob = useCallback((blob: Blob, numeroOt: string) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `PROCTOR_${numeroOt}_${new Date().toISOString().slice(0, 10)}.xlsx`
        a.click()
        URL.revokeObjectURL(url)
    }, [])

    const closeParentModalIfEmbedded = useCallback(() => {
        if (window.parent !== window) {
            window.parent.postMessage({ type: 'CLOSE_MODAL' }, '*')
        }
    }, [])

    const clearLocalDraft = useCallback(() => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem(draftStorageKey)
        }

        if (editingEnsayoId && hydratedFromServerRef.current) {
            setForm(hydratedFromServerRef.current)
            toast.success('Cambios locales limpiados. Se restauraron los datos guardados.')
            return
        }

        setForm(buildInitialState())
        toast.success('Datos limpiados.')
    }, [draftStorageKey, editingEnsayoId])

    const handleClearLocalData = useCallback(() => {
        const hasChanges = !isFormAtInitialState(form)
        if (!hasChanges) {
            clearLocalDraft()
            return
        }
        setIsClearDraftModalOpen(true)
    }, [clearLocalDraft, form])

    const confirmClearLocalData = useCallback(() => {
        setIsClearDraftModalOpen(false)
        clearLocalDraft()
    }, [clearLocalDraft])

    const handleSave = useCallback(async (withDownload: boolean) => {
        if (!form.muestra || !form.numero_ot || !form.realizado_por) {
            toast.error('Complete los campos obligatorios: Muestra, N OT y Realizado por')
            return
        }

        setLoading(true)
        try {
            const payload = buildPayload()
            if (withDownload) {
                const { blob } = await saveAndDownloadProctorExcel(payload, editingEnsayoId ?? undefined)
                downloadBlob(blob, payload.numero_ot)
                toast.success(editingEnsayoId ? 'Formato Proctor actualizado y descargado.' : 'Formato Proctor guardado y descargado.')
            } else {
                await saveProctorEnsayo(payload, editingEnsayoId ?? undefined)
                toast.success(editingEnsayoId ? 'Formato Proctor actualizado correctamente.' : 'Formato Proctor guardado correctamente.')
            }

            if (typeof window !== 'undefined') {
                localStorage.removeItem(draftStorageKey)
            }
            hydratedFromServerRef.current = null
            setForm(buildInitialState())
            setEditingEnsayoId(null)
            closeParentModalIfEmbedded()
        } catch (err: unknown) {
            let msg = err instanceof Error ? err.message : 'Error desconocido'
            if (axios.isAxiosError(err)) {
                const detail = err.response?.data?.detail
                if (typeof detail === 'string' && detail.trim()) {
                    msg = detail
                }
            }
            toast.error(`Error guardando formato Proctor: ${msg}`)
        } finally {
            setLoading(false)
        }
    }, [buildPayload, closeParentModalIfEmbedded, downloadBlob, draftStorageKey, editingEnsayoId, form.muestra, form.numero_ot, form.realizado_por])

    return (
        <div className="max-w-[1780px] mx-auto p-4 md:p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                    <Beaker className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-foreground">
                        Proctor Modificado - ASTM D1557-12(2021)
                    </h1>
                    <p className="text-sm text-muted-foreground">Formulario operativo alineado al formato de hoja oficial</p>
                    {editingEnsayoId && (
                        <p className="text-xs text-primary font-medium mt-1">Editando ensayo #{editingEnsayoId}</p>
                    )}
                </div>
            </div>

            <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-5">
                <div>
                    {loadingEnsayo && (
                        <div className="mb-4 h-10 rounded-lg border border-border bg-muted/40 px-3 text-sm text-muted-foreground flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Cargando datos guardados para edicion...
                        </div>
                    )}

                    <div className="space-y-5">
                <Section title="Encabezado" icon={<FlaskConical className="h-4 w-4" />}>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Input label="Muestra *" value={form.muestra} onChange={v => set('muestra', v)} onBlur={() => applyFormattedField('muestra', normalizeMuestraCode)} placeholder="123-SU-26" />
                        <Input label="N OT *" value={form.numero_ot} onChange={v => set('numero_ot', v)} onBlur={() => applyFormattedField('numero_ot', normalizeNumeroOtCode)} placeholder="1234-26" />
                        <Input label="Fecha de ensayo" value={form.fecha_ensayo} onChange={v => set('fecha_ensayo', v)} onBlur={() => applyFormattedField('fecha_ensayo', normalizeFlexibleDate)} placeholder="DD/MM/AA" />
                        <Input label="Realizado por *" value={form.realizado_por} onChange={v => set('realizado_por', v)} placeholder="Iniciales o nombre" />
                    </div>
                </Section>

                <Section title="Densidad humeda (filas 15-22)">
                    <div className="overflow-x-auto rounded-md border border-border">
                        <table className="w-full min-w-[1080px] text-sm">
                            <thead className="bg-muted/40">
                                <tr className="text-xs font-semibold text-muted-foreground">
                                    <th className="w-80 px-3 py-2 border-b border-r border-border text-left">DESCRIPCION</th>
                                    <th className="w-20 px-2 py-2 border-b border-r border-border text-center">UND</th>
                                    {POINT_COLUMNS.map((_, idx) => (
                                        <th key={`densidad-humeda-head-${idx}`} className="w-36 px-2 py-2 border-b border-r border-border text-center last:border-r-0">{idx + 1}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <TableRowStatic label="Prueba N" unit="--" values={POINT_COLUMNS.map((_, idx) => idx + 1)} />
                                <TableRowStatic label="Numero de capas" unit="--" values={POINT_COLUMNS.map(() => FIXED_NUMERO_CAPAS)} />
                                <TableRowSelectNumber label="Numero de golpes" unit="--" values={form.puntos.map(point => point.numero_golpes)} options={GOLPES_OPTIONS} onChange={setPointGolpes} />
                                <TableRowNumber label="Masa de suelo humedo y molde (A)" unit="g" values={form.puntos.map(point => point.masa_suelo_humedo_molde_a)} onChange={(idx, raw) => setPointNumber(idx, 'masa_suelo_humedo_molde_a', raw)} />
                                <TableRowNumber label="Masa del molde compactacion (B)" unit="g" values={form.puntos.map(point => point.masa_molde_compactacion_b)} onChange={(idx, raw) => setPointNumber(idx, 'masa_molde_compactacion_b', raw)} />
                                <TableRowComputed label="Masa suelo compactado (C=A-B)" unit="g" values={computedPoints.map(point => point.masa_suelo_compactado_c)} />
                                <TableRowNumber label="Volumen de molde compactacion (D)" unit="cm3" values={form.puntos.map(point => point.volumen_molde_compactacion_d)} onChange={(idx, raw) => setPointNumber(idx, 'volumen_molde_compactacion_d', raw)} />
                                <TableRowComputed label="Densidad humeda (X=C/D)" unit="g/cm3" values={computedPoints.map(point => point.densidad_humeda_x)} highlight />
                            </tbody>
                        </table>
                    </div>
                </Section>

                <Section title="Contenido humedad - Densidad seca (filas 24-33)">
                    <div className="overflow-x-auto rounded-md border border-border">
                        <table className="w-full min-w-[1080px] text-sm">
                            <thead className="bg-muted/40">
                                <tr className="text-xs font-semibold text-muted-foreground">
                                    <th className="w-80 px-3 py-2 border-b border-r border-border text-left">DESCRIPCION</th>
                                    <th className="w-20 px-2 py-2 border-b border-r border-border text-center">UND</th>
                                    {POINT_COLUMNS.map((label) => (
                                        <th key={label} className="w-36 px-2 py-2 border-b border-r border-border text-center last:border-r-0">{label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <TableRowText label="Tara N" unit="-" values={form.puntos.map(point => point.tara_numero || '')} onChange={(idx, raw) => setPointText(idx, 'tara_numero', raw)} />
                                <TableRowNumber label="Masa recipiente y suelo humedo (E)" unit="g" values={form.puntos.map(point => point.masa_recipiente_suelo_humedo_e)} onChange={(idx, raw) => setPointNumber(idx, 'masa_recipiente_suelo_humedo_e', raw)} />
                                <TableRowNumber label="Masa recipiente y suelo seco 1" unit="g" values={form.puntos.map(point => point.masa_recipiente_suelo_seco_1)} onChange={(idx, raw) => setPointNumber(idx, 'masa_recipiente_suelo_seco_1', raw)} />
                                <TableRowNumber label="Masa recipiente y suelo seco 2" unit="g" values={form.puntos.map(point => point.masa_recipiente_suelo_seco_2)} onChange={(idx, raw) => setPointNumber(idx, 'masa_recipiente_suelo_seco_2', raw)} />
                                <TableRowNumber label="Masa recipiente y suelo seco 3 (F)" unit="g" values={form.puntos.map(point => point.masa_recipiente_suelo_seco_3_f)} onChange={(idx, raw) => setPointNumber(idx, 'masa_recipiente_suelo_seco_3_f', raw)} />
                                <TableRowComputed label="Masa de agua (Y=E-F)" unit="g" values={computedPoints.map(point => point.masa_agua_y)} />
                                <TableRowNumber label="Masa de recipiente (G)" unit="g" values={form.puntos.map(point => point.masa_recipiente_g)} onChange={(idx, raw) => setPointNumber(idx, 'masa_recipiente_g', raw)} />
                                <TableRowComputed label="Masa de suelo seco (Z=F-G)" unit="g" values={computedPoints.map(point => point.masa_suelo_seco_z)} />
                                <TableRowComputed label="Contenido de humedad moldeo (W=Y/Z*100)" unit="%" values={computedPoints.map(point => point.contenido_humedad_moldeo_w)} />
                                <TableRowComputed label="Densidad seca" unit="g/cm3" values={computedPoints.map(point => point.densidad_seca)} highlight />
                            </tbody>
                        </table>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                        Densidad seca maxima estimada: <span className="font-semibold text-foreground">{densidadSecaMaxima != null ? densidadSecaMaxima : '-'}</span>
                    </p>
                </Section>

                <Section title="Descripcion de la muestra y condiciones del ensayo">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <div className="space-y-4">
                            <div className="rounded-md border border-border p-3 space-y-3">
                                <h3 className="text-sm font-semibold text-foreground">Descripcion de la muestra</h3>
                                <Input label="Tipo de muestra" value={form.tipo_muestra || ''} onChange={v => set('tipo_muestra', v)} />
                                <SelectField label="Condicion de la muestra (-, ALTERADO, INTACTA)" value={form.condicion_muestra || '-'} options={CONDICION_MUESTRA_OPTIONS} onChange={v => set('condicion_muestra', v as ProctorPayload['condicion_muestra'])} />
                                <Input label="Tamano maximo de la particula (in)" value={form.tamano_maximo_particula_in || ''} onChange={v => set('tamano_maximo_particula_in', v)} />
                                <Input label="Forma de la particula" value={form.forma_particula || ''} onChange={v => set('forma_particula', v)} />
                                <Input label="Clasificacion SUCS o visual" value={form.clasificacion_sucs_visual || ''} onChange={v => set('clasificacion_sucs_visual', v)} />
                            </div>

                            <div className="rounded-md border border-border p-3 space-y-3">
                                <h3 className="text-sm font-semibold text-foreground">Condiciones del ensayo</h3>
                                <SelectField label="Metodo de ensayo (-, A, B, C)" value={form.metodo_ensayo} options={METODO_ENSAYO_OPTIONS} onChange={v => set('metodo_ensayo', v as ProctorPayload['metodo_ensayo'])} />
                                <SelectField label="Metodo de preparacion (HUMEDO o SECO)" value={form.metodo_preparacion} options={METODO_PREPARACION_OPTIONS} onChange={v => set('metodo_preparacion', v as ProctorPayload['metodo_preparacion'])} />
                                <SelectField label="Tipo de apisonador (MANUAL o MECANICO)" value={form.tipo_apisonador} options={APISONADOR_OPTIONS} onChange={v => set('tipo_apisonador', v as ProctorPayload['tipo_apisonador'])} />
                                <NumberInput label="Contenido de humedad natural (%)" value={form.contenido_humedad_natural_pct} onChange={v => setNum('contenido_humedad_natural_pct', v)} />
                                <SelectField label="Se excluyo algun material de la muestra (SI/NO)" value={form.excluyo_material_muestra} options={SI_NO_OPTIONS} onChange={v => set('excluyo_material_muestra', v as ProctorPayload['excluyo_material_muestra'])} />
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">Observaciones</label>
                                    <textarea
                                        value={form.observaciones || ''}
                                        onChange={e => set('observaciones', e.target.value)}
                                        rows={3}
                                        className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                                        placeholder="Observaciones del ensayo..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="overflow-hidden rounded-md border border-border">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/40 text-xs font-semibold text-muted-foreground">
                                        <tr>
                                            <th className="px-3 py-2 border-b border-r border-border text-left">Designacion de tamices</th>
                                            <th className="px-3 py-2 border-b border-r border-border text-center">Masa retenida (g)</th>
                                            <th className="px-3 py-2 border-b border-r border-border text-center">% retenido</th>
                                            <th className="px-3 py-2 border-b border-border text-center">% retenido acumulado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {SIEVE_LABELS.map((label, idx) => (
                                            <tr key={label}>
                                                <td className="px-3 py-2 border-b border-r border-border">{label}</td>
                                                <td className="px-2 py-2 border-b border-r border-border"><TableNumInput value={form.tamiz_masa_retenida_g[idx]} onChange={raw => setSieveValue('tamiz_masa_retenida_g', idx, raw)} /></td>
                                                <td className="px-2 py-2 border-b border-r border-border"><TableNumInput value={form.tamiz_porcentaje_retenido[idx]} onChange={raw => setSieveValue('tamiz_porcentaje_retenido', idx, raw)} /></td>
                                                <td className="px-2 py-2 border-b border-border"><TableNumInput value={form.tamiz_porcentaje_retenido_acumulado[idx]} onChange={raw => setSieveValue('tamiz_porcentaje_retenido_acumulado', idx, raw)} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">Si deja porcentajes vacios, el sistema los calcula automaticamente a partir de la masa total.</p>
                        </div>
                    </div>
                </Section>

                <Section title="Equipo utilizado y codigos">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        <SelectField
                            label="Tamiz utilizado metodo (-, INS-0050 3/4in, INS-0053 No 4, INS-0052 3/8in)"
                            value={form.tamiz_utilizado_metodo_codigo || '-'}
                            options={TAMIZ_METODO_OPTIONS}
                            onChange={v => set('tamiz_utilizado_metodo_codigo', v)}
                        />
                        <SelectField
                            label="Balanza 1 g (-, EQP-0054)"
                            value={form.balanza_1g_codigo || '-'}
                            options={BALANZA_1G_OPTIONS}
                            onChange={v => set('balanza_1g_codigo', v)}
                        />
                        <SelectField
                            label="Balanza 0,1 g (-, EQP-0046)"
                            value={form.balanza_codigo || '-'}
                            options={BALANZA_01G_OPTIONS}
                            onChange={v => set('balanza_codigo', v)}
                        />
                        <SelectField
                            label="Horno 110 C (-, EQP-0049)"
                            value={form.horno_110_codigo || '-'}
                            options={HORNO_110_OPTIONS}
                            onChange={v => set('horno_110_codigo', v)}
                        />
                        <SelectField
                            label="Molde (-, INS-0195 MOLDE 6in, INS-0114 MOLDE 4in)"
                            value={form.molde_codigo || '-'}
                            options={MOLDE_OPTIONS}
                            onChange={v => set('molde_codigo', v)}
                        />
                        <SelectField
                            label="Pison (-, INS-0196)"
                            value={form.pison_codigo || '-'}
                            options={PISON_OPTIONS}
                            onChange={v => set('pison_codigo', v)}
                        />
                    </div>
                </Section>

                <Section title="Revisado / Aprobado">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <SelectField label="Revisado por" value={form.revisado_por || '-'} options={REVISADO_POR_OPTIONS} onChange={v => set('revisado_por', v)} />
                        <Input label="Fecha revision" value={form.revisado_fecha || ''} onChange={v => set('revisado_fecha', v)} onBlur={() => applyFormattedField('revisado_fecha', normalizeFlexibleDate)} placeholder="DD/MM/AA" />
                        <SelectField label="Aprobado por" value={form.aprobado_por || '-'} options={APROBADO_POR_OPTIONS} onChange={v => set('aprobado_por', v)} />
                        <Input label="Fecha aprobacion" value={form.aprobado_fecha || ''} onChange={v => set('aprobado_fecha', v)} onBlur={() => applyFormattedField('aprobado_fecha', normalizeFlexibleDate)} placeholder="DD/MM/AA" />
                    </div>
                </Section>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                        onClick={handleClearLocalData}
                        disabled={loading}
                        className="h-11 rounded-lg border border-input bg-background text-foreground font-medium hover:bg-muted/60 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <Trash2 className="h-4 w-4" />
                        Limpiar datos
                    </button>
                    <button onClick={() => void handleSave(false)} disabled={loading} className="h-11 rounded-lg bg-secondary text-secondary-foreground font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</> : 'Guardar'}
                    </button>
                    <button onClick={() => void handleSave(true)} disabled={loading} className="h-11 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Procesando...</> : <><Download className="h-4 w-4" /> Guardar y Descargar</>}
                    </button>
                </div>
                    </div>
                </div>
                <SideProgressPanel
                    form={form}
                    progressSummary={progressSummary}
                    pointTablePreview={pointTablePreview}
                    sieveTablePreview={sieveTablePreview}
                    densidadSecaMaxima={densidadSecaMaxima}
                />
            </div>

            <ConfirmActionModal
                isOpen={isClearDraftModalOpen}
                title="Limpiar datos no guardados"
                message="Se limpiarán los datos no guardados. ¿Deseas continuar?"
                confirmText="Sí, limpiar"
                cancelText="Cancelar"
                onConfirm={confirmClearLocalData}
                onCancel={() => setIsClearDraftModalOpen(false)}
            />
        </div>
    )
}

interface ProgressSection {
    label: string
    ready: boolean
    detail?: string
}

interface ProgressSummary {
    completion: number
    sections: ProgressSection[]
}

interface SideProgressPanelProps {
    form: ProctorPayload
    progressSummary: ProgressSummary
    pointTablePreview: Array<{
        label: string
        humedad: number | null | undefined
        densidad: number | null | undefined
    }>
    sieveTablePreview: Array<{
        label: string
        masa: number | null | undefined
        pct: number | null | undefined
        acc: number | null | undefined
    }>
    densidadSecaMaxima: number | null
}

function SideProgressPanel({
    form,
    progressSummary,
    pointTablePreview,
    sieveTablePreview,
    densidadSecaMaxima,
}: SideProgressPanelProps) {
    return (
        <aside className="hidden xl:block">
            <div className="sticky top-4 space-y-4">
                <div className="bg-card border border-border rounded-lg shadow-sm">
                    <div className="px-4 py-3 border-b border-border bg-muted/50 rounded-t-lg">
                        <h3 className="text-sm font-semibold text-foreground">Formulario / Tabla de informacion</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Seguimiento en vivo del ensayo</p>
                    </div>
                    <div className="p-4 space-y-4">
                        <div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                <span>Avance general</span>
                                <span className="font-semibold text-foreground">{progressSummary.completion}%</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all"
                                    style={{ width: `${progressSummary.completion}%` }}
                                />
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-md border border-border">
                            <table className="w-full text-xs">
                                <tbody>
                                    {progressSummary.sections.map((section) => (
                                        <tr key={section.label} className="border-b border-border last:border-b-0">
                                            <td className="px-3 py-2 text-muted-foreground">{section.label}</td>
                                            <td className="px-3 py-2 text-right">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${section.ready ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                                    {section.ready ? 'OK' : 'Pend.'}
                                                </span>
                                                {section.detail ? (
                                                    <span className="ml-2 text-muted-foreground">{section.detail}</span>
                                                ) : null}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="overflow-hidden rounded-md border border-border">
                            <table className="w-full text-xs">
                                <thead className="bg-muted/40 text-muted-foreground">
                                    <tr>
                                        <th className="px-2 py-2 text-left">Punto</th>
                                        <th className="px-2 py-2 text-center">W (%)</th>
                                        <th className="px-2 py-2 text-center">Dens. seca</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pointTablePreview.map((row) => (
                                        <tr key={row.label} className="border-t border-border">
                                            <td className="px-2 py-2">{row.label}</td>
                                            <td className="px-2 py-2 text-center">{row.humedad ?? '-'}</td>
                                            <td className="px-2 py-2 text-center">{row.densidad ?? '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="overflow-hidden rounded-md border border-border">
                            <table className="w-full text-xs">
                                <thead className="bg-muted/40 text-muted-foreground">
                                    <tr>
                                        <th className="px-2 py-2 text-left">Tamiz</th>
                                        <th className="px-2 py-2 text-center">g</th>
                                        <th className="px-2 py-2 text-center">%</th>
                                        <th className="px-2 py-2 text-center">Acum.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sieveTablePreview.map((row) => (
                                        <tr key={row.label} className="border-t border-border">
                                            <td className="px-2 py-2">{row.label}</td>
                                            <td className="px-2 py-2 text-center">{row.masa ?? '-'}</td>
                                            <td className="px-2 py-2 text-center">{row.pct ?? '-'}</td>
                                            <td className="px-2 py-2 text-center">{row.acc ?? '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="text-xs text-muted-foreground border border-border rounded-md p-3 bg-muted/20 space-y-1">
                            <p><span className="font-medium text-foreground">Muestra:</span> {form.muestra || '-'}</p>
                            <p><span className="font-medium text-foreground">N OT:</span> {form.numero_ot || '-'}</p>
                            <p><span className="font-medium text-foreground">Realizado:</span> {form.realizado_por || '-'}</p>
                            <p><span className="font-medium text-foreground">Densidad seca max.:</span> {densidadSecaMaxima ?? '-'}</p>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    )
}

function ConfirmActionModal({
    isOpen,
    title,
    message,
    confirmText,
    cancelText,
    onConfirm,
    onCancel,
}: {
    isOpen: boolean
    title: string
    message: string
    confirmText: string
    cancelText: string
    onConfirm: () => void
    onCancel: () => void
}) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
            <button
                type="button"
                className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm cursor-default"
                onClick={onCancel}
                aria-label="Cerrar modal"
            />
            <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
                <div className="px-6 pt-6 pb-4">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                            <Trash2 className="h-5 w-5" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                            <p className="text-sm leading-relaxed text-muted-foreground">{message}</p>
                        </div>
                    </div>
                </div>
                <div className="px-6 pb-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="h-10 px-4 rounded-lg border border-input bg-background text-foreground text-sm font-medium hover:bg-muted/60 transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    )
}

function Section({ title, icon, children }: {
    title: string
    icon?: React.ReactNode
    children: React.ReactNode
}) {
    return (
        <div className="bg-card border border-border rounded-lg shadow-sm">
            <div className="px-4 py-2.5 border-b border-border bg-muted/50 rounded-t-lg flex items-center gap-2">
                {icon}
                <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            </div>
            <div className="p-4">{children}</div>
        </div>
    )
}

function Input({ label, value, onChange, placeholder, onBlur }: {
    label: string
    value: string
    onChange: (v: string) => void
    placeholder?: string
    onBlur?: () => void
}) {
    return (
        <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                onBlur={onBlur}
                placeholder={placeholder}
                autoComplete="off"
                data-lpignore="true"
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
        </div>
    )
}

function NumberInput({ label, value, onChange }: {
    label: string
    value: number | null | undefined
    onChange: (v: string) => void
}) {
    return (
        <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
            <input
                type="number"
                step="any"
                value={value ?? ''}
                onChange={e => onChange(e.target.value)}
                autoComplete="off"
                data-lpignore="true"
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
        </div>
    )
}

function SelectField({ label, value, options, onChange }: {
    label: string
    value: string
    options: readonly string[]
    onChange: (value: string) => void
}) {
    return (
        <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
            <div className="relative">
                <select
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className="w-full h-9 pl-3 pr-8 rounded-md border border-input bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    {options.map(option => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
        </div>
    )
}

function TableNumInput({ value, onChange }: {
    value: number | null | undefined
    onChange: (raw: string) => void
}) {
    return (
        <input
            type="number"
            step="any"
            value={value ?? ''}
            onChange={e => onChange(e.target.value)}
            autoComplete="off"
            data-lpignore="true"
            className="w-full h-8 px-2 rounded-md border border-input bg-background text-sm text-center focus:outline-none focus:ring-2 focus:ring-ring"
        />
    )
}

function TableTextInput({ value, onChange }: {
    value: string
    onChange: (raw: string) => void
}) {
    return (
        <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            autoComplete="off"
            data-lpignore="true"
            className="w-full h-8 px-2 rounded-md border border-input bg-background text-sm text-center focus:outline-none focus:ring-2 focus:ring-ring"
        />
    )
}

function TableComputedValue({ value, highlight = false }: {
    value: number | null
    highlight?: boolean
}) {
    return (
        <div className={`h-8 px-2 rounded-md border text-sm flex items-center justify-center ${highlight && value != null ? 'border-primary bg-primary/5 text-primary font-semibold' : 'border-input bg-muted/30 text-foreground'}`}>
            {value != null ? value : '-'}
        </div>
    )
}

function TableStaticValue({ value }: {
    value: string | number
}) {
    return (
        <div className="h-8 px-2 rounded-md border border-input bg-muted/30 text-sm text-foreground flex items-center justify-center">
            {value}
        </div>
    )
}

function TableRowNumber({
    label,
    unit,
    values,
    onChange,
}: {
    label: string
    unit: string
    values: Array<number | null | undefined>
    onChange: (index: number, raw: string) => void
}) {
    return (
        <tr>
            <td className="px-3 py-2 border-b border-r border-border">{label}</td>
            <td className="px-2 py-2 border-b border-r border-border text-center">{unit}</td>
            {values.map((value, idx) => (
                <td key={`${label}-${idx}`} className="px-2 py-2 border-b border-r border-border last:border-r-0">
                    <TableNumInput value={value} onChange={raw => onChange(idx, raw)} />
                </td>
            ))}
        </tr>
    )
}

function TableRowStatic({
    label,
    unit,
    values,
}: {
    label: string
    unit: string
    values: Array<string | number>
}) {
    return (
        <tr>
            <td className="px-3 py-2 border-b border-r border-border">{label}</td>
            <td className="px-2 py-2 border-b border-r border-border text-center">{unit}</td>
            {values.map((value, idx) => (
                <td key={`${label}-${idx}`} className="px-2 py-2 border-b border-r border-border last:border-r-0">
                    <TableStaticValue value={value} />
                </td>
            ))}
        </tr>
    )
}

function TableSelectInput({
    value,
    options,
    onChange,
}: {
    value: number | null | undefined
    options: readonly string[]
    onChange: (raw: string) => void
}) {
    const currentValue = value == null ? '-' : String(value)
    return (
        <div className="relative">
            <select
                value={currentValue}
                onChange={e => onChange(e.target.value)}
                className="w-full h-8 pl-2 pr-7 rounded-md border border-input bg-background text-sm text-center appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
            >
                {options.map(option => (
                    <option key={option} value={option}>{option}</option>
                ))}
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        </div>
    )
}

function TableRowSelectNumber({
    label,
    unit,
    values,
    options,
    onChange,
}: {
    label: string
    unit: string
    values: Array<number | null | undefined>
    options: readonly string[]
    onChange: (index: number, raw: string) => void
}) {
    return (
        <tr>
            <td className="px-3 py-2 border-b border-r border-border">{label}</td>
            <td className="px-2 py-2 border-b border-r border-border text-center">{unit}</td>
            {values.map((value, idx) => (
                <td key={`${label}-${idx}`} className="px-2 py-2 border-b border-r border-border last:border-r-0">
                    <TableSelectInput value={value} options={options} onChange={raw => onChange(idx, raw)} />
                </td>
            ))}
        </tr>
    )
}

function TableRowText({
    label,
    unit,
    values,
    onChange,
}: {
    label: string
    unit: string
    values: string[]
    onChange: (index: number, raw: string) => void
}) {
    return (
        <tr>
            <td className="px-3 py-2 border-b border-r border-border">{label}</td>
            <td className="px-2 py-2 border-b border-r border-border text-center">{unit}</td>
            {values.map((value, idx) => (
                <td key={`${label}-${idx}`} className="px-2 py-2 border-b border-r border-border last:border-r-0">
                    <TableTextInput value={value} onChange={raw => onChange(idx, raw)} />
                </td>
            ))}
        </tr>
    )
}

function TableRowComputed({
    label,
    unit,
    values,
    highlight = false,
}: {
    label: string
    unit: string
    values: Array<number | null>
    highlight?: boolean
}) {
    return (
        <tr>
            <td className="px-3 py-2 border-b border-r border-border">{label}</td>
            <td className="px-2 py-2 border-b border-r border-border text-center">{unit}</td>
            {values.map((value, idx) => (
                <td key={`${label}-${idx}`} className="px-2 py-2 border-b border-r border-border last:border-r-0">
                    <TableComputedValue value={value} highlight={highlight} />
                </td>
            ))}
        </tr>
    )
}
