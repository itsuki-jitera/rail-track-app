/**
 * SVG画像生成ユーティリティ
 * SVG Image Generation Utility
 *
 * 偏心矢計算結果をSVG形式のグラフとして出力
 */

const fs = require('fs');
const path = require('path');

class SVGChartGenerator {
  constructor() {
    this.defaultWidth = 800;
    this.defaultHeight = 400;
    this.margin = { top: 40, right: 60, bottom: 60, left: 80 };
  }

  /**
   * 偏心矢波形のSVGグラフを生成
   *
   * @param {Array} data - 波形データ
   * @param {Object} options - オプション設定
   * @returns {string} SVG文字列
   */
  generateWaveformSVG(data, options = {}) {
    const {
      width = this.defaultWidth,
      height = this.defaultHeight,
      title = '偏心矢波形',
      xLabel = '距離 (m)',
      yLabel = '偏心矢 (mm)',
      showGrid = true,
      showOriginal = true,
      strokeWidth = 2,
      color = '#2E86C1',
      originalColor = '#E74C3C'
    } = options;

    // グラフエリアの計算
    const graphWidth = width - this.margin.left - this.margin.right;
    const graphHeight = height - this.margin.top - this.margin.bottom;

    // データの範囲を計算
    const xValues = data.map(d => d.distance || d.x || 0);
    const yValues = data.map(d => d.value || d.y || 0);
    const originalValues = data.map(d => d.originalValue || d.original || null).filter(v => v !== null);

    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    let yMin = Math.min(...yValues);
    let yMax = Math.max(...yValues);

    if (originalValues.length > 0) {
      yMin = Math.min(yMin, ...originalValues);
      yMax = Math.max(yMax, ...originalValues);
    }

    // パディング追加
    const yPadding = (yMax - yMin) * 0.1;
    yMin -= yPadding;
    yMax += yPadding;

    // スケール関数
    const scaleX = (x) => this.margin.left + ((x - xMin) / (xMax - xMin)) * graphWidth;
    const scaleY = (y) => this.margin.top + graphHeight - ((y - yMin) / (yMax - yMin)) * graphHeight;

    // SVG開始
    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="white"/>`;

    // タイトル
    svg += `
  <text x="${width / 2}" y="25" font-family="Arial, sans-serif" font-size="18" font-weight="bold" text-anchor="middle">${this.escapeXml(title)}</text>`;

    // グリッド線（オプション）
    if (showGrid) {
      svg += this.generateGrid(graphWidth, graphHeight, this.margin);
    }

    // 軸
    svg += this.generateAxes(graphWidth, graphHeight, this.margin);

    // 軸ラベル
    svg += `
  <text x="${width / 2}" y="${height - 10}" font-family="Arial" font-size="12" text-anchor="middle">${this.escapeXml(xLabel)}</text>
  <text x="20" y="${height / 2}" font-family="Arial" font-size="12" text-anchor="middle" transform="rotate(-90 20 ${height / 2})">${this.escapeXml(yLabel)}</text>`;

    // 軸の目盛りと数値
    svg += this.generateTicks(xMin, xMax, yMin, yMax, graphWidth, graphHeight, this.margin);

    // クリッピングパス（グラフエリアの外側を切り取る）
    svg += `
  <defs>
    <clipPath id="graphArea">
      <rect x="${this.margin.left}" y="${this.margin.top}" width="${graphWidth}" height="${graphHeight}"/>
    </clipPath>
  </defs>`;

    // オリジナルデータの線（存在する場合）
    if (showOriginal && originalValues.length > 0) {
      const originalPath = this.generatePath(data, scaleX, scaleY, 'originalValue');
      svg += `
  <path d="${originalPath}" fill="none" stroke="${originalColor}" stroke-width="${strokeWidth}" opacity="0.7" clip-path="url(#graphArea)"/>`;
    }

    // 偏心矢データの線
    const versPath = this.generatePath(data, scaleX, scaleY, 'value');
    svg += `
  <path d="${versPath}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" clip-path="url(#graphArea)"/>`;

    // 凡例
    if (showOriginal && originalValues.length > 0) {
      svg += this.generateLegend(
        [
          { label: '偏心矢', color },
          { label: '測定値', color: originalColor }
        ],
        width - 120,
        50
      );
    }

    // SVG終了
    svg += `
</svg>`;

    return svg;
  }

  /**
   * 検測特性グラフのSVG生成
   *
   * @param {Array} characteristics - 検測特性データ
   * @param {Object} options - オプション設定
   * @returns {string} SVG文字列
   */
  generateCharacteristicsSVG(characteristics, options = {}) {
    const {
      width = this.defaultWidth,
      height = this.defaultHeight * 1.5, // 2つのグラフを縦に並べる
      title = '検測特性',
      amplitudeColor = '#2E86C1',
      phaseColor = '#E74C3C'
    } = options;

    const graphHeight = (height - this.margin.top - this.margin.bottom) / 2 - 20;
    const graphWidth = width - this.margin.left - this.margin.right;

    // データ範囲
    const wavelengths = characteristics.map(c => c.wavelength);
    const amplitudes = characteristics.map(c => c.amplitude);
    const phases = characteristics.map(c => c.phaseDeg);

    const xMin = Math.min(...wavelengths);
    const xMax = Math.max(...wavelengths);
    const ampMin = 0;
    const ampMax = Math.max(...amplitudes) * 1.1;
    const phaseMin = Math.min(...phases);
    const phaseMax = Math.max(...phases);

    // SVG開始
    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="white"/>`;

    // タイトル
    svg += `
  <text x="${width / 2}" y="25" font-family="Arial" font-size="18" font-weight="bold" text-anchor="middle">${this.escapeXml(title)}</text>`;

    // 振幅特性グラフ
    const ampScaleX = (x) => this.margin.left + ((Math.log10(x) - Math.log10(xMin)) / (Math.log10(xMax) - Math.log10(xMin))) * graphWidth;
    const ampScaleY = (y) => this.margin.top + graphHeight - ((y - ampMin) / (ampMax - ampMin)) * graphHeight;

    svg += this.generateSubGraph(
      characteristics,
      ampScaleX,
      ampScaleY,
      'amplitude',
      '振幅特性',
      '波長 (m)',
      '振幅',
      amplitudeColor,
      this.margin.top,
      graphWidth,
      graphHeight
    );

    // 位相特性グラフ
    const phaseOffsetY = this.margin.top + graphHeight + 40;
    const phaseScaleX = ampScaleX; // 同じX軸スケール
    const phaseScaleY = (y) => phaseOffsetY + graphHeight - ((y - phaseMin) / (phaseMax - phaseMin)) * graphHeight;

    svg += this.generateSubGraph(
      characteristics,
      phaseScaleX,
      phaseScaleY,
      'phaseDeg',
      '位相特性',
      '波長 (m)',
      '位相 (度)',
      phaseColor,
      phaseOffsetY,
      graphWidth,
      graphHeight
    );

    svg += `
</svg>`;

    return svg;
  }

