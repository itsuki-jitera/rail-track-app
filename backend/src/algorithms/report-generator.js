/**
 * 自動レポート生成システム
 * 作業報告書、品質レポート、解析結果レポートの自動生成
 */

const fs = require('fs').promises;
const path = require('path');

class ReportGenerator {
  constructor() {
    this.templates = {
      workReport: 'work_report',
      qualityReport: 'quality_report',
      analysisReport: 'analysis_report',
      comparisonReport: 'comparison_report',
      summaryReport: 'summary_report'
    };

    // レポート設定
    this.config = {
      company: 'レールテック株式会社',
      department: 'システム開発部',
      systemName: '軌道復元システム',
      version: '2.0',
      logoPath: '/assets/logo.png'
    };

    // チャート色設定
    this.chartColors = {
      primary: '#4A90E2',
      secondary: '#50E3C2',
      danger: '#E74C3C',
      warning: '#F39C12',
      success: '#27AE60',
      info: '#3498DB'
    };
  }

  /**
   * 作業報告書生成
   */
  async generateWorkReport(data, options = {}) {
    const {
      workType = 'restoration',
      section = 'UNKNOWN',
      startDate = new Date(),
      endDate = new Date(),
      operator = 'システム',
      machineType = 'MTT 08-32',
      includeGraphs = true,
      format = 'html'
    } = options;

    // レポート構造の構築
    const report = {
      metadata: this.generateMetadata('作業報告書', section),
      summary: await this.generateWorkSummary(data, workType, section),
      details: await this.generateWorkDetails(data, options),
      statistics: this.calculateWorkStatistics(data),
      graphs: includeGraphs ? await this.generateGraphs(data) : null,
      recommendations: this.generateWorkRecommendations(data),
      footer: this.generateFooter()
    };

    // フォーマット別出力
    let output;
    switch (format) {
      case 'html':
        output = await this.renderHTMLReport(report, 'work');
        break;
      case 'json':
        output = JSON.stringify(report, null, 2);
        break;
      case 'markdown':
        output = this.renderMarkdownReport(report, 'work');
        break;
      default:
        output = this.renderTextReport(report, 'work');
    }

    return {
      content: output,
      format: format,
      filename: `work_report_${section}_${Date.now()}.${this.getFileExtension(format)}`,
      metadata: report.metadata
    };
  }

  /**
   * 品質検証レポート生成
   */
  async generateQualityReport(qualityData, options = {}) {
    const {
      section = 'UNKNOWN',
      dataType = 'level',
      includeDetailed = true,
      includeComparison = false,
      beforeData = null,
      format = 'html'
    } = options;

    const report = {
      metadata: this.generateMetadata('品質検証レポート', section),
      executive: this.generateExecutiveSummary(qualityData),
      qualityAnalysis: {
        overallScore: qualityData.score,
        level: qualityData.level,
        passed: qualityData.passed,
        statistics: qualityData.statistics,
        anomalies: this.formatAnomalies(qualityData.anomalies)
      },
      detailedAnalysis: includeDetailed ?
        await this.generateDetailedQualityAnalysis(qualityData) : null,
      comparison: includeComparison && beforeData ?
        await this.generateComparisonAnalysis(beforeData, qualityData) : null,
      recommendations: qualityData.recommendations,
      appendix: this.generateQualityAppendix(qualityData)
    };

    // レポート出力
    let output;
    switch (format) {
      case 'html':
        output = await this.renderHTMLReport(report, 'quality');
        break;
      case 'pdf':
        output = await this.renderPDFReport(report, 'quality');
        break;
      default:
        output = this.renderMarkdownReport(report, 'quality');
    }

    return {
      content: output,
      format: format,
      filename: `quality_report_${section}_${Date.now()}.${this.getFileExtension(format)}`,
      metadata: report.metadata
    };
  }

