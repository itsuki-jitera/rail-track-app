/**
 * HTMLレポート生成モジュール
 * 復元波形、計画線、移動量データをHTML形式で出力
 *
 * 出力内容:
 * - 視覚的に見やすいレポート
 * - グラフ表示（Chart.jsを使用）
 * - テーブル形式のデータ表示
 * - PDF変換可能なフォーマット
 */

class HTMLReportGenerator {
  constructor() {
    this.encoding = 'utf8';
    this.includeCharts = true;
  }

  /**
   * HTMLヘッダーを生成
   * @param {string} title - タイトル
   * @returns {string} HTMLヘッダー
   */
  generateHeader(title) {
    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>
  <style>
    body {
      font-family: 'Yu Gothic', 'Meiryo', sans-serif;
      margin: 20px;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background-color: white;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      border-bottom: 3px solid #4CAF50;
      padding-bottom: 10px;
    }
    h2 {
      color: #555;
      border-left: 5px solid #4CAF50;
      padding-left: 10px;
      margin-top: 30px;
    }
    h3 {
      color: #666;
      margin-top: 20px;
    }
    .metadata {
      background-color: #f9f9f9;
      padding: 15px;
      border-radius: 5px;
      margin: 20px 0;
    }
    .metadata-item {
      margin: 5px 0;
    }
    .metadata-label {
      font-weight: bold;
      display: inline-block;
      width: 150px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th {
      background-color: #4CAF50;
      color: white;
      padding: 12px;
      text-align: left;
    }
    td {
      border: 1px solid #ddd;
      padding: 10px;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    .statistics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    .stat-card {
      background-color: #f0f8ff;
      padding: 15px;
      border-radius: 5px;
      border-left: 4px solid #2196F3;
    }
    .stat-label {
      font-size: 14px;
      color: #666;
      margin-bottom: 5px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #333;
    }
    .stat-unit {
      font-size: 14px;
      color: #888;
    }
    .chart-container {
      margin: 30px 0;
      height: 400px;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      text-align: center;
      color: #888;
      font-size: 12px;
    }
    @media print {
      body {
        background-color: white;
      }
      .container {
        box-shadow: none;
      }
    }
  </style>
  ${this.includeCharts ? '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>' : ''}
</head>
<body>
  <div class="container">
`;
  }

  /**
   * HTMLフッターを生成
   * @returns {string} HTMLフッター
   */
  generateFooter() {
    const now = new Date().toLocaleString('ja-JP');
    return `
    <div class="footer">
      <p>生成日時: ${now}</p>
      <p>軌道復元システム - Rail Track Restoration System</p>
    </div>
  </div>
</body>
</html>
`;
  }

  /**
   * メタデータセクションを生成
   * @param {Object} metadata - メタデータ
   * @returns {string} HTMLセクション
   */
  generateMetadataSection(metadata) {
    return `
    <div class="metadata">
      <h3>測定情報</h3>
      ${metadata.lineName ? `<div class="metadata-item"><span class="metadata-label">路線名:</span>${this.escapeHtml(metadata.lineName)}</div>` : ''}
      ${metadata.lineCode ? `<div class="metadata-item"><span class="metadata-label">路線コード:</span>${this.escapeHtml(metadata.lineCode)}</div>` : ''}
      ${metadata.direction ? `<div class="metadata-item"><span class="metadata-label">上下区分:</span>${this.escapeHtml(metadata.direction)}</div>` : ''}
      ${metadata.measurementDate ? `<div class="metadata-item"><span class="metadata-label">測定日:</span>${this.escapeHtml(metadata.measurementDate)}</div>` : ''}
      ${metadata.dataType ? `<div class="metadata-item"><span class="metadata-label">測定項目:</span>${this.escapeHtml(metadata.dataType)}</div>` : ''}
      ${metadata.startKm !== undefined ? `<div class="metadata-item"><span class="metadata-label">開始キロ程:</span>${metadata.startKm} m</div>` : ''}
      ${metadata.endKm !== undefined ? `<div class="metadata-item"><span class="metadata-label">終了キロ程:</span>${metadata.endKm} m</div>` : ''}
      ${metadata.dataPoints !== undefined ? `<div class="metadata-item"><span class="metadata-label">データ点数:</span>${metadata.dataPoints} 点</div>` : ''}
    </div>
`;
  }

  /**
   * 統計情報セクションを生成
   * @param {Object} statistics - 統計情報
   * @returns {string} HTMLセクション
   */
  generateStatisticsSection(statistics) {
    if (!statistics) return '';

    return `
    <h2>統計情報</h2>
    <div class="statistics-grid">
      <div class="stat-card">
        <div class="stat-label">元データ σ値</div>
        <div class="stat-value">${statistics.original?.sigma?.toFixed(3) || '-'} <span class="stat-unit">mm</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">復元波形 σ値</div>
        <div class="stat-value">${statistics.restored?.sigma?.toFixed(3) || '-'} <span class="stat-unit">mm</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">良化率</div>
        <div class="stat-value">${statistics.improvementRate?.toFixed(2) || '-'} <span class="stat-unit">%</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">元データ RMS</div>
        <div class="stat-value">${statistics.original?.rms?.toFixed(3) || '-'} <span class="stat-unit">mm</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">復元波形 RMS</div>
        <div class="stat-value">${statistics.restored?.rms?.toFixed(3) || '-'} <span class="stat-unit">mm</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">ピーク間（元データ）</div>
        <div class="stat-value">${statistics.original?.peakToPeak?.toFixed(3) || '-'} <span class="stat-unit">mm</span></div>
      </div>
    </div>
`;
  }

  /**
   * データテーブルを生成
   * @param {Array} data - データ配列
   * @param {Array} columns - カラム定義 [{key: string, label: string, unit: string}]
   * @param {number} maxRows - 最大表示行数
   * @returns {string} HTMLテーブル
   */
  generateDataTable(data, columns, maxRows = 100) {
    if (!data || data.length === 0) return '';

    const displayData = maxRows > 0 ? data.slice(0, maxRows) : data;
    const isLimited = data.length > maxRows;

    let html = '<table>';

    // ヘッダー
    html += '<thead><tr>';
    for (const col of columns) {
      html += `<th>${this.escapeHtml(col.label)}${col.unit ? ` (${col.unit})` : ''}</th>`;
    }
    html += '</tr></thead>';

    // データ行
    html += '<tbody>';
    for (const row of displayData) {
      html += '<tr>';
      for (const col of columns) {
        const value = row[col.key];
        const formatted = typeof value === 'number' ? value.toFixed(3) : value;
        html += `<td>${this.escapeHtml(String(formatted))}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody>';

    html += '</table>';

    if (isLimited) {
      html += `<p style="color: #888; font-size: 14px;">※ 最初の${maxRows}行のみ表示（全${data.length}行）</p>`;
    }

    return html;
  }

  /**
   * 復元波形レポートを生成
   * @param {RestorationWaveformResult} result - 復元波形計算結果
   * @param {Object} metadata - メタデータ
   * @returns {string} HTML文字列
   */
  generateRestorationReport(result, metadata = {}) {
    let html = this.generateHeader('復元波形レポート');

    html += '<h1>復元波形レポート</h1>';

    // メタデータ
    html += this.generateMetadataSection(metadata);

    // 統計情報
    if (result.statistics) {
      html += this.generateStatisticsSection(result.statistics);
    }

    // フィルタパラメータ
    if (result.filterParams) {
      html += `
      <h2>フィルタパラメータ</h2>
      <div class="metadata">
        <div class="metadata-item"><span class="metadata-label">最小波長:</span>${result.filterParams.minWavelength} m</div>
        <div class="metadata-item"><span class="metadata-label">最大波長:</span>${result.filterParams.maxWavelength} m</div>
        <div class="metadata-item"><span class="metadata-label">サンプリング間隔:</span>${result.filterParams.samplingInterval} m</div>
        <div class="metadata-item"><span class="metadata-label">フィルタ次数:</span>${result.filterParams.filterOrder}</div>
      </div>
`;
    }

    // データテーブル
    html += '<h2>復元波形データ</h2>';
    const tableData = result.restoredWaveform.map((point, i) => ({
      distance: point.distance,
      restored: point.value,
      plan: result.planLine[i].value,
      tamping: result.movementData[i].tamping
    }));

    const columns = [
      { key: 'distance', label: '距離', unit: 'm' },
      { key: 'restored', label: '復元波形', unit: 'mm' },
      { key: 'plan', label: '計画線', unit: 'mm' },
      { key: 'tamping', label: 'こう上量', unit: 'mm' }
    ];

    html += this.generateDataTable(tableData, columns, 100);

    html += this.generateFooter();

    return html;
  }

  /**
   * 矢中弦レポートを生成
   * @param {Object} versineData - 矢中弦データ
   * @param {Object} metadata - メタデータ
   * @returns {string} HTML文字列
   */
  generateVersineReport(versineData, metadata = {}) {
    let html = this.generateHeader('矢中弦レポート');

    html += '<h1>矢中弦レポート</h1>';

    // メタデータ
    html += this.generateMetadataSection(metadata);

    // 各弦長のデータテーブル
    for (const [chordType, data] of Object.entries(versineData)) {
      html += `<h2>矢中弦 ${chordType}</h2>`;

      const columns = [
        { key: 'distance', label: '距離', unit: 'm' },
        { key: 'value', label: '矢中弦', unit: 'mm' }
      ];

      html += this.generateDataTable(data, columns, 100);
    }

    html += this.generateFooter();

    return html;
  }

  /**
   * 環境データレポートを生成
   * @param {TrackEnvironmentData} environmentData - 環境データ
   * @param {Object} metadata - メタデータ
   * @returns {string} HTML文字列
   */
  generateEnvironmentReport(environmentData, metadata = {}) {
    let html = this.generateHeader('軌道環境データレポート');

    html += '<h1>軌道環境データレポート</h1>';

    // メタデータ
    html += this.generateMetadataSection(metadata);

    // 駅名データ
    if (environmentData.stations && environmentData.stations.length > 0) {
      html += '<h2>駅名</h2>';
      const columns = [
        { key: 'kilometer', label: 'キロ程', unit: 'm' },
        { key: 'stationName', label: '駅名', unit: '' }
      ];
      html += this.generateDataTable(environmentData.stations, columns, 50);
    }

    // こう配データ
    if (environmentData.slopes && environmentData.slopes.length > 0) {
      html += '<h2>こう配</h2>';
      const columns = [
        { key: 'from', label: '開始', unit: 'm' },
        { key: 'to', label: '終了', unit: 'm' },
        { key: 'gradient', label: '勾配', unit: '‰' },
        { key: 'curveRadius', label: '縦曲線半径', unit: 'm' }
      ];
      html += this.generateDataTable(environmentData.slopes, columns, 50);
    }

    // 曲線データ
    if (environmentData.curves && environmentData.curves.length > 0) {
      html += '<h2>曲線</h2>';
      const columns = [
        { key: 'from', label: '開始', unit: 'm' },
        { key: 'to', label: '終了', unit: 'm' },
        { key: 'radius', label: '半径', unit: 'm' },
        { key: 'cant', label: 'カント', unit: 'mm' },
        { key: 'direction', label: '方向', unit: '' }
      ];
      html += this.generateDataTable(environmentData.curves, columns, 50);
    }

    // 構造物データ
    if (environmentData.structures && environmentData.structures.length > 0) {
      html += '<h2>構造物</h2>';
      const columns = [
        { key: 'from', label: '開始', unit: 'm' },
        { key: 'to', label: '終了', unit: 'm' },
        { key: 'structureType', label: '種別', unit: '' },
        { key: 'structureName', label: '名称', unit: '' }
      ];
      html += this.generateDataTable(environmentData.structures, columns, 50);
    }

    html += this.generateFooter();

    return html;
  }

  /**
   * 総合レポートを生成
   * @param {RestorationWaveformResult} result - 復元波形計算結果
   * @param {TrackEnvironmentData} environmentData - 環境データ（オプション）
   * @param {Object} metadata - メタデータ
   * @returns {string} HTML文字列
   */
  generateComprehensiveReport(result, environmentData = null, metadata = {}) {
    let html = this.generateHeader('軌道復元総合レポート');

    html += '<h1>軌道復元総合レポート</h1>';

    // メタデータ
    html += this.generateMetadataSection(metadata);

    // 統計情報
    if (result.statistics) {
      html += this.generateStatisticsSection(result.statistics);
    }

    // フィルタパラメータ
    if (result.filterParams) {
      html += `
      <h2>フィルタパラメータ</h2>
      <div class="metadata">
        <div class="metadata-item"><span class="metadata-label">波長帯域:</span>${result.filterParams.minWavelength}m - ${result.filterParams.maxWavelength}m</div>
        <div class="metadata-item"><span class="metadata-label">サンプリング間隔:</span>${result.filterParams.samplingInterval} m</div>
      </div>
`;
    }

    // 復元波形データ
    html += '<h2>復元波形データ（抜粋）</h2>';
    const restorationData = result.restoredWaveform.map((point, i) => ({
      distance: point.distance,
      restored: point.value,
      plan: result.planLine[i].value,
      tamping: result.movementData[i].tamping
    }));

    const restorationColumns = [
      { key: 'distance', label: '距離', unit: 'm' },
      { key: 'restored', label: '復元波形', unit: 'mm' },
      { key: 'plan', label: '計画線', unit: 'mm' },
      { key: 'tamping', label: 'こう上量', unit: 'mm' }
    ];

    html += this.generateDataTable(restorationData, restorationColumns, 50);

    html += this.generateFooter();

    return html;
  }

  /**
   * HTML文字列をBufferに変換
   * @param {string} html - HTML文字列
   * @returns {Buffer} バッファ
   */
  toBuffer(html) {
    return Buffer.from(html, this.encoding);
  }

  /**
   * HTMLエスケープ
   * @param {string} text - テキスト
   * @returns {string} エスケープ済みテキスト
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * グラフ表示の有効/無効を設定
   * @param {boolean} include - グラフを含めるか
   */
  setIncludeCharts(include) {
    this.includeCharts = include;
  }
}

module.exports = { HTMLReportGenerator };
