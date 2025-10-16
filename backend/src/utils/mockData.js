/**
 * モックデータ生成ユーティリティ
 * テスト用の軌道データを生成する
 */

/**
 * 正弦波ベースの軌道データを生成
 * @param {number} numPoints - データ点数
 * @param {number} amplitude - 振幅 (mm)
 * @param {number} frequency - 周波数 (1/m)
 * @param {number} noise - ノイズレベル (mm)
 * @returns {Array} 軌道データ配列
 */
export function generateSineWaveData(numPoints = 100, amplitude = 10, frequency = 0.1, noise = 1.0) {
  const data = [];
  const step = 0.5; // 0.5mごとのデータ

  for (let i = 0; i < numPoints; i++) {
    const distance = i * step;
    const sineValue = amplitude * Math.sin(2 * Math.PI * frequency * distance);
    const noiseValue = (Math.random() - 0.5) * 2 * noise;
    const irregularity = sineValue + noiseValue;

    data.push({
      distance: parseFloat(distance.toFixed(2)),
      irregularity: parseFloat(irregularity.toFixed(2))
    });
  }

  return data;
}

/**
 * 複数のピークを含む軌道データを生成
 * @param {number} numPoints - データ点数
 * @returns {Array} 軌道データ配列
 */
export function generatePeakyData(numPoints = 100) {
  const data = [];
  const step = 0.5;
  const peakPositions = [20, 40, 60, 80]; // ピーク位置（インデックス）
  const baselineNoise = 1.0;

  for (let i = 0; i < numPoints; i++) {
    const distance = i * step;
    let irregularity = (Math.random() - 0.5) * 2 * baselineNoise + 5.0; // ベースライン

    // ピーク位置付近で大きな値を追加
    peakPositions.forEach(peakPos => {
      const dist = Math.abs(i - peakPos);
      if (dist < 5) {
        const peakValue = 15.0 * Math.exp(-dist * dist / 4.0); // ガウス分布
        irregularity += peakValue;
      }
    });

    data.push({
      distance: parseFloat(distance.toFixed(2)),
      irregularity: parseFloat(irregularity.toFixed(2))
    });
  }

  return data;
}

/**
 * トレンドを含む軌道データを生成
 * @param {number} numPoints - データ点数
 * @returns {Array} 軌道データ配列
 */
export function generateTrendData(numPoints = 100) {
  const data = [];
  const step = 0.5;
  const trend = 0.05; // トレンド係数
  const noise = 2.0;

  for (let i = 0; i < numPoints; i++) {
    const distance = i * step;
    const trendValue = trend * distance;
    const sineValue = 5.0 * Math.sin(2 * Math.PI * 0.05 * distance);
    const noiseValue = (Math.random() - 0.5) * 2 * noise;
    const irregularity = trendValue + sineValue + noiseValue + 3.0;

    data.push({
      distance: parseFloat(distance.toFixed(2)),
      irregularity: parseFloat(irregularity.toFixed(2))
    });
  }

  return data;
}

/**
 * DCP形式風のモックデータを生成
 * @param {number} numPoints - データ点数
 * @returns {Object} DCP形式データ
 */
export function generateDCPMockData(numPoints = 100) {
  const trackData = generateSineWaveData(numPoints);

  return {
    header: {
      formatType: 'DCP',
      version: '1.0',
      recordDate: new Date().toISOString().split('T')[0],
      lineName: '東海道本線',
      direction: '上り',
      startKm: '100.0',
      endKm: '110.0',
      dataPoints: numPoints
    },
    data: trackData,
    metadata: {
      measurementDevice: 'DCP測定車両001',
      samplingInterval: 0.5,
      unit: 'mm'
    }
  };
}

/**
 * LABOCS形式風のモックデータを生成
 * @param {number} numPoints - データ点数
 * @returns {Object} LABOCS形式データ
 */
