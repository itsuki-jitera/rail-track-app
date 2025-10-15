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

export const handler = serverless(app);
