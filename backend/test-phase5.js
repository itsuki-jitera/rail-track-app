/**
 * Phase 5: 復元波形計算システム 統合テスト
 */

const FFTEngine = require('./src/algorithms/fft-engine');
const RestorationFilter = require('./src/algorithms/restoration-filter');
const MovementCalculator = require('./src/algorithms/movement-calculator');

// テスト用のカラーコード
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(title) {
  console.log('\n' + '='.repeat(70));
  log(`  ${title}`, 'cyan');
  console.log('='.repeat(70));
}

function success(message) {
  log(`✓ ${message}`, 'green');
}

function error(message) {
  log(`✗ ${message}`, 'red');
}

function info(message) {
  log(`ℹ ${message}`, 'blue');
}

// テストカウンター
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    passedTests++;
    success(testName);
    return true;
  } else {
    failedTests++;
    error(testName);
    return false;
  }
}

function assertApprox(actual, expected, tolerance, testName) {
  const diff = Math.abs(actual - expected);
  const passed = diff <= tolerance;
  totalTests++;

  if (passed) {
    passedTests++;
    success(`${testName} (${actual.toFixed(6)} ≈ ${expected.toFixed(6)})`);
  } else {
    failedTests++;
    error(`${testName} (${actual.toFixed(6)} ≠ ${expected.toFixed(6)}, diff=${diff.toFixed(6)})`);
  }

  return passed;
}

// ========================================
// Test 1: FFTエンジンの基本動作テスト
// ========================================
function testFFTEngine() {
  header('Test 1: FFT処理基盤のテスト');

  // Test 1.1: 正弦波のFFT
  info('Test 1.1: 正弦波のFFT');
  const sampleRate = 100; // Hz
  const frequency = 5;    // Hz
  const duration = 1;     // seconds
  const n = sampleRate * duration;

  // 5Hz の正弦波を生成
  const sineWave = [];
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    sineWave[i] = Math.sin(2 * Math.PI * frequency * t);
  }

  const fftResult = FFTEngine.transform(sineWave, null, false);

  assert(fftResult.real.length === n, 'FFT結果の実数部の長さが正しい');
  assert(fftResult.imag.length === n, 'FFT結果の虚数部の長さが正しい');

  // パワースペクトルを計算
  const power = FFTEngine.powerSpectrum(fftResult.real, fftResult.imag);

  // 5Hz の位置でピークがあることを確認
  const peakIndex = 5;
  const peakValue = power[peakIndex];
  const avgValue = power.slice(0, 50).reduce((a, b) => a + b) / 50;

  assert(peakValue > avgValue * 10, '5Hzの位置でパワースペクトルのピークを検出');

  // Test 1.2: FFT → IFFT でデータが復元されることを確認
  info('Test 1.2: FFT → IFFT でデータ復元');
  const ifftResult = FFTEngine.transform(fftResult.real, fftResult.imag, true);

  let maxError = 0;
  for (let i = 0; i < n; i++) {
    const error = Math.abs(ifftResult.real[i] - sineWave[i]);
    if (error > maxError) maxError = error;
  }

  assertApprox(maxError, 0, 1e-10, 'IFFT後のデータ復元精度');

  // Test 1.3: 窓関数の動作確認
  info('Test 1.3: 窓関数の適用');
  const testData = new Array(100).fill(1.0);
  const hannWindow = FFTEngine.applyWindow(testData, 'hanning');

  assert(hannWindow[0] < 0.1, 'ハニング窓の最初の値が小さい');
  assert(hannWindow[50] > 0.9, 'ハニング窓の中央の値が大きい');
  assert(hannWindow[99] < 0.1, 'ハニング窓の最後の値が小さい');

  // Test 1.4: 波長⇔周波数ビン変換
  info('Test 1.4: 波長⇔周波数ビン変換');
  const wavelength = 10.0; // m
  const dataInterval = 0.25; // m
  const dataLength = 1000;

  const bin = FFTEngine.wavelengthToBin(wavelength, dataLength, dataInterval);
  const convertedWavelength = FFTEngine.binToWavelength(bin, dataLength, dataInterval);

  assertApprox(convertedWavelength, wavelength, 0.1, '波長⇔ビン変換の往復精度');
}