export function generateLABOCSMockData(numPoints = 100) {
  const trackData = generateSineWaveData(numPoints);

  return {
    header: {
      formatType: 'LABOCS',
      version: '2.0',
      recordDate: new Date().toISOString().split('T')[0],
      section: {
        lineName: '東海道本線',
        direction: '上り',
        startKm: '100.0',
        endKm: '110.0'
      },
      channels: ['距離', '左レール狂い', '右レール狂い', 'カント', 'スラック']
    },
    data: trackData.map((point, index) => ({
      distance: point.distance,
      leftRail: point.irregularity,
      rightRail: point.irregularity + (Math.random() - 0.5) * 2,
      cant: (Math.random() - 0.5) * 10,
      slack: (Math.random() - 0.5) * 5
    })),
    statistics: {
      totalDistance: (numPoints - 1) * 0.5,
      dataPoints: numPoints,
      measurementDate: new Date().toISOString()
    }
  };
}

/**
 * MTT計算用のモック補正パラメータを生成
 * @returns {Object} 補正パラメータ
 */
export function generateMTTCorrectionParams() {
  return {
    leftRail: {
      bcCoefficient: 3.63,
      cdCoefficient: 9.37,
      cantCorrection: 0.15,
      slackCorrection: 0.08
    },
    rightRail: {
      bcCoefficient: 3.63,
      cdCoefficient: 9.37,
      cantCorrection: 0.15,
      slackCorrection: 0.08
    },
    section: {
      sectionId: '区間001',
      avgCant: 50.0,      // 平均カント (mm)
      avgSlack: 10.0,     // 平均スラック (mm)
      curvatureRadius: 800.0  // 曲線半径 (m)
    }
  };
}

/**
 * ピーク検出のテスト用データを生成
 * @returns {Array} ピークを含む軌道データ
 */
export function generatePeakTestData() {
  return generatePeakyData(150);
}

/**
 * FFTテスト用の複数周波数成分データを生成
 * @param {number} numPoints - データ点数
 * @returns {Array} 軌道データ配列
 */
export function generateMultiFrequencyData(numPoints = 256) {
  const data = [];
  const step = 0.5;

  for (let i = 0; i < numPoints; i++) {
    const distance = i * step;
    // 複数の周波数成分を合成
    const component1 = 10.0 * Math.sin(2 * Math.PI * 0.05 * distance); // 低周波
    const component2 = 5.0 * Math.sin(2 * Math.PI * 0.2 * distance);  // 中周波
    const component3 = 2.0 * Math.sin(2 * Math.PI * 0.5 * distance);  // 高周波
    const noise = (Math.random() - 0.5) * 1.0;

    const irregularity = component1 + component2 + component3 + noise + 10.0;

    data.push({
      distance: parseFloat(distance.toFixed(2)),
      irregularity: parseFloat(irregularity.toFixed(2))
    });
  }

  return data;
}

/**
 * CSV形式の文字列データを生成
 * @param {number} numPoints - データ点数
 * @returns {string} CSV形式の文字列
 */
export function generateCSVString(numPoints = 100) {
  const data = generateSineWaveData(numPoints);
  let csvString = '';

  data.forEach(point => {
    csvString += `${point.distance}, ${point.irregularity}\n`;
  });

  return csvString;
}

/**
 * 実データに近い軌道データを生成（MTT値も含む）
 * @param {number} numPoints - データ点数
 * @returns {Object} 詳細な軌道データ
 */
export function generateRealisticTrackData(numPoints = 100) {
  const data = [];
  const step = 0.5;
  const mttParams = generateMTTCorrectionParams();

  for (let i = 0; i < numPoints; i++) {
    const distance = i * step;
    const baseValue = 5.0 * Math.sin(2 * Math.PI * 0.08 * distance);
    const noise = (Math.random() - 0.5) * 2.0;
    const measuredValue = baseValue + noise + 8.0;

    // カント・スラック値（区間によって変動）
    const cant = mttParams.section.avgCant + (Math.random() - 0.5) * 20.0;
    const slack = mttParams.section.avgSlack + (Math.random() - 0.5) * 5.0;

    data.push({
      distance: parseFloat(distance.toFixed(2)),
      irregularity: parseFloat(measuredValue.toFixed(2)),
      cant: parseFloat(cant.toFixed(2)),
      slack: parseFloat(slack.toFixed(2))
    });
  }

  return {
    data: data,
    correctionParams: mttParams,
    metadata: {
      lineName: '東海道本線',
      direction: '上り',
      measurementDate: new Date().toISOString().split('T')[0],
      totalDistance: (numPoints - 1) * step
    }
  };
}