  /**
   * サブグラフの生成
   */
  generateSubGraph(data, scaleX, scaleY, valueKey, title, xLabel, yLabel, color, offsetY, width, height) {
    let svg = '';

    // グラフエリアの枠
    svg += `
  <rect x="${this.margin.left}" y="${offsetY}" width="${width}" height="${height}" fill="none" stroke="#ccc"/>`;

    // タイトル
    svg += `
  <text x="${this.margin.left + width / 2}" y="${offsetY - 10}" font-family="Arial" font-size="14" font-weight="bold" text-anchor="middle">${title}</text>`;

    // データパス
    const pathData = data.map((d, i) => {
      const x = scaleX(d.wavelength);
      const y = scaleY(d[valueKey]);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    svg += `
  <path d="${pathData}" fill="none" stroke="${color}" stroke-width="2"/>`;

    // 軸ラベル
    svg += `
  <text x="${this.margin.left + width / 2}" y="${offsetY + height + 35}" font-family="Arial" font-size="11" text-anchor="middle">${xLabel}</text>
  <text x="20" y="${offsetY + height / 2}" font-family="Arial" font-size="11" text-anchor="middle" transform="rotate(-90 20 ${offsetY + height / 2})">${yLabel}</text>`;

    return svg;
  }

  /**
   * パスデータの生成
   */
  generatePath(data, scaleX, scaleY, valueKey) {
    return data.map((d, i) => {
      const x = scaleX(d.distance || d.x || 0);
      const y = scaleY(d[valueKey] || 0);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }

  /**
   * グリッド線の生成
   */
  generateGrid(width, height, margin) {
    let svg = '<g stroke="#e0e0e0" stroke-width="0.5">';

    // 垂直グリッド線
    for (let i = 0; i <= 10; i++) {
      const x = margin.left + (width * i) / 10;
      svg += `<line x1="${x}" y1="${margin.top}" x2="${x}" y2="${margin.top + height}"/>`;
    }

    // 水平グリッド線
    for (let i = 0; i <= 5; i++) {
      const y = margin.top + (height * i) / 5;
      svg += `<line x1="${margin.left}" y1="${y}" x2="${margin.left + width}" y2="${y}"/>`;
    }

    svg += '</g>';
    return svg;
  }

  /**
   * 軸の生成
   */
  generateAxes(width, height, margin) {
    return `
  <g stroke="black" stroke-width="2">
    <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + height}"/>
    <line x1="${margin.left}" y1="${margin.top + height}" x2="${margin.left + width}" y2="${margin.top + height}"/>
  </g>`;
  }

  /**
   * 目盛りの生成
   */
  generateTicks(xMin, xMax, yMin, yMax, width, height, margin) {
    let svg = '<g font-family="Arial" font-size="10">';

    // X軸の目盛り
    for (let i = 0; i <= 10; i++) {
      const x = margin.left + (width * i) / 10;
      const value = xMin + ((xMax - xMin) * i) / 10;
      svg += `
    <line x1="${x}" y1="${margin.top + height}" x2="${x}" y2="${margin.top + height + 5}" stroke="black"/>
    <text x="${x}" y="${margin.top + height + 18}" text-anchor="middle">${value.toFixed(1)}</text>`;
    }

    // Y軸の目盛り
    for (let i = 0; i <= 5; i++) {
      const y = margin.top + height - (height * i) / 5;
      const value = yMin + ((yMax - yMin) * i) / 5;
      svg += `
    <line x1="${margin.left - 5}" y1="${y}" x2="${margin.left}" y2="${y}" stroke="black"/>
    <text x="${margin.left - 10}" y="${y + 4}" text-anchor="end">${value.toFixed(1)}</text>`;
    }

    svg += '</g>';
    return svg;
  }

  /**
   * 凡例の生成
   */
  generateLegend(items, x, y) {
    let svg = `<g transform="translate(${x}, ${y})">`;

    items.forEach((item, i) => {
      const offsetY = i * 20;
      svg += `
    <line x1="0" y1="${offsetY}" x2="20" y2="${offsetY}" stroke="${item.color}" stroke-width="2"/>
    <text x="25" y="${offsetY + 4}" font-family="Arial" font-size="12">${this.escapeXml(item.label)}</text>`;
    });

    svg += '</g>';
    return svg;
  }

  /**
   * XMLエスケープ
   */
  escapeXml(text) {
    if (!text) return '';
    return text.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * SVGファイルの保存
   *
   * @param {string} svg - SVG文字列
   * @param {string} filePath - 保存先パス
   * @returns {Promise<string>} 保存されたファイルパス
   */
  async saveSVG(svg, filePath) {
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, svg, 'utf8', (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(filePath);
        }
      });
    });
  }

  /**
   * バッチグラフの生成（複数データセット）
   *
   * @param {Array} datasets - 複数のデータセット
   * @param {Object} options - オプション設定
   * @returns {string} SVG文字列
   */
  generateBatchComparisonSVG(datasets, options = {}) {
    const {
      width = this.defaultWidth,
      height = this.defaultHeight,
      title = 'バッチ処理結果比較',
      colors = ['#2E86C1', '#E74C3C', '#F39C12', '#27AE60', '#8E44AD']
    } = options;

    const graphWidth = width - this.margin.left - this.margin.right;
    const graphHeight = height - this.margin.top - this.margin.bottom;

    // 全データセットの範囲を計算
    let xMin = Infinity, xMax = -Infinity;
    let yMin = Infinity, yMax = -Infinity;

    datasets.forEach(dataset => {
      const xValues = dataset.data.map(d => d.distance || 0);
      const yValues = dataset.data.map(d => d.value || 0);

      xMin = Math.min(xMin, ...xValues);
      xMax = Math.max(xMax, ...xValues);
      yMin = Math.min(yMin, ...yValues);
      yMax = Math.max(yMax, ...yValues);
    });

    // パディング
    const yPadding = (yMax - yMin) * 0.1;
    yMin -= yPadding;
    yMax += yPadding;

    // スケール関数
    const scaleX = (x) => this.margin.left + ((x - xMin) / (xMax - xMin)) * graphWidth;
    const scaleY = (y) => this.margin.top + graphHeight - ((y - yMin) / (yMax - yMin)) * graphHeight;

    // SVG生成
    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="white"/>`;

    // タイトル
    svg += `
  <text x="${width / 2}" y="25" font-family="Arial" font-size="18" font-weight="bold" text-anchor="middle">${this.escapeXml(title)}</text>`;

    // グリッドと軸
    svg += this.generateGrid(graphWidth, graphHeight, this.margin);
    svg += this.generateAxes(graphWidth, graphHeight, this.margin);
    svg += this.generateTicks(xMin, xMax, yMin, yMax, graphWidth, graphHeight, this.margin);

    // 各データセットの線
    datasets.forEach((dataset, i) => {
      const color = colors[i % colors.length];
      const path = this.generatePath(dataset.data, scaleX, scaleY, 'value');
      svg += `
  <path d="${path}" fill="none" stroke="${color}" stroke-width="2" opacity="0.8"/>`;
    });

    // 凡例
    const legendItems = datasets.map((dataset, i) => ({
      label: dataset.name || `データ${i + 1}`,
      color: colors[i % colors.length]
    }));
    svg += this.generateLegend(legendItems, width - 150, 50);

    svg += `
</svg>`;

    return svg;
  }
}

module.exports = { SVGChartGenerator };