  /**
   * 解析結果レポート生成
   */
  async generateAnalysisReport(analysisData, options = {}) {
    const {
      analysisType = 'restoration',
      section = 'UNKNOWN',
      includeRawData = false,
      includeMethodology = true,
      format = 'html'
    } = options;

    const report = {
      metadata: this.generateMetadata('解析結果レポート', section),
      overview: this.generateAnalysisOverview(analysisData, analysisType),
      methodology: includeMethodology ?
        this.generateMethodologySection(analysisType) : null,
      results: {
        primary: this.formatPrimaryResults(analysisData),
        secondary: this.formatSecondaryResults(analysisData),
        statistical: this.generateStatisticalAnalysis(analysisData)
      },
      visualization: await this.generateAnalysisVisualization(analysisData),
      interpretation: this.generateInterpretation(analysisData, analysisType),
      rawData: includeRawData ? this.formatRawData(analysisData) : null,
      conclusions: this.generateConclusions(analysisData)
    };

    let output;
    switch (format) {
      case 'html':
        output = await this.renderHTMLReport(report, 'analysis');
        break;
      case 'excel':
        output = await this.renderExcelReport(report, 'analysis');
        break;
      default:
        output = this.renderMarkdownReport(report, 'analysis');
    }

    return {
      content: output,
      format: format,
      filename: `analysis_report_${analysisType}_${Date.now()}.${this.getFileExtension(format)}`,
      metadata: report.metadata
    };
  }

  /**
   * 比較レポート生成（作業前後）
   */
  async generateComparisonReport(beforeData, afterData, options = {}) {
    const {
      section = 'UNKNOWN',
      workDate = new Date(),
      includeDetailedComparison = true,
      format = 'html'
    } = options;

    // 改善率計算
    const improvements = this.calculateImprovements(beforeData, afterData);

    const report = {
      metadata: this.generateMetadata('作業前後比較レポート', section),
      summary: {
        workDate: workDate,
        overallImprovement: improvements.overall,
        keyMetrics: improvements.metrics
      },
      beforeAnalysis: {
        statistics: beforeData.statistics,
        qualityLevel: beforeData.qualityLevel,
        issues: beforeData.issues
      },
      afterAnalysis: {
        statistics: afterData.statistics,
        qualityLevel: afterData.qualityLevel,
        remainingIssues: afterData.issues
      },
      improvements: improvements,
      detailedComparison: includeDetailedComparison ?
        await this.generateDetailedComparison(beforeData, afterData) : null,
      visualization: await this.generateComparisonCharts(beforeData, afterData),
      effectiveness: this.evaluateWorkEffectiveness(improvements),
      recommendations: this.generatePostWorkRecommendations(afterData, improvements)
    };

    let output;
    switch (format) {
      case 'html':
        output = await this.renderHTMLReport(report, 'comparison');
        break;
      case 'powerpoint':
        output = await this.renderPresentationReport(report);
        break;
      default:
        output = this.renderMarkdownReport(report, 'comparison');
    }

    return {
      content: output,
      format: format,
      filename: `comparison_report_${section}_${Date.now()}.${this.getFileExtension(format)}`,
      metadata: report.metadata
    };
  }

  /**
   * サマリーレポート生成
   */
  async generateSummaryReport(allData, options = {}) {
    const {
      period = 'monthly',
      sections = [],
      format = 'html'
    } = options;

    const report = {
      metadata: this.generateMetadata('総合サマリーレポート', 'ALL'),
      period: this.formatPeriod(period),
      overview: this.generateOverallSummary(allData),
      sectionReports: await this.generateSectionReports(sections, allData),
      trends: this.analyzeTrends(allData),
      performance: this.calculatePerformanceMetrics(allData),
      issues: this.consolidateIssues(allData),
      recommendations: this.generateStrategicRecommendations(allData),
      forecast: this.generateForecast(allData)
    };

    let output;
    switch (format) {
      case 'html':
        output = await this.renderHTMLReport(report, 'summary');
        break;
      case 'dashboard':
        output = await this.renderDashboardReport(report);
        break;
      default:
        output = this.renderMarkdownReport(report, 'summary');
    }

    return {
      content: output,
      format: format,
      filename: `summary_report_${period}_${Date.now()}.${this.getFileExtension(format)}`,
      metadata: report.metadata
    };
  }

  // ========== HTML レンダリング ==========

