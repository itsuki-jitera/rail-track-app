/**
 * パラメータファイルエクスポーター (.PRM形式)
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」P35-36に基づく実装
 * - 計算時のパラメータを保存
 * - 後で同じ条件で再計算可能にする
 */

const fs = require('fs').promises;
const path = require('path');

class PRMExporter {
  constructor() {
    this.version = '1.0.0';
    this.fileExtension = '.PRM';
  }

  /**
   * パラメータをPRM形式でエクスポート
   * @param {Object} parameters - パラメータオブジェクト
   * @param {Object} workSection - 作業区間情報
   * @returns {Promise<string>} 出力ファイルパス
   */
  async exportParameters(parameters, workSection) {
    const content = this.generatePRMContent(parameters, workSection);
    const fileName = this.generateFileName(workSection);
    const filePath = path.join(workSection.outputDir || './output', fileName);

    await fs.writeFile(filePath, content, 'utf8');

    return filePath;
  }

  /**
   * PRM形式のコンテンツを生成
   * @param {Object} params - パラメータ
   * @param {Object} workSection - 作業区間
   * @returns {string} PRMファイル内容
   */
  generatePRMContent(params, workSection) {
    const lines = [];

    // ヘッダー
    lines.push('*RAIL_TRACK_PARAMETER_FILE');
    lines.push(`*VERSION:${this.version}`);
    lines.push(`*DATE:${new Date().toISOString()}`);
    lines.push('*');

    // 作業区間情報
    lines.push('[WORK_SECTION]');
    lines.push(`LINE_NAME=${workSection.lineName || ''}`);
    lines.push(`TRACK_NAME=${workSection.trackName || ''}`);
    lines.push(`DIRECTION=${workSection.direction || 'UP'}`);
    lines.push(`START_KM=${workSection.startKm || 0}`);
    lines.push(`END_KM=${workSection.endKm || 0}`);
    lines.push(`WORK_DATE=${workSection.workDate || new Date().toISOString().split('T')[0]}`);
    lines.push(`OPERATOR=${workSection.operator || 'SYSTEM'}`);
    lines.push('');

    // 復元波形計算パラメータ
    lines.push('[RESTORATION_WAVE]');
    lines.push(`METHOD=${params.restoration?.method || 'FFT'}`);
    lines.push(`MIN_WAVELENGTH=${params.restoration?.minWavelength || 6}`);
    lines.push(`MAX_WAVELENGTH=${params.restoration?.maxWavelength || 40}`);
    lines.push(`WINDOW_FUNCTION=${params.restoration?.windowFunction || 'HANNING'}`);
    lines.push(`FILTER_TYPE=${params.restoration?.filterType || 'BANDPASS'}`);
    lines.push(`SAMPLING_INTERVAL=${params.restoration?.samplingInterval || 0.25}`);
    lines.push('');

    // 計画線パラメータ
    lines.push('[PLAN_LINE]');
    lines.push(`GENERATION_METHOD=${params.planLine?.method || 'CONVEX'}`);
    lines.push(`PRIORITY_MODE=${params.planLine?.priorityMode || 'UPWARD'}`);
    lines.push(`MAX_UPWARD=${params.planLine?.maxUpward || 50}`);
    lines.push(`MAX_DOWNWARD=${params.planLine?.maxDownward || 10}`);
    lines.push(`TARGET_UPWARD_RATIO=${params.planLine?.targetUpwardRatio || 0.7}`);
    lines.push(`SMOOTHING_WINDOW=${params.planLine?.smoothingWindow || 20}`);
    lines.push(`MANUAL_EDIT=${params.planLine?.manualEdit || 'FALSE'}`);
    lines.push('');

    // 曲線諸元パラメータ
    lines.push('[CURVE_ELEMENTS]');
    lines.push(`CHORD_LENGTH=${params.curve?.chordLength || 10}`);
    lines.push(`APPLY_TRAPEZOID=${params.curve?.applyTrapezoid || 'TRUE'}`);
    lines.push(`TRANSITION_TYPE=${params.curve?.transitionType || 'CLOTHOID'}`);
    lines.push(`D6_CORRECTION=${params.curve?.d6Correction || 'TRUE'}`);
    lines.push(`CURVE_COUNT=${params.curve?.elements?.length || 0}`);

    // 個別曲線諸元
    if (params.curve?.elements && params.curve.elements.length > 0) {
      params.curve.elements.forEach((element, index) => {
        lines.push(`CURVE_${index + 1}=${element.startKm},${element.endKm},${element.radius},${element.direction},${element.cant || 0}`);
      });
    }
    lines.push('');

    // 縦曲線パラメータ
    lines.push('[VERTICAL_CURVE]');
    lines.push(`EXCLUSION_METHOD=${params.verticalCurve?.method || 'MOVING_AVERAGE'}`);
    lines.push(`CHORD_LENGTH=${params.verticalCurve?.chordLength || 10}`);
    lines.push(`WINDOW_SIZE=${params.verticalCurve?.windowSize || 100}`);
    lines.push(`POLYNOMIAL_ORDER=${params.verticalCurve?.polynomialOrder || 3}`);
    lines.push(`APPLY_EXCLUSION=${params.verticalCurve?.applyExclusion || 'TRUE'}`);
    lines.push('');

    // 移動量制限パラメータ
    lines.push('[MOVEMENT_RESTRICTION]');
    lines.push(`CHECK_RESTRICTION=${params.restriction?.checkRestriction || 'TRUE'}`);
    lines.push(`STANDARD_LIMIT=${params.restriction?.standardLimit || 30}`);
    lines.push(`MAXIMUM_LIMIT=${params.restriction?.maximumLimit || 50}`);
    lines.push(`RESTRICTION_COUNT=${params.restriction?.points?.length || 0}`);

    // 個別制限箇所
    if (params.restriction?.points && params.restriction.points.length > 0) {
      params.restriction.points.forEach((point, index) => {
        lines.push(`RESTRICTION_${index + 1}=${point.startKm},${point.endKm},${point.direction},${point.amount},${point.isFixed ? 'FIXED' : 'LIMITED'}`);
      });
    }
    lines.push('');

    // MTTパラメータ
    lines.push('[MTT_SETTINGS]');
    lines.push(`MTT_TYPE=${params.mtt?.type || '08-475'}`);
    lines.push(`LIFTING_DEVICE=${params.mtt?.liftingDevice || '3POINT'}`);
    lines.push(`LINING_DEVICE=${params.mtt?.liningDevice || '2POINT'}`);
    lines.push(`CHORD_LENGTH=${params.mtt?.chordLength || 10}`);
    lines.push(`D_POINT_DISTANCE=${params.mtt?.dPointDistance || 11.2}`);
    lines.push(`C_POINT_DISTANCE=${params.mtt?.cPointDistance || 5.6}`);
    lines.push(`APPLY_CORRECTION=${params.mtt?.applyCorrection || 'TRUE'}`);
    lines.push('');

    // 出力設定パラメータ
    lines.push('[OUTPUT_SETTINGS]');
    lines.push(`ALS_FORMAT=${params.output?.alsFormat || 'TRUE'}`);
    lines.push(`ALS_INTERVAL=${params.output?.alsInterval || 5}`);
    lines.push(`ALC_FORMAT=${params.output?.alcFormat || 'FALSE'}`);
    lines.push(`CSV_FORMAT=${params.output?.csvFormat || 'TRUE'}`);
    lines.push(`CSV_INTERVAL=${params.output?.csvInterval || 0.5}`);
    lines.push(`MTT_DATA=${params.output?.mttData || 'TRUE'}`);
    lines.push(`INCLUDE_PREDICTION=${params.output?.includePrediction || 'TRUE'}`);
    lines.push('');

    // 手検測データパラメータ
    lines.push('[HAND_MEASUREMENT]');
    lines.push(`USE_HAND_DATA=${params.handMeasurement?.useHandData || 'FALSE'}`);
    lines.push(`CORRELATION_THRESHOLD=${params.handMeasurement?.correlationThreshold || 0.7}`);
    lines.push(`SEARCH_RANGE=${params.handMeasurement?.searchRange || 20}`);
    lines.push(`AUTO_ALIGNMENT=${params.handMeasurement?.autoAlignment || 'TRUE'}`);
    lines.push(`DATA_FILE=${params.handMeasurement?.dataFile || ''}`);
    lines.push('');

    // 前後接続パラメータ
    lines.push('[CONNECTION_SETTINGS]');
    lines.push(`FRONT_CONNECTION=${params.connection?.frontConnection || 'TRUE'}`);
    lines.push(`FRONT_LENGTH=${params.connection?.frontLength || 50}`);
    lines.push(`REAR_CONNECTION=${params.connection?.rearConnection || 'TRUE'}`);
    lines.push(`REAR_LENGTH=${params.connection?.rearLength || 50}`);
    lines.push(`CONNECTION_TYPE=${params.connection?.type || 'LINEAR'}`);
    lines.push('');

    // その他のパラメータ
    lines.push('[MISC_SETTINGS]');
    lines.push(`COORDINATE_SYSTEM=${params.misc?.coordinateSystem || 'ABSOLUTE'}`);
    lines.push(`GAUGE_VALUE=${params.misc?.gaugeValue || 1067}`);
    lines.push(`TEMPERATURE=${params.misc?.temperature || 20}`);
    lines.push(`WEATHER=${params.misc?.weather || 'CLEAR'}`);
    lines.push(`MEMO=${params.misc?.memo || ''}`);
    lines.push('');

    // フッター
    lines.push('*END_OF_PARAMETERS');

    return lines.join('\n');
  }