// ========================================
// Test 2: 復元逆フィルターのテスト
// ========================================
function testRestorationFilter() {
  header('Test 2: 復元逆フィルターのテスト');

  // Test 2.1: インパルス応答の計算
  info('Test 2.1: インパルス応答の計算');
  const N = 1000;
  const deltaD = 0.25; // m
  const lambdaLower = 6.0; // m
  const lambdaUpper = 100.0; // m

  const impulseResponse = RestorationFilter.calculateImpulseResponse(
    N, deltaD, lambdaLower, lambdaUpper
  );

  assert(impulseResponse.length === N, 'インパルス応答の長さが正しい');
  assert(!isNaN(impulseResponse[0]), 'インパルス応答の値が数値');

  // インパルス応答の総和チェック（正規化確認）
  const sum = impulseResponse.reduce((a, b) => a + Math.abs(b), 0);
  assert(sum > 0, 'インパルス応答の総和が正の値');

  // Test 2.2: 簡単な信号での復元波形計算
  info('Test 2.2: 復元波形計算の基本動作');

  // テスト用の矩形波を生成
  const testSignal = new Array(500).fill(0);
  for (let i = 100; i < 150; i++) {
    testSignal[i] = 10.0; // mm
  }

  const result = RestorationFilter.calculateRestorationWaveform(testSignal, {
    lambdaLower: 6.0,
    lambdaUpper: 100.0,
    dataInterval: 0.25,
    dataType: 'alignment'
  });

  assert(result.success === true, '復元波形計算が成功');
  assert(result.restoredWaveform.length === testSignal.length, '復元波形の長さが正しい');
  assert(result.statistics.sigma > 0, 'σ値が計算されている');
  assert(result.statistics.rms > 0, 'RMSが計算されている');

  // Test 2.3: データタイプ別のデフォルトパラメータ
  info('Test 2.3: データタイプ別パラメータ');
  const alignmentParams = RestorationFilter.getDefaultParams('alignment');
  const levelParams = RestorationFilter.getDefaultParams('level');

  assert(alignmentParams.lambdaLower === 6.0, '通りの下限波長が6m');
  assert(alignmentParams.lambdaUpper === 100.0, '通りの上限波長が100m');
  assert(levelParams.lambdaLower === 3.5, '高低の下限波長が3.5m');
  assert(levelParams.lambdaUpper === 40.0, '高低の上限波長が40m');

  // Test 2.4: 統計情報の計算
  info('Test 2.4: 統計情報の計算');
  const testData = [1, 2, 3, 4, 5];
  const stats = RestorationFilter.calculateStatistics(testData);

  assertApprox(stats.mean, 3.0, 1e-6, '平均値の計算');
  assertApprox(stats.sigma, Math.sqrt(2), 1e-6, '標準偏差の計算');
  assert(stats.min === 1, '最小値の検出');
  assert(stats.max === 5, '最大値の検出');
  assert(stats.count === 5, 'データ点数のカウント');
}

// ========================================
// Test 3: 移動量計算機能のテスト
// ========================================
function testMovementCalculator() {
  header('Test 3: 移動量計算機能のテスト');

  // Test 3.1: 移動量計算の基本動作
  info('Test 3.1: 移動量計算の基本動作');

  const restoredWaveform = [1, 2, 3, 4, 5];
  const planLine = [0, 0, 0, 0, 0];

  const result = MovementCalculator.calculateMovement(restoredWaveform, planLine);

  assert(result.success === true, '移動量計算が成功');
  assert(result.movement.length === restoredWaveform.length, '移動量データの長さが正しい');

  // 移動量 = 計画線 - 復元波形 = [0,0,0,0,0] - [1,2,3,4,5] = [-1,-2,-3,-4,-5]
  assert(result.movement[0] === -1, '移動量の計算が正確 (index 0)');
  assert(result.movement[4] === -5, '移動量の計算が正確 (index 4)');

  // 整正後予測波形 = 復元波形 + 移動量 = 計画線
  assert(result.predictedWaveform[0] === 0, '整正後予測波形の計算 (index 0)');
  assert(result.predictedWaveform[4] === 0, '整正後予測波形の計算 (index 4)');

  // Test 3.2: 良化率の計算
  info('Test 3.2: 良化率の計算');

  const improvementRate = MovementCalculator.calculateImprovementRate(10, 5);
  assertApprox(improvementRate, 50, 1e-6, '良化率50%の計算');

  const improvementRate2 = MovementCalculator.calculateImprovementRate(10, 2);
  assertApprox(improvementRate2, 80, 1e-6, '良化率80%の計算');

  // Test 3.3: 移動量制限チェック
  info('Test 3.3: 移動量制限チェック');

  const movement = [10, 20, 35, 60, 15]; // mm
  const violations = MovementCalculator.checkMovementRestrictions(movement, {
    standard: 30,
    maximum: 50
  });

  assert(violations.standardExceeded.length === 1, '標準値超過が1件 (35mm)');
  assert(violations.maximumExceeded.length === 1, '最大値超過が1件 (60mm)');
  assert(violations.violationCount === 2, '違反総数が2件');

  // Test 3.4: ピーク値抽出
  info('Test 3.4: ピーク値抽出');

  const peakData = [0, 1, 5, 1, 0, 2, 8, 2, 0, 3, 12, 3, 0];
  const peakResult = MovementCalculator.extractPeakValues(peakData, 2);

  assert(peakResult.pValue === 12, '最大ピーク値が12');
  assert(peakResult.peaks.length > 0, 'ピークが検出されている');
  assert(peakResult.peaks[0].absValue === 12, '最大ピークが最初に来る');

  // Test 3.5: 移動量の平滑化
  info('Test 3.5: 移動量の平滑化');

  const noisyData = [1, 10, 2, 11, 3, 12, 4];
  const smoothed = MovementCalculator.smoothMovement(noisyData, 3);

  assert(smoothed.length === noisyData.length, '平滑化後のデータ長が同じ');
  assert(smoothed[3] > noisyData[2] && smoothed[3] < noisyData[3], '平滑化により値が平均化');
}

