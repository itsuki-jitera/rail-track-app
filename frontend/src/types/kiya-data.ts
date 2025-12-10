/**
 * キヤデータ型定義
 * 軌道検測車による測定データの型定義
 */

// 曲線情報
export interface Curve {
  id: string
  start: number          // 開始キロ程 (km)
  end: number            // 終了キロ程 (km)
  radius: number         // 曲線半径 (m)
  cant: number           // カント値 (mm)
  slack?: number         // スラック値 (mm)
  direction: 'left' | 'right'  // 曲線方向
}

// 構造物情報
export interface Structure {
  id: string
  type: 'tunnel' | 'bridge' | 'station' | 'point'
  start: number          // 開始キロ程 (km)
  end?: number           // 終了キロ程 (km) - トンネル・橋梁の場合
  name?: string          // 名称 - 駅・ポイントの場合
}

// 管理値
export interface ManagementValue {
  marker: string         // マーカー (L01, L02, etc.)
  startKm: number        // 開始キロ程
  endKm: number          // 終了キロ程
  lineCode: string       // 線別コード
  routeCode: string      // 路線コード
  construction: string   // 施工区分
  type: string           // 種別

  // 管理値（mm）
  standard10m?: number      // 10m標準
  straightness10m?: number  // 10m通り
  gauge?: number            // 軌間正
  elevation?: number        // 高低
  levelPlus?: number        // 水準+
  levelMinus?: number       // 水準-
  trackUpDown?: number      // 軌道上下
  trackLeftRight?: number   // 軌道左右

  // 曲線部管理値
  curveStandard?: number    // O区間標準
  curveIrregularity?: number // O区間狂正
  curveSharpness?: number    // O区間急曲
}

// キヤデータメタ情報
export interface KiyaMetadata {
  route: string          // 路線名
  section: string        // 区間名
  date: Date             // 測定日
  startKm: number        // 開始キロ程
  endKm: number          // 終了キロ程
  direction?: 'up' | 'down'  // 上り・下り
  measuredBy?: string    // 測定車両
}

// キヤデータ全体
export interface KiyaData {
  metadata: KiyaMetadata
  curves: Curve[]
  structures: Structure[]
  managementValues: ManagementValue[]
}

// CKファイルパース結果
export interface CKParseResult {
  curves: Curve[]
  structures: Structure[]
  stations: { km: number; name?: string }[]
  metadata?: {
    createdDate?: string
    courseName?: string
  }
}

// LKファイルパース結果
export interface LKParseResult {
  sections: {
    marker: string
    routeName: string
    sectionName: string
  }[]
  managementValues: ManagementValue[]
  managementSections: {
    marker: string
    startKm: number
    endKm: number
    lineCode: string
    routeCode: string
  }[]
}

// マーカー種別
export type MarkerType =
  | 'DD'  // Distance Data
  | 'BP'  // Begin Point
  | 'EP'  // End Point
  | 'BR'  // Begin Radius
  | 'ER'  // End Radius
  | 'BC'  // Begin Curve
  | 'EC'  // End Curve
  | 'BT'  // Begin Tunnel
  | 'ET'  // End Tunnel
  | 'BB'  // Begin Bridge
  | 'EB'  // End Bridge
  | 'SN'  // Station Number
  | 'CK'  // Check Point
  | 'FK'  // Flag Point
  | 'BK'  // Block Point

// マーカー情報
export interface Marker {
  type: MarkerType
  position: number       // キロ程
  radius?: number        // 半径 (BC/ECの場合)
  cant?: number          // カント (BC/ECの場合)
  name?: string          // 名称 (SN等の場合)
  data?: Record<string, any>  // その他のデータ
}
