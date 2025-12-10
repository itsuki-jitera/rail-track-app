# 軌道復元システム バックエンド

Rail Track Restoration System - Backend

鉄道軌道の検測データを解析し、復元波形を計算するシステムのバックエンド実装

## 概要

本システムは、鉄道の軌道検測データを処理し、長波長成分（6m-40m）を抽出して復元波形を計算します。計画線の作成、レポート生成、バッチ処理など、軌道保守業務に必要な機能を統合的に提供します。

## 主な機能

### フェーズ1: ファイル形式パーサー

- **RSQパーサー**: 旧形式（2048byteヘッダー + Float32データ）
- **HDR/DATパーサー**: 新形式（テキストヘッダー + バイナリデータ）
- **PNTパーサー**: キロ程対照表（CSV）
- **TBL/DDBパーサー**: LABOCS表形式（駅名、勾配、曲線、構造物）
- **DCPパーサー**: 全項目一括ファイル（12項目）

### フェーズ2: データ変換システム

- **DCP→RSQ変換**: 一括ファイルを項目別に分割
- **Oracle→LABOCS変換**: CSV形式をLABOCS表形式に変換

### フェーズ3: 復元波形計算エンジン

- **逆フィルタ**: 6m-40m帯域通過フィルタ（正弦波合成法）
- **矢中弦変換**: 10m/20m/40m弦の計算
- **統計情報**: σ値、RMS値、良化率の算出

### フェーズ4: 計画線編集システム

- **計画線エディタ**: 直線/曲線設定、履歴管理（Undo/Redo）
- **交叉法**: 緩和曲線（クロソイド）による滑らかな接続
- **微調整**: スプライン補間、ガウシアン平滑化、異常値除去

### フェーズ5: レポート生成

- **CSV/HTMLレポート**: 復元波形、矢中弦、統計情報
- **レポート管理**: 複数フォーマット対応、バッチ生成

### フェーズ6: 高度な機能

- **バッチ処理**: 複数ファイルの一括処理、進捗管理
- **履歴管理**: ファイル処理履歴の記録・検索
- **データキャッシュ**: LRU方式のメモリ/ディスクキャッシュ

## ディレクトリ構成

```
backend/src/
├── index.js                    # メインエントリーポイント
├── parsers/                    # ファイル形式パーサー
│   ├── rsq-parser.js
│   ├── hdr-dat-parser.js
│   ├── pnt-parser.js
│   ├── tbl-ddb-parser.js
│   └── dcp-parser.js
├── converters/                 # データ変換
│   ├── dcp-to-rsq-converter.js
│   └── oracle-to-labocs-converter.js
├── algorithms/                 # アルゴリズム
│   ├── inverse-filter.js
│   ├── versine-converter.js
│   ├── restoration-engine.js
│   ├── plan-line-editor.js
│   ├── crossing-method.js
│   └── plan-line-refinement.js
├── reports/                    # レポート生成
│   ├── csv-report-generator.js
│   ├── html-report-generator.js
│   └── report-manager.js
├── batch/                      # バッチ処理
│   └── batch-processor.js
├── utils/                      # ユーティリティ
│   ├── encoding-detector.js
│   ├── file-history-manager.js
│   └── data-cache-manager.js
└── types/                      # 型定義
    └── index.js
```

## 使い方

### 基本的な使用例

```javascript
const { RailTrackRestorationSystem } = require('./src/index');

// システムを初期化
const system = new RailTrackRestorationSystem({
  outputDirectory: './output',
  samplingInterval: 0.25
});

// RSQファイルから復元波形を計算
async function processRSQFile(filePath) {
  const result = await system.quickStartRSQ(filePath);

  console.log('統計情報:', result.result.statistics);
  console.log('良化率:', result.result.statistics.improvementRate, '%');

  // レポート生成
  const reports = await system.generateReports(
    result.result,
    {
      lineName: result.header.lineCode,
      measurementDate: result.header.measurementDate
    },
    ['csv', 'html']
  );

  console.log('生成されたレポート:', reports);
}

// 実行
processRSQFile('./data/sample.RSQ');
```

### HDR/DATファイルの処理

```javascript
async function processHDRDATFiles(hdrPath, datPath) {
  const result = await system.quickStartHDRDAT(hdrPath, datPath);

  console.log('復元波形計算完了');
  console.log('元データσ値:', result.result.statistics.original.sigma);
  console.log('復元波形σ値:', result.result.statistics.restored.sigma);
}
```

### バッチ処理

```javascript
async function batchProcess() {
  const result = await system.runBatchProcessing('./input', {
    filePattern: /\.(rsq|RSQ)$/i,
    generateReports: true,
    reportFormats: ['csv', 'html'],
    onProgress: (progress) => {
      console.log(`進捗: ${progress.percentage.toFixed(2)}%`);
    }
  });

  console.log('処理完了:', result.completed, '件');
  console.log('失敗:', result.failed, '件');
}
```

### 個別モジュールの使用

```javascript
// 復元波形計算のみ
const { RestorationEngine } = require('./src/index');

const engine = new RestorationEngine({
  minWavelength: 6.0,
  maxWavelength: 40.0,
  samplingInterval: 0.25
});

const result = engine.calculate(measurementData);

// 計画線編集
const { PlanLineEditor } = require('./src/index');

const editor = new PlanLineEditor(0.25);
const planLine = editor.generateInitialPlanLine(restoredWaveform, 800);
const straightLine = editor.setStraightLine(planLine, 1000, 2000);
```

## データ形式

### 測定データ形式

```javascript
// MeasurementData[]
[
  { distance: 0.00, value: 1.234 },
  { distance: 0.25, value: 1.456 },
  { distance: 0.50, value: 1.678 },
  // ...
]
```

### 復元結果形式

```javascript
{
  success: true,
  restoredWaveform: MeasurementData[],
  planLine: MeasurementData[],
  movementData: MovementData[],
  versineData: {
    '10m': MeasurementData[],
    '20m': MeasurementData[],
    '40m': MeasurementData[]
  },
  statistics: {
    original: { sigma: 2.5, rms: 2.8, max: 8.5, min: -7.2 },
    restored: { sigma: 1.8, rms: 2.0, max: 6.2, min: -5.8 },
    improvementRate: 28.0
  },
  filterParams: {
    minWavelength: 6.0,
    maxWavelength: 40.0,
    samplingInterval: 0.25,
    filterOrder: 513
  }
}
```

## 技術仕様

### 逆フィルタ

- **方式**: 正弦波合成法によるFIRフィルタ
- **帯域**: 6m～40m（波長）
- **次数**: 513（奇数、デフォルト）
- **窓関数**: ハミング窓

### 矢中弦変換

- **弦長**: 10m、20m、40m
- **計算式**: `V[i] = (y[i-n] + y[i+n]) / 2 - y[i]`
- **サンプリング**: 0.25m間隔

### 計画線編集

- **遷移関数**: 3次関数、正弦関数、クロソイド曲線
- **制約条件**: 最大勾配、最小曲線半径、カント逓減
- **履歴管理**: Undo/Redo（最大100件）

## パフォーマンス

- **バッチ処理**: 最大5ファイル同時処理（デフォルト）
- **キャッシュ**: メモリ100件、ディスク1000件（デフォルト）
- **処理速度**: 約1000点/秒（復元波形計算）

## 開発

### 依存関係

主要な外部依存なし（Node.js標準ライブラリのみ使用）

### テスト

```bash
# テスト実行（実装予定）
npm test
```

## ライセンス

内部使用のため、ライセンスは適用されません。

## 作成者

軌道復元システム開発チーム

---

**Rail Track Restoration System v1.0.0**
