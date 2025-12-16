/**
 * キロ程処理サービス
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」に基づく実装
 * - 通常区間: データ数 × データ間隔（1m）で計算
 * - WB区間: ラボックス元データのキロ程をそのまま使用
 * - KK.KDTファイルからWB区間情報を読み込み
 */

const fs = require('fs').promises;
const path = require('path');

class KilometerService {
  /**
   * キロ程データの処理
   * WB区間と通常区間を区別して処理
   *
   * @param {Array} data - 測定データ
   * @param {Array} wbSections - WB区間情報 [{ start, end, type, originalKilometer }]
   * @param {Object} options - オプション
   * @returns {Array} キロ程付きデータ
   */
  static async processKilometer(data, wbSections = [], options = {}) {
    const {
      dataInterval = 0.25,  // データ間隔 (m)
      baseKilometer = 0,    // 基準キロ程 (km)
      workDirection = 'forward',  // 作業方向
      kkdtFilePath = null   // KK.KDTファイルパス
    } = options;

    console.log('キロ程処理開始');
    console.log(`データ点数: ${data.length}`);
    console.log(`WB区間数: ${wbSections.length}`);
    console.log(`作業方向: ${workDirection}`);

    // KK.KDTファイルがある場合は読み込み
    let kkdtData = null;
    if (kkdtFilePath) {
      try {
        kkdtData = await this.readKKDTFile(kkdtFilePath);
        console.log('KK.KDTファイル読み込み成功');
      } catch (error) {
        console.error('KK.KDTファイル読み込みエラー:', error);
      }
    }

    // キロ程計算
    const processedData = [];
    let currentPosition = 0;
    let currentKilometer = baseKilometer;

    for (let i = 0; i < data.length; i++) {
      const point = data[i];
      currentPosition = i * dataInterval;

      // WB区間内かチェック
      const wbSection = this.findWBSection(currentPosition, wbSections);

      if (wbSection) {
        // WB区間: ラボックス元データのキロ程を使用
        if (wbSection.originalKilometer && wbSection.originalKilometer[i]) {
          currentKilometer = wbSection.originalKilometer[i];
        } else if (kkdtData && kkdtData[currentPosition]) {
          // KK.KDTファイルから取得
          currentKilometer = kkdtData[currentPosition];
        } else {
          // WB区間だが元データがない場合は線形補間
          currentKilometer = this.interpolateWBKilometer(
            currentPosition,
            wbSection,
            baseKilometer,
            dataInterval
          );
        }
      } else {
        // 通常区間: データ数 × データ間隔で計算
        if (workDirection === 'forward') {
          currentKilometer = baseKilometer + (currentPosition / 1000);
        } else {
          currentKilometer = baseKilometer - (currentPosition / 1000);
        }
      }

      processedData.push({
        ...point,
        position: currentPosition,
        kilometer: currentKilometer,
        kilometerage: this.formatKilometer(currentKilometer),
        isWBSection: !!wbSection,
        wbType: wbSection ? wbSection.type : null
      });
    }

    return processedData;
  }

  /**
   * WB区間を検索
   */
  static findWBSection(position, wbSections) {
    return wbSections.find(wb =>
      position >= wb.start && position <= wb.end
    );
  }

  /**
   * WB区間内のキロ程を補間
   */
  static interpolateWBKilometer(position, wbSection, baseKilometer, dataInterval) {
    // WB区間の始点と終点のキロ程から線形補間
    const sectionLength = wbSection.end - wbSection.start;
    const relativePosition = position - wbSection.start;
    const ratio = relativePosition / sectionLength;

    if (wbSection.startKilometer && wbSection.endKilometer) {
      return wbSection.startKilometer +
        (wbSection.endKilometer - wbSection.startKilometer) * ratio;
    }

    // デフォルトは通常計算
    return baseKilometer + (position / 1000);
  }

  /**
   * KK.KDTファイルの読み込み
   * フォーマット: (切取りファイル名上6桁) + "KK.KDT"
   */
  static async readKKDTFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const kkdtData = {};

      console.log(`KK.KDTファイル行数: ${lines.length}`);

