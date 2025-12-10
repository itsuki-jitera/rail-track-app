/**
 * ALS（Automatic Lining System）用移動量データエクスポーター
 * PDFドキュメント P32-33の仕様に基づく実装
 */

const fs = require('fs').promises;
const path = require('path');
const iconv = require('iconv-lite');

class ALSDataExporter {
  constructor(options = {}) {
    this.dataInterval = options.dataInterval || 5.0; // データ間隔（m）: 5m, 1m, 0.5m
    this.workDirection = options.workDirection || 'forward'; // 作業方向
    this.outputDir = options.outputDir || './output/EXTVER';
  }

  /**
   * ALS用移動量データ（.WDT）を生成
   * @param {Array} movements - 移動量データ配列
   * @param {Object} workSection - 作業区間情報
   * @returns {Promise<string>} 生成されたファイルパス
   */
  async exportALSData(movements, workSection) {
    try {
      // 出力ディレクトリの作成
      await this.ensureDirectoryExists(this.outputDir);

      // ファイル名の生成
      const fileName = this.generateFileName(workSection);
      const filePath = path.join(this.outputDir, fileName);

      // データフォーマット変換
      const formattedData = this.formatALSData(movements, workSection);

      // ファイル出力
      await fs.writeFile(filePath, formattedData, 'utf8');

      console.log(`ALS移動量データを出力しました: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('ALS データ出力エラー:', error);
      throw error;
    }
  }

  /**
   * ALS用データフォーマットに変換
   * 各行フォーマット: キロ程(7.3) + 空白(2) + 横移動(5.1) + 空白(2) + 縦移動(5.1)
   */
  formatALSData(movements, workSection) {
    const lines = [];
    const startKm = workSection.startKm || 0;

    for (let i = 0; i < movements.length; i += this.dataInterval) {
      const movement = movements[i];

      // キロ程計算（km単位、小数3桁）
      const kmPosition = (startKm + i) / 1000;

      // 横移動量（mm単位、符号付き、右移動がプラス）
      const lateralMovement = this.formatMovementValue(movement.lateral || 0);

      // 縦移動量（mm単位、符号付き、上移動がプラス）
      const verticalMovement = this.formatMovementValue(movement.vertical || 0);

      // 1行のフォーマット
      const line = this.formatALSLine(kmPosition, lateralMovement, verticalMovement);
      lines.push(line);
    }

    return lines.join('\r\n'); // Windows改行コード
  }

  /**
   * ALS用の1行をフォーマット
   */
  formatALSLine(kmPosition, lateralMovement, verticalMovement) {
    // キロ程: 7桁、小数3桁
    const kmStr = kmPosition.toFixed(3).padStart(7, ' ');

    // 横移動: 5桁、小数1桁、符号付き
    const lateralStr = this.formatSignedNumber(lateralMovement, 5, 1);

    // 縦移動: 5桁、小数1桁、符号付き
    const verticalStr = this.formatSignedNumber(verticalMovement, 5, 1);

    // 空白2文字で区切る
    return `${kmStr}  ${lateralStr}  ${verticalStr}`;
  }

  /**
   * 符号付き数値のフォーマット
   */
  formatSignedNumber(value, totalWidth, decimalPlaces) {
    const formatted = value.toFixed(decimalPlaces);
    const sign = value >= 0 ? ' ' : ''; // 正の場合は空白、負の場合は-記号
    return (sign + formatted).padStart(totalWidth, ' ');
  }

  /**
   * 移動量値のフォーマット（mm単位、小数1桁）
   */
  formatMovementValue(value) {
    // メートルからミリメートルへ変換
    return value * 1000;
  }

  /**
   * ファイル名生成
   */
  generateFileName(workSection) {
    const prefix = workSection.filePrefix || 'X';
    const id = workSection.id || '000001';
    return `${prefix}${id}ID.WDT`;
  }

  /**
   * 新幹線用分割データ出力
   * 180データ単位で分割、10データ重複
   */
  async exportShinkansenData(movements, workSection) {
    const dataPerFile = 180;
    const overlapData = 10;
    const files = [];

    for (let i = 0, fileIndex = 1; i < movements.length; i += (dataPerFile - overlapData)) {
      const startIndex = i;
      const endIndex = Math.min(i + dataPerFile, movements.length);
      const segmentData = movements.slice(startIndex, endIndex);

      // ファイル名生成（数字でインデックス）
      const fileName = this.generateShinkansenFileName(workSection, fileIndex);
      const filePath = path.join(this.outputDir, fileName);

      // データフォーマット変換
      const formattedData = this.formatALSData(segmentData, {
        ...workSection,
        startKm: workSection.startKm + startIndex
      });

      // ファイル出力
      await fs.writeFile(filePath, formattedData, 'utf8');
      files.push(filePath);

      fileIndex++;

      // 最後のセグメントの場合は終了
      if (endIndex >= movements.length) break;
    }

    console.log(`新幹線用分割データを出力しました: ${files.length}ファイル`);
    return files;
  }

  /**
   * 新幹線用ファイル名生成
   */
  generateShinkansenFileName(workSection, index) {
    const prefix = workSection.filePrefix || 'X';
    const id = workSection.id || '000001';
    return `${prefix}${id}${index}D.WDT`;
  }

  /**
   * 移動量確認用データ出力（補正なし）
   */
  async exportVerificationData(movements, workSection) {
    const fileName = this.generateVerificationFileName(workSection);
    const filePath = path.join('output/IDOU', fileName);

    // 出力ディレクトリの作成
    await this.ensureDirectoryExists('output/IDOU');

    // 補正なしのデータフォーマット
    const formattedData = this.formatALSData(movements, workSection);

    await fs.writeFile(filePath, formattedData, 'utf8');
    console.log(`移動量確認用データを出力しました: ${filePath}`);

    return filePath;
  }

  /**
   * 確認用ファイル名生成
   */
  generateVerificationFileName(workSection) {
    const prefix = workSection.filePrefix || 'X';
    const id = workSection.id || '000001';
    return `${prefix}${id}JD.WDT`;
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
}

module.exports = ALSDataExporter;