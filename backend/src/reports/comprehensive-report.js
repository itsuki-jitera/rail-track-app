/**
 * 総合レポート生成器
 * PDFドキュメント P38-40の仕様に基づく実装
 * 全ての分析結果を統合したレポート生成
 */

const fs = require('fs').promises;
const path = require('path');
const PDFDocument = require('pdfkit');

class ComprehensiveReportGenerator {
  constructor(options = {}) {
    this.outputDir = options.outputDir || './output/reports';
    this.includeCharts = options.includeCharts !== false;
    this.language = options.language || 'ja';
  }

  /**
   * 総合レポートを生成
   * @param {Object} analysisData - 全分析データ
   * @param {Object} workSection - 作業区間情報
   * @returns {Promise<Object>} 生成されたレポートファイル情報
   */
  async generateReport(analysisData, workSection) {
    const report = {
      metadata: this.generateMetadata(workSection),
      summary: this.generateExecutiveSummary(analysisData),
      sections: []
    };

    // 1. 作業区間概要
    report.sections.push(this.generateWorkSectionOverview(workSection));

    // 2. 軌道狂い分析
    report.sections.push(this.generateTrackIrregularityAnalysis(analysisData.trackData));

    // 3. 移動量計算結果
    report.sections.push(this.generateMovementCalculationResults(analysisData.movements));

    // 4. 波長帯域分析
    report.sections.push(this.generateWavebandAnalysis(analysisData.wavebandAnalysis));

    // 5. 品質評価（σ値・良化率）
    report.sections.push(this.generateQualityAssessment(analysisData.qualityAnalysis));

    // 6. 縦曲線分析
    report.sections.push(this.generateVerticalCurveAnalysis(analysisData.verticalCurves));

    // 7. 手検測データ相関
    if (analysisData.fieldMeasurements) {
      report.sections.push(this.generateFieldMeasurementCorrelation(
        analysisData.fieldMeasurements
      ));
    }

    // 8. 推奨事項
    report.sections.push(this.generateRecommendations(analysisData));

    // 9. 付録
    report.appendix = this.generateAppendix(analysisData);

    // ファイル出力
    const outputs = await this.exportReport(report, workSection);

    return {
      report: report,
      files: outputs
    };
  }

  /**
   * メタデータ生成
   */
  generateMetadata(workSection) {
    return {
      reportId: this.generateReportId(),
      generatedAt: new Date().toISOString(),
      version: '1.0',
      lineName: workSection.lineName,
      lineDirection: workSection.lineDirection,
      workRange: `${workSection.startPosition}m - ${workSection.endPosition}m`,
      mttType: workSection.mttType,
      operator: workSection.operator || '未設定'
    };
  }

  /**
   * エグゼクティブサマリー生成
   */
  generateExecutiveSummary(analysisData) {
    const summary = {
      overview: '',
      keyFindings: [],
      criticalIssues: [],
      overallAssessment: ''
    };

    // 全体概要
    const quality = analysisData.qualityAnalysis?.overall;
    if (quality) {
      summary.overview = `整備により通り狂いが${quality.improvementRate.lateral}%、` +
        `高低狂いが${quality.improvementRate.vertical}%改善される見込みです。`;

      // 総合評価
      summary.overallAssessment = quality.evaluation.description;
    }

    // 主要な発見事項
    if (analysisData.wavebandAnalysis) {
      const dominant = analysisData.wavebandAnalysis.dominantWavelength;
      if (dominant) {
        summary.keyFindings.push(
          `支配的な波長: ${dominant.wavelength.toFixed(1)}m`
        );
      }
    }

    // 重要な課題
    if (analysisData.movements?.restrictions) {
      const restrictions = analysisData.movements.restrictions;
      if (restrictions.length > 0) {
        summary.criticalIssues.push(
          `${restrictions.length}箇所で移動量制限があります`
        );
      }
    }

    return summary;
  }

  /**
   * 作業区間概要セクション
   */
  generateWorkSectionOverview(workSection) {
    return {
      title: '作業区間概要',
      content: {
        基本情報: {
          線名: workSection.lineName,
          線別: this.formatLineDirection(workSection.lineDirection),
          作業方向: workSection.workDirection === 'forward' ? '下り' : '上り',
          作業区間: `${workSection.startPosition}m ～ ${workSection.endPosition}m`,
          作業延長: `${workSection.endPosition - workSection.startPosition}m`,
          前方バッファ: `${workSection.bufferBefore}m`,
          後方バッファ: `${workSection.bufferAfter}m`
        },
        MTT設定: {
          機種: workSection.mttType,
          レベリング弦長: `BC: ${workSection.mttConfig?.leveling?.bcLength}m, ` +
            `CD: ${workSection.mttConfig?.leveling?.cdLength}m`,
          ライニング弦長: `BC: ${workSection.mttConfig?.lining?.bcLength}m, ` +
            `CD: ${workSection.mttConfig?.lining?.cdLength}m`
        }
      }
    };
  }

