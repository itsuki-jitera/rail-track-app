/**
 * 前後接続処理（境界接続）
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」に基づく実装
 * - 作業区間の前後での移動量接続
 * - 線形/曲線補間による滑らかな接続
 * - MTT機械特性を考慮した接続処理
 */

class BoundaryConnection {
  constructor(options = {}) {
    this.frontLength = options.frontLength || 50;     // 前方接続長 (m)
    this.rearLength = options.rearLength || 50;       // 後方接続長 (m)
    this.connectionType = options.connectionType || 'cubic'; // linear, quadratic, cubic, cosine
    this.mttType = options.mttType || '08-475';       // MTT種別
    this.verbose = options.verbose !== false;
  }

  /**
   * 移動量データに前後接続処理を適用
   * @param {Array} movementData - 移動量データ配列
   * @param {Object} workSection - 作業区間情報
   * @param {Object} options - 接続オプション
   * @returns {Array} 接続処理済みの移動量データ
   */
  applyBoundaryConnection(movementData, workSection, options = {}) {
    if (!movementData || movementData.length === 0) {
      return movementData;
    }

    const connectionOptions = {
      ...this,
      ...options
    };

    // データをコピー（元データを変更しない）
    let connectedData = JSON.parse(JSON.stringify(movementData));

    // 前方接続処理
    if (connectionOptions.applyFront !== false) {
      connectedData = this.applyFrontConnection(
        connectedData,
        workSection.startKm,
        connectionOptions
      );
    }

    // 後方接続処理
    if (connectionOptions.applyRear !== false) {
      connectedData = this.applyRearConnection(
        connectedData,
        workSection.endKm,
        connectionOptions
      );
    }

    // MTT機械特性補正
    if (connectionOptions.applyMttCorrection !== false) {
      connectedData = this.applyMttCharacteristics(
        connectedData,
        connectionOptions
      );
    }

    return connectedData;
  }

  /**
   * 前方接続処理
   * @param {Array} data - 移動量データ
   * @param {number} startKm - 作業開始位置 (m)
   * @param {Object} options - 接続オプション
   * @returns {Array} 前方接続処理済みデータ
   */
  applyFrontConnection(data, startKm, options) {
    const connectionLength = options.frontLength || this.frontLength;
    const connectionType = options.connectionType || this.connectionType;

    // 接続区間のデータを抽出
    const connectionEndPos = startKm + connectionLength;
    const connectionData = data.filter(d =>
      d.position >= startKm && d.position <= connectionEndPos
    );

    if (connectionData.length === 0) {
      return data;
    }

    // 接続終了点の移動量を取得
    const endPoint = connectionData[connectionData.length - 1];
    const endLateralMovement = endPoint.lateralMovement || 0;
    const endVerticalMovement = endPoint.verticalMovement || 0;

    // 接続関数を適用
    connectionData.forEach(point => {
      const relativePos = (point.position - startKm) / connectionLength;
      const factor = this.getConnectionFactor(relativePos, connectionType);

      // 横移動量の接続
      if (point.lateralMovement !== undefined) {
        point.lateralMovementOriginal = point.lateralMovement;
        point.lateralMovement = endLateralMovement * factor;
      }

      // 縦移動量の接続
      if (point.verticalMovement !== undefined) {
        point.verticalMovementOriginal = point.verticalMovement;
        point.verticalMovement = endVerticalMovement * factor;
      }

      // 接続フラグを設定
      point.connectionType = 'front';
      point.connectionFactor = factor;
    });

    // データを更新
    data.forEach((point, index) => {
      const connectedPoint = connectionData.find(c => c.position === point.position);
      if (connectedPoint) {
        data[index] = connectedPoint;
      }
    });

    if (this.verbose) {
      console.log(`前方接続処理完了: ${startKm}m - ${connectionEndPos}m (${connectionType})`);
    }

    return data;
  }

  /**
   * 後方接続処理
   * @param {Array} data - 移動量データ
   * @param {number} endKm - 作業終了位置 (m)
   * @param {Object} options - 接続オプション
   * @returns {Array} 後方接続処理済みデータ
   */
  applyRearConnection(data, endKm, options) {
    const connectionLength = options.rearLength || this.rearLength;
    const connectionType = options.connectionType || this.connectionType;

    // 接続区間のデータを抽出
    const connectionStartPos = endKm - connectionLength;
    const connectionData = data.filter(d =>
      d.position >= connectionStartPos && d.position <= endKm
    );

    if (connectionData.length === 0) {
      return data;
    }

    // 接続開始点の移動量を取得
    const startPoint = connectionData[0];
    const startLateralMovement = startPoint.lateralMovement || 0;
    const startVerticalMovement = startPoint.verticalMovement || 0;

    // 接続関数を適用
    connectionData.forEach(point => {
      const relativePos = (endKm - point.position) / connectionLength;
      const factor = this.getConnectionFactor(relativePos, connectionType);

      // 横移動量の接続
      if (point.lateralMovement !== undefined) {
        point.lateralMovementOriginal = point.lateralMovement;
        point.lateralMovement = startLateralMovement * factor;
      }

      // 縦移動量の接続
      if (point.verticalMovement !== undefined) {
        point.verticalMovementOriginal = point.verticalMovement;
        point.verticalMovement = startVerticalMovement * factor;
      }

      // 接続フラグを設定
      point.connectionType = 'rear';
      point.connectionFactor = factor;
    });

    // データを更新
    data.forEach((point, index) => {
      const connectedPoint = connectionData.find(c => c.position === point.position);
      if (connectedPoint) {
        data[index] = connectedPoint;
      }
    });

    if (this.verbose) {
      console.log(`後方接続処理完了: ${connectionStartPos}m - ${endKm}m (${connectionType})`);
    }

    return data;
  }

