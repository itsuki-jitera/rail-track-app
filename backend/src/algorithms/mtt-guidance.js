/**
 * MTT誘導補正システム
 * MTT（Multiple Tie Tamper）機種別のパラメータ管理とフロント位置最適化
 * 文書「057_復元波形を用いた軌道整正計算」の仕様に基づく実装
 */

class MTTGuidanceSystem {
  constructor(options = {}) {
    // MTT機種別パラメータ
    this.mttParameters = {
      // 08-32型（標準型）
      '08-32': {
        name: '08-32型',
        manufacturer: 'Plasser & Theurer',
        frontOffset: 12.5,        // フロント位置オフセット (m)
        workingSpeed: 0.8,         // 作業速度 (km/h)
        liftCapacity: 50,          // 最大こう上量 (mm)
        alignmentCapacity: 40,     // 最大通り移動量 (mm)
        tampingUnits: 32,          // タンピングユニット数
        measurementChord: 10,      // 測定弦長 (m)
        correctionFactors: {
          level: 1.0,
          alignment: 1.05,
          cant: 1.0,
          gauge: 1.0
        }
      },
      // 09-32型（新型）
      '09-32': {
        name: '09-32型',
        manufacturer: 'Plasser & Theurer',
        frontOffset: 13.0,
        workingSpeed: 1.0,
        liftCapacity: 60,
        alignmentCapacity: 45,
        tampingUnits: 32,
        measurementChord: 10,
        correctionFactors: {
          level: 1.0,
          alignment: 1.03,
          cant: 1.0,
          gauge: 1.0
        }
      },
      // DGS-90型（動的安定装置付き）
      'DGS-90': {
        name: 'DGS-90型',
        manufacturer: 'Matisa',
        frontOffset: 14.5,
        workingSpeed: 0.6,
        liftCapacity: 55,
        alignmentCapacity: 42,
        tampingUnits: 24,
        measurementChord: 12,
        correctionFactors: {
          level: 0.98,
          alignment: 1.08,
          cant: 1.02,
          gauge: 1.0
        }
      },
      // マルタイ（マルチプルタイタンパー）
      'multi-tie': {
        name: 'マルチプルタイタンパー',
        manufacturer: 'Various',
        frontOffset: 11.5,
        workingSpeed: 0.5,
        liftCapacity: 45,
        alignmentCapacity: 35,
        tampingUnits: 16,
        measurementChord: 10,
        correctionFactors: {
          level: 1.02,
          alignment: 1.06,
          cant: 1.0,
          gauge: 1.0
        }
      },
      // カスタム設定
      'custom': {
        name: 'カスタム',
        manufacturer: 'User Defined',
        frontOffset: options.frontOffset || 12.0,
        workingSpeed: options.workingSpeed || 0.7,
        liftCapacity: options.liftCapacity || 50,
        alignmentCapacity: options.alignmentCapacity || 40,
        tampingUnits: options.tampingUnits || 24,
        measurementChord: options.measurementChord || 10,
        correctionFactors: options.correctionFactors || {
          level: 1.0,
          alignment: 1.0,
          cant: 1.0,
          gauge: 1.0
        }
      }
    };

    // デフォルトMTT種別
    this.defaultMttType = options.defaultMttType || '08-32';

    // 作業方向
    this.workDirections = {
      forward: 'forward',    // 順方向
      backward: 'backward'   // 逆方向
    };
  }

