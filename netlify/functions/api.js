import express from 'express';
import serverless from 'serverless-http';
import multer from 'multer';

const app = express();

// Middleware
app.use(express.json());

// Configure multer for memory storage (serverless doesn't have persistent disk)
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('CSVファイルのみアップロード可能です'));
    }
  }
});

// Helper function: Parse CSV data
function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());
  const data = [];

  for (const line of lines) {
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

// FFT Implementation (simplified)
function fft(data) {
  const n = data.length;
  if (n <= 1) return data;

  // Simple DFT for small arrays (not optimized FFT)
  const result = [];
  for (let k = 0; k < n; k++) {
    let real = 0;
    let imag = 0;
    for (let t = 0; t < n; t++) {
      const angle = (2 * Math.PI * t * k) / n;
      real += data[t] * Math.cos(angle);
      imag -= data[t] * Math.sin(angle);
    }
    result.push({ real, imag, magnitude: Math.sqrt(real * real + imag * imag) });
  }
  return result;
}

// Peak Detection Algorithm
function detectPeaks(data, threshold = 1.0, minDistance = 5) {
  const peaks = [];

  for (let i = 1; i < data.length - 1; i++) {
    const current = data[i].irregularity;
    const prev = data[i - 1].irregularity;
    const next = data[i + 1].irregularity;

    // Check if it's a local maximum
    if (current > prev && current > next && Math.abs(current) > threshold) {
      // Check minimum distance from previous peak
      if (peaks.length === 0 || i - peaks[peaks.length - 1].index >= minDistance) {
        peaks.push({
          index: i,
          distance: data[i].distance,
          value: current,
          type: current > 0 ? 'positive' : 'negative'
        });
      }
    }
  }

  return peaks;
}

// Outlier Detection Algorithm
function detectOutliers(data, threshold = 2.0) {
  const stats = calculateStatistics(data);
  const outliers = [];

  data.forEach((point, index) => {
    const zScore = Math.abs((point.irregularity - stats.avg) / stats.stdDev);
    if (zScore > threshold) {
      outliers.push({
        index,
        distance: point.distance,
        value: point.irregularity,
        zScore,
        deviation: point.irregularity - stats.avg
      });
    }
  });

  return { outliers, statistics: stats };
}

// Apply Filter (Moving Average, Gaussian, etc.)
function applyFilter(data, filterType, windowSize = 5) {
  if (!data || data.length === 0) return data;

  let filtered = [...data];

  if (filterType === 'movingAverage') {
    filtered = data.map((point, i) => {
      const halfWindow = Math.floor(windowSize / 2);
      const start = Math.max(0, i - halfWindow);
      const end = Math.min(data.length - 1, i + halfWindow);

      let sum = 0;
      let count = 0;
      for (let j = start; j <= end; j++) {
        sum += data[j].irregularity;
        count++;
      }

      return { ...point, irregularity: sum / count };
    });
  } else if (filterType === 'gaussian') {
    // Simplified Gaussian filter
    const sigma = windowSize / 3;
    filtered = data.map((point, i) => {
      const halfWindow = Math.floor(windowSize / 2);
      const start = Math.max(0, i - halfWindow);
      const end = Math.min(data.length - 1, i + halfWindow);

      let sum = 0;
      let weightSum = 0;
      for (let j = start; j <= end; j++) {
        const distance = i - j;
        const weight = Math.exp(-(distance * distance) / (2 * sigma * sigma));
        sum += data[j].irregularity * weight;
        weightSum += weight;
      }

      return { ...point, irregularity: sum / weightSum };
    });
  }

  return filtered;
}

// MTT Calculation (Track Evaluation)
function calculateMTT(data, wavelength = 10) {
  if (data.length === 0) return { bc: 0, cd: 0, evaluation: '不可' };

  const stats = calculateStatistics(data);

  // BC: 標準偏差ベース (Simplified)
  const bc = stats.stdDev * 2;

  // CD: 最大振幅ベース (Simplified)
  const cd = (stats.max - stats.min) / 2;

  // 評価基準
  let evaluation = '優';
  if (bc > 3 || cd > 3) evaluation = '良';
  if (bc > 5 || cd > 5) evaluation = '可';
  if (bc > 8 || cd > 8) evaluation = '不可';

  return {
    bc: parseFloat(bc.toFixed(2)),
    cd: parseFloat(cd.toFixed(2)),
    evaluation,
    statistics: stats
  };
}

// Apply Corrections (Cant/Slack)
function applyCorrections(data, cantCorrection = 0, slackCorrection = 0) {
  const corrected = data.map(point => ({
    distance: point.distance,
    irregularity: point.irregularity + cantCorrection + slackCorrection,
    original: point.irregularity
  }));

  return {
    corrected,
    appliedCorrections: {
      cant: cantCorrection,
      slack: slackCorrection,
      total: cantCorrection + slackCorrection
    },
    originalStats: calculateStatistics(data),
    correctedStats: calculateStatistics(corrected)
  };
}

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Rail Track API is running' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Rail Track API is running' });
});