  /**
   * 接続係数を計算
   * @param {number} relativePos - 相対位置 (0-1)
   * @param {string} type - 接続タイプ
   * @returns {number} 接続係数 (0-1)
   */
  getConnectionFactor(relativePos, type) {
    // 位置を0-1にクランプ
    const t = Math.max(0, Math.min(1, relativePos));

    switch (type) {
      case 'linear':
        // 線形接続
        return t;

      case 'quadratic':
        // 2次曲線接続（イーズイン）
        return t * t;

      case 'cubic':
        // 3次曲線接続（スムーズステップ）
        return t * t * (3 - 2 * t);

      case 'cosine':
        // コサインカーブ接続
        return (1 - Math.cos(t * Math.PI)) / 2;

      case 'exponential':
        // 指数関数接続
        return Math.pow(t, 2.5);

      case 'mtt':
        // MTT機械特性を考慮した接続
        return this.getMttConnectionFactor(t);

      default:
        // デフォルトは3次曲線
        return t * t * (3 - 2 * t);
    }
  }

  /**
   * MTT機械特性を考慮した接続係数
   * @param {number} t - 相対位置 (0-1)
   * @returns {number} 接続係数
   */
  getMttConnectionFactor(t) {
    // MTT種別に応じた接続特性
    switch (this.mttType) {
      case '08-475':
      case '08-275':
        // 3点式タンピング特性
        return Math.pow(t, 2.2) * (3 - 2 * Math.pow(t, 0.8));

      case '09-16':
      case '09-32':
        // 4点式タンピング特性
        return Math.pow(t, 2.5) * (3.5 - 2.5 * Math.pow(t, 0.7));

      case 'MTT-15':
        // 新型機特性
        return t * t * t * (10 - 15 * t + 6 * t * t);

      default:
        // 標準特性
        return t * t * (3 - 2 * t);
    }
  }

  /**
   * MTT機械特性補正を適用
   * @param {Array} data - 移動量データ
   * @param {Object} options - 補正オプション
   * @returns {Array} 補正済みデータ
   */
  applyMttCharacteristics(data, options) {
    const mttType = options.mttType || this.mttType;

    // MTT種別に応じた補正パラメータ
    const mttParams = this.getMttParameters(mttType);

    data.forEach(point => {
      // 接続区間のみ補正を適用
      if (point.connectionType) {
        // D点誘導量の影響を考慮
        const dPointEffect = this.calculateDPointEffect(
          point.position,
          mttParams.dPointDistance
        );

        // C点補正値の影響を考慮
        const cPointEffect = this.calculateCPointEffect(
          point.position,
          mttParams.cPointDistance
        );

        // 補正を適用
        if (point.lateralMovement !== undefined) {
          point.lateralMovement *= (1 + dPointEffect * 0.1);
        }

        if (point.verticalMovement !== undefined) {
          point.verticalMovement *= (1 + cPointEffect * 0.15);
        }
      }
    });

    return data;
  }

  /**
   * MTTパラメータを取得
   * @param {string} mttType - MTT種別
   * @returns {Object} MTTパラメータ
   */
  getMttParameters(mttType) {
    const params = {
      '08-475': {
        dPointDistance: 11.2,  // D点距離 (m)
        cPointDistance: 5.6,   // C点距離 (m)
        liftingPoints: 3,      // こう上点数
        liningPoints: 2        // 通り整正点数
      },
      '08-275': {
        dPointDistance: 9.8,
        cPointDistance: 4.9,
        liftingPoints: 3,
        liningPoints: 2
      },
      '09-16': {
        dPointDistance: 12.0,
        cPointDistance: 6.0,
        liftingPoints: 4,
        liningPoints: 2
      },
      '09-32': {
        dPointDistance: 13.5,
        cPointDistance: 6.75,
        liftingPoints: 4,
        liningPoints: 3
      },
      'MTT-15': {
        dPointDistance: 15.0,
        cPointDistance: 7.5,
        liftingPoints: 4,
        liningPoints: 3
      }
    };

    return params[mttType] || params['08-475'];
  }

