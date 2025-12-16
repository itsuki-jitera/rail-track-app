/**
 * 波長範囲動的計算モジュール
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」P8に基づく
 * 復元波長範囲を最高列車速度に応じて動的に計算
 */

class WavelengthCalculator {
  constructor() {
    // デフォルト値
    this.defaultMinWavelength = {
      conventional: 6.0,       // 在来線標準
      shinkansen: 3.5,         // 新幹線最小
      shinkansenStandard: 6.0, // 新幹線標準
      alignmentTrial: 15.0     // 通り試行的下限
    };

    // 速度係数（最高速度に対する倍率）
    this.speedMultiplier = {
      minimum: 1.5,  // 最小倍率
      standard: 1.7, // 標準倍率
      maximum: 2.0   // 最大倍率
    };
  }

  /**
   * 波長範囲を計算
   * @param {Object} options - 計算オプション
   * @returns {Object} 波長範囲
   */
  calculateWavelengthRange(options = {}) {
    const {
      maxSpeed = 130,              // 最高列車速度 (km/h)
      railType = 'conventional',   // 路線種別
      dataType = 'level',          // データ種別（高低/通り）
      multiplierType = 'standard', // 倍率タイプ
      useTrialMode = false         // 試行モード（通り15m下限）
    } = options;

    // 下限波長の決定
    const lowerWavelength = this.calculateLowerWavelength(
      railType,
      dataType,
      useTrialMode
    );

    // 上限波長の計算
    const upperWavelength = this.calculateUpperWavelength(
      maxSpeed,
      multiplierType
    );

    // 推奨設定の生成
    const recommendations = this.generateRecommendations(
      maxSpeed,
      railType,
      dataType
    );

    return {
      lowerWavelength,
      upperWavelength,
      maxSpeed,
      railType,
      dataType,
      recommendations,
      formula: this.getCalculationFormula(multiplierType)
    };
  }

  /**
   * 下限波長を計算
   * @param {string} railType - 路線種別
   * @param {string} dataType - データ種別
   * @param {boolean} useTrialMode - 試行モード
   * @returns {number} 下限波長 (m)
   */
  calculateLowerWavelength(railType, dataType, useTrialMode) {
    // 新幹線の場合
    if (railType === 'shinkansen') {
      if (dataType === 'level') {
        // 高低: 3.5m～6mで選択可能
        return this.defaultMinWavelength.shinkansenStandard;
      } else if (dataType === 'alignment') {
        // 通り: 6mまたは15m（試行）
        return useTrialMode ?
          this.defaultMinWavelength.alignmentTrial :
          this.defaultMinWavelength.shinkansenStandard;
      }
    }

    // 在来線の場合
    if (dataType === 'alignment' && useTrialMode) {
      // 通りの試行的15m下限
      return this.defaultMinWavelength.alignmentTrial;
    }

    // 標準は6m
    return this.defaultMinWavelength.conventional;
  }

  /**
   * 上限波長を計算
   * @param {number} maxSpeed - 最高列車速度 (km/h)
   * @param {string} multiplierType - 倍率タイプ
   * @returns {number} 上限波長 (m)
   */
  calculateUpperWavelength(maxSpeed, multiplierType) {
    const multiplier = this.speedMultiplier[multiplierType] || this.speedMultiplier.standard;

    // 上限波長 = 最高列車速度 × 倍率
    // ただし、最小40m、最大200mの範囲内に制限
    const calculated = maxSpeed * multiplier;

    return Math.max(40, Math.min(200, calculated));
  }

  /**
   * 路線種別に応じた標準速度を取得
   * @param {string} railType - 路線種別
   * @returns {number} 標準速度 (km/h)
   */
  getStandardSpeed(railType) {
    const standardSpeeds = {
      'shinkansen': 270,      // 新幹線標準
      'shinkansen_max': 320,  // 新幹線最高
      'conventional': 130,    // 在来線特急
      'suburban': 110,        // 近郊線
      'local': 85,           // 地方線
      'freight': 95          // 貨物線
    };

    return standardSpeeds[railType] || standardSpeeds.conventional;
  }

  /**
   * 推奨設定を生成
   * @param {number} maxSpeed - 最高列車速度
   * @param {string} railType - 路線種別
   * @param {string} dataType - データ種別
   * @returns {Object} 推奨設定
   */
  generateRecommendations(maxSpeed, railType, dataType) {
    const recommendations = {
      standard: {},
      alternative: [],
      notes: []
    };

    // 標準推奨設定
    recommendations.standard = {
      lowerWavelength: this.calculateLowerWavelength(railType, dataType, false),
      upperWavelength: this.calculateUpperWavelength(maxSpeed, 'standard'),
      description: '標準設定'
    };

    // 代替設定
    // 保守的設定（上限を大きく）
    recommendations.alternative.push({
      lowerWavelength: recommendations.standard.lowerWavelength,
      upperWavelength: this.calculateUpperWavelength(maxSpeed, 'maximum'),
      description: '保守的設定（長波長重視）'
    });

    // 詳細設定（下限を小さく）
    if (railType === 'shinkansen' && dataType === 'level') {
      recommendations.alternative.push({
        lowerWavelength: this.defaultMinWavelength.shinkansen,
        upperWavelength: recommendations.standard.upperWavelength,
        description: '詳細設定（3.5m下限）'
      });
    }

    // 試行設定（通り15m）
    if (dataType === 'alignment') {
      recommendations.alternative.push({
        lowerWavelength: this.defaultMinWavelength.alignmentTrial,
        upperWavelength: recommendations.standard.upperWavelength,
        description: '試行設定（通り15m下限）'
      });
    }

    // 注記
    if (maxSpeed > 200) {
      recommendations.notes.push('高速運転区間のため、上限波長を大きく設定することを推奨');
    }

    if (railType === 'shinkansen') {
      recommendations.notes.push('新幹線の場合、3.5m-6mの下限選択が可能');
    }

    if (dataType === 'alignment') {
      recommendations.notes.push('通りデータの場合、試行的に15m下限の選択が可能');
    }

    return recommendations;
  }

