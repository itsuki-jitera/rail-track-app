# 🚄 軌道復元システム (Rail Track Restoration System)

既存のVisual Basic 6軌道復元システムをベースにした、モダンなWEBアプリケーションです。

## 📋 概要

このアプリケーションは鉄道軌道の検測データを処理し、軌道波形の可視化と復元計算を行います。VB6で実装されていたKCDW、KANA3、DCPZW等のシステムをモダンなWEB技術で再実装しました。

### 主な機能

- ✅ **データ処理**
  - RSQファイル解析（軌道検測データ）
  - キヤデータ処理（車両データ統合）
  - 軌道環境データ処理
  - 複数フォーマット対応（CSV、RSQ、キヤ専用フォーマット）

- 📊 **軌道波形解析**
  - 軌道波形データのグラフ表示
  - 統計情報の計算（最小値、最大値、平均値、標準偏差）
  - 相関係数計算
  - 波形復元処理

- 📐 **偏心矢計算**
  - 非対称弦長対応（p ≠ q）
  - 検測特性係数計算（振幅・位相特性）
  - 偏心矢変換（異なる検測特性間の変換）
  - リアルタイム波長特性可視化

- 📈 **可視化機能**
  - Plotly.jsによる高性能グラフ表示
  - インタラクティブなズーム・パン操作
  - 複数データ系列の比較表示
  - 振幅特性・位相特性のデュアルプロット

- 📱 **ユーザビリティ**
  - ドラッグ&ドロップ対応
  - レスポンシブデザイン
  - タブベースUI
  - リアルタイムパラメータ調整

## 🛠️ 技術スタック

### バックエンド
- **Node.js** - JavaScriptランタイム
- **Express.js** - WEBフレームワーク
- **Multer** - ファイルアップロード処理
- **CORS** - クロスオリジン対応
- **Custom Parsers** - RSQ、キヤデータ解析エンジン

### フロントエンド
- **React 18** - UIライブラリ
- **TypeScript** - 型安全な開発
- **Vite** - 高速ビルドツール
- **Plotly.js** - データ可視化（react-plotly.js）
- **Chart.js** - 基本チャート表示
- **react-chartjs-2** - React用Chart.jsラッパー

## 📦 インストール

### 前提条件
- Node.js 18以上
- npm または yarn

### セットアップ手順

1. **バックエンドのセットアップ**

```bash
cd rail-track-app/backend
npm install
```

2. **フロントエンドのセットアップ**

```bash
cd rail-track-app/frontend
npm install
```

## 🚀 起動方法

### 開発環境

1. **バックエンドAPIの起動** (ポート: 5000)

```bash
cd rail-track-app/backend
npm start
```

または、ファイル監視モード（Node.js 18.11+）:

```bash
npm run dev
```

2. **フロントエンドの起動** (ポート: 3000)

別のターミナルで:

```bash
cd rail-track-app/frontend
npm run dev
```

3. **ブラウザでアクセス**

```
http://localhost:3000
```

## 📄 データフォーマット

### 1. CSVファイル形式

```csv
距離(m), 軌道狂い量(mm)
0.0, 2.5
0.5, 2.8
1.0, 3.2
...
```

### 2. RSQファイル形式

軌道検測データの標準フォーマット:
- 固定長レコード形式
- バイナリデータ
- ヘッダー情報含む

### 3. キヤデータフォーマット

車両検測データの専用フォーマット:
- 複数データ系列対応
- タイムスタンプ付き測定値
- メタデータセクション

サンプルデータ: `sample-data.csv`, `test-data/` ディレクトリ参照

## 🔌 API エンドポイント

### 基本API

#### GET /api/health
ヘルスチェック

**レスポンス:**
```json
{
  "status": "ok",
  "message": "Rail Track API is running"
}
```

#### POST /api/upload
CSVファイルをアップロードして解析

**リクエスト:**
- Content-Type: multipart/form-data
- Body: file (CSV)

**レスポンス:**
```json
{
  "success": true,
  "filename": "sample-data.csv",
  "dataPoints": 41,
  "data": [...],
  "statistics": {
    "min": 2.2,
    "max": 6.7,
    "avg": 4.15,
    "stdDev": 1.52
  }
}
```

#### POST /api/restore-waveform
波形復元計算

**リクエスト:**
```json
{
  "data": [...],
  "filterType": "simple"
}
```

