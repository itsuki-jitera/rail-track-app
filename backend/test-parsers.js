/**
 * パーサーの手動テストスクリプト
 * 実際のCK/LKファイルを使って動作確認
 */
import fs from 'fs/promises';
import path from 'path';
import { smartDecode } from './src/utils/encoding-detector.js';
import { parseCK } from './src/parsers/ck-parser.js';
import { parseLK } from './src/parsers/lk-parser.js';

async function testCKParser(filePath) {
  console.log('\n=== CKファイルのテスト ===');
  console.log(`ファイル: ${filePath}`);

  try {
    const buffer = await fs.readFile(filePath);
    const decoded = smartDecode(buffer);

    console.log(`エンコーディング: ${decoded.encoding}`);
    console.log(`デコード成功: ${decoded.success}`);

    const result = parseCK(decoded.text);

    console.log(`\n解析結果:`);
    console.log(`- 曲線数: ${result.curves.length}`);
    console.log(`- 構造物数: ${result.structures.length}`);
    console.log(`- 駅数: ${result.stations.length}`);

    if (result.curves.length > 0) {
      console.log(`\n最初の曲線:`);
      console.log(JSON.stringify(result.curves[0], null, 2));
    }

    if (result.structures.length > 0) {
      console.log(`\n最初の構造物:`);
      console.log(JSON.stringify(result.structures[0], null, 2));
    }

    return true;
  } catch (error) {
    console.error(`エラー: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

async function testLKParser(filePath) {
  console.log('\n=== LKファイルのテスト ===');
  console.log(`ファイル: ${filePath}`);

  try {
    const buffer = await fs.readFile(filePath);
    const decoded = smartDecode(buffer);

    console.log(`エンコーディング: ${decoded.encoding}`);
    console.log(`デコード成功: ${decoded.success}`);

    const result = parseLK(decoded.text);

    console.log(`\n解析結果:`);
    console.log(`- 区間定義数: ${result.sections.length}`);
    console.log(`- 管理値数: ${result.managementValues.length}`);
    console.log(`- 管理区間数: ${result.managementSections.length}`);

    if (result.sections.length > 0) {
      console.log(`\n最初の区間定義:`);
      console.log(JSON.stringify(result.sections[0], null, 2));
    }

    if (result.managementValues.length > 0) {
      console.log(`\n最初の管理値:`);
      const firstValue = result.managementValues[0];
      console.log(`  マーカー: ${firstValue.marker}`);
      console.log(`  開始キロ程: ${firstValue.startKm} km`);
      console.log(`  終了キロ程: ${firstValue.endKm} km`);
      console.log(`  10m標準: ${firstValue.standard10m} mm`);
      console.log(`  軌間正: ${firstValue.gauge} mm`);
    }

    return true;
  } catch (error) {
    console.error(`エラー: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

async function main() {
  console.log('========================================');
  console.log('キヤデータパーサー 動作確認テスト');
  console.log('========================================');

  const baseDir = path.join('..', '..', '40_旧ラボデータ', 'キヤデータ', '22961677017-01');
  const ckFile = path.join(baseDir, 'CK0101.csv');
  const lkFile = path.join(baseDir, 'LK0101.csv');

  let passCount = 0;
  let failCount = 0;

  // CKファイルのテスト
  const ckResult = await testCKParser(ckFile);
  if (ckResult) passCount++; else failCount++;

  // LKファイルのテスト
  const lkResult = await testLKParser(lkFile);
  if (lkResult) passCount++; else failCount++;

  // 結果サマリー
  console.log('\n========================================');
  console.log('テスト結果サマリー');
  console.log('========================================');
  console.log(`成功: ${passCount} / 2`);
  console.log(`失敗: ${failCount} / 2`);

  if (failCount === 0) {
    console.log('\n✓ すべてのテストが成功しました！');
    process.exit(0);
  } else {
    console.log('\n✗ 一部のテストが失敗しました');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
