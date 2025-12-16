/**
 * 計画線関連のAPIルート
 *
 * 初期計画線生成と最適化のエンドポイント
 */

const express = require('express');
const router = express.Router();
const InitialPlanLineGenerator = require('../algorithms/initial-plan-line-generator');
const UpwardPriorityOptimizer = require('../algorithms/upward-priority-optimizer');

/**
 * POST /api/plan-line/generate-initial
 * 初期計画線の生成
 */
router.post('/generate-initial', async (req, res) => {
  try {
    const { restoredWaveform, method, parameters } = req.body;

    // バリデーション
    if (!restoredWaveform || restoredWaveform.length === 0) {
      return res.status(400).json({
        error: '復元波形データが必要です'
      });
    }

    // 生成器の初期化
    const generator = new InitialPlanLineGenerator(parameters);

    // 初期計画線の生成
    const result = generator.generateInitialPlanLine(restoredWaveform, {
      method: method || 'restored-based'
    });

    // 妥当性検証
    const validation = generator.validateInitialPlanLine(
      result.planLine,
      restoredWaveform
    );

    res.json({
      planLine: result.planLine,
      statistics: result.statistics,
      validation: validation,
      method: result.method,
      parameters: result.parameters
    });
  } catch (error) {
    console.error('初期計画線生成エラー:', error);
    res.status(500).json({
      error: '初期計画線の生成に失敗しました',
      message: error.message
    });
  }
});

/**
 * POST /api/plan-line/optimize
 * こう上優先最適化
 */
router.post('/optimize', async (req, res) => {
  try {
    const {
      restoredWaveform,
      planLine,
      targetUpwardRatio = 0.7,
      maxUpward = 50,
      maxDownward = 10,
      iterationLimit = 100
    } = req.body;

    // バリデーション
    if (!restoredWaveform || !planLine) {
      return res.status(400).json({
        error: '復元波形と計画線のデータが必要です'
      });
    }

    // 最適化器の初期化
    const optimizer = new UpwardPriorityOptimizer({
      maxUpward,
      maxDownward,
      targetUpwardRatio,
      iterationLimit
    });

    // 最適化実行
    const result = optimizer.optimizePlanLine(
      restoredWaveform,
      planLine,
      { iterationLimit }
    );

    res.json({
      optimizedPlanLine: result.optimizedPlanLine,
      statistics: result.statistics,
      iterations: result.iterations,
      converged: result.converged,
      improvement: result.improvement,
      message: result.message
    });
  } catch (error) {
    console.error('最適化エラー:', error);
    res.status(500).json({
      error: '最適化に失敗しました',
      message: error.message
    });
  }
});

/**
 * POST /api/plan-line/validate
 * 計画線の妥当性検証
 */
router.post('/validate', async (req, res) => {
  try {
    const { planLine, restoredWaveform } = req.body;

    if (!planLine || !restoredWaveform) {
      return res.status(400).json({
        error: '計画線と復元波形のデータが必要です'
      });
    }

    const generator = new InitialPlanLineGenerator();
    const validation = generator.validateInitialPlanLine(planLine, restoredWaveform);

    res.json(validation);
  } catch (error) {
    console.error('検証エラー:', error);
    res.status(500).json({
      error: '検証に失敗しました',
      message: error.message
    });
  }
});

/**
 * POST /api/plan-line/smooth
 * 計画線の平滑化
 */
router.post('/smooth', async (req, res) => {
  try {
    const { planLine, smoothingFactor = 0.3 } = req.body;

    if (!planLine || planLine.length === 0) {
      return res.status(400).json({
        error: '計画線データが必要です'
      });
    }

    const generator = new InitialPlanLineGenerator();
    const smoothedPlanLine = generator.smoothWaveform(planLine, smoothingFactor);

    res.json({
      planLine: smoothedPlanLine,
      smoothingFactor
    });
  } catch (error) {
    console.error('平滑化エラー:', error);
    res.status(500).json({
      error: '平滑化に失敗しました',
      message: error.message
    });
  }
});

/**
 * POST /api/plan-line/statistics
 * 計画線の統計情報計算
 */
router.post('/statistics', async (req, res) => {
  try {
    const { planLine, restoredWaveform } = req.body;

    if (!planLine || !restoredWaveform) {
      return res.status(400).json({
        error: '計画線と復元波形のデータが必要です'
      });
    }

    const generator = new InitialPlanLineGenerator();
    const statistics = generator.calculateStatistics(planLine, restoredWaveform);

    res.json(statistics);
  } catch (error) {
    console.error('統計計算エラー:', error);
    res.status(500).json({
      error: '統計計算に失敗しました',
      message: error.message
    });
  }
});

module.exports = router;