**レスポンス:**
```json
{
  "success": true,
  "original": { ... },
  "restored": { ... },
  "filterType": "simple"
}
```

#### POST /api/calculate-correlation
相関係数の計算

**リクエスト:**
```json
{
  "data1": [...],
  "data2": [...]
}
```

**レスポンス:**
```json
{
  "success": true,
  "correlation": 0.85,
  "description": "強い正の相関"
}
```

### 偏心矢計算API

#### POST /api/eccentric-versine/calculate
偏心矢の計算（大規模データ自動最適化対応）

**リクエスト:**
```json
{
  "measurementData": [
    { "distance": 0, "value": 1.5 },
    { "distance": 0.25, "value": 1.8 },
    ...
  ],
  "p": 10,
  "q": 5,
  "samplingInterval": 0.25,
  "useOptimized": false  // オプション: true で強制的に最適化版を使用
}
```

**レスポンス:**
```json
{
  "success": true,
  "versineData": [...],
  "parameters": {
    "p": 10,
    "q": 5,
    "samplingInterval": 0.25
  },
  "statistics": {
    "min": -2.5,
    "max": 3.2,
    "mean": 0.15,
    "stdDev": 1.2
  },
  "calculatorInfo": {
    "type": "optimized",  // "standard" or "optimized"
    "dataPoints": 50000,
    "threshold": 10000,
    "recommendation": "chunked"
  }
}
```

**注:** データ点数が10,000点以上の場合、自動的に最適化版（チャンク処理）が使用されます。

#### POST /api/eccentric-versine/characteristics
検測特性係数の計算

**リクエスト:**
```json
{
  "p": 10,
  "q": 5,
  "samplingInterval": 0.25,
  "wavelengthRange": {
    "min": 1,
    "max": 200,
    "step": 1
  }
}
```

**レスポンス:**
```json
{
  "success": true,
  "characteristics": [
    {
      "wavelength": 1,
      "A": 0.95,
      "B": 0.05,
      "amplitude": 0.951,
      "phase": 0.052,
      "phaseDeg": 3.0
    },
    ...
  ]
}
```

#### POST /api/eccentric-versine/convert
偏心矢の変換（異なる検測特性間）

**リクエスト:**
```json
{
  "sourceData": [...],
  "sourceParams": { "p": 10, "q": 5 },
  "targetParams": { "p": 5, "q": 5 },
  "samplingInterval": 0.25
}
```

**レスポンス:**
```json
{
  "success": true,
  "convertedData": [...],
  "conversionCoefficients": {
    "alpha": 0.98,
    "beta": 0.02
  }
}
```

#### POST /api/eccentric-versine/batch-characteristics
複数パラメータの一括特性計算

**リクエスト:**
```json
{
  "configurations": [
    { "p": 10, "q": 5, "label": "10-5m偏心矢" },
    { "p": 5, "q": 5, "label": "5-5m偏心矢" }
  ],
  "samplingInterval": 0.25,
  "wavelengthRange": { "min": 1, "max": 200, "step": 1 }
}
```

**レスポンス:**
```json
{
  "success": true,
  "results": [
    {
      "label": "10-5m偏心矢",
      "characteristics": [...]
    },
    ...
  ]
}
```

#### POST /api/eccentric-versine/estimate-memory
メモリ使用量の推定（Phase 16.2で追加）

**リクエスト:**
```json
{
  "dataPoints": 500000,
  "p": 10,
  "q": 5
}
```

**レスポンス:**
```json
{
  "success": true,
  "dataPoints": 500000,
  "memoryEstimate": {
    "dataPoints": 500000,
    "inputDataMemory": "1.91 MB",
    "outputDataMemory": "1.91 MB",
    "objectOverhead": "15.26 MB",
    "totalMemory": "19.07 MB",
    "totalBytes": 20000000,
    "recommendation": "Normal processing is fine"
  },
  "recommendedMethod": "streaming",
  "threshold": {
    "normal": 10000,
    "chunked": 100000
  }
}
```

**推奨処理方法:**
- `normal`: 10,000点未満 - 通常処理
- `chunked`: 10,000〜100,000点 - チャンク処理
- `streaming`: 100,000点以上 - ストリーミング処理

### エクスポートAPI（Phase 17で追加）

#### POST /api/eccentric-versine/export/pdf
偏心矢計算結果をPDFレポートとしてダウンロード

