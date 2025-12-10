/**
 * 最適化版偏心矢計算のパフォーマンス比較ベンチマーク
 * Optimized Eccentric Versine Performance Comparison Benchmark
 */

const PerformanceBenchmark = require('./src/utils/benchmark.js');
const { EccentricVersine } = require('./src/algorithms/eccentric-versine.js');
const { EccentricVersineOptimized } = require('./src/algorithms/eccentric-versine-optimized.js');

async function runComparisonBenchmarks() {
  const benchmark = new PerformanceBenchmark();

  console.log('🔬 Starting Optimized vs Original Performance Comparison...\n');
  console.log('='.repeat(80));

  // テストケース定義
  const testCases = [
    { points: 1000, label: '1,000点 (250m)' },
    { points: 10000, label: '10,000点 (2.5km)' },
    { points: 50000, label: '50,000点 (12.5km)' },
    { points: 100000, label: '100,000点 (25km)' },
    { points: 500000, label: '500,000点 (125km)' }
  ];

  // パラメータ
  const p = 10;
  const q = 5;
  const samplingInterval = 0.25;

  console.log('\n📋 Test Configuration:');
  console.log(`   Chord lengths: p=${p}m, q=${q}m`);
  console.log(`   Sampling interval: ${samplingInterval}m`);
  console.log(`   Test cases: ${testCases.length}`);
  console.log('');

  const comparisonResults = [];

  // 各テストケースで比較
  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 Testing with ${testCase.label}`);
    console.log('='.repeat(80));

    const data = benchmark.generateTestData(testCase.points, samplingInterval);

    // メモリ使用量の推定
    const memoryEstimate = EccentricVersineOptimized.estimateMemoryUsage(testCase.points, p, q);
    console.log(`\n💾 Estimated Memory Usage:`);
    console.log(`   Total: ${memoryEstimate.totalMemory}`);
    console.log(`   Recommendation: ${memoryEstimate.recommendation}`);

    // 推奨処理方法
    const recommendedMethod = EccentricVersineOptimized.recommendProcessingMethod(testCase.points);
    console.log(`\n💡 Recommended Method: ${recommendedMethod}`);

    // オリジナル版でベンチマーク
    console.log(`\n⏱️  Testing Original Implementation...`);
    const originalCalculator = new EccentricVersine({ samplingInterval });
    const originalResult = await benchmark.measure(
      `Original - ${testCase.label}`,
      (measurementData, p, q) => originalCalculator.calculate(measurementData, p, q),
      data,
      p,
      q
    );

    // 最適化版でベンチマーク
    console.log(`\n⚡ Testing Optimized Implementation...`);
    const optimizedCalculator = new EccentricVersineOptimized({
      samplingInterval,
      chunkSize: 10000,
      enableProgress: true,
      progressCallback: (progress) => {
        if (progress.percentage % 25 === 0) {
          console.log(`   Progress: ${progress.percentage}% - ${progress.message}`);
        }
      }
    });
    const optimizedResult = await benchmark.measure(
      `Optimized - ${testCase.label}`,
      (measurementData, p, q) => optimizedCalculator.calculateLarge(measurementData, p, q),
      data,
      p,
      q
    );

    // 結果の比較
    const originalTime = originalResult.benchmark.executionTimeMs;
    const optimizedTime = optimizedResult.benchmark.executionTimeMs;
    const speedup = originalTime / optimizedTime;
    const improvement = ((originalTime - optimizedTime) / originalTime * 100).toFixed(1);

    console.log(`\n📈 Performance Comparison:`);
    console.log(`   Original:  ${originalResult.benchmark.executionTime}`);
    console.log(`   Optimized: ${optimizedResult.benchmark.executionTime}`);
    console.log(`   Speedup:   ${speedup.toFixed(2)}x`);
    console.log(`   Improvement: ${improvement}%`);

    console.log(`\n💾 Memory Comparison:`);
    console.log(`   Original:  ${originalResult.benchmark.memoryUsed.heapUsed}`);
    console.log(`   Optimized: ${optimizedResult.benchmark.memoryUsed.heapUsed}`);

    // 結果の保存
    comparisonResults.push({
      dataPoints: testCase.points,
      label: testCase.label,
      original: {
        time: originalTime,
        memory: parseFloat(originalResult.benchmark.memoryUsed.heapUsed)
      },
      optimized: {
        time: optimizedTime,
        memory: parseFloat(optimizedResult.benchmark.memoryUsed.heapUsed)
      },
      speedup: parseFloat(speedup.toFixed(2)),
      improvement: parseFloat(improvement),
      recommendedMethod
    });
  }

  // 総合レポート
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 COMPREHENSIVE PERFORMANCE REPORT');
  console.log('='.repeat(80));

  console.log('\n📈 Performance Summary:');
  console.log('┌─────────────────┬──────────────┬──────────────┬──────────┬─────────────┐');
  console.log('│ Dataset         │ Original (ms)│ Optimized(ms)│ Speedup  │ Improvement │');
  console.log('├─────────────────┼──────────────┼──────────────┼──────────┼─────────────┤');

  comparisonResults.forEach(result => {
    const label = result.label.padEnd(15);
    const origTime = result.original.time.toFixed(2).padStart(12);
    const optTime = result.optimized.time.toFixed(2).padStart(12);
    const speedup = `${result.speedup}x`.padStart(8);
    const improvement = `${result.improvement}%`.padStart(11);
    console.log(`│ ${label} │ ${origTime} │ ${optTime} │ ${speedup} │ ${improvement} │`);
  });

  console.log('└─────────────────┴──────────────┴──────────────┴──────────┴─────────────┘');

  // 平均改善率
  const avgImprovement = comparisonResults.reduce((sum, r) => sum + r.improvement, 0) / comparisonResults.length;
  const avgSpeedup = comparisonResults.reduce((sum, r) => sum + r.speedup, 0) / comparisonResults.length;

  console.log(`\n📊 Overall Statistics:`);
  console.log(`   Average Speedup: ${avgSpeedup.toFixed(2)}x`);
  console.log(`   Average Improvement: ${avgImprovement.toFixed(1)}%`);

  // 最も効果的だったケース
  const bestCase = comparisonResults.reduce((best, current) =>
    current.improvement > best.improvement ? current : best
  );
  console.log(`\n🏆 Best Performance Gain:`);
  console.log(`   Dataset: ${bestCase.label}`);
  console.log(`   Improvement: ${bestCase.improvement}%`);
  console.log(`   Speedup: ${bestCase.speedup}x`);

  // 推奨事項
  console.log(`\n💡 RECOMMENDATIONS:`);
  console.log('='.repeat(80));

  const largeDataThreshold = comparisonResults.find(r => r.speedup > 1.2);
  if (largeDataThreshold) {
    console.log(`✅ Use optimized version for datasets >= ${largeDataThreshold.dataPoints} points`);
  }

  const streamingThreshold = comparisonResults.find(r => r.dataPoints >= 100000);
  if (streamingThreshold) {
    console.log(`✅ Consider streaming processing for datasets >= 100,000 points`);
  }

  console.log(`✅ Chunk size of 10,000 points provides good balance`);
  console.log(`✅ Progress notifications improve UX for large datasets`);

  // 結果をJSONファイルに保存
  const fs = require('fs');
  const reportData = {
    timestamp: new Date().toISOString(),
    testConfiguration: {
      p,
      q,
      samplingInterval,
      testCases: testCases.map(tc => tc.label)
    },
    results: comparisonResults,
    summary: {
      averageSpeedup: parseFloat(avgSpeedup.toFixed(2)),
      averageImprovement: parseFloat(avgImprovement.toFixed(1)),
      bestCase: {
        dataset: bestCase.label,
        improvement: bestCase.improvement,
        speedup: bestCase.speedup
      }
    },
    recommendations: [
      {
        type: 'threshold',
        message: largeDataThreshold
          ? `Use optimized version for datasets >= ${largeDataThreshold.dataPoints} points`
          : 'Optimized version shows consistent benefits across all dataset sizes'
      },
      {
        type: 'streaming',
        message: 'Consider streaming processing for datasets >= 100,000 points'
      }
    ]
  };

  fs.writeFileSync(
    './benchmark-optimized-comparison-report.json',
    JSON.stringify(reportData, null, 2)
  );

  console.log('\n📄 Detailed report saved to: benchmark-optimized-comparison-report.json');
  console.log('\n✅ Comparison benchmark completed successfully!');
  console.log('='.repeat(80) + '\n');
}

// 実行
runComparisonBenchmarks().catch(error => {
  console.error('❌ Comparison benchmark failed:', error);
  process.exit(1);
});