  /**
   * PRMファイルを読み込んでパラメータオブジェクトに変換
   * @param {string} filePath - PRMファイルパス
   * @returns {Promise<Object>} パラメータオブジェクト
   */
  async importParameters(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    return this.parsePRMContent(content);
  }

  /**
   * PRM内容をパース
   * @param {string} content - PRMファイル内容
   * @returns {Object} パラメータオブジェクト
   */
  parsePRMContent(content) {
    const lines = content.split('\n');
    const params = {
      restoration: {},
      planLine: {},
      curve: { elements: [] },
      verticalCurve: {},
      restriction: { points: [] },
      mtt: {},
      output: {},
      handMeasurement: {},
      connection: {},
      misc: {},
      workSection: {}
    };

    let currentSection = null;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // コメントまたは空行をスキップ
      if (trimmedLine.startsWith('*') || trimmedLine === '') {
        continue;
      }

      // セクションヘッダー
      if (trimmedLine.startsWith('[') && trimmedLine.endsWith(']')) {
        currentSection = trimmedLine.slice(1, -1);
        continue;
      }

      // パラメータ行
      const [key, value] = trimmedLine.split('=').map(s => s.trim());

      if (!key || value === undefined) continue;

      // セクションごとの処理
      switch (currentSection) {
        case 'WORK_SECTION':
          params.workSection[this.camelCase(key)] = this.parseValue(value);
          break;

        case 'RESTORATION_WAVE':
          params.restoration[this.camelCase(key)] = this.parseValue(value);
          break;

        case 'PLAN_LINE':
          params.planLine[this.camelCase(key)] = this.parseValue(value);
          break;

        case 'CURVE_ELEMENTS':
          if (key.startsWith('CURVE_')) {
            const curveData = value.split(',');
            params.curve.elements.push({
              startKm: parseFloat(curveData[0]),
              endKm: parseFloat(curveData[1]),
              radius: parseFloat(curveData[2]),
              direction: curveData[3],
              cant: parseFloat(curveData[4] || 0)
            });
          } else {
            params.curve[this.camelCase(key)] = this.parseValue(value);
          }
          break;

        case 'VERTICAL_CURVE':
          params.verticalCurve[this.camelCase(key)] = this.parseValue(value);
          break;

        case 'MOVEMENT_RESTRICTION':
          if (key.startsWith('RESTRICTION_')) {
            const restrictionData = value.split(',');
            params.restriction.points.push({
              startKm: parseFloat(restrictionData[0]),
              endKm: parseFloat(restrictionData[1]),
              direction: restrictionData[2],
              amount: parseFloat(restrictionData[3]),
              isFixed: restrictionData[4] === 'FIXED'
            });
          } else {
            params.restriction[this.camelCase(key)] = this.parseValue(value);
          }
          break;

        case 'MTT_SETTINGS':
          params.mtt[this.camelCase(key)] = this.parseValue(value);
          break;

        case 'OUTPUT_SETTINGS':
          params.output[this.camelCase(key)] = this.parseValue(value);
          break;

        case 'HAND_MEASUREMENT':
          params.handMeasurement[this.camelCase(key)] = this.parseValue(value);
          break;

        case 'CONNECTION_SETTINGS':
          params.connection[this.camelCase(key)] = this.parseValue(value);
          break;

        case 'MISC_SETTINGS':
          params.misc[this.camelCase(key)] = this.parseValue(value);
          break;
      }
    }