**リクエスト:**
```json
{
  "reportData": {
    "parameters": { "p": 10, "q": 5, "samplingInterval": 0.25 },
    "statistics": { "min": -2.5, "max": 3.2, "mean": 0.15, "stdDev": 1.2 },
    "versineData": [...]
  },
  "filename": "custom-report.pdf"  // オプション
}
```

**レスポンス:** PDFファイルのダウンロード

#### POST /api/eccentric-versine/export/excel
偏心矢計算結果をExcelファイルとしてダウンロード

**リクエスト:**
```json
{
  "reportData": {
    "parameters": { ... },
    "statistics": { ... },
    "versineData": [...],
    "characteristics": [...]
  },
  "filename": "custom-report.xlsx"  // オプション
}
```

**レスポンス:** Excelファイル（.xlsx）のダウンロード

**Excelファイル構成:**
- サマリーシート: パラメータと統計情報
- 計算データシート: 詳細データとフィルター機能
- 統計分析シート: パーセンタイル含む詳細統計
- 検測特性シート: A,B係数、振幅、位相データ
- グラフシート: 波形グラフ（最初の1000点）

#### POST /api/eccentric-versine/export/batch-excel
バッチ処理結果を統合Excelレポートとしてダウンロード

**リクエスト:**
```json
{
  "batchResults": [
    {
      "filename": "data1.csv",
      "success": true,
      "statistics": { ... },
      "data": [...]
    },
    ...
  ]
}
```

### キヤデータ処理API

#### POST /api/kiya/parse
キヤデータファイルの解析

#### POST /api/kiya/process
キヤデータの処理と統合

### 軌道環境データAPI

#### POST /api/track-environment/parse
軌道環境データの解析

#### POST /api/track-environment/process
軌道環境データの処理

## 📁 プロジェクト構造

```
rail-track-app/
├── backend/                           # Express API
│   ├── src/
│   │   ├── server.js                 # レガシーサーバー
│   │   ├── api-server.js             # メインAPIサーバー (Port: 5000)
│   │   ├── algorithms/               # 計算アルゴリズム
│   │   │   ├── correlation.js        # 相関係数計算
│   │   │   ├── waveform-restoration.js  # 波形復元
│   │   │   ├── eccentric-versine.js  # 偏心矢計算エンジン
│   │   │   └── eccentric-versine-optimized.js  # 大規模データ最適化版
│   │   ├── parsers/                  # データパーサー
│   │   │   ├── rsq-parser.js         # RSQファイル解析
│   │   │   ├── kiya-parser.js        # キヤデータ解析
│   │   │   └── track-environment-parser.js  # 軌道環境データ解析
│   │   ├── routes/                   # APIルート定義
│   │   │   ├── eccentric-versine-routes.js  # 偏心矢API
│   │   │   ├── kiya-routes.js        # キヤデータAPI
│   │   │   └── track-environment-routes.js  # 軌道環境API
│   │   └── utils/                    # ユーティリティ
│   │       ├── logger.js             # ロガー
│   │       ├── benchmark.js          # パフォーマンスベンチマーク
│   │       ├── lru-cache.js          # LRUキャッシュ実装
│   │       ├── pdf-generator.js      # PDFレポート生成
│   │       └── excel-generator.js    # Excelレポート生成
│   ├── benchmark-eccentric-versine.js       # 偏心矢ベンチマークスクリプト
│   ├── benchmark-optimized-comparison.js    # 最適化版比較ベンチマーク
│   ├── uploads/                      # アップロードファイル格納
│   ├── reports/                      # 生成レポート格納
│   ├── package.json
│   └── .gitignore
├── frontend/                         # Reactアプリ
│   ├── src/
│   │   ├── components/              # Reactコンポーネント
│   │   │   ├── FileUpload.tsx       # ファイルアップロード
│   │   │   ├── ChartDisplay.tsx     # Chart.js表示
│   │   │   ├── Statistics.tsx       # 統計情報表示
│   │   │   ├── EccentricVersineChart.tsx      # 偏心矢波形チャート
│   │   │   ├── CharacteristicsChart.tsx       # 検測特性チャート
│   │   │   └── ConversionComparisonChart.tsx  # 変換比較チャート
│   │   ├── pages/                   # ページコンポーネント
│   │   │   ├── EccentricVersinePage.tsx       # 偏心矢計算ページ
│   │   │   └── EccentricVersinePage.css       # スタイル
│   │   ├── App.tsx                  # メインアプリ
│   │   ├── App.css                  # アプリスタイル
│   │   ├── main.tsx                 # エントリーポイント
│   │   └── index.css                # グローバルスタイル
│   ├── index.html
│   ├── vite.config.ts               # Vite設定
│   ├── tsconfig.json                # TypeScript設定
│   └── package.json
├── test-data/                       # テストデータ
│   ├── sample-data.csv
│   ├── test-rsq.rsq
│   └── kiya-sample/
├── sample-data.csv                  # サンプルデータ
└── README.md
```

