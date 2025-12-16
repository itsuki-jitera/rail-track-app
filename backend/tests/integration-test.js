/**
 * 統合テスト
 *
 * レールトラック軌道整正システムの主要機能を検証
 */

const fs = require('fs').promises;
const path = require('path');

// エクスポーター
const PRMExporter = require('../src/exporters/prm-exporter');
const RestrictionExporter = require('../src/exporters/restriction-exporter');
const CurveElementExporter = require('../src/exporters/curve-element-exporter');

// アルゴリズム
const BoundaryConnection = require('../src/algorithms/boundary-connection');
const RestorationEngine = require('../src/algorithms/restoration-engine');
const CurveTrapezoid = require('../src/algorithms/curve-trapezoid');
const VerticalCurveExclusion = require('../src/algorithms/vertical-curve-exclusion');

// テストデータ生成
function generateTestData(length = 1000, interval = 0.25) {
  const data = [];
  for (let pos = 0; pos <= length; pos += interval) {
    data.push({
      position: pos,
      levelLeft: Math.sin(pos * 0.01) * 10 + Math.random() * 2,
      levelRight: Math.sin(pos * 0.01) * 10 + Math.random() * 2,
      alignmentLeft: Math.cos(pos * 0.02) * 5 + Math.random(),
      alignmentRight: Math.cos(pos * 0.02) * 5 + Math.random(),
      gauge: 1067 + Math.random() * 2 - 1,
      cant: Math.sin(pos * 0.005) * 30
    });
  }
  return data;
}

// テスト用作業区間
const testWorkSection = {
  lineName: 'テスト線',
  trackName: '上り本線',
  direction: 'up',
  startKm: 540000,
  endKm: 541000,
  workDate: '2024-01-15',
  operator: 'テストオペレータ',
  outputDir: './test-output',
  filePrefix: 'TEST'
};

// テスト実行
async function runIntegrationTests() {
  console.log('=== 統合テスト開始 ===\n');

  try {
    // 出力ディレクトリ作成
    await fs.mkdir(testWorkSection.outputDir, { recursive: true });

    // テスト1: パラメータファイル出力
    await testPRMExporter();

    // テスト2: 移動量制限ファイル出力
    await testRestrictionExporter();

    // テスト3: 曲線諸元ファイル出力
    await testCurveElementExporter();

    // テスト4: 前後接続処理
    await testBoundaryConnection();

    // テスト5: 復元波形計算
    await testRestorationEngine();

    // テスト6: 曲線諸元台形差引
    await testCurveTrapezoid();

    // テスト7: 縦曲線除外
    await testVerticalCurveExclusion();

    console.log('\n=== 統合テスト完了 ===');
    console.log('✅ 全てのテストが成功しました');

  } catch (error) {
    console.error('❌ テスト失敗:', error.message);
    console.error(error.stack);
  }
}

// テスト1: パラメータファイル出力
async function testPRMExporter() {
  console.log('📝 テスト1: パラメータファイル出力');

  const exporter = new PRMExporter();

  const testParams = {
    restoration: {
      method: 'FFT',
      minWavelength: 6,
      maxWavelength: 40,
      windowFunction: 'HANNING'
    },
    planLine: {
      method: 'CONVEX',
      priorityMode: 'UPWARD',
      maxUpward: 50,
      maxDownward: 10
    },
    curve: {
      chordLength: 10,
      applyTrapezoid: true,
      elements: [
        {
          startKm: 540200,
          endKm: 540400,
          radius: 400,
          direction: 'right',
          cant: 105
        }
      ]
    },
    mtt: {
      type: '08-475',
      applyCorrection: true
    },
    output: {
      alsFormat: true,
      csvFormat: true
    }
  };

  const filePath = await exporter.exportParameters(testParams, testWorkSection);
  console.log(`  ✓ PRMファイル出力: ${filePath}`);

  // 読み込みテスト
  const imported = await exporter.importParameters(filePath);
  console.log(`  ✓ PRMファイル読み込み成功`);
  console.log(`    - 復元波形方式: ${imported.restoration.method}`);
  console.log(`    - 曲線数: ${imported.curve.elements.length}`);
}

