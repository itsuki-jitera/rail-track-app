/**
 * 作業区間管理モデル
 * PDFドキュメントの作業区間仕様に基づく実装
 */

class WorkSection {
  constructor(options = {}) {
    // 基本情報
    this.lineName = options.lineName || '';           // 線名
    this.lineDirection = options.lineDirection || ''; // 線別（上り/下り/単線）
    this.workDirection = options.workDirection || 'forward'; // 作業方向

    // 作業区間（m単位）
    this.startPosition = options.startPosition || 0;
    this.endPosition = options.endPosition || 0;

    // バッファ設定（PDFドキュメント: 前後500m以上）
    this.bufferBefore = options.bufferBefore || 500;
    this.bufferAfter = options.bufferAfter || 500;

    // WB区間設定（PDFドキュメント: 始終点から50m以上離れる）
    this.wbSafetyMargin = options.wbSafetyMargin || 50;
    this.wbSections = options.wbSections || [];

    // 表示範囲（作業区間 + 50-150m）
    this.displayBufferBefore = options.displayBufferBefore || 120;
    this.displayBufferAfter = options.displayBufferAfter || 120;

    // 移動量制限箇所
    this.movementRestrictions = options.movementRestrictions || [];

    // MTT機種設定
    this.mttType = options.mttType || '08-16';
  }

  /**
   * 実際のデータ取得範囲を計算（バッファ含む）
   * @returns {Object} データ取得範囲
   */
  getDataRange() {
    return {
      start: this.startPosition - this.bufferBefore,
      end: this.endPosition + this.bufferAfter,
      totalLength: this.endPosition - this.startPosition + this.bufferBefore + this.bufferAfter
    };
  }

  /**
   * 表示範囲を計算
   * @returns {Object} 表示範囲
   */
  getDisplayRange() {
    return {
      start: this.startPosition - this.displayBufferBefore,
      end: this.endPosition + this.displayBufferAfter,
      workStart: this.startPosition,
      workEnd: this.endPosition
    };
  }

  /**
   * WB区間との干渉をチェック
   * @param {number} position - チェックする位置
   * @returns {boolean} WB区間と干渉する場合true
   */
  isInWBSection(position) {
    for (const wbSection of this.wbSections) {
      if (position >= wbSection.start && position <= wbSection.end) {
        return true;
      }
    }
    return false;
  }

  /**
   * WB区間から安全な距離にあるかチェック
   * @param {number} position - チェックする位置
   * @returns {boolean} 安全な場合true
   */
  isSafeFromWBSection(position) {
    for (const wbSection of this.wbSections) {
      const distanceFromStart = Math.abs(position - wbSection.start);
      const distanceFromEnd = Math.abs(position - wbSection.end);

      if (distanceFromStart < this.wbSafetyMargin ||
          distanceFromEnd < this.wbSafetyMargin) {
        return false;
      }
    }
    return true;
  }

  /**
   * 移動量制限をチェック
   * @param {number} position - 位置
   * @param {string} direction - 方向（'lateral' または 'vertical'）
   * @returns {Object|null} 制限情報またはnull
   */
  getMovementRestriction(position, direction) {
    for (const restriction of this.movementRestrictions) {
      if (position >= restriction.start &&
          position <= restriction.end &&
          restriction.direction === direction) {
        return {
          limit: restriction.limit,
          type: restriction.type,
          description: restriction.description
        };
      }
    }
    return null;
  }

  /**
   * 左右方向の移動量制限を追加
   * @param {Object} restriction - 制限情報
   */
  addLateralRestriction(restriction) {
    this.movementRestrictions.push({
      start: restriction.start,
      end: restriction.end,
      direction: 'lateral',
      side: restriction.side, // 'left' または 'right'
      limit: restriction.limit,
      type: 'fixed',
      description: restriction.description || ''
    });
  }