  /**
   * 軌道狂い分析セクション
   */
  generateTrackIrregularityAnalysis(trackData) {
    if (!trackData) {
      return { title: '軌道狂い分析', content: 'データなし' };
    }

    const stats = this.calculateTrackStatistics(trackData);

    return {
      title: '軌道狂い分析',
      content: {
        測定概要: {
          測定日: trackData.measurementDate || '不明',
          データ点数: trackData.length,
          サンプリング間隔: '0.5m'
        },
        統計値: {
          高低左: stats.elevationLeft,
          高低右: stats.elevationRight,
          通り左: stats.alignmentLeft,
          通り右: stats.alignmentRight,
          軌間: stats.gauge,
          水準: stats.level
        },
        異常箇所: this.identifyAbnormalSections(trackData)
      }
    };
  }

  /**
   * 移動量計算結果セクション
   */
  generateMovementCalculationResults(movements) {
    if (!movements) {
      return { title: '移動量計算結果', content: 'データなし' };
    }

    return {
      title: '移動量計算結果',
      content: {
        計算方法: movements.method || '復元波形法',
        統計: {
          横方向: {
            最大: `${movements.stats?.lateral?.max || 0}mm`,
            最小: `${movements.stats?.lateral?.min || 0}mm`,
            平均: `${movements.stats?.lateral?.mean || 0}mm`,
            標準偏差: `${movements.stats?.lateral?.std || 0}mm`
          },
          縦方向: {
            最大: `${movements.stats?.vertical?.max || 0}mm`,
            最小: `${movements.stats?.vertical?.min || 0}mm`,
            平均: `${movements.stats?.vertical?.mean || 0}mm`,
            標準偏差: `${movements.stats?.vertical?.std || 0}mm`
          }
        },
        制限箇所: movements.restrictions || [],
        補正適用: movements.corrections || []
      }
    };
  }

  /**
   * 波長帯域分析セクション
   */
  generateWavebandAnalysis(wavebandAnalysis) {
    if (!wavebandAnalysis) {
      return { title: '波長帯域分析', content: 'データなし' };
    }

    const bands = wavebandAnalysis.wavebands || [];
    const bandResults = {};

    for (const band of bands) {
      bandResults[band.band.name] = {
        範囲: `${band.band.min}m - ${band.band.max}m`,
        パワー: `${band.power.toFixed(3)}`,
        寄与率: `${band.contribution.toFixed(1)}%`,
        RMS: `${band.statistics.rms.toFixed(3)}`
      };
    }

    return {
      title: '波長帯域分析',
      content: {
        波長帯域別結果: bandResults,
        支配的波長: wavebandAnalysis.dominantWavelength ?
          `${wavebandAnalysis.dominantWavelength.wavelength.toFixed(1)}m` : '不明',
        実効波長: `${wavebandAnalysis.statistics?.effectiveWavelength?.toFixed(1) || 0}m`
      }
    };
  }

  /**
   * 品質評価セクション
   */
  generateQualityAssessment(qualityAnalysis) {
    if (!qualityAnalysis) {
      return { title: '品質評価', content: 'データなし' };
    }

    const overall = qualityAnalysis.overall || {};

    return {
      title: '品質評価（σ値・良化率）',
      content: {
        全体評価: {
          整備前: {
            通り狂いσ値: `${overall.before?.lateral?.toFixed(2) || 0}mm`,
            高低狂いσ値: `${overall.before?.vertical?.toFixed(2) || 0}mm`
          },
          整備後予測: {
            通り狂いσ値: `${overall.after?.lateral?.toFixed(2) || 0}mm`,
            高低狂いσ値: `${overall.after?.vertical?.toFixed(2) || 0}mm`
          },
          良化率: {
            通り狂い: `${overall.improvementRate?.lateral || 0}%`,
            高低狂い: `${overall.improvementRate?.vertical || 0}%`
          },
          評価: overall.evaluation || {}
        },
        区間別評価: this.formatSectionEvaluation(qualityAnalysis.bySection)
      }
    };
  }

