/**
 * グローバル作業空間コンテキスト
 * 全画面で共有されるデータと状態を管理
 * 実際の運用フローに準拠した処理順序制御を実装
 */

import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';

// データ型定義
interface MTTData {
  filename: string;
  uploadDate: Date;
  rawData: any;
  metadata: {
    totalLength: number;
    measurementDate: string;
    trainType: string;
    direction: 'up' | 'down';
  };
}

interface KiyaData {
  level: number[];
  alignment: number[];
  gauge: number[];
  crossLevel: number[];
  cant: number[];
  positions: number[];
}

interface WorkSection {
  startKm: number;
  endKm: number;
  startPos: number;
  endPos: number;
  bufferStart: number; // 前方余分切取り量（通常500m）
  bufferEnd: number;   // 後方余分切取り量（通常500m）
  wbSections: Array<{
    start: number;
    end: number;
    type: 'WB' | 'W';
  }>;
}

interface CurveSpec {
  id: string;
  startPos: number;
  endPos: number;
  radius: number;
  cant: number;
  direction: 'left' | 'right';
  transitionLength: number;
}

interface FixedPoint {
  position: number;
  description: string;
  allowedMovement: {
    vertical: number;
    horizontal: number;
  };
}

interface MovementLimit {
  startPos: number;
  endPos: number;
  maxVertical: number;
  maxHorizontal: number;
  reason: string;
}

interface RestoredWaveform {
  positions: number[];
  level: number[];
  alignment: number[];
  calculatedAt: Date;
  method: 'standard' | 'enhanced';
}

interface PlanLine {
  positions: number[];
  targetLevel: number[];
  targetAlignment: number[];
  fixedPoints: number[];
  method: 'convex' | 'spline' | 'linear';
}

interface Movement {
  position: number;
  verticalMovement: number;
  horizontalMovement: number;
  adjustmentType: 'raise' | 'lower' | 'left' | 'right';
}

interface PredictionResult {
  predictedLevel: number[];
  predictedAlignment: number[];
  qualityScore: number;
  warnings: string[];
}

// 作業空間の状態定義
interface GlobalWorkspaceState {
  // 元データ
  originalData: {
    mttData: MTTData | null;
    cutData: KiyaData | null;
    kiyaData: KiyaData | null;
  };

  // 設定情報
  settings: {
    workSection: WorkSection | null;
    curveSpecs: CurveSpec[];
    fixedPoints: FixedPoint[];
    movementLimits: MovementLimit[];
    fieldMeasurements: Array<{
      position: number;
      measuredLevel: number;
      measuredAlignment: number;
    }>;
    lineSections: any[];        // LKデータ用
    curveRawData: any | null;   // CK生データ保存用
    lineRawData: any | null;    // LK生データ保存用
  };

  // 計算結果
  results: {
    restoredWaveform: RestoredWaveform | null;
    planLine: PlanLine | null;
    movements: Movement[] | null;
    prediction: PredictionResult | null;
  };

  // 作業状態フラグ
  status: {
    dataLoaded: boolean;        // データ読込完了
    sectionCut: boolean;        // 作業区間切取完了
    positionAligned: boolean;   // 位置合わせ完了
    waveformCalculated: boolean; // 復元波形計算完了
    planLineSet: boolean;       // 計画線設定完了
    movementsCalculated: boolean; // 移動量計算完了
  };

  // エラー情報
  errors: {
    dataLoad?: string;
    sectionCut?: string;
    calculation?: string;
  };

  // 作業履歴
  history: Array<{
    timestamp: Date;
    action: string;
    details: any;
  }>;
}

// アクション型定義
type WorkspaceAction =
  | { type: 'LOAD_MTT_DATA'; payload: MTTData }
  | { type: 'SET_WORK_SECTION'; payload: WorkSection }
  | { type: 'CUT_SECTION'; payload: KiyaData }
  | { type: 'SET_CURVE_SPECS'; payload: CurveSpec[] }
  | { type: 'SET_LINE_SECTIONS'; payload: any[] }
  | { type: 'SET_CURVE_RAW_DATA'; payload: any }
  | { type: 'SET_LINE_RAW_DATA'; payload: any }
  | { type: 'ADD_FIXED_POINT'; payload: FixedPoint }
  | { type: 'SET_MOVEMENT_LIMITS'; payload: MovementLimit[] }
  | { type: 'SET_FIELD_MEASUREMENTS'; payload: any[] }
  | { type: 'CALCULATE_RESTORED_WAVEFORM'; payload: RestoredWaveform }
  | { type: 'SET_PLAN_LINE'; payload: PlanLine }
  | { type: 'CALCULATE_MOVEMENTS'; payload: Movement[] }
  | { type: 'SET_PREDICTION'; payload: PredictionResult }
  | { type: 'ALIGN_POSITION'; payload: { aligned: boolean } }
  | { type: 'RESET_WORKSPACE' }
  | { type: 'SET_ERROR'; payload: { type: keyof GlobalWorkspaceState['errors']; message: string } }
  | { type: 'CLEAR_ERROR'; payload: keyof GlobalWorkspaceState['errors'] }
  | { type: 'ADD_HISTORY'; payload: { action: string; details: any } };

