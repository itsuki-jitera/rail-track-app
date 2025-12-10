/**
 * 復元波形計算機能のテストスクリプト
 */

import RestorationWaveformCalculator from './src/calculators/restoration-waveform.js';

// テストデータ生成: 正弦波 + ノイズ
function generateTestData(numPoints = 200) {
  const data = [];
  const wavelength = 20; // 20mの波長
  const amplitude = 5;   // 振幅5mm

  for (let i = 0; i < numPoints; i++) {
    const distance = i * 0.5; // 0.5m間隔
    const baseValue = amplitude * Math.sin(2 * Math.PI * distance / wavelength);
    const noise = (Math.random() - 0.5) * 2; // ±1mmのノイズ
    const value = baseValue + noise;

    data.push({ distance, value });
  }

  return data;
}

async function runTest() {
  console.log('========================================');
  console.log('復元波形計算機能テスト');
  console.log('========================================\n');

  // テストデータ生成
  console.log('テストデータ生成中...');
  const testData = generateTestData(200);
  console.log(`✓ ${testData.length}点のテストデータを生成しました\n`);

  // 計算器を初期化
  console.log('復元波形計算器を初期化中...');
  const calculator = new RestorationWaveformCalculator({
    minWavelength: 6.0,
    maxWavelength: 40.0,
    samplingInterval: 0.25
  });
  console.log('✓ 初期化完了\n');

  // 計算実行
  console.log('========================================');
  console.log('計算開始');
  console.log('========================================\n');

  const startTime = Date.now();
  const result = calculator.calculate(testData);
  const endTime = Date.now();

  console.log('\n========================================');
  console.log('計算結果');
  console.log('========================================\n');

  if (result.success) {
    console.log('✓ 計算成功!\n');

    console.log('【メタデータ】');
    console.log(`  元データ点数: ${result.data.metadata.originalDataPoints}`);
    console.log(`  リサンプリング後: ${result.data.metadata.resampledDataPoints}`);
    console.log(`  FFTサイズ: ${result.data.metadata.fftSize}`);
    console.log(`  ゼロクロス点数: ${result.data.metadata.zeroCrossCount}`);
    console.log(`  復元波長範囲: ${result.data.metadata.minWavelength}m - ${result.data.metadata.maxWavelength}m`);
    console.log(`  サンプリング間隔: ${result.data.metadata.samplingInterval}m\n`);

    console.log('【フィルタ情報】');
    console.log(`  最小周波数: ${result.data.filterInfo.minFreq.toFixed(4)} Hz`);
    console.log(`  最大周波数: ${result.data.filterInfo.maxFreq.toFixed(4)} Hz`);
    console.log(`  波長範囲: ${result.data.filterInfo.minWavelength}m - ${result.data.filterInfo.maxWavelength}m\n`);

    console.log('【結果データ】');
    console.log(`  復元波形: ${result.data.restorationWaveform.length}点`);
    console.log(`  計画線: ${result.data.planLine.length}点`);
    console.log(`  移動量: ${result.data.movementAmounts.length}点`);
    console.log(`  ゼロクロス点: ${result.data.zeroCrossPoints.length}点\n`);

    console.log('【ゼロクロス点（最初の5点）】');
    result.data.zeroCrossPoints.slice(0, 5).forEach((point, idx) => {
      console.log(`  ${idx + 1}. 距離: ${point.distance.toFixed(2)}m, タイプ: ${point.type}`);
    });
    console.log();

    console.log('【移動量サンプル（最初の10点）】');
    result.data.movementAmounts.slice(0, 10).forEach((point, idx) => {
      console.log(`  ${idx + 1}. ${point.distance.toFixed(2)}m: ${point.amount.toFixed(3)}mm`);
    });
    console.log();

    console.log(`処理時間: ${endTime - startTime}ms\n`);

    console.log('========================================');
    console.log('テスト完了: ✓ 成功');
    console.log('========================================');

  } else {
    console.error('✗ 計算失敗');
    console.error(`エラー: ${result.error}`);
    if (result.stack) {
      console.error(`スタックトレース:\n${result.stack}`);
    }

    console.log('\n========================================');
    console.log('テスト完了: ✗ 失敗');
    console.log('========================================');
    process.exit(1);
  }
}

// テスト実行
runTest().catch(error => {
  console.error('テスト中にエラーが発生しました:', error);
  process.exit(1);
});