  /**
   * 縦曲線分析セクション
   */
  generateVerticalCurveAnalysis(verticalCurves) {
    if (!verticalCurves || verticalCurves.length === 0) {
      return { title: '縦曲線分析', content: '縦曲線なし' };
    }

    const curveList = verticalCurves.map((curve, index) => ({
      番号: index + 1,
      区間: `${curve.startPosition}m - ${curve.endPosition}m`,
      半径: `${curve.radius}m`,
      勾配変化: `${curve.startGradient}‰ → ${curve.endGradient}‰`,
      タイプ: curve.type,
      移動量制限: curve.movementLimits || '標準'
    }));

    return {
      title: '縦曲線分析',
      content: {
        縦曲線数: verticalCurves.length,
        縦曲線一覧: curveList,
        注意事項: this.generateVerticalCurveNotes(verticalCurves)
      }
    };
  }

  /**
   * 手検測データ相関セクション
   */
  generateFieldMeasurementCorrelation(fieldMeasurements) {
    const correlations = fieldMeasurements.correlations || [];

    const results = correlations.map(corr => ({
      測定種別: corr.type,
      相関係数: corr.coefficient.toFixed(3),
      位置補正: `${corr.shift}m`,
      信頼度: corr.confidence
    }));

    return {
      title: '手検測データ相関',
      content: {
        測定点数: fieldMeasurements.count || 0,
        相関結果: results,
        推奨位置補正: `${fieldMeasurements.recommendedShift || 0}m`,
        総合信頼度: fieldMeasurements.overallConfidence || '中'
      }
    };
  }

  /**
   * 推奨事項セクション
   */
  generateRecommendations(analysisData) {
    const recommendations = [];

    // 品質改善に関する推奨
    if (analysisData.qualityAnalysis?.recommendations) {
      recommendations.push(...analysisData.qualityAnalysis.recommendations);
    }

    // 波長帯域に関する推奨
    if (analysisData.wavebandAnalysis?.recommendations) {
      recommendations.push(...analysisData.wavebandAnalysis.recommendations);
    }

    // 移動量制限に関する推奨
    if (analysisData.movements?.restrictions?.length > 0) {
      recommendations.push({
        type: '移動量制限',
        priority: 'high',
        message: '移動量制限箇所があります。個別の対応が必要です。'
      });
    }

    return {
      title: '推奨事項',
      content: {
        高優先度: recommendations.filter(r => r.priority === 'high'),
        中優先度: recommendations.filter(r => r.priority === 'medium'),
        低優先度: recommendations.filter(r => r.priority === 'low'),
        総合所見: this.generateOverallComments(analysisData)
      }
    };
  }

  /**
   * 付録生成
   */
  generateAppendix(analysisData) {
    return {
      用語説明: this.getGlossary(),
      計算方法: this.getCalculationMethods(),
      参考基準値: this.getReferenceValues(),
      データ出力先: analysisData.exportedFiles || []
    };
  }

  /**
   * レポートをファイル出力
   */
  async exportReport(report, workSection) {
    await this.ensureDirectoryExists(this.outputDir);

    const outputs = {};

    // JSON形式で保存
    const jsonPath = path.join(
      this.outputDir,
      `report_${workSection.id}_${Date.now()}.json`
    );
    await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');
    outputs.json = jsonPath;

    // HTML形式で保存
    const htmlPath = await this.exportToHTML(report, workSection);
    outputs.html = htmlPath;

    // PDF形式で保存（オプション）
    if (this.includeCharts) {
      const pdfPath = await this.exportToPDF(report, workSection);
      outputs.pdf = pdfPath;
    }

    return outputs;
  }

  /**
   * HTML形式でエクスポート
   */
  async exportToHTML(report, workSection) {
    const html = this.generateHTMLReport(report);
    const htmlPath = path.join(
      this.outputDir,
      `report_${workSection.id}_${Date.now()}.html`
    );

    await fs.writeFile(htmlPath, html, 'utf8');
    return htmlPath;
  }