  /**
   * 上下方向の移動量制限を追加（こう上のみ）
   * @param {Object} restriction - 制限情報
   */
  addVerticalRestriction(restriction) {
    this.movementRestrictions.push({
      start: restriction.start,
      end: restriction.end,
      direction: 'vertical',
      limit: restriction.limit, // こう上量の制限値
      type: 'uplift',
      description: restriction.description || ''
    });
  }

  /**
   * 作業区間情報の検証
   * @returns {Object} 検証結果
   */
  validate() {
    const errors = [];
    const warnings = [];

    // 作業区間の順序チェック
    if (this.startPosition >= this.endPosition) {
      errors.push('作業開始位置が終了位置より後になっています');
    }

    // バッファサイズチェック
    if (this.bufferBefore < 500) {
      warnings.push('前方バッファが推奨値（500m）より小さいです');
    }
    if (this.bufferAfter < 500) {
      warnings.push('後方バッファが推奨値（500m）より小さいです');
    }

    // WB区間との干渉チェック
    if (!this.isSafeFromWBSection(this.startPosition)) {
      errors.push('作業開始地点がWB区間に近すぎます（50m以上離してください）');
    }
    if (!this.isSafeFromWBSection(this.endPosition)) {
      errors.push('作業終了地点がWB区間に近すぎます（50m以上離してください）');
    }

    // W区間のチェック
    if (this.isInWBSection(this.startPosition)) {
      warnings.push('作業開始地点がW区間内にあります');
    }
    if (this.isInWBSection(this.endPosition)) {
      warnings.push('作業終了地点がW区間内にあります');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 作業区間サマリーを生成
   * @returns {Object} サマリー情報
   */
  getSummary() {
    const dataRange = this.getDataRange();
    const displayRange = this.getDisplayRange();

    return {
      lineName: this.lineName,
      lineDirection: this.lineDirection,
      workDirection: this.workDirection === 'forward' ? '下り方向' : '上り方向',
      workSection: {
        start: this.startPosition,
        end: this.endPosition,
        length: this.endPosition - this.startPosition
      },
      dataRange: {
        start: dataRange.start,
        end: dataRange.end,
        totalLength: dataRange.totalLength
      },
      displayRange: {
        start: displayRange.start,
        end: displayRange.end
      },
      mttType: this.mttType,
      restrictions: {
        lateral: this.movementRestrictions.filter(r => r.direction === 'lateral').length,
        vertical: this.movementRestrictions.filter(r => r.direction === 'vertical').length
      },
      wbSections: this.wbSections.length
    };
  }

  /**
   * 印刷用フォーマットで出力
   * @returns {string} 印刷用テキスト
   */
  toPrintFormat() {
    const summary = this.getSummary();
    const lines = [];

    lines.push('作業区間、曲線諸元、移動量制限箇所等');
    lines.push('=' .repeat(60));
    lines.push(`線名: ${summary.lineName}`);
    lines.push(`線別: ${summary.lineDirection}`);
    lines.push(`作業方向: ${summary.workDirection}`);
    lines.push(`作業区間: ${summary.workSection.start} ～ ${summary.workSection.end}`);
    lines.push(`作業延長: ${summary.workSection.length}m`);
    lines.push(`MTT種別: ${summary.mttType}`);
    lines.push('');

    // 移動量制限箇所
    if (this.movementRestrictions.length > 0) {
      lines.push('移動量制限箇所');
      lines.push('-'.repeat(50));
      lines.push('方向    開始    終了    制限量(mm)');
      lines.push('-'.repeat(50));

      for (const restriction of this.movementRestrictions) {
        const direction = restriction.direction === 'lateral' ? '左右' : '上下';
        const side = restriction.side ? `(${restriction.side === 'left' ? '左' : '右'})` : '';
        lines.push(
          `${direction}${side}  ${restriction.start}  ${restriction.end}  ${restriction.limit}`
        );
      }
      lines.push('-'.repeat(50));
    }

    return lines.join('\n');
  }
}

module.exports = WorkSection;