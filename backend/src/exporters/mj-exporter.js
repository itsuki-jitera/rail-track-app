/**
 * MJ（作業用データ）エクスポーター
 * PDFドキュメント P34-35の仕様に基づく実装
 * ALS作業用データとして、MTT整備に必要な各点の情報を出力
 */

const fs = require('fs').promises;
const path = require('path');
const MTTConfiguration = require('../config/mtt-config');

class MJDataExporter {
  constructor(options = {}) {
    this.mttType = options.mttType || '08-16';
    this.mttConfig = MTTConfiguration.getConfig(this.mttType);
    this.workDirection = options.workDirection || 'forward';
    this.outputDir = options.outputDir || './output';
  }

  /**
   * MJ作業用データを生成
   * @param {Object} data - 移動量と整備後予測波形データ
   * @param {Object} workSection - 作業区間情報
   * @returns {Promise<string>} 生成されたファイルパス
   */
  async exportMJData(data, workSection) {
    try {
      // 出力ディレクトリの作成
      await this.ensureDirectoryExists(this.outputDir);

      // ファイル名の生成
      const fileName = this.generateFileName(workSection);
      const filePath = path.join(this.outputDir, fileName);

      // データフォーマット変換
      const formattedData = this.formatMJData(data, workSection);

      // ファイル出力（CSV形式）
      await fs.writeFile(filePath, formattedData, 'utf8');

      console.log(`MJ作業用データを出力しました: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('MJ データ出力エラー:', error);
      throw error;
    }
  }

  /**
   * MJ用データフォーマットに変換
   * CSV形式で出力
   */
  formatMJData(data, workSection) {
    const lines = [];

    // 1行目: ヘッダー情報
    const header = this.generateHeader(workSection);
    lines.push(header);

    // 2行目以降: データ行
    const dataLines = this.generateDataLines(data, workSection);
    lines.push(...dataLines);

    return lines.join('\r\n');
  }

  /**
   * ヘッダー行生成
   * フォーマット: プレロード方向,カント方向,ファイル種別
   */
  generateHeader(workSection) {
    // プレロードの方向（0:左、1:右）
    const preloadDirection = workSection.liningDirection === 'left' ? '0' : '1';

    // カント（0:左カント、1:右カント）
    const cantDirection = workSection.elevationDirection === 'left' ? '0' : '1';

    // ファイルの種別（1:事前検測、3:手入力、5:08-475等）
    const fileType = this.getFileTypeForMTT();

    return `${preloadDirection},${cantDirection},${fileType}`;
  }

  /**
   * MTT機種に応じたファイルタイプを取得
   */
  getFileTypeForMTT() {
    const typeMap = {
      '08-475': '5',
      '08-1X': '6',
      '08-2X': '6',
      '08-32幹': '7',
      '08-32幹2670': '8',
      '08-275': '9',
      '09-16在': '6',
      '08-16': '4'
    };
    return typeMap[this.mttType] || '4';
  }

  /**
   * データ行生成
   */
  generateDataLines(data, workSection) {
    const lines = [];
    const startPosition = workSection.startPosition || 0;

    // 09-16在の場合と、それ以外で処理を分ける
    const is0916 = this.mttType === '09-16在';

    for (let i = 0; i < data.movements.length; i += 0.5) {
      const position = startPosition + i;
      const movement = data.movements[Math.floor(i / 0.5)] || {};
      const prediction = data.predictions[Math.floor(i / 0.5)] || {};

      if (is0916) {
        // 09-16在の場合: D点基準
        const line = this.format0916Line(position, movement, prediction);
        lines.push(line);
      } else {
        // その他のMTT: C点基準
        const line = this.formatStandardLine(position, movement, prediction);
        lines.push(line);
      }
    }

    return lines;
  }

  /**
   * 09-16在用のデータ行フォーマット
   * D点のキロ程基準
   */
  format0916Line(position, movement, prediction) {
    // D点のキロ程（0.5m単位）
    const dPosition = (position / 1000).toFixed(4);

    // D点誘導量（mm、小数3桁）
    const dGuidance = this.formatNumber(movement.lateral || 0, 7, 3);

    // C点補正値（MTT偏心矢、mm）
    const cCorrection = this.formatNumber(
      this.calculateEccentricVector(prediction, position),
      7, 3
    );

    // D点こう上量（mm、小数3桁）
    const dUplift = this.formatNumber(movement.vertical || 0, 7, 3);

    // ダミー値
    const dummy1 = this.formatNumber(0, 7, 3);

    // カント（mm、小数3桁）
    const cant = this.formatNumber(prediction.cant || 0, 7, 3);

    // ダミー値
    const dummy2 = this.formatNumber(0, 7, 3);

    return `${dPosition},${dGuidance},${cCorrection},${dUplift},${dummy1},${cant},${dummy2}`;
  }

  /**
   * 標準MTT用のデータ行フォーマット
   * C点のキロ程基準
   */
  formatStandardLine(position, movement, prediction) {
    // C点のキロ程（0.5m単位）
    const cPosition = (position / 1000).toFixed(4);

    // D点誘導量（C点基準で必要な移動量、mm）
    const dGuidance = this.formatNumber(
      this.calculateDPointGuidance(movement, position),
      7, 3
    );

    // C点補正値（MTT偏心矢、mm）
    const cCorrection = this.formatNumber(
      this.calculateEccentricVector(prediction, position),
      7, 3
    );

    // D点こう上量（C点基準で必要な移動量、mm）
    const dUplift = this.formatNumber(
      this.calculateDPointUplift(movement, position),
      7, 3
    );

    // ダミー値
    const dummy1 = this.formatNumber(0, 7, 3);

    // カント（mm、小数3桁）
    const cant = this.formatNumber(prediction.cant || 0, 7, 3);

    // ダミー値
    const dummy2 = this.formatNumber(0, 7, 3);

    return `${cPosition},${dGuidance},${cCorrection},${dUplift},${dummy1},${cant},${dummy2}`;
  }

  /**
   * D点誘導量を計算（C点基準）
   */
  calculateDPointGuidance(movement, cPosition) {
    // C点からD点までの距離
    const cdLength = this.mttConfig.lining.cdLength;

    // 基本の移動量
    const baseMovement = (movement.lateral || 0) * 1000; // mm変換

    // MTTの弦長を考慮した補正
    // C点を整備する際に必要なD点の誘導量
    const correction = this.calculateLiningCorrection(baseMovement, cdLength);

    return baseMovement + correction;
  }

  /**
   * D点こう上量を計算（C点基準）
   */
  calculateDPointUplift(movement, cPosition) {
    // C点からD点までの距離
    const cdLength = this.mttConfig.leveling.cdLength;

    // 基本の移動量
    const baseMovement = (movement.vertical || 0) * 1000; // mm変換

    // MTTの弦長を考慮した補正
    const correction = this.calculateLevelingCorrection(baseMovement, cdLength);

    return baseMovement + correction;
  }

  /**
   * MTT偏心矢を計算
   * 整備後予測波形から計算
   */
  calculateEccentricVector(prediction, position) {
    if (!prediction.alignmentCurve) {
      return 0;
    }

    // MTTの弦長に基づいて偏心矢を計算
    const bcLength = this.mttConfig.lining.bcLength;
    const cdLength = this.mttConfig.lining.cdLength;
    const totalLength = bcLength + cdLength;

    // 3点から偏心矢を計算（右カーブがプラス）
    const eccentricity = prediction.alignmentCurve * (bcLength * cdLength) / (2 * totalLength);

    return eccentricity * 1000; // mm変換
  }

  /**
   * ライニング補正量計算
   */
  calculateLiningCorrection(baseMovement, cdLength) {
    // 簡略化した補正計算
    // 実際にはより複雑な計算が必要
    return baseMovement * 0.01 * cdLength;
  }

  /**
   * レベリング補正量計算
   */
  calculateLevelingCorrection(baseMovement, cdLength) {
    // 簡略化した補正計算
    return baseMovement * 0.01 * cdLength;
  }

  /**
   * 数値フォーマット
   */
  formatNumber(value, totalWidth, decimalPlaces) {
    const formatted = value.toFixed(decimalPlaces);
    return formatted.padStart(totalWidth, ' ');
  }

  /**
   * ファイル名生成
   */
  generateFileName(workSection) {
    const prefix = workSection.filePrefix || 'X';
    const id = workSection.id || '000001';
    return `${prefix}${id}ID.MJ`;
  }

  /**
   * ディレクトリの存在確認と作成
   */
  async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * MTT整備のイメージ情報を生成
   * デバッグ・確認用
   */
  generateMTTImage(position) {
    const config = this.mttConfig;
    const bcLength = config.lining.bcLength;
    const cdLength = config.lining.cdLength;

    return {
      mttType: this.mttType,
      positions: {
        B: position - bcLength,  // リア位置
        C: position,             // ミドル位置
        D: position + cdLength   // フロント位置
      },
      lengths: {
        BC: bcLength,
        CD: cdLength,
        total: bcLength + cdLength
      }
    };
  }
}

module.exports = MJDataExporter;