  /**
   * MTT種別に応じた補正を適用
   * @param {Array} movementData - 移動量データ [{distance, tamping, lining}]
   * @param {string} mttType - MTT機種
   * @param {string} workDirection - 作業方向
   * @param {Object} options - 追加オプション
   * @returns {Object} 補正済みデータ
   */
  applyMTTCorrection(movementData, mttType = '08-32', workDirection = 'forward', options = {}) {
    const mttParams = this.mttParameters[mttType];
    if (!mttParams) {
      throw new Error(`未知のMTT種別: ${mttType}`);
    }

    console.log(`MTT補正適用: ${mttParams.name}`);
    console.log(`作業方向: ${workDirection}`);

    // フロント位置の最適化
    const optimizedFrontOffset = this.optimizeFrontPosition(
      movementData,
      mttParams,
      workDirection,
      options
    );

    // 補正データの生成
    const correctedData = movementData.map((point, index) => {
      // フロント位置補正
      const frontCorrectedDistance = this.applyFrontOffset(
        point.distance,
        optimizedFrontOffset,
        workDirection
      );

      // 機種別補正係数の適用
      const correctedTamping = point.tamping * mttParams.correctionFactors.level;
      const correctedLining = point.lining * mttParams.correctionFactors.alignment;

      // 容量制限チェック
      const limitedTamping = this.applyCapacityLimit(
        correctedTamping,
        mttParams.liftCapacity
      );
      const limitedLining = this.applyCapacityLimit(
        correctedLining,
        mttParams.alignmentCapacity
      );

      return {
        originalDistance: point.distance,
        distance: frontCorrectedDistance,
        originalTamping: point.tamping,
        originalLining: point.lining,
        tamping: limitedTamping,
        lining: limitedLining,
        frontOffset: optimizedFrontOffset,
        mttType: mttType,
        capacityLimited: {
          tamping: Math.abs(correctedTamping) > mttParams.liftCapacity,
          lining: Math.abs(correctedLining) > mttParams.alignmentCapacity
        }
      };
    });

    // 作業効率の計算
    const efficiency = this.calculateWorkEfficiency(
      correctedData,
      mttParams,
      options.plannedDuration
    );

    // 統計情報
    const statistics = this.calculateStatistics(movementData, correctedData);

    return {
      success: true,
      data: correctedData,
      mttParameters: mttParams,
      optimizedFrontOffset,
      workDirection,
      efficiency,
      statistics,
      recommendations: this.generateRecommendations(statistics, mttParams)
    };
  }

  /**
   * フロント位置の最適化計算
   * @private
   */
  optimizeFrontPosition(movementData, mttParams, workDirection, options = {}) {
    const {
      optimizationMethod = 'energy',  // 'energy' | 'peak' | 'rms'
      searchRange = 5.0,              // 探索範囲 (m)
      searchStep = 0.5                // 探索ステップ (m)
    } = options;

    let bestOffset = mttParams.frontOffset;
    let bestScore = Infinity;

    // 探索範囲内で最適なオフセットを検索
    for (let offset = mttParams.frontOffset - searchRange;
         offset <= mttParams.frontOffset + searchRange;
         offset += searchStep) {

      let score = 0;

      switch (optimizationMethod) {
        case 'energy':
          // エネルギー最小化
          score = movementData.reduce((sum, point) => {
            const adjustedDistance = this.applyFrontOffset(
              point.distance,
              offset,
              workDirection
            );
            // 移動量の2乗和（エネルギー）
            return sum + point.tamping ** 2 + point.lining ** 2;
          }, 0);
          break;

        case 'peak':
          // ピーク値最小化
          const peaks = movementData.map(point =>
            Math.max(Math.abs(point.tamping), Math.abs(point.lining))
          );
          score = Math.max(...peaks);
          break;

        case 'rms':
          // RMS（二乗平均平方根）最小化
          const sumSquares = movementData.reduce((sum, point) =>
            sum + point.tamping ** 2 + point.lining ** 2, 0
          );
          score = Math.sqrt(sumSquares / movementData.length);
          break;
      }

      if (score < bestScore) {
        bestScore = score;
        bestOffset = offset;
      }
    }

    console.log(`最適化されたフロント位置: ${bestOffset.toFixed(2)}m`);
    console.log(`最適化スコア: ${bestScore.toFixed(3)}`);

    return bestOffset;
  }

