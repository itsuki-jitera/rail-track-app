/**
 * 計画線データの生成とスケール検証テスト
 */

const InitialPlanLineGenerator = require('./backend/src/algorithms/initial-plan-line-generator');

// テスト用の復元波形データを生成（実際の通り狂いを模擬）
function generateTestWaveform(length = 500) {
  const waveform = [];

  for (let i = 0; i < length * 4; i++) {  // 0.25m間隔
    const position = i * 0.25;

    // 実際の軌道狂いパターンをシミュレート
    // 長周期成分（100-200m周期、±3mm程度）
    const longWave = 3 * Math.sin(2 * Math.PI * position / 150);

    // 中周期成分（20-40m周期、±1.5mm程度）
    const midWave = 1.5 * Math.sin(2 * Math.PI * position / 30 + Math.PI / 4);

    // 短周期成分（5-10m周期、±0.5mm程度）
    const shortWave = 0.5 * Math.sin(2 * Math.PI * position / 7 + Math.PI / 3);

    // ランダムノイズ（±0.2mm程度）
    const noise = (Math.random() - 0.5) * 0.4;

    // 合成値
    const value = longWave + midWave + shortWave + noise;

    waveform.push({
      position: position,
      value: value
    });
  }

  return waveform;
}

// メインテスト
function testPlanLineGeneration() {
  console.log('=== 計画線生成テスト ===\n');

  // テスト波形を生成
  const restoredWaveform = generateTestWaveform();

  console.log('復元波形データ:');
  console.log(`- データ点数: ${restoredWaveform.length}`);
  console.log(`- データ範囲: 0 - ${restoredWaveform[restoredWaveform.length - 1].position}m`);

  // 値の範囲を計算
  const values = restoredWaveform.map(p => p.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const avgValue = values.reduce((sum, v) => sum + v, 0) / values.length;

  console.log(`- 最小値: ${minValue.toFixed(3)}mm`);
  console.log(`- 最大値: ${maxValue.toFixed(3)}mm`);
  console.log(`- 平均値: ${avgValue.toFixed(3)}mm`);
  console.log(`- 振幅: ${(maxValue - minValue).toFixed(3)}mm\n`);

  // 各方法で初期計画線を生成
  const methods = ['restored-based', 'convex', 'flat'];

  methods.forEach(method => {
    console.log(`\n=== ${method} 方法 ===`);

    const generator = new InitialPlanLineGenerator({
      method: method,
      smoothingFactor: 0.3,
      upwardBias: 2,
      maxUpward: 50,
      maxDownward: 10
    });

    try {
      const result = generator.generateInitialPlanLine(restoredWaveform, {
        method: method
      });

      const planLine = result.planLine;
      const planValues = planLine.map(p => p.value);
      const planMin = Math.min(...planValues);
      const planMax = Math.max(...planValues);
      const planAvg = planValues.reduce((sum, v) => sum + v, 0) / planValues.length;

      console.log('計画線データ:');
      console.log(`- データ点数: ${planLine.length}`);
      console.log(`- 最小値: ${planMin.toFixed(3)}mm`);
      console.log(`- 最大値: ${planMax.toFixed(3)}mm`);
      console.log(`- 平均値: ${planAvg.toFixed(3)}mm`);
      console.log(`- 振幅: ${(planMax - planMin).toFixed(3)}mm`);

      // 統計情報
      if (result.statistics) {
        console.log('\n統計情報:');
        console.log(`- こう上率: ${(result.statistics.upwardRatio * 100).toFixed(1)}%`);
        console.log(`- 最大こう上量: ${result.statistics.maxUpward.toFixed(1)}mm`);
        console.log(`- 最大こう下量: ${result.statistics.maxDownward.toFixed(1)}mm`);
        console.log(`- 平均こう上量: ${result.statistics.avgUpward.toFixed(1)}mm`);
        console.log(`- 平均こう下量: ${result.statistics.avgDownward.toFixed(1)}mm`);
      }

      // 最初の10点を表示
      console.log('\n最初の10点のデータ:');
      for (let i = 0; i < Math.min(10, planLine.length); i++) {
        const movement = planLine[i].value - restoredWaveform[i].value;
        console.log(`  ${i}: 位置=${planLine[i].position.toFixed(2)}m, ` +
                   `復元=${restoredWaveform[i].value.toFixed(3)}mm, ` +
                   `計画=${planLine[i].value.toFixed(3)}mm, ` +
                   `移動=${movement > 0 ? '+' : ''}${movement.toFixed(3)}mm`);
      }

      // 妥当性検証
      const validation = generator.validateInitialPlanLine(planLine, restoredWaveform);
      console.log('\n妥当性検証:');
      console.log(`- 有効: ${validation.valid ? 'はい' : 'いいえ'}`);
      if (validation.issues.length > 0) {
        console.log('- 問題点:');
        validation.issues.forEach(issue => console.log(`  * ${issue}`));
      }
      if (validation.warnings.length > 0) {
        console.log('- 警告:');
        validation.warnings.forEach(warning => console.log(`  * ${warning}`));
      }
      console.log(`- 推奨: ${validation.recommendation}`);

    } catch (error) {
      console.error(`エラー: ${error.message}`);
    }
  });

  // 問題の診断
  console.log('\n\n=== 問題の診断 ===');
  console.log('ユーザーの報告:');
  console.log('「計画線の設定値として0.1mmかそうでないかくらいの違いしかない」');
  console.log('\n原因分析:');

  // flatメソッドの問題を確認
  const flatGenerator = new InitialPlanLineGenerator({ method: 'flat' });
  const flatResult = flatGenerator.generateInitialPlanLine(restoredWaveform, { method: 'flat' });
  const flatVariance = flatGenerator.calculateVariance(flatResult.planLine);

  console.log(`1. フラット計画線の分散: ${flatVariance.toFixed(6)}`);
  if (flatVariance < 0.01) {
    console.log('   → 計画線がほぼ直線（分散が0.01未満）');
    console.log('   → これが「0.1mm程度の違い」の原因と思われます');
  }

  // restored-basedメソッドの改善確認
  const improvedGenerator = new InitialPlanLineGenerator({ method: 'restored-based' });
  const improvedResult = improvedGenerator.generateInitialPlanLine(restoredWaveform, { method: 'restored-based' });
  const improvedVariance = improvedGenerator.calculateVariance(improvedResult.planLine);

  console.log(`\n2. 改善された計画線の分散: ${improvedVariance.toFixed(6)}`);
  if (improvedVariance > 1) {
    console.log('   → 適切な変化を持つ計画線が生成されています');
  }

  console.log('\n推奨対策:');
  console.log('1. restored-based方法を使用する');
  console.log('2. 初期値生成時にflatメソッドを避ける');
  console.log('3. グラフのY軸スケールを±10mm程度に設定する');
}

// テスト実行
testPlanLineGeneration();