## 🧮 実装されている計算アルゴリズム

### 1. 偏心矢計算 (Eccentric Versine)

VB6のKANA3システムから移植した高精度偏心矢計算:

**基本式:**
```
y[n] = x[n] - (1/(p+q))(p×x[n-q/τ] + q×x[n+p/τ])
```

where:
- `x[n]`: 測定値 (measurement value)
- `y[n]`: 偏心矢 (eccentric versine)
- `p, q`: 弦長パラメータ (chord length parameters in meters)
- `τ`: サンプリング間隔 (sampling interval in meters)

**特徴:**
- 非対称弦長対応（p ≠ q）
- 任意のサンプリング間隔対応
- 高速計算実装

### 2. 検測特性係数計算

**振幅係数A:**
```
A = 1 - (p×cos(ωq) + q×cos(ωp))/(p+q)
```

**位相係数B:**
```
B = (-p×sin(ωq) + q×sin(ωp))/(p+q)
```

**振幅特性:**
```
振幅 = √(A² + B²)
```

**位相特性:**
```
位相 = arctan(B/A)  [ラジアン]
位相(度) = arctan(B/A) × 180/π
```

where:
- `ω = 2π/λ` (角周波数)
- `λ`: 波長 (wavelength in meters)

### 3. 偏心矢変換係数

異なる検測特性間の変換:

**変換係数α:**
```
α = (A1×A2 + B1×B2) / (A1² + B1²)
```

**変換係数β:**
```
β = (A1×B2 - A2×B1) / (A1² + B1²)
```

**変換式:**
```
y2[n] = α×y1[n] + β×y1'[n]
```

where:
- `y1[n]`: 変換元偏心矢
- `y2[n]`: 変換後偏心矢
- `y1'[n]`: 変換元偏心矢の微分近似

### 4. 相関係数計算

VB6の元システムから移植:

```javascript
相関係数 = (SUMXY - n×平均X×平均Y) / √[(SUMXX - n×平均X²) × (SUMYY - n×平均Y²)]
```

### 5. 統計値計算
- 最小値 (Min)
- 最大値 (Max)
- 平均値 (Average)
- 標準偏差 (Standard Deviation)

### 6. 波形復元（簡易版）

3点移動平均フィルタを使用した簡易的な復元処理:

```javascript
復元値[i] = (元データ[i-1] + 元データ[i] + 元データ[i+1]) / 3
```

## 📊 偏心矢計算機能の使い方

### 基本的な流れ

1. **メイン画面から偏心矢計算ページへ移動**
   - 「📏 偏心矢計算」ボタンをクリック

2. **タブ1: 偏心矢計算**
   - 測定データをJSON形式で入力
   - パラメータ設定（p, q, サンプリング間隔）
   - 「計算実行」ボタンをクリック
   - 結果グラフと統計値を確認

3. **タブ2: 検測特性**
   - パラメータ設定（p, q, サンプリング間隔）
   - 波長範囲設定（最小、最大、刻み）
   - 「特性計算」ボタンをクリック
   - 振幅特性・位相特性グラフを確認

4. **タブ3: 偏心矢変換**
   - 変換元データ入力
   - 変換元パラメータ設定（p1, q1）
   - 変換先パラメータ設定（p2, q2）
   - 「変換実行」ボタンをクリック
   - 変換結果と差分を確認

5. **タブ4: 一括特性比較**
   - 複数の設定を追加（最大5個）
   - 「一括計算」ボタンをクリック
   - 複数の特性を同時に比較

6. **タブ5: アルゴリズム仕様**
   - 計算式の確認
   - パラメータの説明
   - 実装詳細の参照

### パラメータの例

