/**
 * キヤデータ管理用Zustandストア
 */
import { create } from 'zustand'
import type { KiyaData, Curve, Structure } from '../types/kiya-data'

interface KiyaState {
  // データ
  kiyaData: KiyaData | null
  curves: Curve[]
  structures: Structure[]

  // UI状態
  isLoading: boolean
  error: string | null
  selectedCurveId: string | null
  selectedStructureId: string | null

  // アクション
  setKiyaData: (data: KiyaData) => void
  clearKiyaData: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  selectCurve: (curveId: string | null) => void
  selectStructure: (structureId: string | null) => void

  // ファイルアップロード
  uploadCKFile: (file: File) => Promise<void>
  uploadLKFile: (file: File) => Promise<void>
  uploadKiyaFile: (file: File) => Promise<void>
}

const API_BASE_URL = 'http://localhost:3003/api'

export const useKiyaStore = create<KiyaState>((set, get) => ({
  // 初期状態
  kiyaData: null,
  curves: [],
  structures: [],
  isLoading: false,
  error: null,
  selectedCurveId: null,
  selectedStructureId: null,

  // データセット
  setKiyaData: (data: KiyaData) => {
    set({
      kiyaData: data,
      curves: data.curves || [],
      structures: data.structures || [],
      error: null
    })
  },

  // データクリア
  clearKiyaData: () => {
    set({
      kiyaData: null,
      curves: [],
      structures: [],
      selectedCurveId: null,
      selectedStructureId: null,
      error: null
    })
  },

  // ローディング状態
  setLoading: (loading: boolean) => {
    set({ isLoading: loading })
  },

  // エラー状態
  setError: (error: string | null) => {
    set({ error, isLoading: false })
  },

  // 曲線選択
  selectCurve: (curveId: string | null) => {
    set({ selectedCurveId: curveId })
  },

  // 構造物選択
  selectStructure: (structureId: string | null) => {
    set({ selectedStructureId: structureId })
  },

  // CKファイルアップロード
  uploadCKFile: async (file: File) => {
    set({ isLoading: true, error: null })

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${API_BASE_URL}/parse-ck`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to parse CK file')
      }

      // KiyaData形式に変換
      const kiyaData: KiyaData = {
        metadata: {
          route: result.metadata?.sectionMarker || 'Unknown',
          section: '',
          date: new Date(),
          startKm: result.curves[0]?.start || 0,
          endKm: result.curves[result.curves.length - 1]?.end || 0
        },
        curves: result.curves || [],
        structures: result.structures || [],
        managementValues: []
      }

      get().setKiyaData(kiyaData)
      set({ isLoading: false })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      set({ error: errorMessage, isLoading: false })
      throw error
    }
  },

  // LKファイルアップロード
  uploadLKFile: async (file: File) => {
    set({ isLoading: true, error: null })

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${API_BASE_URL}/parse-lk`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to parse LK file')
      }

      // KiyaData形式に変換
      const kiyaData: KiyaData = {
        metadata: {
          route: result.sections[0]?.routeName || 'Unknown',
          section: result.sections[0]?.sectionName || '',
          date: new Date(),
          startKm: result.managementValues[0]?.startKm || 0,
          endKm: result.managementValues[result.managementValues.length - 1]?.endKm || 0
        },
        curves: [],
        structures: [],
        managementValues: result.managementValues || []
      }

      get().setKiyaData(kiyaData)
      set({ isLoading: false })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      set({ error: errorMessage, isLoading: false })
      throw error
    }
  },

  // キヤファイル自動判定アップロード
  uploadKiyaFile: async (file: File) => {
    set({ isLoading: true, error: null })

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${API_BASE_URL}/upload-kiya`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to parse Kiya file')
      }

      // ファイルタイプに応じてデータを構築
      let kiyaData: KiyaData

      if (result.fileType === 'CK') {
        kiyaData = {
          metadata: {
            route: result.data.metadata?.sectionMarker || 'Unknown',
            section: '',
            date: new Date(),
            startKm: result.data.curves[0]?.start || 0,
            endKm: result.data.curves[result.data.curves.length - 1]?.end || 0
          },
          curves: result.data.curves || [],
          structures: result.data.structures || [],
          managementValues: []
        }
      } else if (result.fileType === 'LK') {
        kiyaData = {
          metadata: {
            route: result.data.sections[0]?.routeName || 'Unknown',
            section: result.data.sections[0]?.sectionName || '',
            date: new Date(),
            startKm: result.data.managementValues[0]?.startKm || 0,
            endKm: result.data.managementValues[result.data.managementValues.length - 1]?.endKm || 0
          },
          curves: [],
          structures: [],
          managementValues: result.data.managementValues || []
        }
      } else {
        throw new Error(`Unknown file type: ${result.fileType}`)
      }

      get().setKiyaData(kiyaData)
      set({ isLoading: false })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      set({ error: errorMessage, isLoading: false })
      throw error
    }
  }
}))