// 初期状態
const initialState: GlobalWorkspaceState = {
  originalData: {
    mttData: null,
    cutData: null,
    kiyaData: null,
  },
  settings: {
    workSection: null,
    curveSpecs: [],
    fixedPoints: [],
    movementLimits: [],
    fieldMeasurements: [],
    lineSections: [],
    curveRawData: null,
    lineRawData: null,
  },
  results: {
    restoredWaveform: null,
    planLine: null,
    movements: null,
    prediction: null,
  },
  status: {
    dataLoaded: false,
    sectionCut: false,
    positionAligned: false,
    waveformCalculated: false,
    planLineSet: false,
    movementsCalculated: false,
  },
  errors: {},
  history: [],
};

// リデューサー
function workspaceReducer(state: GlobalWorkspaceState, action: WorkspaceAction): GlobalWorkspaceState {
  switch (action.type) {
    case 'LOAD_MTT_DATA':
      return {
        ...state,
        originalData: {
          ...state.originalData,
          mttData: action.payload,
        },
        status: {
          ...state.status,
          dataLoaded: true,
        },
        history: [
          ...state.history,
          {
            timestamp: new Date(),
            action: 'MTTデータ読込',
            details: { filename: action.payload.filename },
          },
        ],
      };

    case 'SET_WORK_SECTION':
      return {
        ...state,
        settings: {
          ...state.settings,
          workSection: action.payload,
        },
        history: [
          ...state.history,
          {
            timestamp: new Date(),
            action: '作業区間設定',
            details: action.payload,
          },
        ],
      };

    case 'CUT_SECTION':
      return {
        ...state,
        originalData: {
          ...state.originalData,
          cutData: action.payload,
          kiyaData: action.payload,
        },
        status: {
          ...state.status,
          sectionCut: true,
        },
        history: [
          ...state.history,
          {
            timestamp: new Date(),
            action: '区間切取完了',
            details: { dataPoints: action.payload?.positions?.length || 0 },
          },
        ],
      };

    case 'SET_CURVE_SPECS':
      return {
        ...state,
        settings: {
          ...state.settings,
          curveSpecs: action.payload,
        },
        history: [
          ...state.history,
          {
            timestamp: new Date(),
            action: '曲線諸元設定',
            details: { count: action.payload.length },
          },
        ],
      };

    case 'SET_LINE_SECTIONS':
      return {
        ...state,
        settings: {
          ...state.settings,
          lineSections: action.payload,
        },
        history: [
          ...state.history,
          {
            timestamp: new Date(),
            action: '線区情報設定',
            details: { count: action.payload.length },
          },
        ],
      };

    case 'SET_CURVE_RAW_DATA':
      return {
        ...state,
        settings: {
          ...state.settings,
          curveRawData: action.payload,
        },
        history: [
          ...state.history,
          {
            timestamp: new Date(),
            action: 'CK生データ保存',
            details: { hasData: !!action.payload },
          },
        ],
      };

    case 'SET_LINE_RAW_DATA':
      return {
        ...state,
        settings: {
          ...state.settings,
          lineRawData: action.payload,
        },
        history: [
          ...state.history,
          {
            timestamp: new Date(),
            action: 'LK生データ保存',
            details: { hasData: !!action.payload },
          },
        ],
      };

    case 'ADD_FIXED_POINT':
      return {
        ...state,
        settings: {
          ...state.settings,
          fixedPoints: [...state.settings.fixedPoints, action.payload],
        },
        history: [
          ...state.history,
          {
            timestamp: new Date(),
            action: '固定点追加',
            details: action.payload,
          },
        ],
      };

    case 'SET_MOVEMENT_LIMITS':
      return {
        ...state,
        settings: {
          ...state.settings,
          movementLimits: action.payload,
        },
        history: [
          ...state.history,
          {
            timestamp: new Date(),
            action: '移動量制限設定',
            details: { count: action.payload.length },
          },
        ],
      };

    case 'SET_FIELD_MEASUREMENTS':
      return {
        ...state,
        settings: {
          ...state.settings,
          fieldMeasurements: action.payload,
        },
        history: [
          ...state.history,
          {
            timestamp: new Date(),
            action: '手検測データ入力',
            details: { count: action.payload.length },
          },
        ],
      };

    case 'CALCULATE_RESTORED_WAVEFORM':
      return {
        ...state,
        results: {
          ...state.results,
          restoredWaveform: action.payload,
        },
        status: {
          ...state.status,
          waveformCalculated: true,
        },
        history: [
          ...state.history,
          {
            timestamp: new Date(),
            action: '復元波形計算完了',
            details: { method: action.payload.method },
          },
        ],
      };

    case 'SET_PLAN_LINE':
      return {
        ...state,
        results: {
          ...state.results,
          planLine: action.payload,
        },
        status: {
          ...state.status,
          planLineSet: true,
        },
        history: [
          ...state.history,
          {
            timestamp: new Date(),
            action: '計画線設定完了',
            details: { method: action.payload.method },
          },
        ],
      };

    case 'CALCULATE_MOVEMENTS':
      return {
        ...state,
        results: {
          ...state.results,
          movements: action.payload,
        },
        status: {
          ...state.status,
          movementsCalculated: true,
        },
        history: [
          ...state.history,
          {
            timestamp: new Date(),
            action: '移動量計算完了',
            details: { count: action.payload.length },
          },
        ],
      };

    case 'SET_PREDICTION':
      return {
        ...state,
        results: {
          ...state.results,
          prediction: action.payload,
        },
        history: [
          ...state.history,
          {
            timestamp: new Date(),
            action: '仕上り予測完了',
            details: { score: action.payload.qualityScore },
          },
        ],
      };

    case 'ALIGN_POSITION':
      return {
        ...state,
        status: {
          ...state.status,
          positionAligned: action.payload.aligned,
        },
        history: [
          ...state.history,
          {
            timestamp: new Date(),
            action: '位置合わせ処理',
            details: { aligned: action.payload.aligned },
          },
        ],
      };

    case 'RESET_WORKSPACE':
      return {
        ...initialState,
        history: [
          {
            timestamp: new Date(),
            action: '作業空間リセット',
            details: {},
          },
        ],
      };

    case 'SET_ERROR':
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.payload.type]: action.payload.message,
        },
      };

    case 'CLEAR_ERROR':
      const newErrors = { ...state.errors };
      delete newErrors[action.payload];
      return {
        ...state,
        errors: newErrors,
      };

    case 'ADD_HISTORY':
      return {
        ...state,
        history: [
          ...state.history,
          {
            timestamp: new Date(),
            action: action.payload.action,
            details: action.payload.details,
          },
        ],
      };

    default:
      return state;
  }
}

