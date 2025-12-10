import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

// 新規追加: アルゴリズムとエクスポート機能
import { applyFilter } from './algorithms/filters.js';
import { applyFFTFilter, analyzeFrequencySpectrum } from './algorithms/fft.js';
import { detectPeaks, detectOutliers, comprehensivePeakAnalysis } from './algorithms/peakDetection.js';
import { calculateMTTValues, calculateDualRailMTT, evaluateMTT } from './algorithms/mttCalculation.js';
import { applyAllCorrectionsToDataset, addCantSlackToDataset } from './algorithms/corrections.js';
import { exportToExcel, exportToCSV, exportToJSON } from './exporters/excelExporter.js';
import { generateSineWaveData, generatePeakyData, generateRealisticTrackData } from './utils/mockData.js';

// キヤデータ処理機能
import { detectEncoding, convertToUTF8, smartDecode } from './utils/encoding-detector.js';
import { parseCK } from './parsers/ck-parser.js';
import { parseLK } from './parsers/lk-parser.js';

// 旧ラボデータ処理機能
import { parseMDTFile, isValidMDTFile } from './parsers/mdt-parser.js';
import { parseO010CSV, convertToStandardFormat as convertO010ToStandard, isValidO010CSV } from './parsers/o010-parser.js';

// 復元波形計算機能
import RestorationWaveformCalculator from './calculators/restoration-waveform.js';

// 復元波形ルート（ES6形式からCommonJS形式への変更が必要）
// import restorationRoutes from './routes/restoration-routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const isCSV = file.mimetype === 'text/csv' || file.originalname.endsWith('.csv') || file.originalname.endsWith('.CSV');
    const isMDT = file.originalname.endsWith('.MDT') || file.originalname.endsWith('.mdt');

    if (isCSV || isMDT) {
      cb(null, true);
    } else {
      cb(new Error('CSV または MDT ファイルのみアップロード可能です'));
    }
  }
});

// Helper function: Parse CSV data
function parseCSV(csvText) {
  // BOMを削除
  let text = csvText;
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  const lines = text.split('\n').filter(line => line.trim());
  const data = [];
  let isFirstLine = true;

  for (const line of lines) {
    // ヘッダー行をスキップ（最初の行が文字列の場合）
    if (isFirstLine) {
      const values = line.split(',').map(v => v.trim());
      if (isNaN(parseFloat(values[0]))) {
        isFirstLine = false;
        continue;
      }
      isFirstLine = false;
    }

    const values = line.split(',').map(v => v.trim());
    if (values.length >= 2) {
      const distance = parseFloat(values[0]);
      const irregularity = parseFloat(values[1]);
      if (!isNaN(distance) && !isNaN(irregularity)) {
        data.push({ distance, irregularity });
      }
    }
  }

  return data;
}

// Helper function: Parse dual-rail CSV data (distance, left, right)
function parseDualRailCSV(csvText) {
  // BOMを削除
  let text = csvText;
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  const lines = text.split('\n').filter(line => line.trim());
  const leftRail = [];
  const rightRail = [];
  let isFirstLine = true;

  for (const line of lines) {
    // ヘッダー行をスキップ（最初の行が文字列の場合）
    if (isFirstLine) {
      const values = line.split(',').map(v => v.trim());
      if (isNaN(parseFloat(values[0]))) {
        isFirstLine = false;
        console.log('[DEBUG] Skipped header row:', line);
        continue;
      }
      isFirstLine = false;
    }

    const values = line.split(',').map(v => v.trim());
    if (values.length >= 3) {
      const distance = parseFloat(values[0]);
      const leftIrregularity = parseFloat(values[1]);
      const rightIrregularity = parseFloat(values[2]);

      if (!isNaN(distance) && !isNaN(leftIrregularity) && !isNaN(rightIrregularity)) {
        leftRail.push({ distance, irregularity: leftIrregularity });
        rightRail.push({ distance, irregularity: rightIrregularity });
      }
    }
  }

  console.log(`[DEBUG] Parsed dual-rail CSV: ${leftRail.length} left points, ${rightRail.length} right points`);
  return { leftRail, rightRail };
}