      for (const line of lines) {
        if (!line.trim()) continue;

        // KK.KDTファイルフォーマットの解析
        // 例: "0000.000 123.456" (位置 キロ程)
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const position = parseFloat(parts[0]);
          const kilometer = parseFloat(parts[1]);

          if (!isNaN(position) && !isNaN(kilometer)) {
            kkdtData[position] = kilometer;
          }
        }
      }

      console.log(`KK.KDTデータ読み込み: ${Object.keys(kkdtData).length}点`);
      return kkdtData;
    } catch (error) {
      console.error('KK.KDTファイル読み込みエラー:', error);
      throw error;
    }
  }

  /**
   * KK.KDTファイルへの書き込み（修正用）
   */
  static async writeKKDTFile(filePath, data) {
    try {
      const lines = [];

      for (const point of data) {
        if (point.isWBSection) {
          // WB区間のデータのみ出力
          lines.push(`${point.position.toFixed(3)} ${point.kilometer.toFixed(3)}`);
        }
      }

      const content = lines.join('\n');
      await fs.writeFile(filePath, content, 'utf-8');

      console.log(`KK.KDTファイル書き込み完了: ${lines.length}行`);
      return true;
    } catch (error) {
      console.error('KK.KDTファイル書き込みエラー:', error);
      throw error;
    }
  }

  /**
   * キロ程のフォーマット
   * @param {number} kilometer - キロ程 (km)
   * @returns {string} フォーマット済みキロ程 (例: "123k456m")
   */
  static formatKilometer(kilometer) {
    const km = Math.floor(kilometer);
    const m = Math.round((kilometer - km) * 1000);
    return `${km}k${m.toString().padStart(3, '0')}m`;
  }

  /**
   * 実延長の計算
   * チャート上のキロ程の差し引きが実延長を表す
   */
  static calculateActualLength(startKilometer, endKilometer, wbSections = []) {
    let actualLength = Math.abs(endKilometer - startKilometer) * 1000; // km to m

    // WB区間の実延長を考慮
    for (const wb of wbSections) {
      if (wb.actualLength) {
        // WB区間の表示上の長さと実際の長さの差を調整
        const displayLength = wb.end - wb.start;
        const lengthDiff = wb.actualLength - displayLength;
        actualLength += lengthDiff;
      }
    }

    return actualLength;
  }

  /**
   * キロ程データの検証
   * 連続性と妥当性をチェック
   */
  static validateKilometerData(data) {
    const errors = [];
    const warnings = [];

    for (let i = 1; i < data.length; i++) {
      const prev = data[i - 1];
      const curr = data[i];

      // キロ程の連続性チェック
      const kmDiff = Math.abs(curr.kilometer - prev.kilometer);
      const posDiff = Math.abs(curr.position - prev.position);
      const expectedKmDiff = posDiff / 1000;

      // 通常区間での大きなずれを検出
      if (!curr.isWBSection && !prev.isWBSection) {
        if (Math.abs(kmDiff - expectedKmDiff) > 0.001) {
          warnings.push({
            position: curr.position,
            message: `キロ程の不連続: ${prev.kilometer.toFixed(3)} → ${curr.kilometer.toFixed(3)}`
          });
        }
      }

      // キロ程の逆転チェック
      if (kmDiff === 0) {
        warnings.push({
          position: curr.position,
          message: 'キロ程が進んでいません'
        });
      }
    }

    return { errors, warnings, isValid: errors.length === 0 };
  }

  /**
   * WB区間情報の生成（サンプル）
   */
  static generateSampleWBSections() {
    return [
      {
        start: 1000,
        end: 1200,
        type: 'WB',
        description: '第1橋梁',
        startKilometer: 1.000,
        endKilometer: 1.200,
        actualLength: 200
      },
      {
        start: 2500,
        end: 2800,
        type: 'WB',
        description: 'トンネル',
        startKilometer: 2.500,
        endKilometer: 2.800,
        actualLength: 300
      },
      {
        start: 3500,
        end: 3600,
        type: 'W',
        description: '踏切',
        startKilometer: 3.500,
        endKilometer: 3.600,
        actualLength: 100
      }
    ];
  }
}

module.exports = KilometerService;