**一般的な設定:**
- 10-5m偏心矢: p=10, q=5
- 5-5m偏心矢: p=5, q=5
- 20-10m偏心矢: p=20, q=10

**サンプリング間隔:**
- 高速検測車: 0.25m
- 一般検測: 0.5m

## 🔧 開発履歴

### Phase 1-9: 基本システム構築
- プロジェクト初期化
- 基本API実装
- ファイルアップロード機能
- グラフ表示機能

### Phase 10: キヤデータ処理の完全統合
- キヤデータパーサー実装
- データ統合機能
- API エンドポイント追加

### Phase 11: 軌道環境データ処理の実装
- 軌道環境パーサー実装
- データ処理ロジック
- API 統合

### Phase 12: 偏心矢計算の仕様適合確認と完全実装
- Phase 12.1: 既存実装の調査
- Phase 12.2: 仕様書との適合確認
- Phase 12.3: 偏心矢計算エンジン実装 (eccentric-versine.js)
- Phase 12.4: API エンドポイント実装 (eccentric-versine-routes.js)
- Phase 12.5: 統合テスト

**実装内容:**
- 非対称弦長対応（p ≠ q）
- 検測特性係数計算（A, B, 振幅, 位相）
- 偏心矢変換機能
- 波長範囲スキャン（1-200m）
- 一括計算機能

### Phase 13: 偏心矢計算フロントエンドUI実装
- Phase 13.1: ページコンポーネント作成 (EccentricVersinePage.tsx)
- Phase 13.2: スタイル実装 (EccentricVersinePage.css)
- Phase 13.3: ルーティング統合 (App.tsx)
- Phase 13.4: 動作確認

**UI機能:**
- タブベースインターフェース（5タブ）
- リアルタイムパラメータ入力
- 統計情報表示
- レスポンシブデザイン

### Phase 14: 偏心矢グラフ表示機能の実装
- Phase 14.1: 偏心矢波形チャート (EccentricVersineChart.tsx)
- Phase 14.2: 検測特性チャート (CharacteristicsChart.tsx)
- Phase 14.3: 変換比較チャート (ConversionComparisonChart.tsx)
- Phase 14.4: ページ統合とテスト

**グラフ機能:**
- Plotly.js による高性能可視化
- インタラクティブズーム・パン
- 複数系列の重ね合わせ表示
- デュアルY軸表示（振幅・位相）

### Phase 15: システム全体のテストとドキュメント作成
- Phase 15.1: README.md更新（本ドキュメント）
- Phase 15.2: APIドキュメント整備
- Phase 15.3: 統合テスト
- Phase 15.4: パフォーマンステスト

### Phase 16: パフォーマンス最適化 ✅
- Phase 16.1: 現状のパフォーマンス測定とボトルネック分析 ✅
- Phase 16.2: 大規模データセット対応の実装 ✅
- Phase 16.3: キャッシング機構の実装 ✅
- Phase 16.4: ストリーミング処理の実装（保留）

**Phase 16.1 完了内容:**
- ベンチマークフレームワーク実装 (benchmark.js)
- 包括的なパフォーマンステスト (benchmark-eccentric-versine.js)
- 処理時間・メモリ使用量の測定
- ボトルネック分析レポート生成

**Phase 16.2 完了内容:**
- 最適化版偏心矢計算エンジン実装 (eccentric-versine-optimized.js)
  - チャンク処理によるメモリ効率化 (デフォルト: 10,000点/チャンク)
  - プログレス通知機能
  - ストリーミング処理対応（AsyncGenerator）
  - メモリ使用量推定機能
- APIルートの自動最適化
  - 10,000点以上のデータで自動的に最適化版を使用
  - メモリ推定エンドポイント追加 (/api/eccentric-versine/estimate-memory)
- 性能比較ベンチマーク (benchmark-optimized-comparison.js)

**パフォーマンス改善結果:**
- 小規模データ (1,000点): 2.24倍高速化 (55.3%改善)
- 大規模データ (500,000点): メモリ使用量37%削減 (64MB → 40MB)
- 平均改善率: 8.7%
- 処理方法の自動選択機能により、データサイズに応じた最適な処理

**Phase 16.3 完了内容:**
- LRUキャッシュ実装 (lru-cache.js)
- 4種類の専用キャッシュ（偏心矢、検測特性、変換、A,B係数）
- キャッシュ管理エンドポイント（統計、クリア、最適化）
- APIルートへのキャッシュ統合