  /**
   * フロント位置オフセットの適用
   * @private
   */
  applyFrontOffset(distance, frontOffset, workDirection) {
    if (workDirection === 'backward') {
      return distance - frontOffset;
    }
    return distance + frontOffset;
  }

  /**
   * 容量制限の適用
   * @private
   */
  applyCapacityLimit(value, capacity) {
    if (Math.abs(value) > capacity) {
      return Math.sign(value) * capacity;
    }
    return value;
  }

  /**
   * 作業効率の計算
   * @private
   */
  calculateWorkEfficiency(correctedData, mttParams, plannedDuration) {
    const totalLength = correctedData.length * 0.25; // データ間隔0.25m
    const workingTime = totalLength / (mttParams.workingSpeed * 1000 / 60); // 分

    // 容量制限にかかった点の割合
    const limitedPoints = correctedData.filter(d =>
      d.capacityLimited.tamping || d.capacityLimited.lining
    ).length;
    const limitedRatio = (limitedPoints / correctedData.length) * 100;

    // タンピング回数の推定
    const tampingCycles = Math.ceil(totalLength / (mttParams.tampingUnits * 0.6));

    return {
      totalLength,
      estimatedTime: workingTime,
      plannedDuration,
      efficiency: plannedDuration ? (plannedDuration / workingTime) * 100 : null,
      limitedRatio,
      tampingCycles,
      averageSpeed: mttParams.workingSpeed
    };
  }

  /**
   * 統計情報の計算
   * @private
   */
  calculateStatistics(originalData, correctedData) {
    // 元データの統計
    const originalStats = this.calculateBasicStats(
      originalData.map(d => ({ tamping: d.tamping, lining: d.lining }))
    );

    // 補正後データの統計
    const correctedStats = this.calculateBasicStats(
      correctedData.map(d => ({ tamping: d.tamping, lining: d.lining }))
    );

    // 変化率
    const changeRates = {
      tamping: ((correctedStats.tamping.mean - originalStats.tamping.mean) /
                Math.abs(originalStats.tamping.mean)) * 100,
      lining: ((correctedStats.lining.mean - originalStats.lining.mean) /
               Math.abs(originalStats.lining.mean)) * 100
    };

    return {
      original: originalStats,
      corrected: correctedStats,
      changeRates,
      frontOffsetApplied: correctedData[0]?.frontOffset || 0
    };
  }

  /**
   * 基本統計量の計算
   * @private
   */
  calculateBasicStats(data) {
    const tampingValues = data.map(d => d.tamping);
    const liningValues = data.map(d => d.lining);

    const calculateStats = (values) => {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const max = Math.max(...values.map(Math.abs));
      const min = Math.min(...values.map(Math.abs));
      const stdDev = Math.sqrt(
        values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length
      );
      return { mean, max, min, stdDev };
    };

    return {
      tamping: calculateStats(tampingValues),
      lining: calculateStats(liningValues)
    };
  }

