/**
 * アルゴリズムAPI
 * Core Algorithm Routes - Bs05, HSJ, Y1Y2
 *
 * エンドポイント:
 * - POST /api/algorithms/bs05 - Bs05曲線部バス補正
 * - POST /api/algorithms/hsj - HSJ波長帯制限フィルタ
 * - POST /api/algorithms/y1y2 - Y1Y2矢中弦計算
 * - GET /api/algorithms/info - アルゴリズム情報取得
 */

const express = require('express');
const router = express.Router();

const { Bs05Algorithm } = require('../algorithms/bs05-algorithm');
const { HSJAlgorithm } = require('../algorithms/hsj-algorithm');
const { Y1Y2Algorithm } = require('../algorithms/y1y2-algorithm');

/**
 * Bs05曲線部バス補正
 * POST /api/algorithms/bs05
 *
 * Request body:
 * - measurementData: 測定データ配列 [{distance, value}, ...]
 * - curveInfoList: 曲線情報配列 (optional)
 * - singleCurveParams: 単一曲線パラメータ (optional)
 *
 * Response:
 * - success: boolean
 * - correctedData: 補正後データ
 * - bassProfile: バスプロファイル
 * - statistics: 統計情報
 */
router.post('/bs05', (req, res) => {
  try {
    const { measurementData, curveInfoList, singleCurveParams, options } = req.body;

    if (!measurementData || !Array.isArray(measurementData)) {
      return res.status(400).json({
        success: false,
        error: 'measurementData array is required'
      });
    }

    const bs05 = new Bs05Algorithm(options);

    let result;

    if (curveInfoList && Array.isArray(curveInfoList)) {
      // 複数曲線の補正
      result = bs05.applyCorrection(measurementData, curveInfoList);
    } else {
      // 単一曲線の補正（デフォルトパラメータ使用）
      result = bs05.applySingleCurveCorrection(measurementData, singleCurveParams);
    }

    res.json(result);
  } catch (error) {
    console.error('Bs05 algorithm error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * HSJ波長帯制限フィルタ
 * POST /api/algorithms/hsj
 *
 * Request body:
 * - measurementData: 測定データ配列
 * - minWavelength: 最小波長 (optional)
 * - maxWavelength: 最大波長 (optional)
 * - filterType: フィルタタイプ ('bandpass', 'highpass', 'lowpass', 'multiband')
 * - cutoffWavelength: カットオフ波長 (highpass/lowpass用)
 *
 * Response:
 * - success: boolean
 * - filteredData: フィルタリング済みデータ
 * - statistics: 統計情報
 * - filterParams: フィルタパラメータ
 */
router.post('/hsj', (req, res) => {
  try {
    const {
      measurementData,
      minWavelength,
      maxWavelength,
      filterType,
      cutoffWavelength,
      options
    } = req.body;

    if (!measurementData || !Array.isArray(measurementData)) {
      return res.status(400).json({
        success: false,
        error: 'measurementData array is required'
      });
    }

    const hsj = new HSJAlgorithm(options);

    let result;

    switch (filterType) {
      case 'bandpass':
        result = hsj.applyFilter(
          measurementData,
          minWavelength || 10.0,
          maxWavelength || 40.0
        );
        break;

      case 'highpass':
        result = hsj.applyHighpassFilter(
          measurementData,
          cutoffWavelength || 10.0
        );
        break;

      case 'lowpass':
        result = hsj.applyLowpassFilter(
          measurementData,
          cutoffWavelength || 40.0
        );
        break;

      case 'multiband':
        result = hsj.applyMultiBandFilter(measurementData);
        break;

      default:
        // デフォルト: 中波長帯域（10m-40m）
        result = hsj.applyFilter(measurementData, 10.0, 40.0);
    }

    res.json(result);
  } catch (error) {
    console.error('HSJ algorithm error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Y1Y2矢中弦計算
 * POST /api/algorithms/y1y2
 *
 * Request body:
 * - measurementData: 測定データ配列
 * - chordType: 弦長タイプ ('5m', '10m', '20m', '40m')
 * - y2Mode: Y2計算モード ('subtract', 'double')
 * - calculateMultiple: 複数弦長計算フラグ (optional)
 * - chordTypes: 複数弦長配列 (optional)
 *
 * Response:
 * - success: boolean
 * - y1: Y1データと統計情報
 * - y2: Y2データと統計情報
 * - difference: Y1-Y2差分データと統計情報
 * - parameters: 計算パラメータ
 */
router.post('/y1y2', (req, res) => {
  try {
    const {
      measurementData,
      chordType,
      y2Mode,
      calculateMultiple,
      chordTypes,
      options
    } = req.body;

    if (!measurementData || !Array.isArray(measurementData)) {
      return res.status(400).json({
        success: false,
        error: 'measurementData array is required'
      });
    }

    const y1y2 = new Y1Y2Algorithm(options);

    let result;

    if (calculateMultiple) {
      // 複数弦長で計算
      result = y1y2.calculateMultiple(
        measurementData,
        chordTypes || ['10m', '20m', '40m'],
        y2Mode || 'subtract'
      );
    } else {
      // 単一弦長で計算
      result = y1y2.calculate(
        measurementData,
        chordType || '10m',
        y2Mode || 'subtract'
      );
    }

    res.json(result);
  } catch (error) {
    console.error('Y1Y2 algorithm error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Y1Y2相関分析
 * POST /api/algorithms/y1y2/correlation
 *
 * Request body:
 * - y1y2Result: Y1Y2計算結果
 *
 * Response:
 * - success: boolean
 * - correlation: 相関係数
 * - interpretation: 解釈
 */
router.post('/y1y2/correlation', (req, res) => {
  try {
    const { y1y2Result } = req.body;

    if (!y1y2Result) {
      return res.status(400).json({
        success: false,
        error: 'y1y2Result is required'
      });
    }

    const y1y2 = new Y1Y2Algorithm();
    const result = y1y2.analyzeCorrelation(y1y2Result);

    res.json(result);
  } catch (error) {
    console.error('Y1Y2 correlation analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * アルゴリズム情報取得
 * GET /api/algorithms/info
 *
 * Response:
 * - algorithms: 各アルゴリズムの情報
 */
router.get('/info', (req, res) => {
  try {
    const bs05 = new Bs05Algorithm();
    const hsj = new HSJAlgorithm();
    const y1y2 = new Y1Y2Algorithm();

    res.json({
      success: true,
      algorithms: {
        bs05: bs05.getAlgorithmInfo(),
        hsj: hsj.getAlgorithmInfo(),
        y1y2: y1y2.getAlgorithmInfo()
      }
    });
  } catch (error) {
    console.error('Get algorithm info error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Bs05理論バス値計算
 * POST /api/algorithms/bs05/theoretical-bass
 *
 * Request body:
 * - radius: 曲線半径 (m)
 * - chordLength: 弦長 (m)
 * - cant: カント (mm) optional
 *
 * Response:
 * - success: boolean
 * - bassValue: 理論バス値 (mm)
 */
router.post('/bs05/theoretical-bass', (req, res) => {
  try {
    const { radius, chordLength, cant } = req.body;

    if (!radius || !chordLength) {
      return res.status(400).json({
        success: false,
        error: 'radius and chordLength are required'
      });
    }

    const bs05 = new Bs05Algorithm();
    const bassValue = bs05.calculateTheoreticalBass(radius, chordLength, cant || 0);

    res.json({
      success: true,
      bassValue,
      parameters: {
        radius,
        chordLength,
        cant: cant || 0
      }
    });
  } catch (error) {
    console.error('Theoretical bass calculation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * HSJ波長帯域設定更新
 * POST /api/algorithms/hsj/set-band
 *
 * Request body:
 * - bandName: 帯域名 ('shortWave', 'midWave', 'longWave')
 * - min: 最小波長 (m)
 * - max: 最大波長 (m)
 *
 * Response:
 * - success: boolean
 * - message: 設定更新メッセージ
 */
router.post('/hsj/set-band', (req, res) => {
  try {
    const { bandName, min, max } = req.body;

    if (!bandName || min === undefined || max === undefined) {
      return res.status(400).json({
        success: false,
        error: 'bandName, min, and max are required'
      });
    }

    const hsj = new HSJAlgorithm();
    hsj.setBand(bandName, min, max);

    res.json({
      success: true,
      message: `Band ${bandName} updated successfully`,
      band: { min, max }
    });
  } catch (error) {
    console.error('Set HSJ band error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * サポートされているアルゴリズム一覧
 * GET /api/algorithms/supported
 *
 * Response:
 * - success: boolean
 * - algorithms: アルゴリズム一覧
 */
router.get('/supported', (req, res) => {
  try {
    res.json({
      success: true,
      algorithms: [
        {
          id: 'bs05',
          name: 'Bs05曲線部バス補正',
          description: '曲線区間における軌道狂いの補正（カント・スラック考慮）',
          endpoints: [
            'POST /api/algorithms/bs05',
            'POST /api/algorithms/bs05/theoretical-bass'
          ]
        },
        {
          id: 'hsj',
          name: 'HSJ波長帯制限フィルタ',
          description: '特定波長帯域の軌道狂い成分を抽出（FFTベース）',
          endpoints: [
            'POST /api/algorithms/hsj',
            'POST /api/algorithms/hsj/set-band'
          ]
        },
        {
          id: 'y1y2',
          name: 'Y1Y2矢中弦計算',
          description: '2種類の矢中弦計算方法と相関分析',
          endpoints: [
            'POST /api/algorithms/y1y2',
            'POST /api/algorithms/y1y2/correlation'
          ]
        }
      ]
    });
  } catch (error) {
    console.error('Get supported algorithms error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