  /**
   * D点効果を計算
   * @param {number} position - 位置
   * @param {number} dPointDistance - D点距離
   * @returns {number} D点効果係数
   */
  calculateDPointEffect(position, dPointDistance) {
    // 簡略化されたD点影響モデル
    const relativePos = (position % dPointDistance) / dPointDistance;
    return Math.sin(relativePos * Math.PI) * 0.5;
  }

  /**
   * C点効果を計算
   * @param {number} position - 位置
   * @param {number} cPointDistance - C点距離
   * @returns {number} C点効果係数
   */
  calculateCPointEffect(position, cPointDistance) {
    // 簡略化されたC点影響モデル
    const relativePos = (position % cPointDistance) / cPointDistance;
    return Math.cos(relativePos * Math.PI * 2) * 0.3;
  }

  /**
   * 接続処理の検証
   * @param {Array} data - 接続処理済みデータ
   * @returns {Object} 検証結果
   */
  validateConnection(data) {
    const validation = {
      valid: true,
      warnings: [],
      info: {}
    };

    // 接続区間のデータを抽出
    const frontConnection = data.filter(d => d.connectionType === 'front');
    const rearConnection = data.filter(d => d.connectionType === 'rear');

    // 前方接続の検証
    if (frontConnection.length > 0) {
      const maxMovement = Math.max(
        ...frontConnection.map(d => Math.abs(d.lateralMovement || 0))
      );

      if (maxMovement > 50) {
        validation.warnings.push(`前方接続区間の最大移動量が大きい: ${maxMovement.toFixed(1)}mm`);
      }

      validation.info.frontConnectionLength = frontConnection.length;
      validation.info.frontMaxMovement = maxMovement;
    }

    // 後方接続の検証
    if (rearConnection.length > 0) {
      const maxMovement = Math.max(
        ...rearConnection.map(d => Math.abs(d.lateralMovement || 0))
      );

      if (maxMovement > 50) {
        validation.warnings.push(`後方接続区間の最大移動量が大きい: ${maxMovement.toFixed(1)}mm`);
      }

      validation.info.rearConnectionLength = rearConnection.length;
      validation.info.rearMaxMovement = maxMovement;
    }

    // 連続性チェック
    for (let i = 1; i < data.length; i++) {
      const prev = data[i - 1];
      const curr = data[i];

      const lateralDiff = Math.abs(
        (curr.lateralMovement || 0) - (prev.lateralMovement || 0)
      );

      const verticalDiff = Math.abs(
        (curr.verticalMovement || 0) - (prev.verticalMovement || 0)
      );

      // 急激な変化を検出
      if (lateralDiff > 10) {
        validation.warnings.push(
          `位置 ${curr.position}m で横移動量が急変: ${lateralDiff.toFixed(1)}mm`
        );
      }

      if (verticalDiff > 10) {
        validation.warnings.push(
          `位置 ${curr.position}m で縦移動量が急変: ${verticalDiff.toFixed(1)}mm`
        );
      }
    }

    validation.valid = validation.warnings.length === 0;

    return validation;
  }

  /**
   * 接続処理結果の統計を取得
   * @param {Array} data - 接続処理済みデータ
   * @returns {Object} 統計情報
   */
  getConnectionStatistics(data) {
    const stats = {
      totalPoints: data.length,
      frontConnectionPoints: 0,
      rearConnectionPoints: 0,
      maxLateralMovement: 0,
      maxVerticalMovement: 0,
      avgLateralMovement: 0,
      avgVerticalMovement: 0
    };

    let lateralSum = 0;
    let verticalSum = 0;
    let lateralCount = 0;
    let verticalCount = 0;

    data.forEach(point => {
      // 接続タイプ別カウント
      if (point.connectionType === 'front') {
        stats.frontConnectionPoints++;
      } else if (point.connectionType === 'rear') {
        stats.rearConnectionPoints++;
      }

      // 移動量統計
      if (point.lateralMovement !== undefined) {
        const absLateral = Math.abs(point.lateralMovement);
        stats.maxLateralMovement = Math.max(stats.maxLateralMovement, absLateral);
        lateralSum += absLateral;
        lateralCount++;
      }

      if (point.verticalMovement !== undefined) {
        const absVertical = Math.abs(point.verticalMovement);
        stats.maxVerticalMovement = Math.max(stats.maxVerticalMovement, absVertical);
        verticalSum += absVertical;
        verticalCount++;
      }
    });

    // 平均値計算
    if (lateralCount > 0) {
      stats.avgLateralMovement = lateralSum / lateralCount;
    }

    if (verticalCount > 0) {
      stats.avgVerticalMovement = verticalSum / verticalCount;
    }

    return stats;
  }
}

module.exports = BoundaryConnection;