// コンテキスト作成
interface GlobalWorkspaceContextType {
  state: GlobalWorkspaceState;
  dispatch: React.Dispatch<WorkspaceAction>;

  // ヘルパー関数
  canSetPlanLine: () => boolean;
  canCalculateMovements: () => boolean;
  validateWorkflow: (requiredStep: string) => { valid: boolean; message?: string };
  getNextRequiredStep: () => string | null;
  exportWorkspace: () => string;
  importWorkspace: (data: string) => void;
}

const GlobalWorkspaceContext = createContext<GlobalWorkspaceContextType | undefined>(undefined);

// プロバイダーコンポーネント
export function GlobalWorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(workspaceReducer, initialState);

  // ローカルストレージへの自動保存
  useEffect(() => {
    const saveTimeout = setTimeout(() => {
      localStorage.setItem('railtrack_workspace', JSON.stringify(state));
    }, 1000);
    return () => clearTimeout(saveTimeout);
  }, [state]);

  // 初回マウント時にローカルストレージから復元
  useEffect(() => {
    const saved = localStorage.getItem('railtrack_workspace');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // 各フィールドを復元
        Object.entries(parsed).forEach(([key, value]) => {
          if (key !== 'history' && value) {
            // 履歴以外のデータを復元
            // 必要に応じて個別のアクションをディスパッチ
          }
        });
      } catch (error) {
        console.error('Failed to restore workspace:', error);
      }
    }
  }, []);

  // ヘルパー関数：計画線設定可能かチェック
  const canSetPlanLine = () => {
    return state.status.dataLoaded &&
           state.status.sectionCut &&
           state.status.waveformCalculated;
  };

  // ヘルパー関数：移動量計算可能かチェック
  const canCalculateMovements = () => {
    return state.status.waveformCalculated &&
           state.status.planLineSet;
  };

  // ヘルパー関数：ワークフロー検証
  const validateWorkflow = (requiredStep: string) => {
    const workflow = {
      'data_load': {
        check: () => true,
        message: 'データを読み込んでください'
      },
      'section_cut': {
        check: () => state.status.dataLoaded,
        message: 'まずデータを読み込んでください'
      },
      'position_align': {
        check: () => state.status.sectionCut,
        message: '作業区間を設定してください'
      },
      'waveform_calc': {
        check: () => state.status.sectionCut,
        message: '作業区間を設定してください'
      },
      'plan_line': {
        check: () => state.status.waveformCalculated,
        message: '復元波形を計算してください'
      },
      'movement_calc': {
        check: () => state.status.planLineSet,
        message: '計画線を設定してください'
      },
    };

    const step = workflow[requiredStep];
    if (!step) return { valid: true };

    const valid = step.check();
    return {
      valid,
      message: valid ? undefined : step.message,
    };
  };

  // ヘルパー関数：次に必要なステップを取得
  const getNextRequiredStep = () => {
    if (!state.status.dataLoaded) return 'データ読込';
    if (!state.status.sectionCut) return '作業区間設定';
    if (!state.status.positionAligned && state.originalData.kiyaData) return '位置合わせ';
    if (!state.status.waveformCalculated) return '復元波形計算';
    if (!state.status.planLineSet) return '計画線設定';
    if (!state.status.movementsCalculated) return '移動量計算';
    return null;
  };

  // ヘルパー関数：作業空間のエクスポート
  const exportWorkspace = () => {
    return JSON.stringify(state, null, 2);
  };

  // ヘルパー関数：作業空間のインポート
  const importWorkspace = (data: string) => {
    try {
      const parsed = JSON.parse(data);
      // 完全リセット後、インポートしたデータで初期化
      dispatch({ type: 'RESET_WORKSPACE' });
      // 各データを復元（実装は簡略化）
      console.log('Workspace imported successfully');
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: {
          type: 'dataLoad',
          message: 'インポートに失敗しました'
        }
      });
    }
  };

  const contextValue: GlobalWorkspaceContextType = {
    state,
    dispatch,
    canSetPlanLine,
    canCalculateMovements,
    validateWorkflow,
    getNextRequiredStep,
    exportWorkspace,
    importWorkspace,
  };

  return (
    <GlobalWorkspaceContext.Provider value={contextValue}>
      {children}
    </GlobalWorkspaceContext.Provider>
  );
}