  /**
   * 推奨事項の生成
   * @private
   */
  generateRecommendations(statistics, mttParams) {
    const recommendations = [];

    // 容量超過チェック
    if (statistics.corrected.tamping.max > mttParams.liftCapacity) {
      recommendations.push(
        `こう上量が機械容量(${mttParams.liftCapacity}mm)を超えています。複数パスでの作業を検討してください。`
      );
    }

    if (statistics.corrected.lining.max > mttParams.alignmentCapacity) {
      recommendations.push(
        `通り移動量が機械容量(${mttParams.alignmentCapacity}mm)を超えています。段階的な修正を検討してください。`
      );
    }

    // 作業効率
    if (statistics.changeRates.tamping > 20) {
      recommendations.push('こう上補正量が大きいため、作業時間が延長する可能性があります。');
    }

    // フロント位置
    if (Math.abs(statistics.frontOffsetApplied - mttParams.frontOffset) > 2) {
      recommendations.push(
        `フロント位置が標準値から${Math.abs(statistics.frontOffsetApplied - mttParams.frontOffset).toFixed(1)}mずれています。現場での調整が必要です。`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('現在の設定で問題ありません。');
    }

    return recommendations;
  }

  /**
   * MTTパラメータの取得
   */
  getMTTParameters(mttType) {
    return this.mttParameters[mttType];
  }

  /**
   * 利用可能なMTT種別リストの取得
   */
  getAvailableMTTTypes() {
    return Object.keys(this.mttParameters).map(key => ({
      id: key,
      name: this.mttParameters[key].name,
      manufacturer: this.mttParameters[key].manufacturer,
      liftCapacity: this.mttParameters[key].liftCapacity,
      alignmentCapacity: this.mttParameters[key].alignmentCapacity
    }));
  }

  /**
   * カスタムMTTパラメータの設定
   */
  setCustomMTTParameters(params) {
    this.mttParameters.custom = {
      ...this.mttParameters.custom,
      ...params
    };
  }

  /**
   * 作業シミュレーション
   * 実際の作業を想定した詳細なシミュレーション
   */
  simulateWork(movementData, mttType, workDirection, options = {}) {
    const {
      startTime = new Date(),
      weatherConditions = 'normal',  // 'normal' | 'rain' | 'snow'
      trackCondition = 'standard',   // 'standard' | 'poor' | 'excellent'
      operatorSkill = 'experienced'  // 'beginner' | 'experienced' | 'expert'
    } = options;

    const mttParams = this.mttParameters[mttType];

    // 天候による速度調整
    let speedMultiplier = 1.0;
    if (weatherConditions === 'rain') speedMultiplier = 0.8;
    if (weatherConditions === 'snow') speedMultiplier = 0.6;

    // オペレーター技能による効率調整
    let efficiencyMultiplier = 1.0;
    if (operatorSkill === 'beginner') efficiencyMultiplier = 0.7;
    if (operatorSkill === 'expert') efficiencyMultiplier = 1.2;

    // 軌道状態による調整
    let difficultyMultiplier = 1.0;
    if (trackCondition === 'poor') difficultyMultiplier = 1.3;
    if (trackCondition === 'excellent') difficultyMultiplier = 0.9;

    const adjustedSpeed = mttParams.workingSpeed * speedMultiplier * efficiencyMultiplier;
    const totalLength = movementData.length * 0.25; // km
    const estimatedDuration = (totalLength / adjustedSpeed) * difficultyMultiplier; // 時間

    // 作業スケジュール生成
    const schedule = this.generateWorkSchedule(
      startTime,
      estimatedDuration,
      movementData.length
    );

    return {
      mttType,
      workDirection,
      conditions: {
        weather: weatherConditions,
        track: trackCondition,
        operator: operatorSkill
      },
      performance: {
        nominalSpeed: mttParams.workingSpeed,
        adjustedSpeed,
        totalLength,
        estimatedDuration,
        startTime,
        endTime: new Date(startTime.getTime() + estimatedDuration * 3600000)
      },
      schedule,
      adjustmentFactors: {
        speedMultiplier,
        efficiencyMultiplier,
        difficultyMultiplier
      }
    };
  }

  /**
   * 作業スケジュールの生成
   * @private
   */
  generateWorkSchedule(startTime, duration, dataPoints) {
    const schedule = [];
    const segmentCount = Math.ceil(duration); // 1時間ごとのセグメント
    const pointsPerSegment = Math.floor(dataPoints / segmentCount);

    for (let i = 0; i < segmentCount; i++) {
      const segmentStart = new Date(startTime.getTime() + i * 3600000);
      const segmentEnd = new Date(startTime.getTime() + (i + 1) * 3600000);

      schedule.push({
        segment: i + 1,
        startTime: segmentStart,
        endTime: segmentEnd,
        startPoint: i * pointsPerSegment,
        endPoint: Math.min((i + 1) * pointsPerSegment, dataPoints),
        progress: ((i + 1) / segmentCount) * 100
      });
    }

    return schedule;
  }
}

module.exports = MTTGuidanceSystem;