// Helper function: Calculate correlation coefficient (相関係数)
function calculateCorrelation(data1, data2) {
  const n = Math.min(data1.length, data2.length);
  if (n === 0) return 0;

  let sumX = 0, sumY = 0, sumXX = 0, sumYY = 0, sumXY = 0;

  for (let i = 0; i < n; i++) {
    const x = data1[i].irregularity;
    const y = data2[i].irregularity;
    sumX += x;
    sumY += y;
    sumXX += x * x;
    sumYY += y * y;
    sumXY += x * y;
  }

  const avgX = sumX / n;
  const avgY = sumY / n;

  const numerator = sumXY - n * avgX * avgY;
  const denominator = Math.sqrt((sumXX - n * avgX * avgX) * (sumYY - n * avgY * avgY));

  if (denominator === 0) return 0;
  return numerator / denominator;
}

// Helper function: Calculate basic statistics
function calculateStatistics(data) {
  if (data.length === 0) {
    return { min: 0, max: 0, avg: 0, stdDev: 0 };
  }

  const values = data.map(d => d.irregularity);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return { min, max, avg, stdDev };
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Rail Track API is running' });
});

// Upload and process CSV file
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'ファイルがアップロードされていません' });
    }

    const filePath = req.file.path;
    const csvText = await fs.readFile(filePath, 'utf-8');
    const data = parseCSV(csvText);

    if (data.length === 0) {
      return res.status(400).json({ error: '有効なデータが見つかりませんでした' });
    }

    const statistics = calculateStatistics(data);

    res.json({
      success: true,
      filename: req.file.originalname,
      dataPoints: data.length,
      data: data,
      statistics: statistics
    });

    // Clean up uploaded file
    await fs.unlink(filePath);

  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({ error: 'ファイル処理中にエラーが発生しました: ' + error.message });
  }
});

// Calculate correlation between two datasets
app.post('/api/calculate-correlation', (req, res) => {
  try {
    const { data1, data2 } = req.body;

    if (!data1 || !data2) {
      return res.status(400).json({ error: 'data1とdata2が必要です' });
    }

    const correlation = calculateCorrelation(data1, data2);

    res.json({
      success: true,
      correlation: correlation,
      description: correlation > 0.7 ? '強い正の相関' :
                   correlation > 0.3 ? '中程度の正の相関' :
                   correlation > -0.3 ? '弱い相関' :
                   correlation > -0.7 ? '中程度の負の相関' : '強い負の相関'
    });

  } catch (error) {
    console.error('Error calculating correlation:', error);
    res.status(500).json({ error: '相関係数の計算中にエラーが発生しました: ' + error.message });
  }
});

// Apply simple restoration filter (simplified version of VB6 restoration logic)
app.post('/api/restore-waveform', (req, res) => {
  try {
    const { data, filterType = 'simple' } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'データが必要です' });
    }

    let restoredData = [...data];

    if (filterType === 'simple') {
      // Simple moving average filter (3-point)
      restoredData = data.map((point, i) => {
        if (i === 0 || i === data.length - 1) {
          return point;
        }
        const avgIrregularity = (data[i-1].irregularity + point.irregularity + data[i+1].irregularity) / 3;
        return { ...point, irregularity: avgIrregularity };
      });
    }

    const originalStats = calculateStatistics(data);
    const restoredStats = calculateStatistics(restoredData);

    res.json({
      success: true,
      original: {
        data: data,
        statistics: originalStats
      },
      restored: {
        data: restoredData,
        statistics: restoredStats
      },
      filterType: filterType
    });

  } catch (error) {
    console.error('Error restoring waveform:', error);
    res.status(500).json({ error: '波形復元中にエラーが発生しました: ' + error.message });
  }
});

// ========== 新規追加エンドポイント ==========

// フィルタ処理エンドポイント
app.post('/api/apply-filter', (req, res) => {
  try {
    const { data, filterType, options } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'データが必要です' });
    }

    let result;

    // FFT系フィルタとそれ以外を分岐
    if (filterType && filterType.startsWith('fft_')) {
      result = applyFFTFilter(data, filterType, options || {});
    } else {
      result = applyFilter(data, filterType || 'moving_average_3', options || {});
    }

    res.json(result);

  } catch (error) {
    console.error('Filter error:', error);
    res.status(500).json({ error: 'フィルタ処理中にエラーが発生しました: ' + error.message });
  }
});