### Phase 17: エクスポート機能拡張（進行中）
- Phase 17.1: PDF レポート生成 ✅
- Phase 17.2: Excel エクスポート ✅
- Phase 17.3: 画像エクスポート（PNG, SVG）（予定）
- Phase 17.4: バッチ処理機能（予定）

**Phase 17.1 完了内容:**
- PDFレポート生成ユーティリティ (pdf-generator.js)
- 偏心矢計算結果のPDFレポート生成
- 検測特性計算結果のPDFレポート生成
- APIエンドポイント（/export/pdf, /export/characteristics-pdf）

**Phase 17.2 完了内容:**
- Excelレポート生成ユーティリティ (excel-generator.js)
- 偏心矢計算結果のExcelレポート（5シート構成）
  - サマリーシート（パラメータと統計）
  - 計算データシート（詳細データ）
  - 統計分析シート（パーセンタイル含む）
  - 検測特性シート（A,B係数、振幅、位相）
  - グラフシート（波形グラフ付き）
- バッチ処理結果のExcelレポート
- APIエンドポイント（/export/excel, /export/batch-excel）

## 🔮 今後の拡張案

### Phase 16: パフォーマンス最適化（完了）
- [x] 大規模データセット対応（100万点以上）
- [x] キャッシング機構の実装
- [ ] ストリーミング処理のフロントエンド統合（保留）
- [ ] Worker スレッド活用（保留）

### Phase 17: エクスポート機能拡張（進行中）
- [x] PDF レポート生成
- [x] Excel エクスポート
- [ ] 画像エクスポート（PNG, SVG）
- [ ] バッチ処理機能

### Phase 18: KANA3 詳細機能調査
- [ ] 高度な復元フィルタ（FFT、IIRフィルタ等）
- [ ] 複数波長同時処理
- [ ] 自動パラメータ推定

### Phase 19: データベース統合（低優先度）
- [ ] PostgreSQL/Oracle 対応
- [ ] データ永続化
- [ ] 履歴管理
- [ ] ユーザー管理

### その他の拡張
- [ ] リアルタイムデータ処理
- [ ] モバイルアプリ対応
- [ ] クラウドデプロイ（AWS、Azure、GCP）
- [ ] 機械学習による異常検知
- [ ] 多言語対応（英語、中国語）

## 📝 元システムについて

このアプリケーションは以下のVB6システムをベースにしています:

### KCDW (軌道波形表示・操作)
- RSQファイル形式の軌道データ処理
- グラフィカル波形表示
- データ編集機能

### KANA3 (復元波形計算エンジン)
- 検測特性を考慮した復元計算
- 偏心矢の変換計算
- 高精度数値計算

### DCPZW, Ora2Lab2等 (データ変換ツール)
- フォーマット変換
- データベース連携
- バッチ処理

### 元システムの主要機能
- RSQファイル形式の軌道データ処理
- 検測特性を考慮した復元計算
- 偏心矢の変換計算
- キヤ車データの処理
- Oracle データベース連携

## 🧪 テスト

### バックエンドテスト

```bash
cd rail-track-app/backend
npm test
```

### フロントエンドテスト

```bash
cd rail-track-app/frontend
npm test
```

### E2Eテスト

```bash
npm run test:e2e
```

## 🚨 トラブルシューティング

### ポート競合エラー

バックエンドのポート5000が使用中の場合:

```bash
# Windowsの場合
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/Macの場合
lsof -ti:5000 | xargs kill -9
```

### CORS エラー

フロントエンドとバックエンドが異なるポートで動作しているため、CORSが適切に設定されている必要があります。`backend/src/api-server.js`でCORS設定を確認してください。

### メモリ不足エラー

大規模データセットを処理する場合:

```bash
node --max-old-space-size=4096 src/api-server.js
```

## 🤝 貢献

このプロジェクトへの貢献を歓迎します。

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 ライセンス

MIT License

## 📞 サポート

問題が発生した場合は、GitHubのIssueを作成してください。

---

**開発:** Based on Rail Track Restoration System (VB6 legacy)
**技術:** Express.js + React + TypeScript + Plotly.js + Chart.js
**バージョン:** 1.0.0 (Phase 15 完了)
**最終更新:** 2025年
