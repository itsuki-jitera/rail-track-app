/**
 * API設定
 * 環境変数からAPIのURLを取得し、デフォルト値を提供
 */

// 環境変数からAPI URLを取得（Viteの環境変数はimport.meta.envから取得）
// プロダクション環境では相対パスを使用（Netlifyのプロキシ経由）
// 開発環境ではローカルAPIサーバーを使用
export const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '' : 'http://localhost:3003');

// API設定オブジェクト
export const apiConfig = {
  baseURL: API_BASE_URL,

  // 各エンドポイントのパスを定義
  endpoints: {
    // アップロード
    upload: `${API_BASE_URL}/api/upload`,

    // キヤデータ関連
    kiya: {
      uploadMTT: `${API_BASE_URL}/api/kiya/upload/mtt`,
      uploadCK: `${API_BASE_URL}/api/kiya/upload/ck`,
      uploadLK: `${API_BASE_URL}/api/kiya/upload/lk`,
      cutSection: `${API_BASE_URL}/api/kiya/cut-section`,
      alignPositions: `${API_BASE_URL}/api/kiya/align-positions`,
      exportData: `${API_BASE_URL}/api/kiya/export`,
    },

    // 作業区間関連
    workSection: {
      set: `${API_BASE_URL}/api/work-section/set`,
      calculateWB: `${API_BASE_URL}/api/work-section/calculate-wb`,
    },

    // 復元波形関連
    restoration: {
      calculate: `${API_BASE_URL}/api/restoration/vb6/calculate`,
      generatePlanLine: `${API_BASE_URL}/api/restoration/generate-plan-line`,
      movement: `${API_BASE_URL}/api/restoration/vb6/movement`,
      autoPlanFromCurves: `${API_BASE_URL}/api/restoration/vb6/auto-plan-from-curves`,
      curveSectionStatistics: `${API_BASE_URL}/api/restoration/vb6/curve-section-statistics`,
      generateCurveReport: `${API_BASE_URL}/api/restoration/vb6/generate-curve-report`,
    },

    // 曲線諸元関連
    curveSpec: {
      import: `${API_BASE_URL}/api/curve-spec/import`,
      list: `${API_BASE_URL}/api/curve-spec/list`,
      save: `${API_BASE_URL}/api/curve-spec/save`,
      update: `${API_BASE_URL}/api/curve-spec/update`,
      delete: `${API_BASE_URL}/api/curve-spec/delete`,
      export: `${API_BASE_URL}/api/curve-spec/export`,
    },

    // 分析関連
    analysis: {
      y1y2: `${API_BASE_URL}/api/analysis/y1y2`,
      spectrum: `${API_BASE_URL}/api/analysis/spectrum`,
      hsjMode: `${API_BASE_URL}/api/analysis/hsj`,
      bs05: `${API_BASE_URL}/api/analysis/bs05`,
      outlier: `${API_BASE_URL}/api/outlier/detect`,
      correction: `${API_BASE_URL}/api/corrections/apply`,
    },

    // キヤデータページ専用
    kiyaData: {
      datasets: `${API_BASE_URL}/api/kiya-data/datasets`,
      dataset: `${API_BASE_URL}/api/kiya-data/dataset`, // POST for create, GET/DELETE with /:id
      statistics: `${API_BASE_URL}/api/kiya-data/statistics`,
      uploadLK: `${API_BASE_URL}/api/kiya-data/upload/lk`,
      uploadCK: `${API_BASE_URL}/api/kiya-data/upload/ck`,
      uploadO010: `${API_BASE_URL}/api/kiya-data/upload/o010`,
      convertLabocs: `${API_BASE_URL}/api/kiya-data/convert/labocs`,
    },
  },
};

// APIが利用可能かチェックする関数
export async function checkAPIConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.ok;
  } catch (error) {
    console.error('API接続エラー:', error);
    return false;
  }
}

// 開発環境かチェック
export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;

// デバッグ用：現在の設定を表示
if (isDevelopment) {
  console.log('API設定:', {
    baseURL: API_BASE_URL,
    isDevelopment,
    isProduction,
  });
}