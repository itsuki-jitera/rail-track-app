# 🚄 軌道復元システム (Rail Track Restoration System)

既存のVisual Basic 6軌道復元システムをベースにした、モダンなWEBアプリケーションのサンプルです。

## 📋 概要

このアプリケーションは鉄道軌道の検測データを処理し、軌道波形の可視化と復元計算を行います。

### 主な機能

- ✅ CSVファイルのアップロード（ドラッグ&ドロップ対応）
- 📊 軌道波形データのグラフ表示
- 📈 統計情報の計算（最小値、最大値、平均値、標準偏差）
- 🔄 簡易的な波形復元（移動平均フィルタ）
- 📱 レスポンシブデザイン

## 🛠️ 技術スタック

### バックエンド
- **Node.js** - JavaScriptランタイム
- **Express.js** - WEBフレームワーク
- **Multer** - ファイルアップロード処理
- **CORS** - クロスオリジン対応

### フロントエンド
- **React 18** - UIライブラリ
- **TypeScript** - 型安全な開発
- **Vite** - 高速ビルドツール
- **Chart.js** - データ可視化
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

1. **バックエンドAPIの起動** (ポート: 3001)

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

### CSVファイル形式

```csv
距離(m), 軌道狂い量(mm)
0.0, 2.5
0.5, 2.8
1.0, 3.2
...
```

サンプルデータ: `sample-data.csv`

## 🔌 API エンドポイント

### GET /api/health
ヘルスチェック

**レスポンス:**
```json
{
  "status": "ok",
  "message": "Rail Track API is running"
}
```

### POST /api/upload
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

### POST /api/restore-waveform
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

### POST /api/calculate-correlation
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

## 📁 プロジェクト構造

```
rail-track-app/
├── backend/                 # Express API
│   ├── src/
│   │   └── server.js       # メインサーバーファイル
│   ├── uploads/            # アップロードファイル格納
│   ├── package.json
│   └── .gitignore
├── frontend/               # Reactアプリ
│   ├── src/
│   │   ├── components/    # Reactコンポーネント
│   │   │   ├── FileUpload.tsx
│   │   │   ├── ChartDisplay.tsx
│   │   │   └── Statistics.tsx
│   │   ├── App.tsx        # メインアプリ
│   │   ├── App.css
│   │   ├── main.tsx       # エントリーポイント
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
├── sample-data.csv         # サンプルデータ
└── README.md
```

## 🧮 実装されている計算アルゴリズム

### 1. 相関係数計算
VB6の元システムから移植した相関係数計算ロジック:

```javascript
相関係数 = (SUMXY - n×平均X×平均Y) / √[(SUMXX - n×平均X²) × (SUMYY - n×平均Y²)]
```

### 2. 統計値計算
- 最小値 (Min)
- 最大値 (Max)
- 平均値 (Average)
- 標準偏差 (Standard Deviation)

### 3. 波形復元（簡易版）
3点移動平均フィルタを使用した簡易的な復元処理:

```javascript
復元値[i] = (元データ[i-1] + 元データ[i] + 元データ[i+1]) / 3
```

## 🔮 今後の拡張案

- [ ] より高度な復元フィルタの実装（FFT、IIRフィルタ等）
- [ ] 複数ファイルの比較機能
- [ ] データのエクスポート機能（CSV、Excel、PDF）
- [ ] ユーザー認証と権限管理
- [ ] データベース連携（PostgreSQL等）
- [ ] リアルタイムデータ処理
- [ ] モバイルアプリ対応
- [ ] クラウドデプロイ（AWS、Azure、GCP）

## 📝 元システムについて

このアプリケーションは以下のVB6システムをベースにしています:

- **KCDW**: 軌道波形表示・操作
- **KANA3**: 復元波形計算エンジン
- **DCPZW, Ora2Lab2等**: データ変換ツール

元システムの機能:
- RSQファイル形式の軌道データ処理
- 検測特性を考慮した復元計算
- 偏心矢の変換計算
- キヤ車データの処理

## 🤝 貢献

このプロジェクトはサンプル実装です。改善提案や機能追加のPRを歓迎します。

## 📄 ライセンス

MIT License

## 📞 サポート

問題が発生した場合は、GitHubのIssueを作成してください。

---

**開発:** Based on Rail Track Restoration System (VB6 legacy)
**技術:** Express.js + React + TypeScript + Chart.js