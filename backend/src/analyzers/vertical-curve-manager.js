/**
 * 縦曲線管理システム
 * PDFドキュメント P24-25の仕様に基づく実装
 * 縦断勾配の管理と縦曲線区間の処理
 */

class VerticalCurveManager {
  constructor(options = {}) {
    this.defaultRadius = options.defaultRadius || 10000; // デフォルト縦曲線半径(m)
    this.minRadius = options.minRadius || 5000; // 最小縦曲線半径(m)
    this.maxGradient = options.maxGradient || 35; // 最大勾配(‰)
  }

  /**
   * 縦曲線データを追加
   * @param {Object} curveData - 縦曲線情報
   * @returns {Object} 追加された縦曲線データ
   */
  addVerticalCurve(curveData) {
    const curve = {
      id: this.generateId(),
      startPosition: curveData.startPosition,
      endPosition: curveData.endPosition,
      radius: curveData.radius || this.defaultRadius,
      startGradient: curveData.startGradient, // ‰
      endGradient: curveData.endGradient, // ‰
      type: this.determineType(curveData.startGradient, curveData.endGradient),
      description: curveData.description || ''
    };

    // 検証
    this.validateCurve(curve);

    return curve;
  }

  /**
   * 縦曲線タイプを判定
   */
  determineType(startGradient, endGradient) {
    const change = endGradient - startGradient;

    if (Math.abs(change) < 0.1) {
      return 'straight'; // 直線
    } else if (change > 0) {
      return 'sag'; // サグカーブ（凹型）
    } else {
      return 'crest'; // クレストカーブ（凸型）
    }
  }

  /**
   * 縦曲線の検証
   */
  validateCurve(curve) {
    // 半径チェック
    if (curve.radius < this.minRadius) {
      throw new Error(`縦曲線半径が最小値(${this.minRadius}m)を下回っています`);
    }

    // 勾配チェック
    if (Math.abs(curve.startGradient) > this.maxGradient) {
      throw new Error(`開始勾配が最大値(${this.maxGradient}‰)を超えています`);
    }
    if (Math.abs(curve.endGradient) > this.maxGradient) {
      throw new Error(`終了勾配が最大値(${this.maxGradient}‰)を超えています`);
    }

    // 区間チェック
    if (curve.endPosition <= curve.startPosition) {
      throw new Error('終了位置が開始位置より前になっています');
    }

    return true;
  }

  /**
   * 指定位置の縦断勾配を計算
   * @param {number} position - キロ程(m)
   * @param {Array} curves - 縦曲線データ配列
   * @returns {number} 勾配(‰)
   */
  calculateGradientAtPosition(position, curves) {
    // 該当する縦曲線を検索
    const curve = curves.find(c =>
      position >= c.startPosition && position <= c.endPosition
    );

    if (!curve) {
      // 縦曲線区間外の場合は直近の勾配を使用
      return this.getNearestGradient(position, curves);
    }

    // 縦曲線内の勾配を計算
    return this.interpolateGradient(position, curve);
  }

  /**
   * 縦曲線内の勾配を補間計算
   */
  interpolateGradient(position, curve) {
    const totalLength = curve.endPosition - curve.startPosition;
    const currentLength = position - curve.startPosition;
    const ratio = currentLength / totalLength;

    // 放物線補間
    const gradientChange = curve.endGradient - curve.startGradient;
    const gradient = curve.startGradient + gradientChange * ratio;

    return gradient;
  }

  /**
   * 最も近い勾配を取得
   */
  getNearestGradient(position, curves) {
    if (curves.length === 0) {
      return 0; // デフォルト勾配
    }

    // 位置より前の最も近い縦曲線を検索
    const beforeCurves = curves.filter(c => c.endPosition <= position);
    if (beforeCurves.length > 0) {
      const nearest = beforeCurves.reduce((prev, curr) =>
        curr.endPosition > prev.endPosition ? curr : prev
      );
      return nearest.endGradient;
    }

    // 位置より後の最も近い縦曲線を使用
    const afterCurves = curves.filter(c => c.startPosition > position);
    if (afterCurves.length > 0) {
      const nearest = afterCurves.reduce((prev, curr) =>
        curr.startPosition < prev.startPosition ? curr : prev
      );
      return nearest.startGradient;
    }

    return 0;
  }

  /**
   * 縦曲線を考慮した高低調整量を計算
   * @param {Array} elevationData - 高低データ
   * @param {Array} curves - 縦曲線データ
   * @returns {Array} 調整後の高低データ
   */
  adjustForVerticalCurves(elevationData, curves) {
    const adjusted = [];

    for (let i = 0; i < elevationData.length; i++) {
      const position = elevationData[i].position;
      const originalElevation = elevationData[i].elevation;

      // 縦断勾配による理論高さを計算
      const gradient = this.calculateGradientAtPosition(position, curves);
      const theoreticalElevation = this.calculateTheoreticalElevation(
        position,
        gradient,
        elevationData[0]
      );

      // 実測値と理論値の差を調整量として適用
      const adjustment = theoreticalElevation - originalElevation;

      adjusted.push({
        position: position,
        elevation: originalElevation,
        adjustment: adjustment,
        adjusted: originalElevation + adjustment,
        gradient: gradient
      });
    }

    return adjusted;
  }

  /**
   * 理論高さを計算
   */
  calculateTheoreticalElevation(position, gradient, reference) {
    const distance = position - reference.position;
    const elevationChange = (gradient / 1000) * distance; // ‰をm/mに変換
    return reference.elevation + elevationChange;
  }

