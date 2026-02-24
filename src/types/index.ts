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

export interface LLPPuntoRow {
    recipiente_numero?: string | null
    numero_golpes?: number | null
    masa_recipiente_suelo_humedo?: number | null
    masa_recipiente_suelo_seco?: number | null
    masa_recipiente_suelo_seco_1?: number | null
    masa_recipiente?: number | null
}

export interface LLPPayload {
    muestra: string
    numero_ot: string
    fecha_ensayo: string
    realizado_por: string

    metodo_ensayo_limite_liquido: "-" | "MULTIPUNTO" | "UNIPUNTO"
    herramienta_ranurado_limite_liquido: "-" | "METAL" | "PLASTICO"
    dispositivo_limite_liquido: "-" | "MANUAL" | "MECANICO"
    metodo_laminacion_limite_plastico: "-" | "MANUAL" | "DISPOSITIVO DE LAMINACION"
    contenido_humedad_muestra_inicial_pct?: number | null
    proceso_seleccion_muestra?: string | null
    metodo_preparacion_muestra: "-" | "HUMEDO" | "SECADO AL AIRE" | "SECADO AL HORNO"

    tipo_muestra?: string | null
    condicion_muestra: "-" | "ALTERADO" | "INTACTO"
    tamano_maximo_visual_in?: string | null
    porcentaje_retenido_tamiz_40_pct?: number | null
    forma_particula?: string | null

    puntos: LLPPuntoRow[]

    balanza_001g_codigo?: string | null
    horno_110_codigo?: string | null
    copa_casagrande_codigo?: string | null
    ranurador_codigo?: string | null

    observaciones?: string | null
    revisado_por?: string | null
    revisado_fecha?: string | null
    aprobado_por?: string | null
    aprobado_fecha?: string | null
}

export interface LLPEnsayoSummary {
    id: number
    numero_ensayo: string
    numero_ot: string
    cliente?: string | null
    muestra?: string | null
    fecha_documento?: string | null
    estado: string
    limite_liquido_promedio?: number | null
    limite_plastico_promedio?: number | null
    indice_plasticidad?: number | null
    bucket?: string | null
    object_key?: string | null
    fecha_creacion?: string | null
    fecha_actualizacion?: string | null
}

export interface LLPEnsayoDetail extends LLPEnsayoSummary {
    payload?: LLPPayload | null
}

export interface LLPSaveResponse {
    id: number
    numero_ensayo: string
    numero_ot: string
    estado: string
    limite_liquido_promedio?: number | null
    limite_plastico_promedio?: number | null
    indice_plasticidad?: number | null
    bucket?: string | null
    object_key?: string | null
    fecha_creacion?: string | null
    fecha_actualizacion?: string | null
}
