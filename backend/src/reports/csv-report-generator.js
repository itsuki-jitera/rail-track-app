/**
 * CSVレポート生成モジュール
 * 復元波形、計画線、移動量データをCSV形式で出力
 *
 * 出力内容:
 * - 復元波形レポート
 * - 計画線レポート
 * - 移動量（こう上量・移動量）レポート
 * - 統計情報レポート
 */

class CSVReportGenerator {
  constructor() {
    this.encoding = 'utf8';
    this.delimiter = ',';
    this.lineBreak = '\r\n';
  }

  /**
   * 復元波形レポートを生成
   * @param {RestorationWaveformResult} result - 復元波形計算結果
   * @param {Object} metadata - メタデータ
   * @returns {string} CSV文字列
   */
  generateRestorationReport(result, metadata = {}) {
    const lines = [];

    // ヘッダー情報
    lines.push('# 復元波形レポート');
    lines.push(`# 路線: ${metadata.lineName || ''}`);
    lines.push(`# 測定日: ${metadata.measurementDate || ''}`);
    lines.push(`# 測定項目: ${metadata.dataType || ''}`);
    lines.push(`# 開始キロ程: ${metadata.startKm || ''}`);
    lines.push(`# 終了キロ程: ${metadata.endKm || ''}`);
    lines.push('');

    // 統計情報
    if (result.statistics) {
      lines.push('# 統計情報');
      lines.push(`# 元データσ値: ${result.statistics.original?.sigma?.toFixed(3) || ''} mm`);
      lines.push(`# 復元波形σ値: ${result.statistics.restored?.sigma?.toFixed(3) || ''} mm`);
      lines.push(`# 良化率: ${result.statistics.improvementRate?.toFixed(2) || ''} %`);
      lines.push('');
    }

    // フィルタパラメータ
    if (result.filterParams) {
      lines.push('# フィルタパラメータ');
      lines.push(`# 最小波長: ${result.filterParams.minWavelength} m`);
      lines.push(`# 最大波長: ${result.filterParams.maxWavelength} m`);
      lines.push(`# サンプリング間隔: ${result.filterParams.samplingInterval} m`);
      lines.push('');
    }

    // データヘッダー
    lines.push('距離(m),復元波形(mm),計画線(mm),こう上量(mm)');

    // データ行
    for (let i = 0; i < result.restoredWaveform.length; i++) {
      const row = [
        result.restoredWaveform[i].distance,
        result.restoredWaveform[i].value,
        result.planLine[i].value,
        result.movementData[i].tamping
      ];
      lines.push(row.join(this.delimiter));
    }

    return lines.join(this.lineBreak);
  }

  /**
   * 矢中弦レポートを生成
   * @param {Object} versineData - 矢中弦データ {10m: [], 20m: [], 40m: []}
   * @param {Object} metadata - メタデータ
   * @returns {string} CSV文字列
   */
  generateVersineReport(versineData, metadata = {}) {
    const lines = [];

    // ヘッダー情報
    lines.push('# 矢中弦レポート');
    lines.push(`# 路線: ${metadata.lineName || ''}`);
    lines.push(`# 測定日: ${metadata.measurementDate || ''}`);
    lines.push('');

    // データヘッダー
    const headers = ['距離(m)'];
    const chordTypes = Object.keys(versineData);

    for (const chordType of chordTypes) {
      headers.push(`矢中弦${chordType}(mm)`);
    }
    lines.push(headers.join(this.delimiter));

    // データ行
    const dataLength = versineData[chordTypes[0]]?.length || 0;

    for (let i = 0; i < dataLength; i++) {
      const row = [versineData[chordTypes[0]][i].distance];

      for (const chordType of chordTypes) {
        row.push(versineData[chordType][i].value);
      }

      lines.push(row.join(this.delimiter));
    }

    return lines.join(this.lineBreak);
  }

  /**
   * 移動量レポートを生成
   * @param {MovementData[]} movementData - 移動量データ
   * @param {Object} metadata - メタデータ
   * @returns {string} CSV文字列
   */
  generateMovementReport(movementData, metadata = {}) {
    const lines = [];

    // ヘッダー情報
    lines.push('# 移動量レポート');
    lines.push(`# 路線: ${metadata.lineName || ''}`);
    lines.push(`# 測定日: ${metadata.measurementDate || ''}`);
    lines.push('');

    // データヘッダー
    lines.push('距離(m),こう上量(mm),移動量(mm)');

    // データ行
    for (const data of movementData) {
      const row = [
        data.distance,
        data.tamping,
        data.lining
      ];
      lines.push(row.join(this.delimiter));
    }

    return lines.join(this.lineBreak);
  }

  /**
   * 統計情報レポートを生成
   * @param {Object} statistics - 統計情報
   * @param {Object} metadata - メタデータ
   * @returns {string} CSV文字列
   */
  generateStatisticsReport(statistics, metadata = {}) {
    const lines = [];

    // ヘッダー情報
    lines.push('# 統計情報レポート');
    lines.push(`# 路線: ${metadata.lineName || ''}`);
    lines.push(`# 測定日: ${metadata.measurementDate || ''}`);
    lines.push('');

    // 統計項目
    lines.push('項目,元データ,復元波形,単位');

    if (statistics.original && statistics.restored) {
      lines.push(`σ値,${statistics.original.sigma?.toFixed(3)},${statistics.restored.sigma?.toFixed(3)},mm`);
      lines.push(`RMS値,${statistics.original.rms?.toFixed(3)},${statistics.restored.rms?.toFixed(3)},mm`);
      lines.push(`最大値,${statistics.original.max?.toFixed(3)},${statistics.restored.max?.toFixed(3)},mm`);
      lines.push(`最小値,${statistics.original.min?.toFixed(3)},${statistics.restored.min?.toFixed(3)},mm`);
      lines.push(`ピーク間,${statistics.original.peakToPeak?.toFixed(3)},${statistics.restored.peakToPeak?.toFixed(3)},mm`);
    }

    lines.push('');
    lines.push(`良化率,${statistics.improvementRate?.toFixed(2)},%`);

    return lines.join(this.lineBreak);
  }