  /**
   * 縦曲線区間での移動量制限を計算
   * @param {Object} curve - 縦曲線データ
   * @returns {Object} 移動量制限
   */
  calculateMovementLimits(curve) {
    const limits = {
      vertical: {
        up: 0,
        down: 0
      }
    };

    // 縦曲線タイプによる制限
    switch(curve.type) {
      case 'crest':
        // クレストカーブでは下げ量を制限
        limits.vertical.down = Math.max(
          10, // 最小10mm
          50 * (1 - curve.radius / 20000) // 半径による調整
        );
        limits.vertical.up = 50; // 標準上げ量
        break;

      case 'sag':
        // サグカーブでは上げ量を制限
        limits.vertical.up = Math.max(
          10,
          50 * (1 - curve.radius / 20000)
        );
        limits.vertical.down = 50; // 標準下げ量
        break;

      case 'straight':
      default:
        // 直線区間は標準値
        limits.vertical.up = 50;
        limits.vertical.down = 50;
        break;
    }

    return limits;
  }

  /**
   * 縦曲線テーブルを生成（作業計画用）
   * @param {Array} curves - 縦曲線データ配列
   * @param {Object} workSection - 作業区間
   * @returns {Array} 縦曲線テーブル
   */
  generateCurveTable(curves, workSection) {
    const table = [];
    const relevantCurves = this.filterRelevantCurves(curves, workSection);

    for (const curve of relevantCurves) {
      const entry = {
        no: table.length + 1,
        startKm: (curve.startPosition / 1000).toFixed(3),
        endKm: (curve.endPosition / 1000).toFixed(3),
        length: curve.endPosition - curve.startPosition,
        radius: curve.radius,
        startGradient: curve.startGradient.toFixed(1),
        endGradient: curve.endGradient.toFixed(1),
        type: this.getTypeLabel(curve.type),
        movementLimits: this.calculateMovementLimits(curve),
        notes: this.generateNotes(curve)
      };

      table.push(entry);
    }

    return table;
  }

  /**
   * 作業区間に関連する縦曲線をフィルタ
   */
  filterRelevantCurves(curves, workSection) {
    const bufferStart = workSection.startPosition - workSection.bufferBefore;
    const bufferEnd = workSection.endPosition + workSection.bufferAfter;

    return curves.filter(curve =>
      (curve.startPosition >= bufferStart && curve.startPosition <= bufferEnd) ||
      (curve.endPosition >= bufferStart && curve.endPosition <= bufferEnd) ||
      (curve.startPosition <= bufferStart && curve.endPosition >= bufferEnd)
    );
  }

  /**
   * タイプラベルを取得
   */
  getTypeLabel(type) {
    const labels = {
      'crest': 'クレスト（凸）',
      'sag': 'サグ（凹）',
      'straight': '直線'
    };
    return labels[type] || type;
  }

  /**
   * 注意事項を生成
   */
  generateNotes(curve) {
    const notes = [];

    // 急な縦曲線の場合
    if (curve.radius < 7500) {
      notes.push('急縦曲線注意');
    }

    // 勾配変化が大きい場合
    const gradientChange = Math.abs(curve.endGradient - curve.startGradient);
    if (gradientChange > 20) {
      notes.push('大勾配変化');
    }

    // クレストカーブの場合
    if (curve.type === 'crest' && curve.radius < 10000) {
      notes.push('見通し注意');
    }

    return notes.join('、');
  }

  /**
   * 縦断図データを生成
   * @param {Array} elevationData - 高低データ
   * @param {Array} curves - 縦曲線データ
   * @returns {Object} 縦断図用データ
   */
  generateProfileData(elevationData, curves) {
    const profileData = {
      actual: [],      // 実測高低
      theoretical: [], // 理論高低
      gradient: [],    // 勾配線
      curves: []       // 縦曲線区間
    };

    // 実測データと理論値を生成
    for (let i = 0; i < elevationData.length; i++) {
      const position = elevationData[i].position;
      const actual = elevationData[i].elevation;
      const gradient = this.calculateGradientAtPosition(position, curves);
      const theoretical = this.calculateTheoreticalElevation(
        position,
        gradient,
        elevationData[0]
      );

      profileData.actual.push({ x: position, y: actual });
      profileData.theoretical.push({ x: position, y: theoretical });
      profileData.gradient.push({ x: position, y: gradient });
    }

    // 縦曲線区間を追加
    profileData.curves = curves.map(curve => ({
      start: curve.startPosition,
      end: curve.endPosition,
      type: curve.type,
      radius: curve.radius
    }));

    return profileData;
  }

  /**
   * CSVエクスポート
   * @param {Array} curves - 縦曲線データ
   * @returns {string} CSV文字列
   */
  exportToCSV(curves) {
    const headers = [
      'No',
      '開始キロ程(km)',
      '終了キロ程(km)',
      '延長(m)',
      '半径(m)',
      '開始勾配(‰)',
      '終了勾配(‰)',
      'タイプ',
      '備考'
    ];

    const rows = curves.map((curve, index) => [
      index + 1,
      (curve.startPosition / 1000).toFixed(3),
      (curve.endPosition / 1000).toFixed(3),
      curve.endPosition - curve.startPosition,
      curve.radius,
      curve.startGradient.toFixed(1),
      curve.endGradient.toFixed(1),
      this.getTypeLabel(curve.type),
      curve.description || ''
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * IDを生成
   */
  generateId() {
    return `vc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = VerticalCurveManager;