// Upload and process CSV file
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'ファイルがアップロードされていません' });
    }

    const csvText = req.file.buffer.toString('utf-8');
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

  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({ error: 'ファイル処理中にエラーが発生しました: ' + error.message });
  }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'ファイルがアップロードされていません' });
    }

    const csvText = req.file.buffer.toString('utf-8');
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

  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({ error: 'ファイル処理中にエラーが発生しました: ' + error.message });
  }
});

// Upload dual rail CSV files
app.post('/api/upload-dual-rail', upload.fields([
  { name: 'leftFile', maxCount: 1 },
  { name: 'rightFile', maxCount: 1 }
]), async (req, res) => {
  try {
    if (!req.files || !req.files.leftFile || !req.files.rightFile) {
      return res.status(400).json({ error: '左右両方のファイルが必要です' });
    }

    const leftCSV = req.files.leftFile[0].buffer.toString('utf-8');
    const rightCSV = req.files.rightFile[0].buffer.toString('utf-8');

    const leftData = parseCSV(leftCSV);
    const rightData = parseCSV(rightCSV);

    if (leftData.length === 0 || rightData.length === 0) {
      return res.status(400).json({ error: '有効なデータが見つかりませんでした' });
    }

    const leftStats = calculateStatistics(leftData);
    const rightStats = calculateStatistics(rightData);
    const correlation = calculateCorrelation(leftData, rightData);

    res.json({
      success: true,
      left: {
        filename: req.files.leftFile[0].originalname,
        dataPoints: leftData.length,
        data: leftData,
        statistics: leftStats
      },
      right: {
        filename: req.files.rightFile[0].originalname,
        dataPoints: rightData.length,
        data: rightData,
        statistics: rightStats
      },
      correlation
    });

  } catch (error) {
    console.error('Error processing dual rail files:', error);
    res.status(500).json({ error: 'ファイル処理中にエラーが発生しました: ' + error.message });
  }
});

// Calculate correlation between two datasets
app.post('/calculate-correlation', (req, res) => {
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

// Apply simple restoration filter
app.post('/restore-waveform', (req, res) => {
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

// Apply filter (new v2.0 endpoint)
app.post('/api/apply-filter', (req, res) => {
  try {
    const { data, filterType, windowSize } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'データが必要です' });
    }

    const filtered = applyFilter(data, filterType, windowSize);

    res.json({
      success: true,
      filtered,
      filterType,
      windowSize,
      originalStats: calculateStatistics(data),
      filteredStats: calculateStatistics(filtered)
    });

  } catch (error) {
    console.error('Error applying filter:', error);
    res.status(500).json({ error: 'フィルター適用中にエラーが発生しました: ' + error.message });
  }
});

// Detect peaks (new v2.0 endpoint)
app.post('/api/detect-peaks', (req, res) => {
  try {
    const { data, threshold, minDistance } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'データが必要です' });
    }

    const peaks = detectPeaks(data, threshold, minDistance);

    res.json({
      success: true,
      peaks,
      peakCount: peaks.length,
      threshold,
      minDistance
    });

  } catch (error) {
    console.error('Error detecting peaks:', error);
    res.status(500).json({ error: 'ピーク検出中にエラーが発生しました: ' + error.message });
  }
});