  /**
   * 計算式を取得
   * @param {string} multiplierType - 倍率タイプ
   * @returns {string} 計算式
   */
  getCalculationFormula(multiplierType) {
    const multiplier = this.speedMultiplier[multiplierType] || this.speedMultiplier.standard;
    return `上限波長 = 最高列車速度 × ${multiplier}`;
  }

  /**
   * 波長範囲の検証
   * @param {number} lower - 下限波長
   * @param {number} upper - 上限波長
   * @returns {Object} 検証結果
   */
  validateWavelengthRange(lower, upper) {
    const validation = {
      valid: true,
      errors: [],
      warnings: []
    };

    // 下限チェック
    if (lower < 3.5) {
      validation.errors.push('下限波長は3.5m以上である必要があります');
      validation.valid = false;
    }

    if (lower > 20) {
      validation.warnings.push('下限波長が20mを超えています。短波長成分が除去される可能性があります');
    }

    // 上限チェック
    if (upper < 40) {
      validation.errors.push('上限波長は40m以上である必要があります');
      validation.valid = false;
    }

    if (upper > 200) {
      validation.warnings.push('上限波長が200mを超えています。計算時間が増加する可能性があります');
    }

    // 範囲チェック
    if (upper <= lower) {
      validation.errors.push('上限波長は下限波長より大きい必要があります');
      validation.valid = false;
    }

    const ratio = upper / lower;
    if (ratio < 5) {
      validation.warnings.push('波長範囲が狭い可能性があります（推奨比率: 5倍以上）');
    }

    return validation;
  }

  /**
   * プリセット設定を取得
   * @param {string} presetName - プリセット名
   * @returns {Object} プリセット設定
   */
  getPreset(presetName) {
    const presets = {
      'conventional_standard': {
        name: '在来線標準',
        maxSpeed: 130,
        railType: 'conventional',
        lowerWavelength: 6,
        upperWavelength: 220,
        description: '在来線特急標準設定'
      },
      'conventional_local': {
        name: '在来線普通',
        maxSpeed: 85,
        railType: 'conventional',
        lowerWavelength: 6,
        upperWavelength: 145,
        description: '在来線普通列車設定'
      },
      'shinkansen_standard': {
        name: '新幹線標準',
        maxSpeed: 270,
        railType: 'shinkansen',
        lowerWavelength: 6,
        upperWavelength: 460,
        description: '新幹線標準設定'
      },
      'shinkansen_max': {
        name: '新幹線最高速',
        maxSpeed: 320,
        railType: 'shinkansen',
        lowerWavelength: 6,
        upperWavelength: 540,
        description: '新幹線最高速度設定'
      },
      'shinkansen_detail': {
        name: '新幹線詳細',
        maxSpeed: 270,
        railType: 'shinkansen',
        lowerWavelength: 3.5,
        upperWavelength: 460,
        description: '新幹線詳細解析設定（3.5m下限）'
      },
      'freight': {
        name: '貨物線',
        maxSpeed: 95,
        railType: 'freight',
        lowerWavelength: 6,
        upperWavelength: 160,
        description: '貨物列車設定'
      }
    };

    return presets[presetName] || presets.conventional_standard;
  }

  /**
   * 速度から路線種別を推定
   * @param {number} maxSpeed - 最高速度
   * @returns {string} 推定路線種別
   */
  estimateRailType(maxSpeed) {
    if (maxSpeed >= 200) {
      return 'shinkansen';
    } else if (maxSpeed >= 120) {
      return 'conventional';
    } else if (maxSpeed >= 100) {
      return 'suburban';
    } else {
      return 'local';
    }
  }

  /**
   * 周波数領域での波長を計算
   * @param {number} wavelength - 波長 (m)
   * @param {number} samplingInterval - サンプリング間隔 (m)
   * @returns {number} 周波数 (1/m)
   */
  wavelengthToFrequency(wavelength, samplingInterval = 0.25) {
    return 1 / wavelength;
  }

  /**
   * FFTビン数を計算
   * @param {number} dataLength - データ長
   * @param {number} samplingInterval - サンプリング間隔
   * @param {number} wavelength - 波長
   * @returns {number} FFTビン番号
   */
  calculateFFTBin(dataLength, samplingInterval, wavelength) {
    const frequency = this.wavelengthToFrequency(wavelength);
    const nyquist = 1 / (2 * samplingInterval);
    const binCount = Math.floor(dataLength / 2);

    return Math.round(frequency * binCount / nyquist);
  }
}

module.exports = WavelengthCalculator;