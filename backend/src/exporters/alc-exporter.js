/**
 * ALC（Automatic Level Control）用移動量データエクスポーター
 * PDFドキュメント P33の仕様に基づく実装
 */

const fs = require('fs').promises;
const path = require('path');

class ALCDataExporter {
  constructor(options = {}) {
    this.dataInterval = options.dataInterval || 5.0; // データ間隔（m）
    this.workDirection = options.workDirection || 'forward'; // 作業方向
    this.outputDir = options.outputDir || './output';
  }

  /**
   * ALC用移動量データ（.VER）を生成
   * @param {Array} movements - 移動量データ配列
   * @param {Object} workSection - 作業区間情報
   * @returns {Promise<string>} 生成されたファイルパス
   */
  async exportALCData(movements, workSection) {
    try {
      // 出力ディレクトリの作成
      await this.ensureDirectoryExists(this.outputDir);

      // ファイル名の生成
      const fileName = this.generateFileName(workSection);
      const filePath = path.join(this.outputDir, fileName);

      // データフォーマット変換
      const formattedData = this.formatALCData(movements, workSection);

      // ファイル出力
      await fs.writeFile(filePath, formattedData, 'utf8');

      console.log(`ALC移動量データを出力しました: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('ALC データ出力エラー:', error);
      throw error;
    }
  }

  /**
   * ALC用データフォーマットに変換
   * ヘッダー2行 + データ行 + フッター1行
   */
  formatALCData(movements, workSection) {
    const lines = [];

    // ヘッダー行1: 作業方向
    const direction = this.workDirection === 'forward' ? 'Forward' : 'Backward';
    lines.push(`VerschieBahn       1.0 ${direction} ***EndOfFileHeader***`);

    // ヘッダー行2: 固定
    lines.push('============================================================');

    // データ行
    const startPosition = workSection.startPosition || 0;

    for (let i = 0, seqNum = 1; i < movements.length; i += this.dataInterval, seqNum++) {
      const movement = movements[i];

      // 位置（m単位）
      const position = startPosition + i;

      // 横移動量（mm単位、符号付き）
      const lateralMovement = (movement.lateral || 0) * 1000;

      // こう上量（mm単位、符号付き）
      const verticalMovement = (movement.vertical || 0) * 1000;

      // データ行フォーマット
      const line = this.formatALCLine(position, lateralMovement, verticalMovement, seqNum);
      lines.push(line);
    }

    // フッター行
    lines.push('========== EndOfTab ==========');

    return lines.join('\r\n'); // Windows改行コード
  }

  /**
   * ALC用の1行をフォーマット
   * フォーマット: キロ程(11) + 横移動量(14) + こう上量(13) + 番号(13) + ダミー(13)
   */
  formatALCLine(position, lateralMovement, verticalMovement, sequenceNumber) {
    // キロ程: 11文字、右詰め
    const positionStr = position.toFixed(3).padStart(11, ' ');

    // 横移動量: 14文字、小数3桁、右詰め
    const lateralStr = lateralMovement.toFixed(3).padStart(14, ' ');

    // こう上量: 13文字、小数3桁、右詰め
    const verticalStr = verticalMovement.toFixed(3).padStart(13, ' ');

    // 番号: 13文字、右詰め
    const seqStr = sequenceNumber.toString().padStart(13, ' ');

    // ダミー: 13文字、全て0
    const dummyStr = '0'.padStart(13, ' ');

    return `${positionStr}${lateralStr}${verticalStr}${seqStr}${dummyStr}`;
  }

  /**
   * ファイル名生成
   */
  generateFileName(workSection) {
    const prefix = workSection.filePrefix || 'X';
    const id = workSection.id || '000001';
    return `${prefix}${id}ID.VER`;
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

module.exports = ALCDataExporter;