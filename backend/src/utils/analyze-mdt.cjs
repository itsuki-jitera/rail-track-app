/**
 * MDTファイル解析ユーティリティ
 * MDTファイルの構造を解析して仕様を理解するためのスクリプト
 */

const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

/**
 * MDTファイルを解析する
 */
function analyzeMDTFile(filePath) {
  console.log('=== MDTファイル解析 ===');
  console.log('ファイル:', filePath);
  console.log('');

  // ファイルをバッファとして読み込み
  const buffer = fs.readFileSync(filePath);
  console.log('ファイルサイズ:', buffer.length, 'bytes');
  console.log('');

  // 先頭100バイトを16進数で表示
  console.log('--- 先頭100バイトの16進ダンプ ---');
  const hexDump = buffer.slice(0, 100).toString('hex').match(/.{1,2}/g).join(' ');
  console.log(hexDump);
  console.log('');

  // Shift-JISとして解析
  console.log('--- Shift-JISとして解析 ---');
  try {
    const textShiftJIS = iconv.decode(buffer, 'Shift_JIS');
    const lines = textShiftJIS.split('\n').slice(0, 20);
    lines.forEach((line, index) => {
      if (line.trim()) {
        console.log(`${index + 1}: ${line}`);
      }
    });
  } catch (error) {
    console.log('Shift-JIS解析エラー:', error.message);
  }
  console.log('');

  // UTF-8として解析（参考）
  console.log('--- UTF-8として解析（参考） ---');
  try {
    const textUTF8 = buffer.toString('utf8');
    const lines = textUTF8.split('\n').slice(0, 10);
    lines.forEach((line, index) => {
      if (line.trim()) {
        console.log(`${index + 1}: ${line}`);
      }
    });
  } catch (error) {
    console.log('UTF-8解析エラー:', error.message);
  }
  console.log('');

  // 改行コードを検出
  console.log('--- 改行コード検出 ---');
  const crlfCount = (buffer.toString('binary').match(/\r\n/g) || []).length;
  const lfCount = (buffer.toString('binary').match(/(?<!\r)\n/g) || []).length;
  const crCount = (buffer.toString('binary').match(/\r(?!\n)/g) || []).length;
  console.log('CRLF (\\r\\n):', crlfCount);
  console.log('LF (\\n):', lfCount);
  console.log('CR (\\r):', crCount);
  console.log('');

  // データ行の検出とパターン分析
  console.log('--- データパターン分析 ---');
  const text = iconv.decode(buffer, 'Shift_JIS');
  const dataLines = text.split(/\r?\n/).filter(line => line.trim());
  console.log('総行数:', dataLines.length);

  if (dataLines.length > 0) {
    console.log('最初の行:', dataLines[0]);
    console.log('最後の行:', dataLines[dataLines.length - 1]);
  }

  // 数値データのパターンを検出
  const numberPattern = /[\+\-]?\d+\.\d+/g;
  let sampleData = [];
  for (let i = 1; i < Math.min(dataLines.length, 10); i++) {
    const numbers = dataLines[i].match(numberPattern);
    if (numbers) {
      sampleData.push({
        line: i + 1,
        text: dataLines[i],
        numbers: numbers
      });
    }
  }

  if (sampleData.length > 0) {
    console.log('\n数値データのサンプル:');
    sampleData.forEach(sample => {
      console.log(`行${sample.line}: ${sample.numbers.join(', ')}`);
    });
  }
}

// コマンドライン引数からファイルパスを取得
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('使用法: node analyze-mdt.cjs <MDTファイルパス>');
  console.log('');
  console.log('デフォルトのサンプルファイルを解析します...');
  console.log('');

  // デフォルトのサンプルファイルを解析
  const sampleFiles = [
    'C:\\Users\\aituk\\work\\itnav\\jitera\\レールテック\\レールテック\\40_旧ラボデータ\\軌道狂いデータ\\KSD022DA.MDT',
    'C:\\Users\\aituk\\work\\itnav\\jitera\\レールテック\\レールテック\\40_旧ラボデータ\\軌道狂いデータ\\KSU022JA.MDT',
    'C:\\Users\\aituk\\work\\itnav\\jitera\\レールテック\\レールテック\\40_旧ラボデータ\\軌道環境データ\\KSD059SC.MDT'
  ];

  sampleFiles.forEach((filePath, index) => {
    if (fs.existsSync(filePath)) {
      if (index > 0) console.log('\n' + '='.repeat(60) + '\n');
      analyzeMDTFile(filePath);
    } else {
      console.log('ファイルが見つかりません:', filePath);
    }
  });
} else {
  const filePath = args[0];
  if (fs.existsSync(filePath)) {
    analyzeMDTFile(filePath);
  } else {
    console.log('ファイルが見つかりません:', filePath);
  }
}