    return params;
  }

  /**
   * 値のパース（型変換）
   * @param {string} value - 文字列値
   * @returns {any} 適切な型に変換された値
   */
  parseValue(value) {
    // ブール値
    if (value === 'TRUE') return true;
    if (value === 'FALSE') return false;

    // 数値
    const num = Number(value);
    if (!isNaN(num) && value !== '') return num;

    // 文字列
    return value;
  }

  /**
   * スネークケースをキャメルケースに変換
   * @param {string} str - スネークケース文字列
   * @returns {string} キャメルケース文字列
   */
  camelCase(str) {
    return str.toLowerCase().replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
  }

  /**
   * ファイル名を生成
   * @param {Object} workSection - 作業区間情報
   * @returns {string} ファイル名
   */
  generateFileName(workSection) {
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '');
    const prefix = workSection.filePrefix || 'PARAM';

    return `${prefix}_${date}_${time}${this.fileExtension}`;
  }

  /**
   * 既存のパラメータファイルを検索
   * @param {string} directory - 検索ディレクトリ
   * @returns {Promise<Array>} PRMファイル一覧
   */
  async findParameterFiles(directory) {
    const files = await fs.readdir(directory);
    return files.filter(file => file.endsWith(this.fileExtension))
      .map(file => path.join(directory, file));
  }
}

module.exports = PRMExporter;