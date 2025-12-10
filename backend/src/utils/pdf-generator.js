/**
 * PDFレポート生成ユーティリティ
 * PDF Report Generation Utility
 *
 * 偏心矢計算結果をPDFレポートとして出力
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PDFReportGenerator {
  constructor() {
    this.pageMargin = 50;
    this.lineHeight = 20;
  }

  /**
   * 偏心矢計算結果のPDFレポートを生成
   *
   * @param {Object} data - レポートデータ
   * @param {string} outputPath - 出力ファイルパス
   * @returns {Promise<string>} 生成されたPDFファイルのパス
   */
  async generateEccentricVersineReport(data, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        // PDFドキュメントの作成
        const doc = new PDFDocument({
          size: 'A4',
          margin: this.pageMargin,
          info: {
            Title: '偏心矢計算レポート',
            Author: 'Rail Track Restoration System',
            Subject: '軌道復元システム 計算結果',
            Keywords: '偏心矢, 軌道検測, レポート'
          }
        });

        // ファイルストリームの作成
        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        // レポートの生成
        this.addHeader(doc, data);
        this.addCalculationParameters(doc, data);
        this.addStatistics(doc, data);

        if (data.characteristics) {
          this.addCharacteristics(doc, data);
        }

        if (data.versineData && data.versineData.length < 100) {
          // データが少ない場合はテーブルとして表示
          this.addDataTable(doc, data);
        }

        this.addFooter(doc);

        // PDF生成完了
        doc.end();

        stream.on('finish', () => {
          resolve(outputPath);
        });

        stream.on('error', (error) => {
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * ヘッダーセクションの追加
   */
  addHeader(doc, data) {
    const now = new Date();

    // タイトル
    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .text('軌道復元システム', { align: 'center' })
      .fontSize(20)
      .text('偏心矢計算レポート', { align: 'center' })
      .moveDown(0.5);

    // 日時
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`生成日時: ${now.toLocaleString('ja-JP')}`, { align: 'center' })
      .moveDown(2);

    // 水平線
    this.drawHorizontalLine(doc);
    doc.moveDown();
  }

  /**
   * 計算パラメータセクションの追加
   */
  addCalculationParameters(doc, data) {
    const params = data.parameters || {};

    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('計算パラメータ')
      .moveDown(0.5);

    doc
      .fontSize(11)
      .font('Helvetica');

    const paramList = [
      `前方弦長 (p): ${params.p || 'N/A'} m`,
      `後方弦長 (q): ${params.q || 'N/A'} m`,
      `サンプリング間隔: ${params.samplingInterval || 'N/A'} m`,
      `データ点数: ${params.totalPoints || params.dataPoints || 'N/A'} 点`,
      `対称/非対称: ${params.isSymmetric ? '対称 (p = q)' : '非対称 (p ≠ q)'}`
    ];

    if (params.chunked !== undefined) {
      paramList.push(`処理方法: ${params.chunked ? 'チャンク処理（最適化版）' : '通常処理'}`);
    }

    paramList.forEach(param => {
      doc.text(`  • ${param}`);
    });

    doc.moveDown(1.5);
  }

  /**
   * 統計情報セクションの追加
   */
  addStatistics(doc, data) {
    const stats = data.statistics || {};

    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('統計情報')
      .moveDown(0.5);

    // 統計テーブル
    const tableTop = doc.y;
    const colWidth = 120;
    const rowHeight = 25;

    // ヘッダー
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('項目', this.pageMargin, tableTop, { width: colWidth, continued: true })
      .text('値', this.pageMargin + colWidth, tableTop, { width: colWidth });

    // データ行
    doc.font('Helvetica');
    let currentY = tableTop + rowHeight;

    const statsData = [
      ['最小値', `${this.formatNumber(stats.min)} mm`],
      ['最大値', `${this.formatNumber(stats.max)} mm`],
      ['平均値', `${this.formatNumber(stats.mean || stats.avg)} mm`],
      ['標準偏差', `${this.formatNumber(stats.stdDev)} mm`],
      ['範囲', `${this.formatNumber(stats.max - stats.min)} mm`]
    ];

    statsData.forEach(([label, value]) => {
      doc
        .text(label, this.pageMargin, currentY, { width: colWidth, continued: true })
        .text(value, this.pageMargin + colWidth, currentY, { width: colWidth });
      currentY += rowHeight;
    });

    doc.y = currentY + 20;
    doc.moveDown();
  }

  /**
   * 検測特性セクションの追加
   */
  addCharacteristics(doc, data) {
    // 新しいページを追加
    doc.addPage();

    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('検測特性')
      .moveDown(0.5);

    doc
      .fontSize(10)
      .font('Helvetica')
      .text('検測特性の詳細データは別途グラフ画像を参照してください。')
      .moveDown();

    if (Array.isArray(data.characteristics) && data.characteristics.length > 0) {
      // サンプルデータを表示（最初の5件と最後の5件）
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('サンプルデータ（抜粋）')
        .moveDown(0.5);

      const samples = [
        ...data.characteristics.slice(0, 5),
        ...data.characteristics.slice(-5)
      ];

      samples.forEach((char, idx) => {
        if (idx === 5) {
          doc.text('...', { indent: 20 });
        }
        doc
          .fontSize(9)
          .font('Helvetica')
          .text(
            `波長: ${char.wavelength}m, 振幅: ${this.formatNumber(char.amplitude)}, 位相: ${this.formatNumber(char.phaseDeg)}°`,
            { indent: 20 }
          );
      });
    }

    doc.moveDown(2);
  }

  /**
   * データテーブルセクションの追加
   */
  addDataTable(doc, data) {
    // 新しいページを追加
    doc.addPage();

    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('計算結果データ')
      .moveDown(0.5);

    const versineData = data.versineData || data.data || [];

    if (versineData.length === 0) {
      doc
        .fontSize(10)
        .font('Helvetica')
        .text('データがありません。');
      return;
    }

    // テーブルヘッダー
    const tableTop = doc.y;
    const col1Width = 80;
    const col2Width = 120;
    const col3Width = 120;
    const rowHeight = 18;

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('距離 (m)', this.pageMargin, tableTop, { width: col1Width, continued: true })
      .text('測定値 (mm)', this.pageMargin + col1Width, tableTop, { width: col2Width, continued: true })
      .text('偏心矢 (mm)', this.pageMargin + col1Width + col2Width, tableTop, { width: col3Width });

    // データ行
    doc.font('Helvetica');
    let currentY = tableTop + rowHeight;

    // ページに収まる範囲でデータを表示
    const maxRows = 30;
    const displayData = versineData.slice(0, maxRows);

    displayData.forEach((item, idx) => {
      // ページ境界チェック
      if (currentY > doc.page.height - 100) {
        doc.addPage();
        currentY = this.pageMargin + 50;
      }

      doc
        .fontSize(9)
        .text(this.formatNumber(item.distance), this.pageMargin, currentY, { width: col1Width, continued: true })
        .text(this.formatNumber(item.originalValue || item.value), this.pageMargin + col1Width, currentY, { width: col2Width, continued: true })
        .text(this.formatNumber(item.value), this.pageMargin + col1Width + col2Width, currentY, { width: col3Width });

      currentY += rowHeight;
    });

    if (versineData.length > maxRows) {
      doc
        .fontSize(9)
        .text(`... 他 ${versineData.length - maxRows} 件`, this.pageMargin, currentY + 10);
    }

    doc.y = currentY + 30;
  }

  /**
   * フッターセクションの追加
   */
  addFooter(doc) {
    const pages = doc.bufferedPageRange();

    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);

      // ページ番号
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(
          `ページ ${i + 1} / ${pages.count}`,
          0,
          doc.page.height - 50,
          { align: 'center' }
        );

      // システム名
      doc
        .fontSize(8)
        .text(
          'Generated by Rail Track Restoration System',
          0,
          doc.page.height - 30,
          { align: 'center' }
        );
    }
  }

  /**
   * 水平線を描画
   */
  drawHorizontalLine(doc) {
    doc
      .moveTo(this.pageMargin, doc.y)
      .lineTo(doc.page.width - this.pageMargin, doc.y)
      .stroke();
  }

  /**
   * 数値のフォーマット
   */
  formatNumber(value) {
    if (value === null || value === undefined || isNaN(value)) {
      return 'N/A';
    }
    return Number(value).toFixed(3);
  }

  /**
   * 検測特性レポートの生成
   */
  async generateCharacteristicsReport(data, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: this.pageMargin
        });

        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        // ヘッダー
        doc
          .fontSize(20)
          .font('Helvetica-Bold')
          .text('検測特性計算レポート', { align: 'center' })
          .moveDown(2);

        // パラメータ
        this.addCalculationParameters(doc, data);

        // 特性データ
        if (data.characteristics) {
          this.addCharacteristics(doc, data);
        }

        this.addFooter(doc);
        doc.end();

        stream.on('finish', () => resolve(outputPath));
        stream.on('error', reject);

      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = { PDFReportGenerator };
