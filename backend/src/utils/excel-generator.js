/**
 * Excelレポート生成ユーティリティ
 * Excel Report Generation Utility
 *
 * 偏心矢計算結果をExcelファイルとして出力
 */

const ExcelJS = require('exceljs');
const path = require('path');

class ExcelReportGenerator {
  constructor() {
    this.workbook = null;
    this.headerStyle = {
      font: { bold: true, size: 12 },
      fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6E6E6' }
      },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    };

    this.titleStyle = {
      font: { bold: true, size: 16 },
      alignment: { horizontal: 'center', vertical: 'middle' }
    };

    this.dataStyle = {
      alignment: { horizontal: 'right', vertical: 'middle' },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    };
  }

  /**
   * 偏心矢計算結果のExcelレポートを生成
   *
   * @param {Object} data - レポートデータ
   * @param {string} outputPath - 出力ファイルパス
   * @returns {Promise<string>} 生成されたExcelファイルのパス
   */
  async generateEccentricVersineReport(data, outputPath) {
    try {
      this.workbook = new ExcelJS.Workbook();

      // メタデータ設定
      this.workbook.creator = 'Rail Track Restoration System';
      this.workbook.created = new Date();
      this.workbook.modified = new Date();
      this.workbook.properties.date1904 = false;

      // シート1: サマリー
      this.createSummarySheet(data);

      // シート2: 計算データ
      this.createDataSheet(data);

      // シート3: 統計情報
      this.createStatisticsSheet(data);

      // シート4: 検測特性（存在する場合）
      if (data.characteristics) {
        this.createCharacteristicsSheet(data);
      }

      // シート5: グラフ
      this.createChartSheet(data);

      // Excelファイルを保存
      await this.workbook.xlsx.writeFile(outputPath);

      return outputPath;
    } catch (error) {
      throw error;
    }
  }

  /**
   * サマリーシートの作成
   */
  createSummarySheet(data) {
    const sheet = this.workbook.addWorksheet('サマリー');
    const params = data.parameters || {};
    const stats = data.statistics || {};

    // タイトル
    sheet.mergeCells('A1:E1');
    sheet.getCell('A1').value = '偏心矢計算レポート';
    sheet.getCell('A1').style = this.titleStyle;

    // 生成日時
    sheet.getCell('A3').value = '生成日時';
    sheet.getCell('B3').value = new Date().toLocaleString('ja-JP');

    // 計算パラメータセクション
    sheet.getCell('A5').value = '計算パラメータ';
    sheet.getCell('A5').style = { font: { bold: true, size: 14 } };

    const paramData = [
      ['パラメータ', '値', '単位'],
      ['前方弦長 (p)', params.p || 'N/A', 'm'],
      ['後方弦長 (q)', params.q || 'N/A', 'm'],
      ['サンプリング間隔', params.samplingInterval || 'N/A', 'm'],
      ['データ点数', params.totalPoints || params.dataPoints || 'N/A', '点'],
      ['対称性', params.isSymmetric ? '対称 (p = q)' : '非対称 (p ≠ q)', ''],
      ['処理方法', params.chunked ? 'チャンク処理（最適化版）' : '通常処理', '']
    ];

    this.addTableToSheet(sheet, 'A7', paramData);

    // 統計情報セクション
    sheet.getCell('A16').value = '統計情報';
    sheet.getCell('A16').style = { font: { bold: true, size: 14 } };

    const statsData = [
      ['項目', '値', '単位'],
      ['最小値', this.formatNumber(stats.min), 'mm'],
      ['最大値', this.formatNumber(stats.max), 'mm'],
      ['平均値', this.formatNumber(stats.mean || stats.avg), 'mm'],
      ['標準偏差', this.formatNumber(stats.stdDev), 'mm'],
      ['範囲', this.formatNumber(stats.max - stats.min), 'mm'],
      ['データ数', stats.count || (data.versineData ? data.versineData.length : 'N/A'), '点']
    ];

    this.addTableToSheet(sheet, 'A18', statsData);

    // 列幅調整
    sheet.columns = [
      { width: 25 },
      { width: 20 },
      { width: 15 },
      { width: 15 },
      { width: 15 }
    ];
  }

  /**
   * データシートの作成
   */
  createDataSheet(data) {
    const sheet = this.workbook.addWorksheet('計算データ');
    const versineData = data.versineData || data.data || [];

    // ヘッダー
    const headers = [
      ['番号', '距離 (m)', '測定値 (mm)', '偏心矢 (mm)', '差分 (mm)']
    ];

    // データ行
    const dataRows = versineData.map((item, index) => {
      const originalValue = item.originalValue || item.value;
      const versineValue = item.value;
      const difference = originalValue - versineValue;

      return [
        index + 1,
        this.formatNumber(item.distance),
        this.formatNumber(originalValue),
        this.formatNumber(versineValue),
        this.formatNumber(difference)
      ];
    });

    // ヘッダーとデータを結合
    const tableData = [...headers, ...dataRows];

    // テーブル追加
    this.addTableToSheet(sheet, 'A1', tableData);

    // 列幅調整
    sheet.columns = [
      { width: 10 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 }
    ];

    // フィルター設定
    sheet.autoFilter = {
      from: 'A1',
      to: 'E1'
    };

    // データが大量の場合は警告を追加
    if (versineData.length > 65000) {
      sheet.getCell('G1').value = `警告: データ数が多いため、最初の65000件のみ表示`;
      sheet.getCell('G1').style = { font: { color: { argb: 'FFFF0000' } } };
    }
  }

  /**
   * 統計シートの作成
   */
  createStatisticsSheet(data) {
    const sheet = this.workbook.addWorksheet('統計分析');
    const stats = data.statistics || {};
    const versineData = data.versineData || [];

    // 基本統計
    sheet.getCell('A1').value = '基本統計量';
    sheet.getCell('A1').style = this.titleStyle;

    const basicStats = [
      ['統計量', '値', '単位'],
      ['サンプル数', versineData.length, '点'],
      ['最小値', this.formatNumber(stats.min), 'mm'],
      ['最大値', this.formatNumber(stats.max), 'mm'],
      ['平均値', this.formatNumber(stats.mean || stats.avg), 'mm'],
      ['中央値', this.formatNumber(stats.median), 'mm'],
      ['標準偏差', this.formatNumber(stats.stdDev), 'mm'],
      ['分散', this.formatNumber(stats.variance), 'mm²'],
      ['範囲', this.formatNumber(stats.max - stats.min), 'mm'],
      ['変動係数', this.formatNumber(stats.cv), '%']
    ];

    this.addTableToSheet(sheet, 'A3', basicStats);

    // パーセンタイル
    if (stats.percentiles) {
      sheet.getCell('A15').value = 'パーセンタイル';
      sheet.getCell('A15').style = { font: { bold: true, size: 14 } };

      const percentileData = [
        ['パーセンタイル', '値 (mm)'],
        ['5%', this.formatNumber(stats.percentiles?.p5)],
        ['25% (Q1)', this.formatNumber(stats.percentiles?.p25)],
        ['50% (中央値)', this.formatNumber(stats.percentiles?.p50)],
        ['75% (Q3)', this.formatNumber(stats.percentiles?.p75)],
        ['95%', this.formatNumber(stats.percentiles?.p95)],
        ['99%', this.formatNumber(stats.percentiles?.p99)]
      ];

      this.addTableToSheet(sheet, 'A17', percentileData);
    }

    // 列幅調整
    sheet.columns = [
      { width: 20 },
      { width: 15 },
      { width: 10 }
    ];
  }

  /**
   * 検測特性シートの作成
   */
  createCharacteristicsSheet(data) {
    const sheet = this.workbook.addWorksheet('検測特性');
    const characteristics = data.characteristics || [];

    // タイトル
    sheet.getCell('A1').value = '検測特性係数';
    sheet.getCell('A1').style = this.titleStyle;

    // パラメータ
    const params = data.parameters || {};
    sheet.getCell('A3').value = `p = ${params.p}m, q = ${params.q}m`;

    // データテーブル
    const headers = [
      ['波長 (m)', 'A係数', 'B係数', '振幅', '位相 (度)']
    ];

    const dataRows = characteristics.map(char => [
      this.formatNumber(char.wavelength),
      this.formatNumber(char.A, 6),
      this.formatNumber(char.B, 6),
      this.formatNumber(char.amplitude, 6),
      this.formatNumber(char.phaseDeg, 2)
    ]);

    const tableData = [...headers, ...dataRows];
    this.addTableToSheet(sheet, 'A5', tableData);

    // 列幅調整
    sheet.columns = [
      { width: 12 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 }
    ];

    // フィルター設定
    sheet.autoFilter = {
      from: 'A5',
      to: 'E5'
    };
  }

  /**
   * グラフシートの作成
   */
  createChartSheet(data) {
    const sheet = this.workbook.addWorksheet('グラフ');
    const versineData = data.versineData || [];

    // タイトル
    sheet.getCell('A1').value = '偏心矢波形グラフ';
    sheet.getCell('A1').style = this.titleStyle;

    // グラフ用データの準備（最初の1000点のみ）
    const chartData = versineData.slice(0, 1000);

    if (chartData.length > 0) {
      // データをシートに追加
      sheet.getCell('A3').value = '距離 (m)';
      sheet.getCell('B3').value = '測定値 (mm)';
      sheet.getCell('C3').value = '偏心矢 (mm)';

      chartData.forEach((item, index) => {
        const row = index + 4;
        sheet.getCell(`A${row}`).value = item.distance;
        sheet.getCell(`B${row}`).value = item.originalValue || item.value;
        sheet.getCell(`C${row}`).value = item.value;
      });

      // グラフを追加
      const chart = sheet.addChart('line', {
        title: '偏心矢波形',
        width: 800,
        height: 400
      });

      chart.addSeries({
        name: '測定値',
        x: {
          worksheet: sheet,
          column: 'A',
          from: 4,
          to: chartData.length + 3
        },
        y: {
          worksheet: sheet,
          column: 'B',
          from: 4,
          to: chartData.length + 3
        }
      });

      chart.addSeries({
        name: '偏心矢',
        x: {
          worksheet: sheet,
          column: 'A',
          from: 4,
          to: chartData.length + 3
        },
        y: {
          worksheet: sheet,
          column: 'C',
          from: 4,
          to: chartData.length + 3
        }
      });

      // グラフの位置設定
      chart.position = {
        type: 'absolute',
        x: 50,
        y: 100
      };
    }

    // 注記
    sheet.getCell('A2').value = `※ グラフは最初の${chartData.length}点のみ表示`;
    sheet.getCell('A2').style = { font: { size: 10, italic: true } };
  }

  /**
   * テーブルをシートに追加
   */
  addTableToSheet(sheet, startCell, data) {
    const startRow = parseInt(startCell.substring(1));
    const startCol = startCell.charCodeAt(0) - 64; // A=1, B=2, etc.

    data.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        const cell = sheet.getCell(rowIndex + startRow, colIndex + startCol);
        cell.value = value;

        // ヘッダー行のスタイル
        if (rowIndex === 0) {
          cell.style = this.headerStyle;
        } else {
          // データ行のスタイル
          cell.style = this.dataStyle;

          // 数値の場合は右寄せ
          if (typeof value === 'number') {
            cell.numFmt = '#,##0.000';
          }
        }
      });
    });
  }

  /**
   * 数値のフォーマット
   */
  formatNumber(value, decimals = 3) {
    if (value === null || value === undefined || isNaN(value)) {
      return 'N/A';
    }
    return parseFloat(Number(value).toFixed(decimals));
  }

  /**
   * バッチ処理用Excelレポートの生成
   */
  async generateBatchReport(batchResults, outputPath) {
    try {
      this.workbook = new ExcelJS.Workbook();

      // メタデータ
      this.workbook.creator = 'Rail Track Restoration System';
      this.workbook.created = new Date();

      // サマリーシート
      const summarySheet = this.workbook.addWorksheet('バッチ処理サマリー');

      summarySheet.getCell('A1').value = 'バッチ処理レポート';
      summarySheet.getCell('A1').style = this.titleStyle;

      const summaryData = [
        ['ファイル名', '処理状態', 'データ数', '最小値', '最大値', '平均値', 'エラー']
      ];

      batchResults.forEach(result => {
        const stats = result.statistics || {};
        summaryData.push([
          result.filename,
          result.success ? '成功' : '失敗',
          result.dataCount || 'N/A',
          this.formatNumber(stats.min),
          this.formatNumber(stats.max),
          this.formatNumber(stats.mean),
          result.error || ''
        ]);
      });

      this.addTableToSheet(summarySheet, 'A3', summaryData);

      // 各結果の詳細シート
      batchResults.forEach((result, index) => {
        if (result.success && result.data) {
          const sheetName = `結果${index + 1}_${result.filename.substring(0, 20)}`;
          this.workbook.addWorksheet(sheetName);
          // 各シートに詳細データを追加
        }
      });

      await this.workbook.xlsx.writeFile(outputPath);
      return outputPath;

    } catch (error) {
      throw error;
    }
  }
}

module.exports = { ExcelReportGenerator };