// Detect outliers (new v2.0 endpoint)
app.post('/api/detect-outliers', (req, res) => {
  try {
    const { data, threshold } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'データが必要です' });
    }

    const result = detectOutliers(data, threshold);

    res.json({
      success: true,
      outliers: result.outliers,
      outlierCount: result.outliers.length,
      statistics: result.statistics,
      threshold
    });

  } catch (error) {
    console.error('Error detecting outliers:', error);
    res.status(500).json({ error: '異常値検出中にエラーが発生しました: ' + error.message });
  }
});

// Analyze spectrum (FFT) (new v2.0 endpoint)
app.post('/api/analyze-spectrum', (req, res) => {
  try {
    const { data } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'データが必要です' });
    }

    const values = data.map(d => d.irregularity);
    const fftResult = fft(values);

    // Create spectrum data
    const spectrum = fftResult.slice(0, Math.floor(fftResult.length / 2)).map((item, index) => ({
      frequency: index,
      magnitude: item.magnitude,
      phase: Math.atan2(item.imag, item.real)
    }));

    res.json({
      success: true,
      spectrum,
      dataPoints: data.length,
      nyquistFrequency: data.length / 2
    });

  } catch (error) {
    console.error('Error analyzing spectrum:', error);
    res.status(500).json({ error: 'スペクトル解析中にエラーが発生しました: ' + error.message });
  }
});

// Apply corrections (new v2.0 endpoint)
app.post('/api/apply-corrections', (req, res) => {
  try {
    const { data, cantCorrection, slackCorrection } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'データが必要です' });
    }

    const result = applyCorrections(data, cantCorrection, slackCorrection);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Error applying corrections:', error);
    res.status(500).json({ error: '補正適用中にエラーが発生しました: ' + error.message });
  }
});

// Calculate MTT (new v2.0 endpoint)
app.post('/api/calculate-mtt', (req, res) => {
  try {
    const { data, wavelength } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'データが必要です' });
    }

    const mtt = calculateMTT(data, wavelength);

    res.json({
      success: true,
      mtt,
      wavelength,
      dataPoints: data.length
    });

  } catch (error) {
    console.error('Error calculating MTT:', error);
    res.status(500).json({ error: 'MTT計算中にエラーが発生しました: ' + error.message });
  }
});

// Calculate dual MTT (new v2.0 endpoint)
app.post('/api/calculate-dual-mtt', (req, res) => {
  try {
    const { leftData, rightData, wavelength } = req.body;

    if (!leftData || !rightData) {
      return res.status(400).json({ error: '左右のデータが必要です' });
    }

    const leftMTT = calculateMTT(leftData, wavelength);
    const rightMTT = calculateMTT(rightData, wavelength);

    res.json({
      success: true,
      left: leftMTT,
      right: rightMTT,
      wavelength
    });

  } catch (error) {
    console.error('Error calculating dual MTT:', error);
    res.status(500).json({ error: '両レールMTT計算中にエラーが発生しました: ' + error.message });
  }
});

// Export data (new v2.0 endpoint)
app.post('/api/export', (req, res) => {
  try {
    const { data, format } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'データが必要です' });
    }

    let exportData = '';

    if (format === 'csv') {
      exportData = 'Distance,Irregularity\n';
      data.forEach(point => {
        exportData += `${point.distance},${point.irregularity}\n`;
      });
    } else if (format === 'json') {
      exportData = JSON.stringify(data, null, 2);
    }

    res.json({
      success: true,
      data: exportData,
      format,
      dataPoints: data.length
    });

  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: 'データエクスポート中にエラーが発生しました: ' + error.message });
  }
});

// Generate mock data (for testing)
app.get('/api/generate-mock-data', (req, res) => {
  const points = parseInt(req.query.points) || 100;
  const data = [];

  for (let i = 0; i < points; i++) {
    data.push({
      distance: i * 0.25,
      irregularity: Math.sin(i * 0.1) * 2 + (Math.random() - 0.5) * 0.5
    });
  }

  res.json({
    success: true,
    data,
    dataPoints: points
  });
});

export const handler = serverless(app);
