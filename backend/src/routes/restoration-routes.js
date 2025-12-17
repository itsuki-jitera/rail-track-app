/**
 * 復元波形計算API
 * Restoration waveform calculation routes
 */

const express = require('express');
const router = express.Router();

// アルゴリズム
const { RestorationEngine } = require('../algorithms/restoration-engine');
const { PlanLineEditor } = require('../algorithms/plan-line-editor');
const { CrossingMethod } = require('../algorithms/crossing-method');
const { PlanLineRefinement } = require('../algorithms/plan-line-refinement');
const { VersineConverter } = require('../algorithms/versine-converter');
const PlanLineZeroPointSystem = require('../algorithms/plan-line-zero-point');
const CorrelationMatcher = require('../algorithms/correlation-matcher');

// Phase 5: 復元波形計算システム
const RestorationFilter = require('../algorithms/restoration-filter');
const MovementCalculator = require('../algorithms/movement-calculator');

// キヤデータパーサー
const { parseKiyaO010, convertToPlanLineData } = require('../parsers/kiya-o010-parser');

/**
 * 復元波形計算
 * POST /api/restoration/calculate
 */
router.post('/calculate', async (req, res) => {
  try {
    const { measurementData, options } = req.body;

    if (!measurementData || !Array.isArray(measurementData)) {
      return res.status(400).json({
        success: false,
        error: 'Measurement data is required (format: [{ distance, value }])'
      });
    }

    console.log(`復元波形計算開始: ${measurementData.length}点`);

    const engine = new RestorationEngine(options);
    const result = engine.calculate(measurementData, options);

    if (!result.success) {
      console.error('復元波形計算失敗:', result.error);
      return res.status(500).json(result);
    }

    // フロントエンドが期待する形式に変換
    const response = {
      success: true,
      data: {
        restorationWaveform: result.restoredWaveform || [],
        planLine: result.planLine || [],
        movementAmounts: result.movementData?.map(d => ({
          distance: d.distance,
          amount: d.tamping
        })) || [],
        zeroCrossPoints: [], // TODO: ゼロクロス点の計算を実装
        filterInfo: {
          minFreq: 1 / (options?.maxWavelength || 40),
          maxFreq: 1 / (options?.minWavelength || 6),
          minWavelength: options?.minWavelength || 6,
          maxWavelength: options?.maxWavelength || 40
        },
        metadata: {
          originalDataPoints: measurementData.length,
          resampledDataPoints: result.restoredWaveform?.length || 0,
          fftSize: 1024, // TODO: 実際のFFTサイズを取得
          zeroCrossCount: 0,
          minWavelength: options?.minWavelength || 6,
          maxWavelength: options?.maxWavelength || 40,
          samplingInterval: options?.samplingInterval || 0.25
        }
      }
    };

    console.log('復元波形計算完了');
    res.json(response);
  } catch (error) {
    console.error('Restoration calculation error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

/**
 * 計画線生成
 * POST /api/restoration/generate-plan-line
 */
router.post('/generate-plan-line', async (req, res) => {
  try {
    const { restoredWaveform, windowSize } = req.body;

    if (!restoredWaveform || !Array.isArray(restoredWaveform)) {
      return res.status(400).json({
        success: false,
        error: 'Restored waveform is required'
      });
    }

    const editor = new PlanLineEditor();
    const planLine = editor.generateInitialPlanLine(restoredWaveform, windowSize || 800);

    res.json({
      success: true,
      planLine,
      windowSize: windowSize || 800
    });
  } catch (error) {
    console.error('Plan line generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ゼロ点計画線計算
 * POST /api/restoration/zero-point-plan-line
 */
router.post('/zero-point-plan-line', async (req, res) => {
  try {
    const { restoredWaveform, restrictions = {}, options = {} } = req.body;

    if (!restoredWaveform || !Array.isArray(restoredWaveform)) {
      return res.status(400).json({
        success: false,
        error: 'Restored waveform is required'
      });
    }

    console.log(`ゼロ点計画線計算開始: ${restoredWaveform.length}点`);

    const zeroPointSystem = new PlanLineZeroPointSystem(options);

    // ゼロクロス点の検出
    const zeroCrossPoints = zeroPointSystem.detectZeroCrossPoints(restoredWaveform);

    // 初期計画線の生成
    const initialPlanLine = zeroPointSystem.generateInitialPlanLine(
      zeroCrossPoints,
      restoredWaveform
    );

    // 移動量制限による調整
    const adjustedPlanLine = zeroPointSystem.adjustPlanLineWithRestrictions(
      initialPlanLine,
      restoredWaveform,
      restrictions
    );

    // 品質評価
    const quality = zeroPointSystem.evaluatePlanLineQuality(
      adjustedPlanLine,
      restoredWaveform
    );

    res.json({
      success: true,
      planLine: adjustedPlanLine,
      zeroCrossPoints,
      initialPlanLine,
      quality,
      statistics: {
        zeroCrossCount: zeroCrossPoints.length,
        averageMovement: quality.averageMovement,
        maxMovement: quality.maxMovement,
        upwardRatio: quality.upwardRatio,
        qualityScore: quality.quality
      }
    });
  } catch (error) {
    console.error('Zero point plan line error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 手検測データ相関マッチング
 * POST /api/restoration/correlation-match
 */
router.post('/correlation-match', async (req, res) => {
  try {
    const { chartData, fieldData, options = {} } = req.body;

    if (!chartData || !fieldData) {
      return res.status(400).json({
        success: false,
        error: 'Chart data and field data are required'
      });
    }

    console.log('相関マッチング開始');

    const matcher = new CorrelationMatcher(options);
    const result = matcher.findBestMatch(chartData, fieldData, options);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json({
      success: true,
      bestOffset: result.bestOffset,
      bestCorrelation: result.bestCorrelation,
      alignedFieldData: result.alignedFieldData,
      matchPosition: result.matchPosition,
      quality: result.quality,
      recommendation: result.recommendation,
      correlationResults: result.correlationResults
    });
  } catch (error) {
    console.error('Correlation matching error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 複数箇所手検測データマッチング
 * POST /api/restoration/multi-point-match
 */
router.post('/multi-point-match', async (req, res) => {
  try {
    const { chartData, multipleFieldData, options = {} } = req.body;

    if (!chartData || !multipleFieldData || !Array.isArray(multipleFieldData)) {
      return res.status(400).json({
        success: false,
        error: 'Chart data and multiple field data array are required'
      });
    }

    console.log(`複数点マッチング開始: ${multipleFieldData.length}箇所`);

    const matcher = new CorrelationMatcher(options);
    const result = matcher.multiPointMatching(chartData, multipleFieldData);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json({
      success: true,
      globalOffset: result.globalOffset,
      matchResults: result.matchResults,
      residuals: result.residuals,
      residualStdDev: result.residualStdDev,
      averageCorrelation: result.averageCorrelation,
      quality: result.quality,
      recommendation: result.recommendation
    });
  } catch (error) {
    console.error('Multi-point matching error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 計画線編集 - 直線設定
 * POST /api/restoration/set-straight-line
 */
router.post('/set-straight-line', async (req, res) => {
  try {
    const { planLine, startDistance, endDistance } = req.body;

    if (!planLine || !Array.isArray(planLine)) {
      return res.status(400).json({
        success: false,
        error: 'Plan line is required'
      });
    }

    const editor = new PlanLineEditor();
    const updatedPlanLine = editor.setStraightLine(planLine, startDistance, endDistance);

    res.json({
      success: true,
      planLine: updatedPlanLine
    });
  } catch (error) {
    console.error('Set straight line error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 計画線編集 - 曲線設定
 * POST /api/restoration/set-circular-curve
 */
router.post('/set-circular-curve', async (req, res) => {
  try {
    const { planLine, startDistance, endDistance, radius, direction } = req.body;

    if (!planLine || !Array.isArray(planLine)) {
      return res.status(400).json({
        success: false,
        error: 'Plan line is required'
      });
    }

    const editor = new PlanLineEditor();
    const updatedPlanLine = editor.setCircularCurve(
      planLine,
      startDistance,
      endDistance,
      radius,
      direction || 'left'
    );

    res.json({
      success: true,
      planLine: updatedPlanLine
    });
  } catch (error) {
    console.error('Set circular curve error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 計画線編集 - 平滑化
 * POST /api/restoration/smooth-section
 */
router.post('/smooth-section', async (req, res) => {
  try {
    const { planLine, startDistance, endDistance, windowSize } = req.body;

    if (!planLine || !Array.isArray(planLine)) {
      return res.status(400).json({
        success: false,
        error: 'Plan line is required'
      });
    }

    const editor = new PlanLineEditor();
    const updatedPlanLine = editor.smoothSection(
      planLine,
      startDistance,
      endDistance,
      windowSize || 100
    );

    res.json({
      success: true,
      planLine: updatedPlanLine
    });
  } catch (error) {
    console.error('Smooth section error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 交叉法 - 計画線接続
 * POST /api/restoration/connect-plan-lines
 */
router.post('/connect-plan-lines', async (req, res) => {
  try {
    const { planLine1, planLine2, crossingDistance, transitionLength } = req.body;

    if (!planLine1 || !planLine2) {
      return res.status(400).json({
        success: false,
        error: 'Both plan lines are required'
      });
    }

    const crossingMethod = new CrossingMethod();
    const connectedPlanLine = crossingMethod.connect(
      planLine1,
      planLine2,
      crossingDistance,
      transitionLength
    );

    res.json({
      success: true,
      planLine: connectedPlanLine
    });
  } catch (error) {
    console.error('Connect plan lines error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 計画線微調整 - ガウシアン平滑化
 * POST /api/restoration/gaussian-smoothing
 */
router.post('/gaussian-smoothing', async (req, res) => {
  try {
    const { planLine, sigma } = req.body;

    if (!planLine || !Array.isArray(planLine)) {
      return res.status(400).json({
        success: false,
        error: 'Plan line is required'
      });
    }

    const refinement = new PlanLineRefinement();
    const smoothedPlanLine = refinement.gaussianSmoothing(planLine, sigma || 5.0);

    res.json({
      success: true,
      planLine: smoothedPlanLine
    });
  } catch (error) {
    console.error('Gaussian smoothing error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 計画線微調整 - 異常値除去
 * POST /api/restoration/remove-outliers
 */
router.post('/remove-outliers', async (req, res) => {
  try {
    const { planLine, threshold } = req.body;

    if (!planLine || !Array.isArray(planLine)) {
      return res.status(400).json({
        success: false,
        error: 'Plan line is required'
      });
    }

    const refinement = new PlanLineRefinement();
    const result = refinement.removeOutliers(planLine, threshold);

    res.json({
      success: true,
      planLine: result.cleaned,
      outlierIndices: result.outliers,
      outlierCount: result.outliers.length
    });
  } catch (error) {
    console.error('Remove outliers error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 矢中弦変換
 * POST /api/restoration/calculate-versine
 */
router.post('/calculate-versine', async (req, res) => {
  try {
    const { measurementData, chordTypes } = req.body;

    if (!measurementData || !Array.isArray(measurementData)) {
      return res.status(400).json({
        success: false,
        error: 'Measurement data is required'
      });
    }

    const converter = new VersineConverter();
    const versineData = converter.convertMultiple(
      measurementData,
      chordTypes || ['10m', '20m', '40m']
    );

    // 統計情報も計算
    const statistics = {};
    for (const [chordType, data] of Object.entries(versineData)) {
      statistics[chordType] = converter.calculateStatistics(data);
    }

    res.json({
      success: true,
      versineData,
      statistics
    });
  } catch (error) {
    console.error('Versine calculation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 統計情報計算
 * POST /api/restoration/calculate-statistics
 */
router.post('/calculate-statistics', async (req, res) => {
  try {
    const { measurementData } = req.body;

    if (!measurementData || !Array.isArray(measurementData)) {
      return res.status(400).json({
        success: false,
        error: 'Measurement data is required'
      });
    }

    const converter = new VersineConverter();
    const statistics = converter.calculateStatistics(measurementData);

    res.json({
      success: true,
      statistics
    });
  } catch (error) {
    console.error('Statistics calculation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 周波数応答取得（デバッグ用）
 * GET /api/restoration/frequency-response
 */
router.get('/frequency-response', (req, res) => {
  try {
    const numPoints = parseInt(req.query.numPoints) || 512;

    const engine = new RestorationEngine();
    const frequencyResponse = engine.getFrequencyResponse(numPoints);

    res.json({
      success: true,
      frequencyResponse
    });
  } catch (error) {
    console.error('Frequency response error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * インパルス応答取得（デバッグ用）
 * GET /api/restoration/impulse-response
 */
router.get('/impulse-response', (req, res) => {
  try {
    const engine = new RestorationEngine();
    const impulseResponse = engine.getImpulseResponse();

    res.json({
      success: true,
      impulseResponse: Array.from(impulseResponse)
    });
  } catch (error) {
    console.error('Impulse response error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// Phase 5: VB6互換 復元波形計算API
// ========================================

/**
 * POST /api/restoration/vb6/calculate
 * VB6互換の復元波形計算 (KANA3相当)
 */
router.post('/vb6/calculate', (req, res) => {
  try {
    const { measurementData, filterParams } = req.body;

    if (!measurementData || !Array.isArray(measurementData)) {
      return res.status(400).json({
        success: false,
        error: '検測データが不正です'
      });
    }

    const dataType = filterParams?.dataType || 'alignment';
    const defaultParams = RestorationFilter.getDefaultParams(dataType);

    const params = {
      lambdaLower: filterParams?.lambdaLower || defaultParams.lambdaLower,
      lambdaUpper: filterParams?.lambdaUpper || defaultParams.lambdaUpper,
      dataInterval: filterParams?.dataInterval || defaultParams.dataInterval,
      dataType
    };

    const result = RestorationFilter.calculateRestorationWaveform(
      measurementData,
      params
    );

    res.json(result);
  } catch (error) {
    console.error('VB6復元波形計算エラー:', error);
    res.status(500).json({
      success: false,
      error: '復元波形計算中にエラーが発生しました',
      details: error.message
    });
  }
});

/**
 * POST /api/restoration/vb6/movement
 * VB6互換の移動量計算
 */
router.post('/vb6/movement', (req, res) => {
  try {
    const { restoredWaveform, planLine, restrictions } = req.body;

    if (!restoredWaveform || !Array.isArray(restoredWaveform)) {
      return res.status(400).json({
        success: false,
        error: '復元波形データが不正です'
      });
    }

    if (!planLine || !Array.isArray(planLine)) {
      return res.status(400).json({
        success: false,
        error: '計画線データが不正です'
      });
    }

    const result = MovementCalculator.calculateMovement(restoredWaveform, planLine);

    if (restrictions) {
      const violations = MovementCalculator.checkMovementRestrictions(
        result.movement,
        restrictions
      );
      result.violations = violations;
    }

    res.json(result);
  } catch (error) {
    console.error('VB6移動量計算エラー:', error);
    res.status(500).json({
      success: false,
      error: '移動量計算中にエラーが発生しました',
      details: error.message
    });
  }
});

/**
 * POST /api/restoration/vb6/peaks
 * ピーク値抽出
 */
router.post('/vb6/peaks', (req, res) => {
  try {
    const { data, windowSize = 10 } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        error: 'データが不正です'
      });
    }

    const result = MovementCalculator.extractPeakValues(data, windowSize);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('ピーク値抽出エラー:', error);
    res.status(500).json({
      success: false,
      error: 'ピーク値抽出中にエラーが発生しました',
      details: error.message
    });
  }
});

/**
 * GET /api/restoration/vb6/default-params/:dataType
 * データタイプ別のデフォルトパラメータ取得
 */
router.get('/vb6/default-params/:dataType', (req, res) => {
  try {
    const { dataType } = req.params;
    const params = RestorationFilter.getDefaultParams(dataType);

    res.json({
      success: true,
      dataType,
      params
    });
  } catch (error) {
    console.error('デフォルトパラメータ取得エラー:', error);
    res.status(500).json({
      success: false,
      error: 'デフォルトパラメータ取得中にエラーが発生しました',
      details: error.message
    });
  }
});

/**
 * POST /api/restoration/vb6/curve-section-statistics
 * 曲線区間ごとの統計分析
 */
router.post('/vb6/curve-section-statistics', (req, res) => {
  try {
    const { restoredWaveform, movement, curveSpecs, dataInterval = 0.25, startKP = 0 } = req.body;

    if (!restoredWaveform || !Array.isArray(restoredWaveform)) {
      return res.status(400).json({
        success: false,
        error: '復元波形データが不正です'
      });
    }

    if (!curveSpecs || !Array.isArray(curveSpecs) || curveSpecs.length === 0) {
      return res.status(400).json({
        success: false,
        error: '曲線諸元データが不正です'
      });
    }

    const sectionStatistics = [];

    // 各曲線区間ごとに統計を計算
    for (const curve of curveSpecs) {
      const sectionData = {
        restoredValues: [],
        movementValues: [],
        indices: []
      };

      // 区間内のデータポイントを抽出
      for (let i = 0; i < restoredWaveform.length; i++) {
        const currentKP = startKP + i * dataInterval;

        if (currentKP >= curve.startKP && currentKP < curve.endKP) {
          sectionData.restoredValues.push(restoredWaveform[i]);
          if (movement && movement[i] !== undefined) {
            sectionData.movementValues.push(Math.abs(movement[i]));
          }
          sectionData.indices.push(i);
        }
      }

      // 統計計算関数
      const calculateStats = (values) => {
        if (values.length === 0) {
          return { min: 0, max: 0, mean: 0, sigma: 0, count: 0 };
        }

        const min = Math.min(...values);
        const max = Math.max(...values);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;

        const variance = values.reduce((sum, val) =>
          sum + Math.pow(val - mean, 2), 0
        ) / values.length;
        const sigma = Math.sqrt(variance);

        return { min, max, mean, sigma, count: values.length };
      };

      const restoredStats = calculateStats(sectionData.restoredValues);
      const movementStats = movement ? calculateStats(sectionData.movementValues) : null;

      sectionStatistics.push({
        curve: {
          startKP: curve.startKP,
          endKP: curve.endKP,
          curveType: curve.curveType,
          radius: curve.radius,
          cant: curve.cant,
          direction: curve.direction,
          label: curve.label,
          length: curve.endKP - curve.startKP
        },
        restoredWaveform: restoredStats,
        movement: movementStats,
        dataPoints: sectionData.indices.length
      });
    }

    // 全体統計
    const overallStats = {
      totalSections: sectionStatistics.length,
      straightSections: sectionStatistics.filter(s => s.curve.curveType === 'straight').length,
      transitionSections: sectionStatistics.filter(s => s.curve.curveType === 'transition').length,
      circularSections: sectionStatistics.filter(s => s.curve.curveType === 'circular').length
    };

    res.json({
      success: true,
      sectionStatistics,
      overallStats,
      message: `${sectionStatistics.length}区間の統計分析を完了しました`
    });

  } catch (error) {
    console.error('曲線区間統計分析エラー:', error);
    res.status(500).json({
      success: false,
      error: '曲線区間統計分析中にエラーが発生しました',
      details: error.message
    });
  }
});

/**
 * POST /api/restoration/vb6/auto-plan-from-curves
 * 曲線諸元に基づく自動計画線生成
 */
router.post('/vb6/auto-plan-from-curves', (req, res) => {
  try {
    const { restoredWaveform, curveSpecs, dataInterval = 0.25, startKP = 0 } = req.body;

    if (!restoredWaveform || !Array.isArray(restoredWaveform)) {
      return res.status(400).json({
        success: false,
        error: '復元波形データが不正です'
      });
    }

    if (!curveSpecs || !Array.isArray(curveSpecs) || curveSpecs.length === 0) {
      return res.status(400).json({
        success: false,
        error: '曲線諸元データが不正です'
      });
    }

    // 計画線初期化（全て0で開始）
    const planLine = new Array(restoredWaveform.length).fill(0);

    // 各データ点のキロ程を計算
    for (let i = 0; i < restoredWaveform.length; i++) {
      const currentKP = startKP + i * dataInterval;

      // 現在のキロ程が含まれる曲線諸元を検索
      const applicableCurve = curveSpecs.find(curve =>
        currentKP >= curve.startKP && currentKP < curve.endKP
      );

      if (applicableCurve) {
        // 曲線種別に応じた計画線値を設定
        switch (applicableCurve.curveType) {
          case 'straight':
            // 直線区間: 0mmのまま（またはオプションで区間平均値）
            planLine[i] = 0;
            break;

          case 'transition':
            // 緩和曲線: 線形補間
            const transitionProgress = (currentKP - applicableCurve.startKP) /
                                      (applicableCurve.endKP - applicableCurve.startKP);

            // 前後の曲線諸元を確認して補間
            const prevCurve = curveSpecs.find(c => c.endKP === applicableCurve.startKP);
            const nextCurve = curveSpecs.find(c => c.startKP === applicableCurve.endKP);

            const startValue = prevCurve && prevCurve.curveType === 'circular' ?
                              (prevCurve.radius ? calculateTheoBass(prevCurve.radius, prevCurve.cant) : 0) : 0;
            const endValue = nextCurve && nextCurve.curveType === 'circular' ?
                            (nextCurve.radius ? calculateTheoBass(nextCurve.radius, nextCurve.cant) : 0) : 0;

            planLine[i] = startValue + (endValue - startValue) * transitionProgress;
            break;

          case 'circular':
            // 円曲線: 理論バス値（半径とカントから計算）
            if (applicableCurve.radius) {
              planLine[i] = calculateTheoBass(applicableCurve.radius, applicableCurve.cant || 0);
            } else {
              planLine[i] = 0;
            }
            break;

          default:
            planLine[i] = 0;
        }
      }
    }

    // 理論バス値計算（簡易版）
    function calculateTheoBass(radius, cant) {
      // 基本的な理論バス計算式
      // 実際のVB6 KCDWではより詳細な計算が行われる
      const baseValue = radius > 0 ? 10000 / radius : 0;
      const cantEffect = cant / 10; // カントの影響
      return baseValue + cantEffect;
    }

    // 計画線の統計情報を計算
    const nonZeroValues = planLine.filter(v => v !== 0);
    const statistics = {
      min: nonZeroValues.length > 0 ? Math.min(...nonZeroValues) : 0,
      max: nonZeroValues.length > 0 ? Math.max(...nonZeroValues) : 0,
      mean: nonZeroValues.length > 0 ?
            nonZeroValues.reduce((a, b) => a + b, 0) / nonZeroValues.length : 0,
      count: nonZeroValues.length
    };

    res.json({
      success: true,
      planLine,
      statistics,
      curveSegments: curveSpecs.length,
      message: `${curveSpecs.length}区間の曲線諸元から計画線を生成しました`
    });

  } catch (error) {
    console.error('自動計画線生成エラー:', error);
    res.status(500).json({
      success: false,
      error: '自動計画線生成中にエラーが発生しました',
      details: error.message
    });
  }
});

/**
 * POST /api/restoration/vb6/generate-curve-report
 * 曲線諸元を考慮したレポート生成（CSV形式）
 */
router.post('/vb6/generate-curve-report', (req, res) => {
  try {
    const {
      restoredWaveform,
      planLine,
      movement,
      curveSpecs,
      curveSectionStats,
      dataInterval = 0.25,
      startKP = 0,
      reportType = 'comprehensive'
    } = req.body;

    if (!restoredWaveform || !Array.isArray(restoredWaveform)) {
      return res.status(400).json({
        success: false,
        error: '復元波形データが不正です'
      });
    }

    const lines = [];
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

    // ヘッダー情報
    lines.push('軌道復元システム - 曲線諸元レポート');
    lines.push(`作成日時,${new Date().toLocaleString('ja-JP')}`);
    lines.push(`データ点数,${restoredWaveform.length}`);
    lines.push(`データ間隔,${dataInterval}m`);
    lines.push('');

    if (reportType === 'comprehensive' || reportType === 'curve-sections') {
      // 曲線区間統計
      if (curveSectionStats && curveSectionStats.sectionStatistics) {
        lines.push('=== 曲線区間別統計 ===');
        lines.push('区間開始KP,区間終了KP,曲線種別,半径(m),カント(mm),方向,延長(km),データ点数,復元波形最小(mm),復元波形最大(mm),復元波形平均(mm),復元波形σ(mm),移動量最小(mm),移動量最大(mm),移動量平均(mm),移動量σ(mm)');

        for (const section of curveSectionStats.sectionStatistics) {
          const row = [
            section.curve.startKP.toFixed(3),
            section.curve.endKP.toFixed(3),
            section.curve.curveType === 'straight' ? '直線' :
              section.curve.curveType === 'transition' ? '緩和曲線' : '円曲線',
            section.curve.radius || '',
            section.curve.cant || '',
            section.curve.direction === 'left' ? '左' :
              section.curve.direction === 'right' ? '右' : '',
            section.curve.length.toFixed(3),
            section.dataPoints,
            section.restoredWaveform.min.toFixed(3),
            section.restoredWaveform.max.toFixed(3),
            section.restoredWaveform.mean.toFixed(3),
            section.restoredWaveform.sigma.toFixed(3),
            section.movement ? section.movement.min.toFixed(3) : '',
            section.movement ? section.movement.max.toFixed(3) : '',
            section.movement ? section.movement.mean.toFixed(3) : '',
            section.movement ? section.movement.sigma.toFixed(3) : ''
          ];
          lines.push(row.join(','));
        }
        lines.push('');
      }
    }

    if (reportType === 'comprehensive' || reportType === 'detailed-data') {
      // 詳細データ（全データ点）
      lines.push('=== 詳細データ ===');
      lines.push('キロ程(km),復元波形(mm),計画線(mm),移動量(mm),曲線種別,曲線区間');

      for (let i = 0; i < restoredWaveform.length; i++) {
        const kp = startKP + i * dataInterval;

        // 現在のキロ程が含まれる曲線区間を特定
        let curveInfo = { type: '-', label: '-' };
        if (curveSpecs) {
          const applicableCurve = curveSpecs.find(curve =>
            kp >= curve.startKP && kp < curve.endKP
          );
          if (applicableCurve) {
            const typeMap = {
              straight: '直線',
              transition: '緩和曲線',
              circular: '円曲線'
            };
            curveInfo = {
              type: typeMap[applicableCurve.curveType] || applicableCurve.curveType,
              label: applicableCurve.label || `${applicableCurve.startKP.toFixed(3)}-${applicableCurve.endKP.toFixed(3)}`
            };
          }
        }

        const row = [
          kp.toFixed(3),
          restoredWaveform[i].toFixed(3),
          planLine && planLine[i] !== undefined ? planLine[i].toFixed(3) : '',
          movement && movement[i] !== undefined ? movement[i].toFixed(3) : '',
          curveInfo.type,
          curveInfo.label
        ];
        lines.push(row.join(','));
      }
    }

    // CSVデータを返す
    const csvContent = lines.join('\n');
    const filename = `curve_report_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csvContent); // UTF-8 BOM

  } catch (error) {
    console.error('レポート生成エラー:', error);
    res.status(500).json({
      success: false,
      error: 'レポート生成中にエラーが発生しました',
      details: error.message
    });
  }
});

/**
 * POST /api/restoration/export/plan-line-csv
 * 計画線データのエクスポート（CSV形式）
 */
router.post('/export/plan-line-csv', async (req, res) => {
  try {
    const { planLine, metadata = {} } = req.body;

    if (!planLine || !Array.isArray(planLine)) {
      return res.status(400).json({
        success: false,
        error: '計画線データが必要です'
      });
    }

    // CSV形式に変換
    let csvContent = '';

    // メタデータをコメントとして追加
    if (metadata.projectName) {
      csvContent += `# Project: ${metadata.projectName}\n`;
    }
    if (metadata.date) {
      csvContent += `# Date: ${metadata.date}\n`;
    }
    if (metadata.description) {
      csvContent += `# Description: ${metadata.description}\n`;
    }

    // ヘッダー行
    csvContent += 'distance,value\n';

    // データ行を追加
    planLine.forEach(point => {
      csvContent += `${point.distance},${point.value}\n`;
    });

    // ファイル名を生成
    const timestamp = new Date().toISOString().slice(0,10);
    const randomId = Math.random().toString(36).substr(2, 8);
    const filename = `plan_line_${timestamp}_${randomId}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csvContent); // UTF-8 BOM付き

  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({
      success: false,
      error: 'CSVエクスポート中にエラーが発生しました',
      details: error.message
    });
  }
});

/**
 * POST /api/restoration/export/plan-line-json
 * 計画線データのエクスポート（JSON形式）
 */
router.post('/export/plan-line-json', async (req, res) => {
  try {
    const { planLine, metadata = {} } = req.body;

    if (!planLine || !Array.isArray(planLine)) {
      return res.status(400).json({
        success: false,
        error: '計画線データが必要です'
      });
    }

    // JSON形式のデータ構造
    const exportData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      metadata: {
        projectName: metadata.projectName || 'Untitled Project',
        description: metadata.description || '',
        date: metadata.date || new Date().toISOString(),
        pointCount: planLine.length,
        minDistance: Math.min(...planLine.map(p => p.distance)),
        maxDistance: Math.max(...planLine.map(p => p.distance)),
        minValue: Math.min(...planLine.map(p => p.value)),
        maxValue: Math.max(...planLine.map(p => p.value))
      },
      planLine: planLine
    };

    // ファイル名を生成
    const timestamp = new Date().toISOString().slice(0,10);
    const randomId = Math.random().toString(36).substr(2, 8);
    const filename = `plan_line_${timestamp}_${randomId}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(exportData);

  } catch (error) {
    console.error('JSON export error:', error);
    res.status(500).json({
      success: false,
      error: 'JSONエクスポート中にエラーが発生しました',
      details: error.message
    });
  }
});

/**
 * POST /api/restoration/import/plan-line-csv
 * 計画線データのインポート（CSV形式）
 */
router.post('/import/plan-line-csv', async (req, res) => {
  try {
    const { csvContent } = req.body;

    if (!csvContent) {
      return res.status(400).json({
        success: false,
        error: 'CSVコンテンツが必要です'
      });
    }

    // CSVを解析
    const lines = csvContent.split('\n').filter(line => line.trim());
    const planLine = [];
    const metadata = {};
    let headerFound = false;

    for (const line of lines) {
      // コメント行からメタデータを抽出
      if (line.startsWith('#')) {
        const comment = line.slice(1).trim();
        if (comment.startsWith('Project:')) {
          metadata.projectName = comment.slice(8).trim();
        } else if (comment.startsWith('Date:')) {
          metadata.date = comment.slice(5).trim();
        } else if (comment.startsWith('Description:')) {
          metadata.description = comment.slice(12).trim();
        }
        continue;
      }

      // ヘッダー行をスキップ
      if (!headerFound && line.toLowerCase().includes('distance')) {
        headerFound = true;
        continue;
      }

      // データ行を解析
      const [distance, value] = line.split(',').map(v => parseFloat(v.trim()));

      if (!isNaN(distance) && !isNaN(value)) {
        planLine.push({ distance, value });
      }
    }

    if (planLine.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'CSVに有効なデータが含まれていません'
      });
    }

    // 距離順にソート
    planLine.sort((a, b) => a.distance - b.distance);

    res.json({
      success: true,
      planLine,
      metadata,
      statistics: {
        pointCount: planLine.length,
        minDistance: Math.min(...planLine.map(p => p.distance)),
        maxDistance: Math.max(...planLine.map(p => p.distance)),
        minValue: Math.min(...planLine.map(p => p.value)),
        maxValue: Math.max(...planLine.map(p => p.value))
      }
    });

  } catch (error) {
    console.error('CSV import error:', error);
    res.status(500).json({
      success: false,
      error: 'CSVインポート中にエラーが発生しました',
      details: error.message
    });
  }
});

/**
 * POST /api/restoration/import/kiya-o010
 * キヤデータ（O010形式）から計画線生成
 */
router.post('/import/kiya-o010', async (req, res) => {
  try {
    const { csvContent, railSide = 'left' } = req.body;

    if (!csvContent) {
      return res.status(400).json({
        success: false,
        error: 'CSVコンテンツが必要です'
      });
    }

    // キヤデータをパース
    const parsedData = parseKiyaO010(csvContent);

    if (!parsedData.success) {
      return res.status(400).json({
        success: false,
        error: 'キヤデータの解析に失敗しました',
        details: parsedData.error
      });
    }

    // 計画線データに変換
    const planLine = convertToPlanLineData(parsedData, railSide);

    if (planLine.length === 0) {
      return res.status(400).json({
        success: false,
        error: '有効なデータが見つかりませんでした'
      });
    }

    res.json({
      success: true,
      planLine,
      metadata: parsedData.metadata,
      statistics: {
        leftRail: parsedData.statistics.leftRail,
        rightRail: parsedData.statistics.rightRail,
        selectedRail: railSide,
        pointCount: planLine.length,
        minDistance: Math.min(...planLine.map(p => p.distance)),
        maxDistance: Math.max(...planLine.map(p => p.distance)),
        minValue: Math.min(...planLine.map(p => p.value)),
        maxValue: Math.max(...planLine.map(p => p.value))
      }
    });

  } catch (error) {
    console.error('Kiya O010 import error:', error);
    res.status(500).json({
      success: false,
      error: 'キヤデータインポート中にエラーが発生しました',
      details: error.message
    });
  }
});

/**
 * POST /api/restoration/import/plan-line-json
 * 計画線データのインポート（JSON形式）
 */
router.post('/import/plan-line-json', async (req, res) => {
  try {
    const { jsonContent } = req.body;

    if (!jsonContent) {
      return res.status(400).json({
        success: false,
        error: 'JSONコンテンツが必要です'
      });
    }

    let importData;
    try {
      // 文字列の場合はパース、オブジェクトの場合はそのまま使用
      importData = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        error: 'JSONの解析に失敗しました',
        details: parseError.message
      });
    }

    // データの検証
    if (!importData.planLine || !Array.isArray(importData.planLine)) {
      return res.status(400).json({
        success: false,
        error: 'JSONに有効な計画線データが含まれていません'
      });
    }

    // 各ポイントの検証
    const validPlanLine = [];
    for (const point of importData.planLine) {
      if (typeof point.distance === 'number' && typeof point.value === 'number') {
        validPlanLine.push({
          distance: point.distance,
          value: point.value
        });
      }
    }

    if (validPlanLine.length === 0) {
      return res.status(400).json({
        success: false,
        error: '有効なポイントがありません'
      });
    }

    // 距離順にソート
    validPlanLine.sort((a, b) => a.distance - b.distance);

    res.json({
      success: true,
      planLine: validPlanLine,
      metadata: importData.metadata || {},
      version: importData.version || 'unknown',
      importDate: new Date().toISOString(),
      statistics: {
        pointCount: validPlanLine.length,
        minDistance: Math.min(...validPlanLine.map(p => p.distance)),
        maxDistance: Math.max(...validPlanLine.map(p => p.distance)),
        minValue: Math.min(...validPlanLine.map(p => p.value)),
        maxValue: Math.max(...validPlanLine.map(p => p.value))
      }
    });

  } catch (error) {
    console.error('JSON import error:', error);
    res.status(500).json({
      success: false,
      error: 'JSONインポート中にエラーが発生しました',
      details: error.message
    });
  }
});

module.exports = router;
