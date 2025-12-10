/**
 * MTT（Multiple Tie Tamper）機種設定管理
 * PDFドキュメント仕様に基づくMTT機種別の弦長設定
 */

class MTTConfiguration {
  static MTT_TYPES = {
    '08-16': {
      name: '08-16',
      description: '標準型MTT',
      leveling: {
        bcLength: 3.63,  // BC間弦長（m）
        cdLength: 9.37,  // CD間弦長（m）
      },
      lining: {
        bcLength: 5.20,  // BC間弦長（m）
        cdLength: 9.50,  // CD間弦長（m）
      }
    },
    '09-16在': {
      name: '09-16在',
      description: '在来線用MTT',
      leveling: {
        bcLength: 3.21,  // BC間弦長（m）
        cdLength: 9.79,  // CD間弦長（m）
      },
      lining: {
        bcLength: 5.20,  // BC間弦長（m）
        cdLength: 9.50,  // CD間弦長（m）
      }
    },
    '08-32幹': {
      name: '08-32幹',
      description: '新幹線用MTT',
      leveling: {
        bcLength: 3.63,  // BC間弦長（m）
        cdLength: 9.37,  // CD間弦長（m）
      },
      lining: {
        bcLength: 5.20,  // BC間弦長（m）
        cdLength: 9.50,  // CD間弦長（m）
      }
    },
    '08-475': {
      name: '08-475',
      description: '大型MTT',
      leveling: {
        bcLength: 3.63,
        cdLength: 9.37,
      },
      lining: {
        bcLength: 5.20,
        cdLength: 9.50,
      }
    },
    '08-1X': {
      name: '08-1X',
      description: '小型MTT',
      leveling: {
        bcLength: 3.21,
        cdLength: 9.79,
      },
      lining: {
        bcLength: 5.20,
        cdLength: 9.50,
      }
    },
    '08-2X': {
      name: '08-2X',
      description: '中型MTT',
      leveling: {
        bcLength: 3.21,
        cdLength: 9.79,
      },
      lining: {
        bcLength: 5.20,
        cdLength: 9.50,
      }
    },
    '08-275': {
      name: '08-275',
      description: '特殊型MTT',
      leveling: {
        bcLength: 3.63,
        cdLength: 9.37,
      },
      lining: {
        bcLength: 5.20,
        cdLength: 9.50,
      }
    }
  };

  /**
   * MTT機種設定を取得
   * @param {string} mttType - MTT機種名
   * @returns {Object} MTT設定情報
   */
  static getConfig(mttType) {
    if (!this.MTT_TYPES[mttType]) {
      throw new Error(`未知のMTT機種: ${mttType}`);
    }
    return this.MTT_TYPES[mttType];
  }

  /**
   * 全MTT機種リストを取得
   * @returns {Array} MTT機種リスト
   */
  static getAllTypes() {
    return Object.keys(this.MTT_TYPES).map(key => ({
      value: key,
      label: `${key} - ${this.MTT_TYPES[key].description}`,
      config: this.MTT_TYPES[key]
    }));
  }

  /**
   * フロント位置を計算
   * @param {string} mttType - MTT機種
   * @param {string} mechanism - 'leveling' または 'lining'
   * @param {number} cPosition - C点の位置（m）
   * @returns {number} D点（フロント）の位置
   */
  static calculateFrontPosition(mttType, mechanism, cPosition) {
    const config = this.getConfig(mttType);
    const cdLength = config[mechanism].cdLength;
    return cPosition + cdLength;
  }

  /**
   * リア位置を計算
   * @param {string} mttType - MTT機種
   * @param {string} mechanism - 'leveling' または 'lining'
   * @param {number} cPosition - C点の位置（m）
   * @returns {number} B点（リア）の位置
   */
  static calculateRearPosition(mttType, mechanism, cPosition) {
    const config = this.getConfig(mttType);
    const bcLength = config[mechanism].bcLength;
    return cPosition - bcLength;
  }
}

module.exports = MTTConfiguration;