// 周波数スペクトル分析エンドポイント
app.post('/api/analyze-spectrum', (req, res) => {
  try {
    const { data } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'データが必要です' });
    }

    const result = analyzeFrequencySpectrum(data);
    res.json(result);

  } catch (error) {
    console.error('Spectrum analysis error:', error);
    res.status(500).json({ error: 'スペクトル分析中にエラーが発生しました: ' + error.message });
  }
});

// ピーク検出エンドポイント
app.post('/api/detect-peaks', (req, res) => {
  try {
    const { data, options } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'データが必要です' });
    }

    const result = comprehensivePeakAnalysis(data, options || {});
    res.json(result);

  } catch (error) {
    console.error('Peak detection error:', error);
    res.status(500).json({ error: 'ピーク検出中にエラーが発生しました: ' + error.message });
  }
});

// 異常値検出エンドポイント
app.post('/api/detect-outliers', (req, res) => {
  try {
    const { data, sigmaMul } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'データが必要です' });
    }

    const outliers = detectOutliers(data, sigmaMul || 3.0);

    res.json({
      success: true,
      outliers,
      count: outliers.length,
      sigmaMul: sigmaMul || 3.0
    });

  } catch (error) {
    console.error('Outlier detection error:', error);
    res.status(500).json({ error: '異常値検出中にエラーが発生しました: ' + error.message });
  }
});

// MTT値計算エンドポイント
app.post('/api/calculate-mtt', (req, res) => {
  try {
    const { data, params } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'データが必要です' });
    }

    // カント・スラック値がなければモックデータを追加
    const dataWithCorrections = data[0].cant !== undefined ?
      data : addCantSlackToDataset(data);

    const result = calculateMTTValues(dataWithCorrections, params || {});

    // 判定も実施
    if (result.success) {
      const evaluation = evaluateMTT(result, params?.thresholds || {});
      result.evaluation = evaluation;
    }

    res.json(result);

  } catch (error) {
    console.error('MTT calculation error:', error);
    res.status(500).json({ error: 'MTT値計算中にエラーが発生しました: ' + error.message });
  }
});

// カント・スラック補正エンドポイント
app.post('/api/apply-corrections', (req, res) => {
  try {
    const { data, coefficients } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'データが必要です' });
    }

    // カント・スラック値がなければモックデータを追加
    const dataWithCorrections = data[0].cant !== undefined ?
      data : addCantSlackToDataset(data);

    const result = applyAllCorrectionsToDataset(dataWithCorrections, coefficients || {});
    res.json(result);

  } catch (error) {
    console.error('Correction error:', error);
    res.status(500).json({ error: '補正処理中にエラーが発生しました: ' + error.message });
  }
});

