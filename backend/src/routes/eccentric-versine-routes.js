/**
 * 偏心矢計算API
 * Eccentric Versine Calculation Endpoints
 */

const express = require('express');
const router = express.Router();
const { EccentricVersine } = require('../algorithms/eccentric-versine');
const { EccentricVersineOptimized } = require('../algorithms/eccentric-versine-optimized');
const { LRUCache, globalCacheManager } = require('../utils/lru-cache');
const { PDFReportGenerator } = require('../utils/pdf-generator');
const { ExcelReportGenerator } = require('../utils/excel-generator');
const { SVGChartGenerator } = require('../utils/svg-generator');
const { BatchProcessor } = require('../utils/batch-processor');
const path = require('path');
const fs = require('fs');

/**
 * POST /api/eccentric-versine/calculate
 * 偏心矢を計算
 */
router.post('/calculate', (req, res) => {
  try {
    const { measurementData, p, q, samplingInterval, useOptimized } = req.body;

    if (!measurementData || !Array.isArray(measurementData)) {
      return res.status(400).json({
        success: false,
        error: 'measurementData is required and must be an array'
      });
    }

    if (typeof p !== 'number' || typeof q !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'p and q must be numbers'
      });
    }

    if (p <= 0 || q <= 0) {
      return res.status(400).json({
        success: false,
        error: 'p and q must be positive values'
      });
    }

    const dataSize = measurementData.length;
    const LARGE_DATASET_THRESHOLD = 10000; // 10,000点以上は大規模データセット

    // データサイズまたはユーザー指定に基づいて最適な計算方法を選択
    const shouldUseOptimized = useOptimized !== undefined
      ? useOptimized
      : dataSize >= LARGE_DATASET_THRESHOLD;

    let result;
    let calculatorType;

    if (shouldUseOptimized) {
      // 最適化版を使用（チャンク処理対応）
      const calculator = new EccentricVersineOptimized({
        samplingInterval: samplingInterval || 0.25,
        chunkSize: 10000,
        enableProgress: false // API経由ではプログレス無効
      });

      result = calculator.calculateLarge(measurementData, p, q);
      calculatorType = 'optimized';
    } else {
      // 通常版を使用
      const calculator = new EccentricVersine({
        samplingInterval: samplingInterval || 0.25
      });

      result = calculator.calculate(measurementData, p, q);
      calculatorType = 'standard';
    }

    // 計算方法の情報を追加
    result.calculatorInfo = {
      type: calculatorType,
      dataPoints: dataSize,
      threshold: LARGE_DATASET_THRESHOLD,
      recommendation: EccentricVersineOptimized.recommendProcessingMethod(dataSize)
    };

    res.json(result);
  } catch (error) {
    console.error('偏心矢計算エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/eccentric-versine/characteristics
 * 検測特性を計算（キャッシュ対応）
 */
router.post('/characteristics', (req, res) => {
  try {
    const { p, q, wavelengths, samplingInterval, useCache = true } = req.body;

    if (typeof p !== 'number' || typeof q !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'p and q must be numbers'
      });
    }

    // キャッシュキーの生成
    const cacheKey = LRUCache.generateKey({
      type: 'characteristics',
      p,
      q,
      wavelengths,
      samplingInterval: samplingInterval || 0.25
    });

    // キャッシュチェック
    const cache = globalCacheManager.getCache('characteristics');
    if (useCache) {
      const cached = cache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          characteristics: cached,
          cached: true
        });
      }
    }

    // キャッシュミス：計算実行
    const calculator = new EccentricVersine({
      samplingInterval: samplingInterval || 0.25
    });

    const result = calculator.calculateMeasurementCharacteristics(
      p,
      q,
      wavelengths
    );

    // 結果をキャッシュ
    if (useCache) {
      cache.set(cacheKey, result);
    }

    res.json({
      success: true,
      characteristics: result,
      cached: false
    });
  } catch (error) {
    console.error('検測特性計算エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/eccentric-versine/convert
 * 偏心矢から偏心矢への変換
 */
router.post('/convert', (req, res) => {
  try {
    const {
      measurementData,
      p1,
      q1,
      p2,
      q2,
      wavelength,
      samplingInterval
    } = req.body;

    if (!measurementData || !Array.isArray(measurementData)) {
      return res.status(400).json({
        success: false,
        error: 'measurementData is required and must be an array'
      });
    }

    if (typeof p1 !== 'number' || typeof q1 !== 'number' ||
        typeof p2 !== 'number' || typeof q2 !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'p1, q1, p2, q2 must be numbers'
      });
    }

    const calculator = new EccentricVersine({
      samplingInterval: samplingInterval || 0.25
    });

    // 測定値を抽出
    const values = new Float32Array(measurementData.length);
    for (let i = 0; i < measurementData.length; i++) {
      values[i] = measurementData[i].value;
    }

    // 変換実行
    const convertedValues = calculator.convertVersine(
      values,
      p1,
      q1,
      p2,
      q2,
      wavelength || 20.0
    );

    // 結果を整形
    const convertedData = [];
    for (let i = 0; i < measurementData.length; i++) {
      convertedData.push({
        distance: measurementData[i].distance,
        value: parseFloat(convertedValues[i].toFixed(3))
      });
    }

    const statistics = calculator.calculateStatistics(convertedData);

    res.json({
      success: true,
      data: convertedData,
      statistics,
      parameters: {
        source: { p: p1, q: q1 },
        target: { p: p2, q: q2 },
        wavelength: wavelength || 20.0
      }
    });
  } catch (error) {
    console.error('偏心矢変換エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/eccentric-versine/convert-from-seiya
 * 正矢から偏心矢への変換
 */
router.post('/convert-from-seiya', (req, res) => {
  try {
    const {
      measurementData,
      pq,
      p2,
      q2,
      wavelength,
      samplingInterval
    } = req.body;

    if (!measurementData || !Array.isArray(measurementData)) {
      return res.status(400).json({
        success: false,
        error: 'measurementData is required and must be an array'
      });
    }

    const calculator = new EccentricVersine({
      samplingInterval: samplingInterval || 0.25
    });

    // 測定値を抽出
    const values = new Float32Array(measurementData.length);
    for (let i = 0; i < measurementData.length; i++) {
      values[i] = measurementData[i].value;
    }

    // 正矢から偏心矢に変換
    const convertedValues = calculator.convertFromSeiya(
      values,
      pq || 10.0,
      p2,
      q2,
      wavelength || 20.0
    );

    // 結果を整形
    const convertedData = [];
    for (let i = 0; i < measurementData.length; i++) {
      convertedData.push({
        distance: measurementData[i].distance,
        value: parseFloat(convertedValues[i].toFixed(3))
      });
    }

    const statistics = calculator.calculateStatistics(convertedData);

    res.json({
      success: true,
      data: convertedData,
      statistics,
      parameters: {
        source: { type: 'seiya', pq: pq || 10.0 },
        target: { type: 'eccentric', p: p2, q: q2 },
        wavelength: wavelength || 20.0
      }
    });
  } catch (error) {
    console.error('正矢→偏心矢変換エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/eccentric-versine/convert-to-seiya
 * 偏心矢から正矢への変換
 */
router.post('/convert-to-seiya', (req, res) => {
  try {
    const {
      measurementData,
      p1,
      q1,
      pq,
      wavelength,
      samplingInterval
    } = req.body;

    if (!measurementData || !Array.isArray(measurementData)) {
      return res.status(400).json({
        success: false,
        error: 'measurementData is required and must be an array'
      });
    }

    const calculator = new EccentricVersine({
      samplingInterval: samplingInterval || 0.25
    });

    // 測定値を抽出
    const values = new Float32Array(measurementData.length);
    for (let i = 0; i < measurementData.length; i++) {
      values[i] = measurementData[i].value;
    }

    // 偏心矢から正矢に変換
    const convertedValues = calculator.convertToSeiya(
      values,
      p1,
      q1,
      pq || 10.0,
      wavelength || 20.0
    );

    // 結果を整形
    const convertedData = [];
    for (let i = 0; i < measurementData.length; i++) {
      convertedData.push({
        distance: measurementData[i].distance,
        value: parseFloat(convertedValues[i].toFixed(3))
      });
    }

    const statistics = calculator.calculateStatistics(convertedData);

    res.json({
      success: true,
      data: convertedData,
      statistics,
      parameters: {
        source: { type: 'eccentric', p: p1, q: q1 },
        target: { type: 'seiya', pq: pq || 10.0 },
        wavelength: wavelength || 20.0
      }
    });
  } catch (error) {
    console.error('偏心矢→正矢変換エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/eccentric-versine/info
 * アルゴリズム情報を取得
 */
router.get('/info', (req, res) => {
  try {
    const calculator = new EccentricVersine();
    const optimizedCalculator = new EccentricVersineOptimized();

    const info = calculator.getAlgorithmInfo();
    const optimizedInfo = optimizedCalculator.getAlgorithmInfo();

    res.json({
      success: true,
      standard: info,
      optimized: optimizedInfo
    });
  } catch (error) {
    console.error('アルゴリズム情報取得エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/eccentric-versine/estimate-memory
 * メモリ使用量を推定
 */
router.post('/estimate-memory', (req, res) => {
  try {
    const { dataPoints, p, q } = req.body;

    if (typeof dataPoints !== 'number' || dataPoints <= 0) {
      return res.status(400).json({
        success: false,
        error: 'dataPoints must be a positive number'
      });
    }

    const estimate = EccentricVersineOptimized.estimateMemoryUsage(
      dataPoints,
      p || 10,
      q || 5
    );

    const recommendation = EccentricVersineOptimized.recommendProcessingMethod(dataPoints);

    res.json({
      success: true,
      dataPoints,
      memoryEstimate: estimate,
      recommendedMethod: recommendation,
      threshold: {
        normal: 10000,
        chunked: 100000
      }
    });
  } catch (error) {
    console.error('メモリ推定エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/eccentric-versine/ab-coefficients
 * A, B係数を計算（キャッシュ対応）
 */
router.post('/ab-coefficients', (req, res) => {
  try {
    const { p, q, wavelength, useCache = true } = req.body;

    if (typeof p !== 'number' || typeof q !== 'number' || typeof wavelength !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'p, q, and wavelength must be numbers'
      });
    }

    // キャッシュキーの生成
    const cacheKey = LRUCache.generateKey({
      type: 'abCoefficients',
      p,
      q,
      wavelength
    });

    // キャッシュチェック
    const cache = globalCacheManager.getCache('abCoefficients');
    if (useCache) {
      const cached = cache.get(cacheKey);
      if (cached) {
        return res.json({
          ...cached,
          cached: true
        });
      }
    }

    // キャッシュミス：計算実行
    const calculator = new EccentricVersine();
    const coefficients = calculator.calculateABCoefficients(p, q, wavelength);

    // 振幅と位相も計算
    const amplitude = Math.sqrt(coefficients.A * coefficients.A + coefficients.B * coefficients.B);
    const phase = Math.atan2(coefficients.B, coefficients.A);

    const result = {
      success: true,
      p,
      q,
      wavelength,
      A: parseFloat(coefficients.A.toFixed(6)),
      B: parseFloat(coefficients.B.toFixed(6)),
      amplitude: parseFloat(amplitude.toFixed(6)),
      phase: parseFloat(phase.toFixed(6)),
      phaseDeg: parseFloat((phase * 180 / Math.PI).toFixed(3)),
      cached: false
    };

    // 結果をキャッシュ
    if (useCache) {
      cache.set(cacheKey, result);
    }

    res.json(result);
  } catch (error) {
    console.error('A, B係数計算エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/eccentric-versine/conversion-coefficients
 * 変換係数α, βを計算
 */
router.post('/conversion-coefficients', (req, res) => {
  try {
    const { p1, q1, p2, q2, wavelength } = req.body;

    if (typeof p1 !== 'number' || typeof q1 !== 'number' ||
        typeof p2 !== 'number' || typeof q2 !== 'number' ||
        typeof wavelength !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'p1, q1, p2, q2, and wavelength must be numbers'
      });
    }

    const calculator = new EccentricVersine();
    const coefficients = calculator.calculateConversionCoefficients(p1, q1, p2, q2, wavelength);

    // 振幅と位相も計算
    const amplitude = Math.sqrt(coefficients.alpha * coefficients.alpha + coefficients.beta * coefficients.beta);
    const phase = Math.atan2(coefficients.beta, coefficients.alpha);

    res.json({
      success: true,
      source: { p: p1, q: q1 },
      target: { p: p2, q: q2 },
      wavelength,
      alpha: parseFloat(coefficients.alpha.toFixed(6)),
      beta: parseFloat(coefficients.beta.toFixed(6)),
      amplitude: parseFloat(amplitude.toFixed(6)),
      phase: parseFloat(phase.toFixed(6)),
      phaseDeg: parseFloat((phase * 180 / Math.PI).toFixed(3))
    });
  } catch (error) {
    console.error('変換係数計算エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/eccentric-versine/cache/stats
 * キャッシュ統計を取得
 */
router.get('/cache/stats', (req, res) => {
  try {
    const stats = globalCacheManager.getAllStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('キャッシュ統計取得エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/eccentric-versine/cache/clear
 * キャッシュをクリア
 */
router.post('/cache/clear', (req, res) => {
  try {
    const { cacheName } = req.body;

    if (cacheName) {
      // 特定のキャッシュをクリア
      const cache = globalCacheManager.getCache(cacheName);
      if (!cache) {
        return res.status(400).json({
          success: false,
          error: `Cache '${cacheName}' not found`
        });
      }
      cache.clear();
      res.json({
        success: true,
        message: `Cache '${cacheName}' cleared`,
        cacheName
      });
    } else {
      // 全キャッシュをクリア
      globalCacheManager.clearAll();
      res.json({
        success: true,
        message: 'All caches cleared'
      });
    }
  } catch (error) {
    console.error('キャッシュクリアエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/eccentric-versine/cache/optimize
 * キャッシュの最適化
 */
router.post('/cache/optimize', (req, res) => {
  try {
    const stats = globalCacheManager.optimize();
    res.json({
      success: true,
      message: 'Cache optimized',
      stats
    });
  } catch (error) {
    console.error('キャッシュ最適化エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/eccentric-versine/export/pdf
 * 偏心矢計算結果をPDFエクスポート
 */
router.post('/export/pdf', async (req, res) => {
  try {
    const { reportData, filename } = req.body;

    if (!reportData) {
      return res.status(400).json({
        success: false,
        error: 'reportData is required'
      });
    }

    // reportsディレクトリの確認・作成
    const reportsDir = path.join(__dirname, '../../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // ファイル名の生成
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const pdfFilename = filename || `eccentric-versine-report-${timestamp}.pdf`;
    const outputPath = path.join(reportsDir, pdfFilename);

    // PDF生成
    const generator = new PDFReportGenerator();
    await generator.generateEccentricVersineReport(reportData, outputPath);

    // ファイル送信
    res.download(outputPath, pdfFilename, (err) => {
      if (err) {
        console.error('PDFダウンロードエラー:', err);
        res.status(500).json({
          success: false,
          error: 'Failed to download PDF'
        });
      }

      // ダウンロード後、ファイルを削除（オプション）
      // setTimeout(() => {
      //   fs.unlinkSync(outputPath);
      // }, 60000); // 1分後に削除
    });

  } catch (error) {
    console.error('PDFエクスポートエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/eccentric-versine/export/characteristics-pdf
 * 検測特性計算結果をPDFエクスポート
 */
router.post('/export/characteristics-pdf', async (req, res) => {
  try {
    const { reportData, filename } = req.body;

    if (!reportData) {
      return res.status(400).json({
        success: false,
        error: 'reportData is required'
      });
    }

    // reportsディレクトリの確認・作成
    const reportsDir = path.join(__dirname, '../../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // ファイル名の生成
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const pdfFilename = filename || `characteristics-report-${timestamp}.pdf`;
    const outputPath = path.join(reportsDir, pdfFilename);

    // PDF生成
    const generator = new PDFReportGenerator();
    await generator.generateCharacteristicsReport(reportData, outputPath);

    // ファイル送信
    res.download(outputPath, pdfFilename, (err) => {
      if (err) {
        console.error('PDFダウンロードエラー:', err);
        res.status(500).json({
          success: false,
          error: 'Failed to download PDF'
        });
      }
    });

  } catch (error) {
    console.error('検測特性PDFエクスポートエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/eccentric-versine/export/excel
 * 偏心矢計算結果をExcelエクスポート
 */
router.post('/export/excel', async (req, res) => {
  try {
    const { reportData, filename } = req.body;

    if (!reportData) {
      return res.status(400).json({
        success: false,
        error: 'reportData is required'
      });
    }

    // reportsディレクトリの確認・作成
    const reportsDir = path.join(__dirname, '../../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // ファイル名の生成
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const excelFilename = filename || `eccentric-versine-report-${timestamp}.xlsx`;
    const outputPath = path.join(reportsDir, excelFilename);

    // Excel生成
    const generator = new ExcelReportGenerator();
    await generator.generateEccentricVersineReport(reportData, outputPath);

    // ファイル送信
    res.download(outputPath, excelFilename, (err) => {
      if (err) {
        console.error('Excelダウンロードエラー:', err);
        res.status(500).json({
          success: false,
          error: 'Failed to download Excel file'
        });
      }

      // ダウンロード後、ファイルを削除（オプション）
      // setTimeout(() => {
      //   fs.unlinkSync(outputPath);
      // }, 60000); // 1分後に削除
    });

  } catch (error) {
    console.error('Excelエクスポートエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/eccentric-versine/export/batch-excel
 * バッチ処理結果をExcelエクスポート
 */
router.post('/export/batch-excel', async (req, res) => {
  try {
    const { batchResults, filename } = req.body;

    if (!batchResults || !Array.isArray(batchResults)) {
      return res.status(400).json({
        success: false,
        error: 'batchResults must be an array'
      });
    }

    // reportsディレクトリの確認・作成
    const reportsDir = path.join(__dirname, '../../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // ファイル名の生成
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const excelFilename = filename || `batch-report-${timestamp}.xlsx`;
    const outputPath = path.join(reportsDir, excelFilename);

    // Excel生成
    const generator = new ExcelReportGenerator();
    await generator.generateBatchReport(batchResults, outputPath);

    // ファイル送信
    res.download(outputPath, excelFilename, (err) => {
      if (err) {
        console.error('バッチExcelダウンロードエラー:', err);
        res.status(500).json({
          success: false,
          error: 'Failed to download Excel file'
        });
      }
    });

  } catch (error) {
    console.error('バッチExcelエクスポートエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/eccentric-versine/export/svg
 * 偏心矢波形をSVG画像としてエクスポート
 */
router.post('/export/svg', async (req, res) => {
  try {
    const { waveformData, options, filename } = req.body;

    if (!waveformData || !Array.isArray(waveformData)) {
      return res.status(400).json({
        success: false,
        error: 'waveformData is required and must be an array'
      });
    }

    // imagesディレクトリの確認・作成
    const imagesDir = path.join(__dirname, '../../images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    // ファイル名の生成
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const svgFilename = filename || `waveform-${timestamp}.svg`;
    const outputPath = path.join(imagesDir, svgFilename);

    // SVG生成
    const generator = new SVGChartGenerator();
    const svg = generator.generateWaveformSVG(waveformData, options || {});
    await generator.saveSVG(svg, outputPath);

    // ファイル送信
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${svgFilename}"`);
    res.sendFile(outputPath, (err) => {
      if (err) {
        console.error('SVGダウンロードエラー:', err);
        res.status(500).json({
          success: false,
          error: 'Failed to download SVG file'
        });
      }
    });

  } catch (error) {
    console.error('SVGエクスポートエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/eccentric-versine/export/characteristics-svg
 * 検測特性をSVG画像としてエクスポート
 */
router.post('/export/characteristics-svg', async (req, res) => {
  try {
    const { characteristics, options, filename } = req.body;

    if (!characteristics || !Array.isArray(characteristics)) {
      return res.status(400).json({
        success: false,
        error: 'characteristics is required and must be an array'
      });
    }

    // imagesディレクトリの確認・作成
    const imagesDir = path.join(__dirname, '../../images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    // ファイル名の生成
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const svgFilename = filename || `characteristics-${timestamp}.svg`;
    const outputPath = path.join(imagesDir, svgFilename);

    // SVG生成
    const generator = new SVGChartGenerator();
    const svg = generator.generateCharacteristicsSVG(characteristics, options || {});
    await generator.saveSVG(svg, outputPath);

    // ファイル送信
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${svgFilename}"`);
    res.sendFile(outputPath, (err) => {
      if (err) {
        console.error('検測特性SVGダウンロードエラー:', err);
        res.status(500).json({
          success: false,
          error: 'Failed to download SVG file'
        });
      }
    });

  } catch (error) {
    console.error('検測特性SVGエクスポートエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/eccentric-versine/export/batch-comparison-svg
 * バッチ処理結果の比較SVG画像をエクスポート
 */
router.post('/export/batch-comparison-svg', async (req, res) => {
  try {
    const { datasets, options, filename } = req.body;

    if (!datasets || !Array.isArray(datasets)) {
      return res.status(400).json({
        success: false,
        error: 'datasets is required and must be an array'
      });
    }

    // imagesディレクトリの確認・作成
    const imagesDir = path.join(__dirname, '../../images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    // ファイル名の生成
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const svgFilename = filename || `batch-comparison-${timestamp}.svg`;
    const outputPath = path.join(imagesDir, svgFilename);

    // SVG生成
    const generator = new SVGChartGenerator();
    const svg = generator.generateBatchComparisonSVG(datasets, options || {});
    await generator.saveSVG(svg, outputPath);

    // ファイル送信
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${svgFilename}"`);
    res.sendFile(outputPath, (err) => {
      if (err) {
        console.error('バッチ比較SVGダウンロードエラー:', err);
        res.status(500).json({
          success: false,
          error: 'Failed to download SVG file'
        });
      }
    });

  } catch (error) {
    console.error('バッチ比較SVGエクスポートエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/eccentric-versine/batch/process
 * 複数ファイルのバッチ処理
 */
router.post('/batch/process', async (req, res) => {
  try {
    const { files, processingOptions } = req.body;

    // 設定の検証
    const validation = BatchProcessor.validateBatchConfig({ files, ...processingOptions });
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    // 警告がある場合は通知
    if (validation.warnings.length > 0) {
      console.log('バッチ処理警告:', validation.warnings);
    }

    // バッチプロセッサーの作成
    const processor = new BatchProcessor({
      maxConcurrent: 5,
      enableOptimization: true,
      progressCallback: (progress) => {
        // 進捗をログ出力（実際の実装ではWebSocketなどで通知）
        console.log(`バッチ処理進捗: ${progress.message}`);
      }
    });

    // バッチ処理の実行
    const result = await processor.processBatch(files, processingOptions);

    // 統合結果の生成
    const consolidatedResult = BatchProcessor.consolidateResults(result.results);

    res.json({
      success: true,
      summary: result.summary,
      consolidatedResult,
      individualResults: result.results
    });

  } catch (error) {
    console.error('バッチ処理エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/eccentric-versine/batch/validate
 * バッチ処理設定の検証
 */
router.post('/batch/validate', (req, res) => {
  try {
    const config = req.body;
    const validation = BatchProcessor.validateBatchConfig(config);

    res.json({
      success: true,
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings
    });

  } catch (error) {
    console.error('バッチ設定検証エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/eccentric-versine/batch/export-report
 * バッチ処理結果の統合レポート生成
 */
router.post('/batch/export-report', async (req, res) => {
  try {
    const { batchResults, format = 'excel', filename } = req.body;

    if (!batchResults) {
      return res.status(400).json({
        success: false,
        error: 'batchResults is required'
      });
    }

    // reportsディレクトリの確認・作成
    const reportsDir = path.join(__dirname, '../../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    switch (format) {
      case 'excel':
        // Excel形式でエクスポート
        const excelFilename = filename || `batch-report-${timestamp}.xlsx`;
        const excelPath = path.join(reportsDir, excelFilename);

        const excelGenerator = new ExcelReportGenerator();
        await excelGenerator.generateBatchReport(batchResults, excelPath);

        res.download(excelPath, excelFilename);
        break;

      case 'pdf':
        // PDF形式でエクスポート
        const pdfFilename = filename || `batch-report-${timestamp}.pdf`;
        const pdfPath = path.join(reportsDir, pdfFilename);

        const pdfGenerator = new PDFReportGenerator();

        // バッチ結果をPDF用に整形
        const pdfData = {
          parameters: batchResults.processingOptions || {},
          statistics: batchResults.consolidatedResult?.overallStatistics || {},
          versineData: [], // バッチ処理では詳細データは含まない
          batchSummary: batchResults.summary,
          files: batchResults.individualResults
        };

        await pdfGenerator.generateEccentricVersineReport(pdfData, pdfPath);

        res.download(pdfPath, pdfFilename);
        break;

      case 'json':
        // JSON形式でエクスポート
        const jsonFilename = filename || `batch-report-${timestamp}.json`;
        const jsonPath = path.join(reportsDir, jsonFilename);

        fs.writeFileSync(jsonPath, JSON.stringify(batchResults, null, 2));

        res.download(jsonPath, jsonFilename);
        break;

      default:
        return res.status(400).json({
          success: false,
          error: `Unsupported format: ${format}`
        });
    }

  } catch (error) {
    console.error('バッチレポートエクスポートエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