  /**
   * 環境データレポートを生成
   * @param {TrackEnvironmentData} environmentData - 環境データ
   * @param {Object} metadata - メタデータ
   * @returns {string} CSV文字列
   */
  generateEnvironmentReport(environmentData, metadata = {}) {
    const lines = [];

    // ヘッダー情報
    lines.push('# 軌道環境データレポート');
    lines.push(`# 路線: ${metadata.lineName || ''}`);
    lines.push('');

    // 駅名データ
    if (environmentData.stations && environmentData.stations.length > 0) {
      lines.push('## 駅名');
      lines.push('キロ程(m),駅名');
      for (const station of environmentData.stations) {
        lines.push(`${station.kilometer},${station.stationName}`);
      }
      lines.push('');
    }

    // こう配データ
    if (environmentData.slopes && environmentData.slopes.length > 0) {
      lines.push('## こう配');
      lines.push('開始(m),終了(m),勾配(‰),縦曲線半径(m)');
      for (const slope of environmentData.slopes) {
        lines.push(`${slope.from},${slope.to},${slope.gradient},${slope.curveRadius}`);
      }
      lines.push('');
    }

    // 曲線データ
    if (environmentData.curves && environmentData.curves.length > 0) {
      lines.push('## 曲線');
      lines.push('開始(m),終了(m),BTC,BCC,ECC,ETC,方向,半径(m),カント(mm),スラック(mm)');
      for (const curve of environmentData.curves) {
        lines.push(
          `${curve.from},${curve.to},${curve.btc},${curve.bcc},${curve.ecc},${curve.etc},` +
          `${curve.direction},${curve.radius},${curve.cant},${curve.slack}`
        );
      }
      lines.push('');
    }

    // 構造物データ
    if (environmentData.structures && environmentData.structures.length > 0) {
      lines.push('## 構造物');
      lines.push('開始(m),終了(m),種別,名称');
      for (const structure of environmentData.structures) {
        lines.push(`${structure.from},${structure.to},${structure.structureType},${structure.structureName}`);
      }
      lines.push('');
    }

    return lines.join(this.lineBreak);
  }

  /**
   * 総合レポートを生成
   * @param {RestorationWaveformResult} result - 復元波形計算結果
   * @param {TrackEnvironmentData} environmentData - 環境データ（オプション）
   * @param {Object} metadata - メタデータ
   * @returns {string} CSV文字列
   */
  generateComprehensiveReport(result, environmentData = null, metadata = {}) {
    const sections = [];

    // 復元波形レポート
    sections.push(this.generateRestorationReport(result, metadata));

    // 矢中弦レポート
    if (result.versineData) {
      sections.push('');
      sections.push(this.generateVersineReport(result.versineData, metadata));
    }

    // 統計情報レポート
    if (result.statistics) {
      sections.push('');
      sections.push(this.generateStatisticsReport(result.statistics, metadata));
    }

    // 環境データレポート
    if (environmentData) {
      sections.push('');
      sections.push(this.generateEnvironmentReport(environmentData, metadata));
    }

    return sections.join(this.lineBreak);
  }

  /**
   * 複数項目の比較レポートを生成
   * @param {Array<{name: string, data: MeasurementData[]}>} dataList - データリスト
   * @param {Object} metadata - メタデータ
   * @returns {string} CSV文字列
   */
  generateComparisonReport(dataList, metadata = {}) {
    const lines = [];

    // ヘッダー情報
    lines.push('# 測定項目比較レポート');
    lines.push(`# 路線: ${metadata.lineName || ''}`);
    lines.push(`# 測定日: ${metadata.measurementDate || ''}`);
    lines.push('');

    // データヘッダー
    const headers = ['距離(m)'];
    for (const item of dataList) {
      headers.push(`${item.name}(mm)`);
    }
    lines.push(headers.join(this.delimiter));

    // データ行
    const dataLength = dataList[0]?.data?.length || 0;

    for (let i = 0; i < dataLength; i++) {
      const row = [dataList[0].data[i].distance];

      for (const item of dataList) {
        row.push(item.data[i].value);
      }

      lines.push(row.join(this.delimiter));
    }

    return lines.join(this.lineBreak);
  }

  /**
   * CSV文字列をBufferに変換
   * @param {string} csv - CSV文字列
   * @returns {Buffer} バッファ
   */
  toBuffer(csv) {
    return Buffer.from(csv, this.encoding);
  }

  /**
   * 区切り文字を設定
   * @param {string} delimiter - 区切り文字
   */
  setDelimiter(delimiter) {
    this.delimiter = delimiter;
  }

  /**
   * 改行コードを設定
   * @param {string} lineBreak - 改行コード
   */
  setLineBreak(lineBreak) {
    this.lineBreak = lineBreak;
  }
}

module.exports = { CSVReportGenerator };