  /**
   * HTMLレポート生成
   */
  async renderHTMLReport(report, type) {
    const template = await this.getHTMLTemplate(type);

    let html = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${report.metadata.title}</title>
    <style>
        ${this.getCSS()}
    </style>
</head>
<body>
    <div class="report-container">
        ${this.renderHeader(report.metadata)}
        ${this.renderContent(report, type)}
        ${this.renderFooter(report.footer || this.generateFooter())}
    </div>
    <script>
        ${this.getJavaScript()}
    </script>
</body>
</html>`;

    return html;
  }

  /**
   * CSSスタイル
   */
  getCSS() {
    return `
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        line-height: 1.6;
        color: #333;
        margin: 0;
        padding: 0;
        background: #f5f5f5;
      }
      .report-container {
        max-width: 1200px;
        margin: 0 auto;
        background: white;
        box-shadow: 0 0 20px rgba(0,0,0,0.1);
      }
      .header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 40px;
        text-align: center;
      }
      .header h1 {
        margin: 0;
        font-size: 2.5em;
      }
      .metadata {
        display: flex;
        justify-content: center;
        gap: 30px;
        margin-top: 20px;
        font-size: 0.9em;
        opacity: 0.9;
      }
      .content {
        padding: 40px;
      }
      .section {
        margin-bottom: 40px;
      }
      .section h2 {
        color: #4A90E2;
        border-bottom: 2px solid #4A90E2;
        padding-bottom: 10px;
      }
      .statistics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin: 20px 0;
      }
      .stat-card {
        background: #f8f9fa;
        padding: 20px;
        border-radius: 8px;
        text-align: center;
        border-left: 4px solid #4A90E2;
      }
      .stat-value {
        font-size: 2em;
        font-weight: bold;
        color: #4A90E2;
      }
      .stat-label {
        color: #666;
        margin-top: 5px;
      }
      .table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
      }
      .table th, .table td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid #ddd;
      }
      .table th {
        background: #f8f9fa;
        font-weight: 600;
      }
      .alert {
        padding: 15px;
        border-radius: 5px;
        margin: 20px 0;
      }
      .alert-success {
        background: #d4edda;
        border-left: 4px solid #28a745;
        color: #155724;
      }
      .alert-warning {
        background: #fff3cd;
        border-left: 4px solid #ffc107;
        color: #856404;
      }
      .alert-danger {
        background: #f8d7da;
        border-left: 4px solid #dc3545;
        color: #721c24;
      }
      .chart-container {
        margin: 30px 0;
        padding: 20px;
        background: #f8f9fa;
        border-radius: 8px;
      }
      .footer {
        background: #2c3e50;
        color: white;
        padding: 30px;
        text-align: center;
      }
      .recommendations {
        background: #e8f4f8;
        border-left: 4px solid #3498db;
        padding: 20px;
        margin: 20px 0;
      }
      .recommendation-item {
        margin: 10px 0;
        padding: 10px;
        background: white;
        border-radius: 5px;
      }
      @media print {
        .report-container {
          box-shadow: none;
        }
        .header {
          background: none;
          color: black;
        }
      }
    `;
  }

  /**
   * JavaScript
   */
  getJavaScript() {
    return `
      // チャート描画用の簡易スクリプト
      document.addEventListener('DOMContentLoaded', function() {
        // アニメーション効果
        const cards = document.querySelectorAll('.stat-card');
        cards.forEach((card, index) => {
          card.style.opacity = '0';
          card.style.transform = 'translateY(20px)';
          setTimeout(() => {
            card.style.transition = 'all 0.5s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
          }, index * 100);
        });

        // 印刷ボタン
        const printBtn = document.getElementById('printBtn');
        if (printBtn) {
          printBtn.addEventListener('click', () => window.print());
        }
      });
    `;
  }

  /**
   * ヘッダーレンダリング
   */
  renderHeader(metadata) {
    return `
      <div class="header">
        <h1>${metadata.title}</h1>
        <div class="metadata">
          <span>📅 ${metadata.date}</span>
          <span>📍 ${metadata.section}</span>
          <span>🏢 ${metadata.company}</span>
        </div>
      </div>
    `;
  }

  /**
   * コンテンツレンダリング
   */
  renderContent(report, type) {
    let content = '<div class="content">';

    switch (type) {
      case 'work':
        content += this.renderWorkContent(report);
        break;
      case 'quality':
        content += this.renderQualityContent(report);
        break;
      case 'analysis':
        content += this.renderAnalysisContent(report);
        break;
      case 'comparison':
        content += this.renderComparisonContent(report);
        break;
      case 'summary':
        content += this.renderSummaryContent(report);
        break;
    }

    content += '</div>';
    return content;
  }

  /**
   * 作業レポートコンテンツ
   */
  renderWorkContent(report) {
    let html = '';

    // サマリーセクション
    if (report.summary) {
      html += `
        <div class="section">
          <h2>作業概要</h2>
          ${this.renderSummary(report.summary)}
        </div>
      `;
    }

    // 統計セクション
    if (report.statistics) {
      html += `
        <div class="section">
          <h2>作業統計</h2>
          <div class="statistics-grid">
            ${this.renderStatistics(report.statistics)}
          </div>
        </div>
      `;
    }

    // グラフセクション
    if (report.graphs) {
      html += `
        <div class="section">
          <h2>作業データ可視化</h2>
          <div class="chart-container">
            ${report.graphs}
          </div>
        </div>
      `;
    }

    // 推奨事項
    if (report.recommendations) {
      html += `
        <div class="section">
          <h2>推奨事項</h2>
          <div class="recommendations">
            ${this.renderRecommendations(report.recommendations)}
          </div>
        </div>
      `;
    }

    return html;
  }

  /**
   * 品質レポートコンテンツ
   */
  renderQualityContent(report) {
    let html = '';

    // エグゼクティブサマリー
    if (report.executive) {
      html += `
        <div class="section">
          <h2>エグゼクティブサマリー</h2>
          ${this.renderExecutiveSummary(report.executive)}
        </div>
      `;
    }

    // 品質分析
    if (report.qualityAnalysis) {
      html += `
        <div class="section">
          <h2>品質分析結果</h2>
          ${this.renderQualityAnalysis(report.qualityAnalysis)}
        </div>
      `;
    }

    // 詳細分析
    if (report.detailedAnalysis) {
      html += `
        <div class="section">
          <h2>詳細分析</h2>
          ${report.detailedAnalysis}
        </div>
      `;
    }

    // 推奨事項
    if (report.recommendations) {
      html += `
        <div class="section">
          <h2>改善推奨事項</h2>
          ${this.renderRecommendations(report.recommendations)}
        </div>
      `;
    }

    return html;
  }

  // ========== Markdown レンダリング ==========

  /**
   * Markdownレポート生成
   */
  renderMarkdownReport(report, type) {
    let markdown = '';

    // ヘッダー
    markdown += `# ${report.metadata.title}\n\n`;
    markdown += `**日付**: ${report.metadata.date}\n`;
    markdown += `**区間**: ${report.metadata.section}\n`;
    markdown += `**作成者**: ${report.metadata.company}\n\n`;
    markdown += `---\n\n`;

    // コンテンツ
    switch (type) {
      case 'work':
        markdown += this.renderWorkMarkdown(report);
        break;
      case 'quality':
        markdown += this.renderQualityMarkdown(report);
        break;
      case 'analysis':
        markdown += this.renderAnalysisMarkdown(report);
        break;
      case 'comparison':
        markdown += this.renderComparisonMarkdown(report);
        break;
      case 'summary':
        markdown += this.renderSummaryMarkdown(report);
        break;
    }

    // フッター
    markdown += `\n---\n\n`;
    markdown += `*Generated by ${this.config.systemName} v${this.config.version}*\n`;

    return markdown;
  }

  /**
   * 作業レポートMarkdown
   */
  renderWorkMarkdown(report) {
    let md = '';

    if (report.summary) {
      md += '## 作業概要\n\n';
      md += this.objectToMarkdownTable(report.summary);
      md += '\n';
    }

    if (report.statistics) {
      md += '## 作業統計\n\n';
      md += this.statisticsToMarkdown(report.statistics);
      md += '\n';
    }

    if (report.recommendations) {
      md += '## 推奨事項\n\n';
      report.recommendations.forEach(rec => {
        md += `- **${rec.priority}**: ${rec.action}\n`;
        md += `  - 理由: ${rec.reason}\n`;
      });
      md += '\n';
    }

    return md;
  }

  // ========== ヘルパー関数 ==========

  /**
   * メタデータ生成
   */
  generateMetadata(title, section) {
    return {
      title: title,
      section: section,
      date: new Date().toLocaleDateString('ja-JP'),
      time: new Date().toLocaleTimeString('ja-JP'),
      company: this.config.company,
      department: this.config.department,
      system: this.config.systemName,
      version: this.config.version
    };
  }

  /**
   * フッター生成
   */
  generateFooter() {
    return {
      copyright: `© ${new Date().getFullYear()} ${this.config.company}`,
      generatedBy: `${this.config.systemName} v${this.config.version}`,
      timestamp: new Date().toISOString(),
      disclaimer: 'このレポートは自動生成されました。内容の最終確認をお願いします。'
    };
  }

  /**
   * 作業サマリー生成
   */
  async generateWorkSummary(data, workType, section) {
    return {
      workType: this.getWorkTypeLabel(workType),
      section: section,
      dataPoints: data.length,
      processedLength: this.calculateProcessedLength(data),
      averageCorrection: this.calculateAverageCorrection(data),
      maxCorrection: this.calculateMaxCorrection(data),
      status: 'completed',
      quality: this.assessWorkQuality(data)
    };
  }

  /**
   * 作業統計計算
   */
  calculateWorkStatistics(data) {
    const values = data.map(d => d.value || d);

    return {
      totalPoints: data.length,
      mean: this.calculateMean(values),
      stdDev: this.calculateStdDev(values),
      min: Math.min(...values),
      max: Math.max(...values),
      rms: this.calculateRMS(values),
      totalWork: values.reduce((a, b) => a + Math.abs(b), 0),
      efficiency: this.calculateEfficiency(data)
    };
  }

  /**
   * 改善率計算
   */
  calculateImprovements(beforeData, afterData) {
    const beforeStats = this.calculateWorkStatistics(beforeData);
    const afterStats = this.calculateWorkStatistics(afterData);

    return {
      overall: ((beforeStats.rms - afterStats.rms) / beforeStats.rms * 100).toFixed(1),
      metrics: {
        rms: ((beforeStats.rms - afterStats.rms) / beforeStats.rms * 100).toFixed(1),
        stdDev: ((beforeStats.stdDev - afterStats.stdDev) / beforeStats.stdDev * 100).toFixed(1),
        max: ((beforeStats.max - afterStats.max) / beforeStats.max * 100).toFixed(1),
        mean: ((beforeStats.mean - afterStats.mean) / beforeStats.mean * 100).toFixed(1)
      }
    };
  }

  /**
   * グラフ生成
   */
  async generateGraphs(data) {
    // 簡易的なSVGグラフ生成
    const width = 800;
    const height = 400;
    const padding = 40;

    const values = data.map(d => d.value || d);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const range = maxValue - minValue;

    let svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="${height}" fill="white"/>
        <g transform="translate(${padding}, ${padding})">
    `;

    // 軸の描画
    svg += `
      <line x1="0" y1="${height - padding * 2}" x2="${width - padding * 2}" y2="${height - padding * 2}"
            stroke="black" stroke-width="1"/>
      <line x1="0" y1="0" x2="0" y2="${height - padding * 2}"
            stroke="black" stroke-width="1"/>
    `;

    // データプロット
    const xStep = (width - padding * 2) / values.length;
    const yScale = (height - padding * 2) / range;

    let pathData = `M 0 ${(height - padding * 2) - (values[0] - minValue) * yScale}`;

    values.forEach((value, index) => {
      const x = index * xStep;
      const y = (height - padding * 2) - (value - minValue) * yScale;
      pathData += ` L ${x} ${y}`;
    });

    svg += `<path d="${pathData}" stroke="${this.chartColors.primary}" stroke-width="2" fill="none"/>`;

    svg += '</g></svg>';

    return svg;
  }

  /**
   * ファイル拡張子取得
   */
  getFileExtension(format) {
    const extensions = {
      html: 'html',
      pdf: 'pdf',
      excel: 'xlsx',
      json: 'json',
      markdown: 'md',
      text: 'txt',
      powerpoint: 'pptx',
      dashboard: 'html'
    };

    return extensions[format] || 'txt';
  }

  /**
   * 統計値計算補助関数
   */
  calculateMean(values) {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  calculateStdDev(values) {
    const mean = this.calculateMean(values);
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  calculateRMS(values) {
    return Math.sqrt(values.reduce((a, b) => a + b * b, 0) / values.length);
  }

  calculateEfficiency(data) {
    // 作業効率の簡易計算
    const totalWork = data.reduce((sum, d) => sum + Math.abs(d.value || d), 0);
    const idealWork = data.length * 2; // 理想的な作業量
    return Math.min(100, (idealWork / totalWork) * 100);
  }

  /**
   * ラベル取得
   */
  getWorkTypeLabel(workType) {
    const labels = {
      restoration: '復元処理',
      alignment: '通り整正',
      leveling: '高低整正',
      tamping: 'つき固め',
      combined: '総合整正'
    };

    return labels[workType] || workType;
  }

  /**
   * その他のヘルパー関数
   */
  calculateProcessedLength(data) {
    if (!data || data.length === 0) return 0;
    return (data.length * 0.25).toFixed(2); // 0.25m間隔と仮定
  }

  calculateAverageCorrection(data) {
    const values = data.map(d => Math.abs(d.value || d));
    return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
  }

  calculateMaxCorrection(data) {
    const values = data.map(d => Math.abs(d.value || d));
    return Math.max(...values).toFixed(2);
  }

  assessWorkQuality(data) {
    const avg = this.calculateAverageCorrection(data);
    if (avg < 5) return 'Excellent';
    if (avg < 10) return 'Good';
    if (avg < 20) return 'Acceptable';
    return 'Needs Improvement';
  }

  formatAnomalies(anomalies) {
    return {
      total: anomalies.count || anomalies.total,
      critical: anomalies.critical || 0,
      warning: anomalies.warning || 0,
      types: anomalies.details || {}
    };
  }

  objectToMarkdownTable(obj) {
    let table = '| 項目 | 値 |\n|------|------|\n';
    for (const [key, value] of Object.entries(obj)) {
      table += `| ${key} | ${value} |\n`;
    }
    return table;
  }

  statisticsToMarkdown(stats) {
    let md = '';
    md += `- **データ点数**: ${stats.totalPoints}\n`;
    md += `- **平均値**: ${stats.mean.toFixed(3)} mm\n`;
    md += `- **標準偏差**: ${stats.stdDev.toFixed(3)} mm\n`;
    md += `- **最小値**: ${stats.min.toFixed(3)} mm\n`;
    md += `- **最大値**: ${stats.max.toFixed(3)} mm\n`;
    md += `- **RMS値**: ${stats.rms.toFixed(3)} mm\n`;
    return md;
  }

  renderStatistics(stats) {
    let html = '';
    const metrics = [
      { label: 'データ点数', value: stats.totalPoints, unit: '点' },
      { label: '平均値', value: stats.mean.toFixed(2), unit: 'mm' },
      { label: '標準偏差', value: stats.stdDev.toFixed(2), unit: 'mm' },
      { label: '最大値', value: stats.max.toFixed(2), unit: 'mm' },
      { label: 'RMS値', value: stats.rms.toFixed(2), unit: 'mm' }
    ];

    metrics.forEach(metric => {
      html += `
        <div class="stat-card">
          <div class="stat-value">${metric.value}</div>
          <div class="stat-label">${metric.label} ${metric.unit}</div>
        </div>
      `;
    });

    return html;
  }

  renderRecommendations(recommendations) {
    let html = '';

    recommendations.forEach(rec => {
      const alertClass = rec.priority === 'high' ? 'alert-danger' :
                        rec.priority === 'medium' ? 'alert-warning' :
                        'alert-success';

      html += `
        <div class="recommendation-item ${alertClass}">
          <strong>${rec.action}</strong><br>
          <small>${rec.reason}</small>
        </div>
      `;
    });

    return html;
  }
}

module.exports = ReportGenerator;