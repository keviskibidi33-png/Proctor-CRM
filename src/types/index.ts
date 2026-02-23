export interface ProctorPunto {
    prueba_numero?: number | null
    numero_capas?: number | null
    numero_golpes?: number | null

    masa_suelo_humedo_molde_a?: number | null
    masa_molde_compactacion_b?: number | null
    masa_suelo_compactado_c?: number | null
    volumen_molde_compactacion_d?: number | null
    densidad_humeda_x?: number | null

    tara_numero?: string | null
    masa_recipiente_suelo_humedo_e?: number | null
    masa_recipiente_suelo_seco_1?: number | null
    masa_recipiente_suelo_seco_2?: number | null
    masa_recipiente_suelo_seco_3_f?: number | null
    masa_agua_y?: number | null
    masa_recipiente_g?: number | null
    masa_suelo_seco_z?: number | null
    contenido_humedad_moldeo_w?: number | null
    densidad_seca?: number | null
}

export interface ProctorPayload {
    muestra: string
    numero_ot: string
    fecha_ensayo: string
    realizado_por: string

    puntos: ProctorPunto[]

    tipo_muestra?: string | null
    condicion_muestra?: "-" | "ALTERADO" | "INTACTA" | null
    tamano_maximo_particula_in?: string | null
    forma_particula?: string | null
    clasificacion_sucs_visual?: string | null

    metodo_ensayo: "-" | "A" | "B" | "C"
    metodo_preparacion: "-" | "HUMEDO" | "SECO"
    tipo_apisonador: "-" | "MANUAL" | "MECANICO"
    contenido_humedad_natural_pct?: number | null
    excluyo_material_muestra: "-" | "SI" | "NO"

    tamiz_masa_retenida_g: Array<number | null>
    tamiz_porcentaje_retenido: Array<number | null>
    tamiz_porcentaje_retenido_acumulado: Array<number | null>

    tamiz_utilizado_metodo_codigo?: string | null
    balanza_1g_codigo?: string | null
    balanza_codigo?: string | null
    horno_110_codigo?: string | null
    molde_codigo?: string | null
    pison_codigo?: string | null

    observaciones?: string | null

    revisado_por?: string | null
    revisado_fecha?: string | null
    aprobado_por?: string | null
    aprobado_fecha?: string | null
}

export interface ProctorEnsayoSummary {
    id: number
    numero_ensayo: string
    numero_ot: string
    cliente?: string | null
    muestra?: string | null
    fecha_documento?: string | null
    estado: string
    densidad_seca_maxima?: number | null
    bucket?: string | null
    object_key?: string | null
    fecha_creacion?: string | null
    fecha_actualizacion?: string | null
}

export interface ProctorEnsayoDetail extends ProctorEnsayoSummary {
    payload?: ProctorPayload | null
}

export interface ProctorSaveResponse {
    id: number
    numero_ensayo: string
    numero_ot: string
    estado: string
    densidad_seca_maxima?: number | null
    bucket?: string | null
    object_key?: string | null
    fecha_creacion?: string | null
    fecha_actualizacion?: string | null
}