// データエクスポートエンドポイント
app.post('/api/export', (req, res) => {
  try {
    const { data, format, options } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'データが必要です' });
    }

    const exportFormat = format || 'excel';

    if (exportFormat === 'excel' || exportFormat === 'xlsx') {
      const buffer = exportToExcel(data, options || {});

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=track_data_${Date.now()}.xlsx`);
      res.send(buffer);

    } else if (exportFormat === 'csv') {
      const csvString = exportToCSV(data, options || {});

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=track_data_${Date.now()}.csv`);
      res.send(csvString);

    } else if (exportFormat === 'json') {
      const jsonString = exportToJSON({ data, options });

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=track_data_${Date.now()}.json`);
      res.send(jsonString);

    } else {
      res.status(400).json({ error: '未対応のフォーマットです: ' + exportFormat });
    }

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'エクスポート中にエラーが発生しました: ' + error.message });
  }
});

// 左右レール別CSVアップロードエンドポイント
app.post('/api/upload-dual-rail', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'ファイルがアップロードされていません' });
    }

    const filePath = req.file.path;
    const csvText = await fs.readFile(filePath, 'utf-8');
    const { leftRail, rightRail } = parseDualRailCSV(csvText);

    if (leftRail.length === 0 || rightRail.length === 0) {
      return res.status(400).json({ error: '有効な左右レールデータが見つかりませんでした' });
    }

    const leftStats = calculateStatistics(leftRail);
    const rightStats = calculateStatistics(rightRail);

    res.json({
      success: true,
      filename: req.file.originalname,
      dataPoints: {
        left: leftRail.length,
        right: rightRail.length,
        total: leftRail.length + rightRail.length
      },
      leftRail: {
        data: leftRail,
        statistics: leftStats
      },
      rightRail: {
        data: rightRail,
        statistics: rightStats
      }
    });

    // Clean up uploaded file
    await fs.unlink(filePath);

  } catch (error) {
    console.error('Error processing dual-rail file:', error);
    res.status(500).json({ error: 'ファイル処理中にエラーが発生しました: ' + error.message });
  }
});

// 左右レール別MTT値計算エンドポイント
app.post('/api/calculate-dual-mtt', (req, res) => {
  try {
    const { leftRail, rightRail, params } = req.body;

    if (!leftRail || !Array.isArray(leftRail) || !rightRail || !Array.isArray(rightRail)) {
      return res.status(400).json({ error: '左右レールのデータが必要です' });
    }

    // カント・スラック値がなければモックデータを追加
    const leftWithCorrections = leftRail[0]?.cant !== undefined ?
      leftRail : addCantSlackToDataset(leftRail);
    const rightWithCorrections = rightRail[0]?.cant !== undefined ?
      rightRail : addCantSlackToDataset(rightRail);

    const dualData = {
      leftRail: leftWithCorrections,
      rightRail: rightWithCorrections
    };

    const result = calculateDualRailMTT(dualData, params || {});

    // 左右それぞれの判定も実施
    if (result.success) {
      if (result.leftRail && result.leftRail.success) {
        const leftEvaluation = evaluateMTT(result.leftRail, params?.thresholds || {});
        result.leftRail.evaluation = leftEvaluation;
      }

      if (result.rightRail && result.rightRail.success) {
        const rightEvaluation = evaluateMTT(result.rightRail, params?.thresholds || {});
        result.rightRail.evaluation = rightEvaluation;
      }
    }

    res.json(result);

  } catch (error) {
    console.error('Dual MTT calculation error:', error);
    res.status(500).json({ error: '左右レールMTT値計算中にエラーが発生しました: ' + error.message });
  }
});

// ========== キヤデータ処理エンドポイント ==========

// CKファイル（曲線情報）解析エンドポイント
app.post('/api/parse-ck', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'ファイルがアップロードされていません' });
    }

    const filePath = req.file.path;
    const buffer = await fs.readFile(filePath);

    // エンコーディング自動検出と変換
    const decoded = smartDecode(buffer);

    if (!decoded.success) {
      console.warn('文字コード検出に失敗。UTF-8として処理します。');
    }

    // CKファイルをパース
    const result = parseCK(decoded.text);

    res.json({
      success: true,
      filename: req.file.originalname,
      encoding: decoded.encoding,
      curves: result.curves,
      structures: result.structures,
      stations: result.stations,
      metadata: result.metadata,
      counts: {
        curves: result.curves.length,
        structures: result.structures.length,
        stations: result.stations.length
      }
    });

    // Clean up uploaded file
    await fs.unlink(filePath);

  } catch (error) {
    console.error('Error parsing CK file:', error);
    res.status(500).json({ error: 'CKファイル解析中にエラーが発生しました: ' + error.message });
  }
});

// LKファイル（線区管理）解析エンドポイント
app.post('/api/parse-lk', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'ファイルがアップロードされていません' });
    }

    const filePath = req.file.path;
    const buffer = await fs.readFile(filePath);

    // エンコーディング自動検出と変換
    const decoded = smartDecode(buffer);

    if (!decoded.success) {
      console.warn('文字コード検出に失敗。UTF-8として処理します。');
    }

    // LKファイルをパース
    const result = parseLK(decoded.text);

    res.json({
      success: true,
      filename: req.file.originalname,
      encoding: decoded.encoding,
      sections: result.sections,
      managementValues: result.managementValues,
      managementSections: result.managementSections,
      counts: {
        sections: result.sections.length,
        managementValues: result.managementValues.length,
        managementSections: result.managementSections.length
      }
    });

    // Clean up uploaded file
    await fs.unlink(filePath);

  } catch (error) {
    console.error('Error parsing LK file:', error);
    res.status(500).json({ error: 'LKファイル解析中にエラーが発生しました: ' + error.message });
  }
});

// 汎用的なキヤデータアップロード（自動判別）
app.post('/api/upload-kiya', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'ファイルがアップロードされていません' });
    }

    const filePath = req.file.path;
    const buffer = await fs.readFile(filePath);
    const filename = req.file.originalname;

    // エンコーディング自動検出と変換
    const decoded = smartDecode(buffer);

    // ファイル名でCK/LKを判別
    const isCK = filename.includes('CK') || filename.startsWith('CK');
    const isLK = filename.includes('LK') || filename.startsWith('LK');

    let result;
    let fileType;

    if (isCK) {
      result = parseCK(decoded.text);
      fileType = 'CK';
    } else if (isLK) {
      result = parseLK(decoded.text);
      fileType = 'LK';
    } else {
      // ファイル名で判別できない場合は内容から判断
      const hasLKMarker = decoded.text.includes('LK');
      const hasBCMarker = decoded.text.includes('BC=');

      if (hasBCMarker) {
        result = parseCK(decoded.text);
        fileType = 'CK';
      } else if (hasLKMarker) {
        result = parseLK(decoded.text);
        fileType = 'LK';
      } else {
        return res.status(400).json({ error: 'CKまたはLKファイル形式として認識できませんでした' });
      }
    }

    res.json({
      success: true,
      filename: filename,
      fileType: fileType,
      encoding: decoded.encoding,
      data: result
    });

    // Clean up uploaded file
    await fs.unlink(filePath);

  } catch (error) {
    console.error('Error uploading kiya file:', error);
    res.status(500).json({ error: 'キヤデータアップロード中にエラーが発生しました: ' + error.message });
  }
});

// ========== 旧ラボデータ処理エンドポイント ==========

// MDTファイル解析エンドポイント
app.post('/api/parse-mdt', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'ファイルがアップロードされていません' });
    }

    const filePath = req.file.path;
    const buffer = await fs.readFile(filePath);

    // MDTファイルを解析
    const result = parseMDTFile(buffer);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      filename: req.file.originalname,
      mdtData: result.data
    });

    // Clean up uploaded file
    await fs.unlink(filePath);

  } catch (error) {
    console.error('Error parsing MDT file:', error);
    res.status(500).json({ error: 'MDTファイル解析中にエラーが発生しました: ' + error.message });
  }
});

// O010*.csv解析エンドポイント
app.post('/api/parse-o010', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'ファイルがアップロードされていません' });
    }

    const filePath = req.file.path;
    const buffer = await fs.readFile(filePath);

    // O010*.csvを解析
    const result = parseO010CSV(buffer);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // 標準フォーマットにも変換
    const standardData = convertO010ToStandard(result);

    res.json({
      success: true,
      filename: req.file.originalname,
      o010Data: result.data,
      multiMeasurementData: standardData,
      totalRecords: result.data.totalRecords
    });

    // Clean up uploaded file
    await fs.unlink(filePath);

  } catch (error) {
    console.error('Error parsing O010 file:', error);
    res.status(500).json({ error: 'O010ファイル解析中にエラーが発生しました: ' + error.message });
  }
});

// 旧ラボデータ統合アップロード（MDT + O010）
app.post('/api/upload-legacy-data', upload.fields([
  { name: 'mdt', maxCount: 1 },
  { name: 'o010', maxCount: 1 }
]), async (req, res) => {
  try {
    const mdtFile = req.files?.mdt?.[0];
    const o010File = req.files?.o010?.[0];

    if (!mdtFile && !o010File) {
      return res.status(400).json({ error: 'MDTまたはO010ファイルが必要です' });
    }

    const response = {
      success: true,
      mdtData: null,
      o010Data: null,
      multiMeasurementData: null
    };

    // MDTファイルの処理
    if (mdtFile) {
      const mdtBuffer = await fs.readFile(mdtFile.path);
      const mdtResult = parseMDTFile(mdtBuffer);

      if (mdtResult.success) {
        response.mdtData = mdtResult.data;
      } else {
        console.warn('MDT parsing warning:', mdtResult.error);
      }

      await fs.unlink(mdtFile.path);
    }

    // O010ファイルの処理
    if (o010File) {
      const o010Buffer = await fs.readFile(o010File.path);
      const o010Result = parseO010CSV(o010Buffer);

      if (o010Result.success) {
        response.o010Data = o010Result.data;
        response.multiMeasurementData = convertO010ToStandard(o010Result);
      } else {
        console.warn('O010 parsing warning:', o010Result.error);
      }

      await fs.unlink(o010File.path);
    }

    res.json(response);

  } catch (error) {
    console.error('Error uploading legacy data:', error);
    res.status(500).json({ error: '旧ラボデータアップロード中にエラーが発生しました: ' + error.message });
  }
});

// ========== 復元波形ルートの登録 ==========
// CommonJSモジュールの動的インポート
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
try {
  const restorationRoutes = require('./routes/restoration-routes.js');
  app.use('/api/restoration', restorationRoutes);
  console.log('Restoration routes loaded successfully');
} catch (error) {
  console.error('Failed to load restoration routes:', error);
}

// ========== 復元波形計算エンドポイント ==========

// 復元波形計算エンドポイント
app.post('/api/calculate-restoration-waveform', async (req, res) => {
  try {
    const { measurementData, options } = req.body;

    // 測定データ形式: [{ distance: 0.0, value: 2.5 }, ...]
    if (!measurementData || !Array.isArray(measurementData)) {
      return res.status(400).json({
        success: false,
        error: '測定データが必要です（形式: [{ distance, value }]）'
      });
    }

    if (measurementData.length === 0) {
      return res.status(400).json({
        success: false,
        error: '測定データが空です'
      });
    }

    console.log(`復元波形計算開始: ${measurementData.length}点のデータ`);

    // 計算器を初期化
    const calculator = new RestorationWaveformCalculator(options);

    // 計算実行
    const result = calculator.calculate(measurementData);

    if (!result.success) {
      return res.status(500).json(result);
    }

    console.log('復元波形計算完了');

    res.json(result);

  } catch (error) {
    console.error('Restoration waveform calculation error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// モックデータ生成エンドポイント（テスト用）
app.get('/api/generate-mock-data', (req, res) => {
  try {
    const type = req.query.type || 'sine';
    const numPoints = parseInt(req.query.numPoints) || 100;

    let data;
    let description;

    switch (type) {
      case 'sine':
        data = generateSineWaveData(numPoints);
        description = '正弦波ベースのデータ';
        break;
      case 'peaky':
        data = generatePeakyData(numPoints);
        description = 'ピークを含むデータ';
        break;
      case 'realistic':
        const realisticData = generateRealisticTrackData(numPoints);
        return res.json({
          success: true,
          data: realisticData.data,
          metadata: realisticData.metadata,
          correctionParams: realisticData.correctionParams,
          description: '実データに近い軌道データ（カント・スラック付き）'
        });
      default:
        data = generateSineWaveData(numPoints);
        description = 'デフォルトデータ';
    }

    res.json({
      success: true,
      data,
      description,
      dataPoints: data.length
    });

  } catch (error) {
    console.error('Mock data generation error:', error);
    res.status(500).json({ error: 'モックデータ生成中にエラーが発生しました: ' + error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Rail Track API server is running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log('\n✨ 利用可能なエンドポイント:');
  console.log('  - CSVアップロード: POST /api/upload');
  console.log('  - 左右レール別アップロード: POST /api/upload-dual-rail');
  console.log('  - フィルタ処理: POST /api/apply-filter');
  console.log('  - スペクトル分析: POST /api/analyze-spectrum');
  console.log('  - ピーク検出: POST /api/detect-peaks');
  console.log('  - 異常値検出: POST /api/detect-outliers');
  console.log('  - MTT値計算: POST /api/calculate-mtt');
  console.log('  - 左右レール別MTT値計算: POST /api/calculate-dual-mtt');
  console.log('  - 補正処理: POST /api/apply-corrections');
  console.log('  - データエクスポート: POST /api/export');
  console.log('  - キヤデータ（CK）解析: POST /api/parse-ck');
  console.log('  - キヤデータ（LK）解析: POST /api/parse-lk');
  console.log('  - キヤデータ汎用アップロード: POST /api/upload-kiya');
  console.log('  - 旧ラボデータ（MDT）解析: POST /api/parse-mdt');
  console.log('  - 旧ラボデータ（O010）解析: POST /api/parse-o010');
  console.log('  - 旧ラボデータ統合アップロード: POST /api/upload-legacy-data');
  console.log('  - モックデータ生成: GET /api/generate-mock-data');
});