  /**
   * HTMLレポート生成
   */
  generateHTMLReport(report) {
    let html = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>軌道整正計算レポート</title>
    <style>
        body { font-family: 'メイリオ', sans-serif; margin: 20px; }
        h1 { color: #333; border-bottom: 2px solid #007bff; }
        h2 { color: #555; margin-top: 30px; }
        table { border-collapse: collapse; width: 100%; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .summary { background-color: #f9f9f9; padding: 15px; border-radius: 5px; }
        .warning { color: #ff6600; font-weight: bold; }
        .success { color: #00cc00; font-weight: bold; }
    </style>
</head>
<body>
    <h1>軌道整正計算レポート</h1>
    <div class="summary">
        <h2>概要</h2>
        <p>${report.summary.overview}</p>
        <p>総合評価: <span class="${this.getAssessmentClass(report.summary.overallAssessment)}">${report.summary.overallAssessment}</span></p>
    </div>`;

    // 各セクションを追加
    for (const section of report.sections) {
      html += this.generateHTMLSection(section);
    }

    html += `
    <footer>
        <p>生成日時: ${report.metadata.generatedAt}</p>
        <p>レポートID: ${report.metadata.reportId}</p>
    </footer>
</body>
</html>`;

    return html;
  }

  /**
   * HTMLセクション生成
   */
  generateHTMLSection(section) {
    let html = `<h2>${section.title}</h2>`;

    if (typeof section.content === 'string') {
      html += `<p>${section.content}</p>`;
    } else {
      html += this.objectToHTML(section.content);
    }

    return html;
  }

  /**
   * オブジェクトをHTML変換
   */
  objectToHTML(obj, depth = 0) {
    if (!obj) return '';

    let html = '';

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && !Array.isArray(value)) {
        html += `<h${3 + depth}>${key}</h${3 + depth}>`;
        html += this.objectToHTML(value, depth + 1);
      } else if (Array.isArray(value)) {
        html += `<h${3 + depth}>${key}</h${3 + depth}><ul>`;
        for (const item of value) {
          if (typeof item === 'object') {
            html += '<li>' + this.objectToHTML(item, depth + 1) + '</li>';
          } else {
            html += `<li>${item}</li>`;
          }
        }
        html += '</ul>';
      } else {
        html += `<p><strong>${key}:</strong> ${value}</p>`;
      }
    }

    return html;
  }

  /**
   * PDF形式でエクスポート（簡易版）
   */
  async exportToPDF(report, workSection) {
    // PDFKitを使用した実装（簡略化）
    const pdfPath = path.join(
      this.outputDir,
      `report_${workSection.id}_${Date.now()}.pdf`
    );

    // 実際のPDF生成は複雑なため、ここでは概要のみ
    // 実装時はPDFKitまたは他のPDFライブラリを使用

    return pdfPath;
  }

  /**
   * ヘルパー関数群
   */

  formatLineDirection(direction) {
    const map = { 'up': '上り', 'down': '下り', 'single': '単線' };
    return map[direction] || direction;
  }

  calculateTrackStatistics(trackData) {
    // 簡略化した統計計算
    return {
      elevationLeft: { mean: 0, std: 0, max: 0, min: 0 },
      elevationRight: { mean: 0, std: 0, max: 0, min: 0 },
      alignmentLeft: { mean: 0, std: 0, max: 0, min: 0 },
      alignmentRight: { mean: 0, std: 0, max: 0, min: 0 },
      gauge: { mean: 0, std: 0, max: 0, min: 0 },
      level: { mean: 0, std: 0, max: 0, min: 0 }
    };
  }

  identifyAbnormalSections(trackData) {
    // 異常箇所の特定（簡略化）
    return [];
  }

  formatSectionEvaluation(sections) {
    if (!sections) return [];
    return sections.map(s => ({
      区間: s.section,
      改善率: `横: ${s.quality?.improvementRate?.lateral || 0}%, 縦: ${s.quality?.improvementRate?.vertical || 0}%`
    }));
  }

  generateVerticalCurveNotes(curves) {
    const notes = [];
    for (const curve of curves) {
      if (curve.radius < 7500) {
        notes.push(`${curve.startPosition}m-${curve.endPosition}m: 急縦曲線`);
      }
    }
    return notes;
  }

  generateOverallComments(analysisData) {
    return '計算結果に基づき、適切な整備作業を実施してください。';
  }

  getAssessmentClass(assessment) {
    if (assessment.includes('良好')) return 'success';
    if (assessment.includes('注意')) return 'warning';
    return '';
  }

  getGlossary() {
    return {
      'σ値': '標準偏差を表す統計値',
      '良化率': '整備前後の改善度合いを示す指標',
      'MTT': 'Multiple Tie Tamper（マルタイ）',
      '復元波形': '測定データから逆算した理想的な軌道形状'
    };
  }

  getCalculationMethods() {
    return {
      '移動量計算': '復元波形法による計算',
      'FFT': '高速フーリエ変換による周波数解析',
      '相関計算': 'ピアソンの積率相関係数'
    };
  }

  getReferenceValues() {
    return {
      '標準σ値': { 通り: '2.0mm以下', 高低: '2.0mm以下' },
      '目標良化率': '40%以上',
      '移動量上限': { 横: '50mm', 縦: '50mm' }
    };
  }

  generateReportId() {
    return `RPT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }
}

module.exports = ComprehensiveReportGenerator;