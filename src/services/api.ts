import axios from 'axios'
import type {
    LLPPayload,
    LLPSaveResponse,
    LLPEnsayoDetail,
    LLPEnsayoSummary,
    ProctorPayload,
    ProctorSaveResponse,
    ProctorEnsayoDetail,
    ProctorEnsayoSummary,
} from '@/types'

const API_URL = import.meta.env.VITE_API_URL || 'https://api.geofal.com.pe'

const api = axios.create({
    baseURL: API_URL,
})

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            window.dispatchEvent(new CustomEvent('session-expired'))
        }
        return Promise.reject(error)
    },
)

export async function saveProctorEnsayo(
    payload: ProctorPayload,
    ensayoId?: number,
): Promise<ProctorSaveResponse> {
    const { data } = await api.post<ProctorSaveResponse>('/api/proctor/excel', payload, {
        params: {
            download: false,
            ensayo_id: ensayoId,
        },
    })
    return data
}

export async function saveAndDownloadProctorExcel(
    payload: ProctorPayload,
    ensayoId?: number,
): Promise<{ blob: Blob; ensayoId?: number }> {
    const response = await api.post('/api/proctor/excel', payload, {
        params: {
            download: true,
            ensayo_id: ensayoId,
        },
        responseType: 'blob',
    })

    const proctorIdHeader = response.headers['x-proctor-id']
    const parsedId = Number(proctorIdHeader)
    return {
        blob: response.data,
        ensayoId: Number.isFinite(parsedId) ? parsedId : undefined,
    }
}

export async function listProctorEnsayos(limit = 100): Promise<ProctorEnsayoSummary[]> {
    const { data } = await api.get<ProctorEnsayoSummary[]>('/api/proctor/', {
        params: { limit },
    })
    return data
}

export async function getProctorEnsayoDetail(ensayoId: number): Promise<ProctorEnsayoDetail> {
    const { data } = await api.get<ProctorEnsayoDetail>(`/api/proctor/${ensayoId}`)
    return data
}

export async function saveLLPEnsayo(
    payload: LLPPayload,
    ensayoId?: number,
): Promise<LLPSaveResponse> {
    const { data } = await api.post<LLPSaveResponse>('/api/llp/excel', payload, {
        params: {
            download: false,
            ensayo_id: ensayoId,
        },
    })
    return data
}

export async function saveAndDownloadLLPExcel(
    payload: LLPPayload,
    ensayoId?: number,
): Promise<{ blob: Blob; ensayoId?: number }> {
    const response = await api.post('/api/llp/excel', payload, {
        params: {
            download: true,
            ensayo_id: ensayoId,
        },
        responseType: 'blob',
    })

    const llpIdHeader = response.headers['x-llp-id']
    const parsedId = Number(llpIdHeader)
    return {
        blob: response.data,
        ensayoId: Number.isFinite(parsedId) ? parsedId : undefined,
    }
}

export async function listLLPEnsayos(limit = 100): Promise<LLPEnsayoSummary[]> {
    const { data } = await api.get<LLPEnsayoSummary[]>('/api/llp/', {
        params: { limit },
    })
    return data
}

export async function getLLPEnsayoDetail(ensayoId: number): Promise<LLPEnsayoDetail> {
    const { data } = await api.get<LLPEnsayoDetail>(`/api/llp/${ensayoId}`)
    return data
}

export default api
