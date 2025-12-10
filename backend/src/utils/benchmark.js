/**
 * パフォーマンスベンチマークユーティリティ
 * Performance Benchmark Utility
 */

class PerformanceBenchmark {
  constructor() {
    this.results = [];
  }

  /**
   * 処理時間を測定
   * @param {string} name - ベンチマーク名
   * @param {Function} fn - 測定する関数
   * @param {any} args - 関数の引数
   * @returns {Object} 測定結果
   */
  async measure(name, fn, ...args) {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();

    let result;
    try {
      result = await fn(...args);
    } catch (error) {
      throw error;
    }

    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();

    const executionTime = Number(endTime - startTime) / 1_000_000; // ナノ秒からミリ秒
    const memoryUsed = {
      heapUsed: (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024, // MB
      external: (endMemory.external - startMemory.external) / 1024 / 1024, // MB
      rss: (endMemory.rss - startMemory.rss) / 1024 / 1024 // MB
    };

    const benchmarkResult = {
      name,
      executionTime: executionTime.toFixed(2) + ' ms',
      executionTimeMs: executionTime,
      memoryUsed: {
        heapUsed: memoryUsed.heapUsed.toFixed(2) + ' MB',
        external: memoryUsed.external.toFixed(2) + ' MB',
        rss: memoryUsed.rss.toFixed(2) + ' MB'
      },
      timestamp: new Date().toISOString()
    };

    this.results.push(benchmarkResult);
    return { result, benchmark: benchmarkResult };
  }

  /**
   * 複数回実行して平均を取る
   * @param {string} name - ベンチマーク名
   * @param {Function} fn - 測定する関数
   * @param {number} iterations - 実行回数
   * @param {any} args - 関数の引数
   * @returns {Object} 平均測定結果
   */
  async measureAverage(name, fn, iterations = 10, ...args) {
    const measurements = [];

    for (let i = 0; i < iterations; i++) {
      const { benchmark } = await this.measure(`${name}_iteration_${i + 1}`, fn, ...args);
      measurements.push(benchmark.executionTimeMs);
    }

    const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const min = Math.min(...measurements);
    const max = Math.max(...measurements);
    const stdDev = Math.sqrt(
      measurements.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / measurements.length
    );

    return {
      name,
      iterations,
      average: avg.toFixed(2) + ' ms',
      min: min.toFixed(2) + ' ms',
      max: max.toFixed(2) + ' ms',
      stdDev: stdDev.toFixed(2) + ' ms',
      measurements: measurements.map(m => m.toFixed(2) + ' ms')
    };
  }

  /**
   * テストデータ生成
   * @param {number} points - データ点数
   * @param {number} samplingInterval - サンプリング間隔
   * @returns {Array} テストデータ
   */
  generateTestData(points, samplingInterval = 0.25) {
    const data = [];
    for (let i = 0; i < points; i++) {
      data.push({
        distance: i * samplingInterval,
        value: Math.sin(i * 0.1) * 5 + Math.random() * 2
      });
    }
    return data;
  }

  /**
   * 結果をコンソールに出力
   */
  printResults() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 PERFORMANCE BENCHMARK RESULTS');
    console.log('='.repeat(80));

    this.results.forEach((result, index) => {
      console.log(`\n[${index + 1}] ${result.name}`);
      console.log(`   Execution Time: ${result.executionTime}`);
      console.log(`   Memory Usage:`);
      console.log(`     - Heap Used: ${result.memoryUsed.heapUsed}`);
      console.log(`     - External: ${result.memoryUsed.external}`);
      console.log(`     - RSS: ${result.memoryUsed.rss}`);
      console.log(`   Timestamp: ${result.timestamp}`);
    });

    console.log('\n' + '='.repeat(80));
  }

  /**
   * 結果をJSON形式で取得
   * @returns {Array} ベンチマーク結果
   */
  getResults() {
    return this.results;
  }

  /**
   * 結果をクリア
   */
  clearResults() {
    this.results = [];
  }

  /**
   * サマリーレポートを生成
   * @returns {Object} サマリー
   */
  getSummary() {
    if (this.results.length === 0) {
      return { message: 'No benchmark results available' };
    }

    const executionTimes = this.results.map(r => r.executionTimeMs);
    const totalTime = executionTimes.reduce((a, b) => a + b, 0);
    const avgTime = totalTime / executionTimes.length;
    const maxTime = Math.max(...executionTimes);
    const minTime = Math.min(...executionTimes);

    return {
      totalBenchmarks: this.results.length,
      totalExecutionTime: totalTime.toFixed(2) + ' ms',
      averageExecutionTime: avgTime.toFixed(2) + ' ms',
      minExecutionTime: minTime.toFixed(2) + ' ms',
      maxExecutionTime: maxTime.toFixed(2) + ' ms',
      slowestOperation: this.results.find(r => r.executionTimeMs === maxTime)?.name,
      fastestOperation: this.results.find(r => r.executionTimeMs === minTime)?.name
    };
  }
}

module.exports = PerformanceBenchmark;