// ========================================
// Test 4: 統合テスト
// ========================================
function testIntegration() {
  header('Test 4: 統合テスト（実データシミュレーション）');

  info('Test 4.1: 通り軌道狂いデータの復元波形計算');

  // 実際の軌道狂いデータをシミュレート
  // 基準線 + 長波長成分 + 中波長成分 + 短波長成分 + ノイズ
  const dataLength = 1000;
  const dataInterval = 0.25; // m (250mm間隔)
  const measurementData = [];

  for (let i = 0; i < dataLength; i++) {
    const distance = i * dataInterval; // m

    // 長波長成分 (50m周期, 振幅8mm)
    const longWave = 8.0 * Math.sin(2 * Math.PI * distance / 50);

    // 中波長成分 (10m周期, 振幅5mm)
    const midWave = 5.0 * Math.sin(2 * Math.PI * distance / 10);

    // 短波長成分 (2m周期, 振幅2mm) - フィルタで除去されるはず
    const shortWave = 2.0 * Math.sin(2 * Math.PI * distance / 2);

    // ノイズ
    const noise = (Math.random() - 0.5) * 1.0;

    measurementData[i] = longWave + midWave + shortWave + noise;
  }

  // 復元波形計算 (通り: 6-100m)
  const restorationResult = RestorationFilter.calculateRestorationWaveform(
    measurementData,
    {
      lambdaLower: 6.0,
      lambdaUpper: 100.0,
      dataInterval: 0.25,
      dataType: 'alignment'
    }
  );

  assert(restorationResult.success, '統合テスト: 復元波形計算成功');

  const restoredSigma = restorationResult.statistics.sigma;
  const originalSigma = RestorationFilter.calculateStatistics(measurementData).sigma;

  info(`  元データσ値: ${originalSigma.toFixed(3)} mm`);
  info(`  復元後σ値: ${restoredSigma.toFixed(3)} mm`);

  // 短波長成分とノイズが除去されるため、復元後のσ値は小さくなるはず
  assert(restoredSigma < originalSigma, '復元によりσ値が低減');

  info('Test 4.2: 計画線設定と移動量計算');

  // 計画線を生成（理想的な直線）
  const planLine = new Array(dataLength).fill(0);

  const movementResult = MovementCalculator.calculateMovement(
    restorationResult.restoredWaveform,
    planLine
  );

  assert(movementResult.success, '統合テスト: 移動量計算成功');

  const movementSigma = movementResult.statistics.movement.sigma;
  const predictedSigma = movementResult.statistics.predicted.sigma;

  info(`  移動量σ値: ${movementSigma.toFixed(3)} mm`);
  info(`  整正後予測σ値: ${predictedSigma.toFixed(3)} mm`);
  info(`  良化率: ${movementResult.improvementRate.toFixed(1)}%`);

  // 整正後予測波形は計画線に近いため、σ値が大幅に改善するはず
  assert(predictedSigma < restoredSigma * 0.1, '整正後のσ値が大幅に改善');
  assert(movementResult.improvementRate > 80, '良化率が80%以上');
}

// ========================================
// メイン実行
// ========================================
function main() {
  log('\n' + '█'.repeat(70), 'bright');
  log('  Phase 5: 復元波形計算システム 統合テスト', 'bright');
  log('█'.repeat(70) + '\n', 'bright');

  try {
    testFFTEngine();
    testRestorationFilter();
    testMovementCalculator();
    testIntegration();

    // テスト結果サマリー
    header('テスト結果サマリー');
    console.log();
    log(`  総テスト数: ${totalTests}`, 'bright');
    log(`  成功: ${passedTests}`, 'green');
    log(`  失敗: ${failedTests}`, failedTests > 0 ? 'red' : 'green');
    console.log();

    const successRate = (passedTests / totalTests * 100).toFixed(1);
    if (failedTests === 0) {
      log(`✓ 全テスト合格！ (成功率: ${successRate}%)`, 'green');
      log('\n Phase 5の実装は正常に動作しています。', 'cyan');
      process.exit(0);
    } else {
      log(`⚠ ${failedTests}件のテストが失敗しました (成功率: ${successRate}%)`, 'yellow');
      process.exit(1);
    }

  } catch (error) {
    console.error();
    log('テスト実行中にエラーが発生しました:', 'red');
    console.error(error);
    process.exit(1);
  }
}

// 実行
main();
