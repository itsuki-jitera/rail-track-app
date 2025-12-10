/**
 * 偏心矢計算のパフォーマンスベンチマーク
 * Eccentric Versine Performance Benchmark
 */

const PerformanceBenchmark = require('./src/utils/benchmark.js');
const { EccentricVersine } = require('./src/algorithms/eccentric-versine.js');

async function runBenchmarks() {
  const benchmark = new PerformanceBenchmark();
  const calculator = new EccentricVersine({ samplingInterval: 0.25 });

  console.log('🚀 Starting Eccentric Versine Performance Benchmarks...\n');

  // テストケース定義
  const testCases = [
    { points: 100, label: '100点 (25m)' },
    { points: 1000, label: '1,000点 (250m)' },
    { points: 10000, label: '10,000点 (2.5km)' },
    { points: 100000, label: '100,000点 (25km)' },
    { points: 1000000, label: '1,000,000点 (250km)' }
  ];

  console.log('📋 Test Cases:');
  testCases.forEach((tc, i) => {
    console.log(`   ${i + 1}. ${tc.label}`);
  });
  console.log('');

  // 1. 偏心矢計算のベンチマーク
  console.log('📐 Benchmarking Eccentric Versine Calculation...');
  for (const testCase of testCases) {
    const data = benchmark.generateTestData(testCase.points);
    console.log(`   Testing with ${testCase.label}...`);

    await benchmark.measure(
      `偏心矢計算 (${testCase.label})`,
      (measurementData, p, q) => calculator.calculate(measurementData, p, q),
      data,
      10,
      5
    );
  }

  // 2. 検測特性計算のベンチマーク
  console.log('\n📊 Benchmarking Characteristics Calculation...');
  const wavelengthRanges = [
    { min: 1, max: 50, step: 1, label: '50点 (1-50m)' },
    { min: 1, max: 100, step: 1, label: '100点 (1-100m)' },
    { min: 1, max: 200, step: 1, label: '200点 (1-200m)' },
    { min: 1, max: 200, step: 0.5, label: '400点 (1-200m, 0.5m刻み)' }
  ];

  for (const range of wavelengthRanges) {
    console.log(`   Testing with ${range.label}...`);
    const wavelengths = [];
    for (let L = range.min; L <= range.max; L += range.step) {
      wavelengths.push(L);
    }
    await benchmark.measure(
      `検測特性計算 (${range.label})`,
      (p, q, waves) => calculator.calculateMeasurementCharacteristics(p, q, waves),
      10,
      5,
      wavelengths
    );
  }

  // 3. 偏心矢変換のベンチマーク
  console.log('\n🔄 Benchmarking Versine Conversion...');
  for (const testCase of testCases.slice(0, 4)) { // 最大10万点まで
    const data = benchmark.generateTestData(testCase.points);
    const versineValues = calculator.calculateEccentricVersine(
      new Float32Array(data.map(d => d.value)),
      10,
      5
    );
    console.log(`   Testing with ${testCase.label}...`);

    await benchmark.measure(
      `偏心矢変換 (${testCase.label})`,
      (versineData, p1, q1, p2, q2, wavelength) =>
        calculator.convertVersine(versineData, p1, q1, p2, q2, wavelength),
      versineValues,
      10,
      5,
      5,
      5,
      20
    );
  }

  // 4. 一括特性計算のベンチマーク
  console.log('\n📈 Benchmarking Batch Characteristics...');
  const configurations = [
    { p: 10, q: 5, label: '10-5m' },
    { p: 5, q: 5, label: '5-5m' },
    { p: 20, q: 10, label: '20-10m' }
  ];

  const wavelengthArray = [];
  for (let L = 1; L <= 200; L += 1) {
    wavelengthArray.push(L);
  }

  await benchmark.measure(
    `一括特性計算 (3設定 × 200波長)`,
    () => {
      const results = [];
      for (const config of configurations) {
        const chars = calculator.calculateMeasurementCharacteristics(
          config.p,
          config.q,
          wavelengthArray
        );
        results.push({ label: config.label, characteristics: chars });
      }
      return results;
    }
  );

  // 5. メモリ効率テスト - 大規模データ
  console.log('\n💾 Memory Efficiency Test (Large Dataset)...');
  const largeData = benchmark.generateTestData(500000); // 50万点
  console.log(`   Testing with 500,000 points (125km)...`);

  await benchmark.measure(
    `大規模データセット処理 (500,000点)`,
    (measurementData, p, q) => calculator.calculate(measurementData, p, q),
    largeData,
    10,
    5
  );

  // 結果表示
  benchmark.printResults();

  // サマリー表示
  console.log('\n📊 SUMMARY');
  console.log('='.repeat(80));
  const summary = benchmark.getSummary();
  console.log(`Total Benchmarks: ${summary.totalBenchmarks}`);
  console.log(`Total Execution Time: ${summary.totalExecutionTime}`);
  console.log(`Average Execution Time: ${summary.averageExecutionTime}`);
  console.log(`Fastest Operation: ${summary.fastestOperation} (${summary.minExecutionTime})`);
  console.log(`Slowest Operation: ${summary.slowestOperation} (${summary.maxExecutionTime})`);
  console.log('='.repeat(80));

  // ボトルネック分析
  console.log('\n🔍 BOTTLENECK ANALYSIS');
  console.log('='.repeat(80));

  const results = benchmark.getResults();
  const sortedByTime = [...results].sort((a, b) => b.executionTimeMs - a.executionTimeMs);

  console.log('\nTop 5 Slowest Operations:');
  sortedByTime.slice(0, 5).forEach((result, index) => {
    console.log(`   ${index + 1}. ${result.name}`);
    console.log(`      Time: ${result.executionTime}`);
    console.log(`      Memory (Heap): ${result.memoryUsed.heapUsed}`);
  });

  // パフォーマンス推奨事項
  console.log('\n💡 PERFORMANCE RECOMMENDATIONS');
  console.log('='.repeat(80));

  const largeDataResults = results.filter(r => r.name.includes('100,000') || r.name.includes('1,000,000'));
  if (largeDataResults.some(r => r.executionTimeMs > 500)) {
    console.log('⚠️  Large dataset processing is slow (>500ms)');
    console.log('   Recommendations:');
    console.log('   - Implement streaming processing for datasets > 100,000 points');
    console.log('   - Use Worker Threads for parallel processing');
    console.log('   - Consider implementing data pagination');
  }

  const memoryIntensive = results.filter(r => {
    const heapMB = parseFloat(r.memoryUsed.heapUsed);
    return heapMB > 50;
  });
  if (memoryIntensive.length > 0) {
    console.log('\n⚠️  High memory usage detected');
    console.log('   Recommendations:');
    console.log('   - Implement memory-efficient algorithms');
    console.log('   - Use streaming for large file processing');
    console.log('   - Add memory limits and error handling');
  }

  console.log('\n✅ Benchmark completed successfully!');
  console.log('='.repeat(80) + '\n');

  // JSON形式で保存
  const fs = require('fs');
  const reportData = {
    timestamp: new Date().toISOString(),
    summary,
    results: results.map(r => ({
      name: r.name,
      executionTime: r.executionTime,
      memoryUsed: r.memoryUsed,
      timestamp: r.timestamp
    })),
    recommendations: []
  };

  if (largeDataResults.some(r => r.executionTimeMs > 500)) {
    reportData.recommendations.push({
      type: 'performance',
      priority: 'high',
      message: 'Implement streaming processing for large datasets'
    });
  }

  if (memoryIntensive.length > 0) {
    reportData.recommendations.push({
      type: 'memory',
      priority: 'medium',
      message: 'Optimize memory usage for large calculations'
    });
  }

  fs.writeFileSync(
    './benchmark-report.json',
    JSON.stringify(reportData, null, 2)
  );
  console.log('📄 Benchmark report saved to: benchmark-report.json\n');
}

// 実行
runBenchmarks().catch(error => {
  console.error('❌ Benchmark failed:', error);
  process.exit(1);
});