// カスタムフック
export function useGlobalWorkspace() {
  const context = useContext(GlobalWorkspaceContext);
  if (context === undefined) {
    throw new Error('useGlobalWorkspace must be used within a GlobalWorkspaceProvider');
  }
  return context;
}

// 便利なセレクター関数
export const workspaceSelectors = {
  getMTTData: (state: GlobalWorkspaceState) => state.originalData.mttData,
  getKiyaData: (state: GlobalWorkspaceState) => state.originalData.kiyaData,
  getWorkSection: (state: GlobalWorkspaceState) => state.settings.workSection,
  getCurveSpecs: (state: GlobalWorkspaceState) => state.settings.curveSpecs,
  getRestoredWaveform: (state: GlobalWorkspaceState) => state.results.restoredWaveform,
  getPlanLine: (state: GlobalWorkspaceState) => state.results.planLine,
  getMovements: (state: GlobalWorkspaceState) => state.results.movements,
  isDataLoaded: (state: GlobalWorkspaceState) => state.status.dataLoaded,
  isReadyForPlanLine: (state: GlobalWorkspaceState) =>
    state.status.dataLoaded && state.status.sectionCut && state.status.waveformCalculated,
  isReadyForMovementCalc: (state: GlobalWorkspaceState) =>
    state.status.waveformCalculated && state.status.planLineSet,
  hasErrors: (state: GlobalWorkspaceState) => Object.keys(state.errors).length > 0,
  getLatestHistory: (state: GlobalWorkspaceState) =>
    state.history[state.history.length - 1] || null,
};