/**
 * Netlify Function - APIプロキシ
 *
 * このファイルは一時的な解決策として、フロントエンドからのAPIリクエストに対して
 * エラーメッセージを返します。
 *
 * 本番環境では、以下のいずれかの方法を推奨します：
 * 1. バックエンドAPIを外部サービスにデプロイする（Railway、Render、Heroku等）
 * 2. Netlify FunctionsでAPIを完全に実装する
 * 3. Next.jsなどのフルスタックフレームワークを使用する
 */

exports.handler = async (event, context) => {
  // CORSヘッダー
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  };

  // OPTIONSリクエストへの対応（CORS preflight）
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // パスからAPIエンドポイントを取得
  const path = event.path.replace('/.netlify/functions/api', '');

  // ヘルスチェック
  if (path === '/health' || path === '/api/health') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'limited',
        message: 'Netlify Function proxy is running (limited functionality)',
        note: 'Full backend API is not deployed. Please deploy backend to external service.',
        timestamp: new Date().toISOString(),
      }),
    };
  }

  // キヤデータ統計情報のモックレスポンス
  if (path === '/kiya-data/statistics' || path === '/api/kiya-data/statistics') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        statistics: {
          totalDatasets: 0,
          totalFiles: 0,
          totalDataPoints: 0,
          lastUpdated: new Date().toISOString(),
          message: 'No data available. Backend API not connected.',
        },
      }),
    };
  }

  // その他のエンドポイントに対する応答
  return {
    statusCode: 503,
    headers,
    body: JSON.stringify({
      success: false,
      error: 'Backend API not available',
      message: 'The backend API server is not deployed. Please deploy the backend to an external service (Railway, Render, Heroku, etc.) and update VITE_API_URL environment variable.',
      suggestion: 'For local development, run the backend server on port 3003.',
      path: path,
      method: event.httpMethod,
    }),
  };
};