// テスト2: 移動量制限ファイル出力
async function testRestrictionExporter() {
  console.log('\n📝 テスト2: 移動量制限ファイル出力');

  const exporter = new RestrictionExporter();

  const testRestrictions = [
    {
      startKm: 540100,
      endKm: 540150,
      direction: 'both',
      restrictionAmount: 0,
      isFixed: true,
      notes: '橋梁区間'
    },
    {
      startKm: 540300,
      endKm: 540320,
      direction: 'left',
      restrictionAmount: 10,
      isFixed: false,
      notes: '建築限界'
    },
    {
      startKm: 540500,
      endKm: 540520,
      direction: 'vertical',
      restrictionAmount: 5,
      isFixed: false,
      notes: '踏切'
    }
  ];

  const files = await exporter.exportRestrictions(testRestrictions, testWorkSection);
  console.log(`  ✓ 左右方向制限ファイル: ${files.lateral}`);
  console.log(`  ✓ 上下方向制限ファイル: ${files.vertical}`);

  // 読み込みテスト
  const lateralData = await exporter.importRestrictions(files.lateral, 'lateral');
  console.log(`  ✓ 左右制限データ読み込み: ${lateralData.length}件`);
}

// テスト3: 曲線諸元ファイル出力
async function testCurveElementExporter() {
  console.log('\n📝 テスト3: 曲線諸元ファイル出力');

  const exporter = new CurveElementExporter();

  const testCurveData = {
    horizontalCurves: [
      {
        startKm: 540200,
        endKm: 540400,
        radius: 400,
        direction: 'right',
        cant: 105,
        transitionLength: 60,
        type: 'transition',
        speed: 65
      },
      {
        startKm: 540600,
        endKm: 540800,
        radius: 600,
        direction: 'left',
        cant: 70,
        transitionLength: 40,
        type: 'circular',
        speed: 75
      }
    ],
    verticalCurves: [
      {
        startKm: 540300,
        endKm: 540500,
        radius: 5000,
        type: 'convex',
        startGradient: 15,
        endGradient: -10
      }
    ],
    gradientSections: [
      {
        startKm: 540000,
        endKm: 540300,
        gradient: 15
      },
      {
        startKm: 540500,
        endKm: 541000,
        gradient: -10
      }
    ]
  };

  const filePath = await exporter.exportCurveElements(testCurveData, testWorkSection);
  console.log(`  ✓ 曲線諸元ファイル出力: ${filePath}`);

  // 検証
  const validation = exporter.validateCurveElements(testCurveData);
  console.log(`  ✓ 曲線諸元検証: ${validation.valid ? '正常' : 'エラー'}`);
  if (validation.warnings.length > 0) {
    validation.warnings.forEach(w => console.log(`    ⚠ ${w}`));
  }

  // 読み込みテスト
  const imported = await exporter.importCurveElements(filePath);
  console.log(`  ✓ 曲線諸元読み込み成功`);
  console.log(`    - 平面曲線: ${imported.horizontalCurves.length}個`);
  console.log(`    - 縦曲線: ${imported.verticalCurves.length}個`);
}

// テスト4: 前後接続処理
async function testBoundaryConnection() {
  console.log('\n📝 テスト4: 前後接続処理');

  const connection = new BoundaryConnection({
    frontLength: 50,
    rearLength: 50,
    connectionType: 'cubic',
    mttType: '08-475',
    verbose: false
  });

  // テスト移動量データ
  const testMovementData = [];
  for (let pos = 540000; pos <= 541000; pos += 0.5) {
    testMovementData.push({
      position: pos,
      lateralMovement: Math.sin((pos - 540000) * 0.01) * 20,
      verticalMovement: Math.cos((pos - 540000) * 0.01) * 15
    });
  }

  const connectedData = connection.applyBoundaryConnection(
    testMovementData,
    testWorkSection
  );

  console.log(`  ✓ 接続処理完了: ${connectedData.length}点`);

  // 統計取得
  const stats = connection.getConnectionStatistics(connectedData);
  console.log(`  ✓ 前方接続点: ${stats.frontConnectionPoints}点`);
  console.log(`  ✓ 後方接続点: ${stats.rearConnectionPoints}点`);
  console.log(`  ✓ 最大横移動量: ${stats.maxLateralMovement.toFixed(1)}mm`);
  console.log(`  ✓ 最大縦移動量: ${stats.maxVerticalMovement.toFixed(1)}mm`);

  // 検証
  const validation = connection.validateConnection(connectedData);
  console.log(`  ✓ 接続検証: ${validation.valid ? '正常' : '警告あり'}`);
  if (validation.warnings.length > 0) {
    validation.warnings.slice(0, 3).forEach(w => console.log(`    ⚠ ${w}`));
  }
}

// テスト5: 復元波形計算
async function testRestorationEngine() {
  console.log('\n📝 テスト5: 復元波形計算');

  const engine = new RestorationEngine();
  const testData = generateTestData(500);

  // 高低データ
  const levelData = testData.map(d => ({
    position: d.position,
    value: (d.levelLeft + d.levelRight) / 2
  }));

  // 通りデータ
  const alignmentData = testData.map(d => ({
    position: d.position,
    value: (d.alignmentLeft + d.alignmentRight) / 2
  }));

  // 復元波形計算
  const levelResult = engine.calculateRestorationWaveform(levelData);
  const alignmentResult = engine.calculateRestorationWaveform(alignmentData);

  console.log(`  ✓ 高低復元波形計算完了`);
  console.log(`    - データ点数: ${levelResult.restoredWaveform.length}`);
  console.log(`    - σ値: ${levelResult.statistics.sigma.toFixed(3)}`);

  console.log(`  ✓ 通り復元波形計算完了`);
  console.log(`    - データ点数: ${alignmentResult.restoredWaveform.length}`);
  console.log(`    - σ値: ${alignmentResult.statistics.sigma.toFixed(3)}`);

  // 計画線生成
  const planLine = engine.calculatePlanLine(levelResult.restoredWaveform);
  console.log(`  ✓ 計画線生成完了: ${planLine.length}点`);

  // 移動量計算
  const movement = engine.calculateMovement(
    levelResult.restoredWaveform,
    planLine
  );
  console.log(`  ✓ 移動量計算完了`);
  console.log(`    - 良化率: ${movement.statistics.improvementRate.toFixed(1)}%`);
}

// テスト6: 曲線諸元台形差引
async function testCurveTrapezoid() {
  console.log('\n📝 テスト6: 曲線諸元台形差引');

  const testData = generateTestData(500);
  const alignmentData = testData.map(d => ({
    position: d.position,
    value: (d.alignmentLeft + d.alignmentRight) / 2 + Math.sin(d.position * 0.05) * 10
  }));

  const curveElements = [
    {
      startKm: 100,
      endKm: 300,
      radius: 400,
      direction: 'right',
      transitionLength: 50,
      type: 'clothoid'
    }
  ];

  const result = CurveTrapezoid.subtractCurveTrapezoid(
    alignmentData,
    curveElements,
    { chordLength: 10 }
  );

  console.log(`  ✓ 台形差引完了: ${result.processedData.length}点`);
  console.log(`  ✓ 理論正矢計算完了`);
  console.log(`    - 最大正矢: ${result.statistics.maxTheoreticalVersine.toFixed(1)}mm`);
  console.log(`    - 差引後σ値: ${result.statistics.sigmaAfter.toFixed(3)}`);
}

// テスト7: 縦曲線除外
async function testVerticalCurveExclusion() {
  console.log('\n📝 テスト7: 縦曲線除外');

  const testData = generateTestData(500);
  const levelData = testData.map(d => ({
    position: d.position,
    value: (d.levelLeft + d.levelRight) / 2 +
            0.00001 * d.position * d.position  // 縦曲線成分
  }));

  const result = VerticalCurveExclusion.excludeVerticalCurve(levelData, {
    method: 'movingAverage',
    windowSize: 100
  });

  console.log(`  ✓ 縦曲線除外完了: ${result.processedData.length}点`);
  console.log(`  ✓ 除外成分抽出完了`);
  console.log(`    - 最大除外量: ${result.statistics.maxExclusion.toFixed(1)}mm`);
  console.log(`    - 除外後σ値: ${result.statistics.sigmaAfter.toFixed(3)}`);
}

// テスト実行
if (require.main === module) {
  runIntegrationTests().catch(console.error);
}

module.exports = { runIntegrationTests };