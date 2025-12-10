# MTT軌道整正計算システム - 実装機能詳細

## 概要

本システムは、PDF仕様書「057_復元波形を用いた軌道整正計算の操作手順.pdf」に基づき、MTT（Multiple Tie Tamper）による軌道整正作業に必要な全機能を実装しています。

## 実装完了機能一覧

### Phase 1: コア機能（完了）

#### 1. MTT機種管理システム
- **実装ファイル**: `backend/src/config/mtt-config.js`
- **機能**:
  - 各MTT機種（08-16、08-475、09-16在等）の弦長設定
  - レベリング・ライニング弦長の管理
  - 機種別パラメータ設定

#### 2. 移動量補正計算
- **実装ファイル**: `backend/src/calculators/movement-correction.js`
- **機能**:
  - 凸型計画線補正（PDF P9-11）
  - MTTフロント誘導補正
  - 固定点制約処理
  - 弦長による影響計算

#### 3. ALS/ALC形式エクスポート
- **実装ファイル**:
  - `backend/src/exporters/als-exporter.js`（PDF P32-33）
  - `backend/src/exporters/alc-exporter.js`（PDF P36）
- **機能**:
  - WDT形式での移動量データ出力
  - 新幹線用200mブロック分割
  - キロ程基準のデータフォーマット

### Phase 2: 高度な分析機能（完了）

#### 4. MJ作業用データエクスポート
- **実装ファイル**: `backend/src/exporters/mj-exporter.js`
- **機能**:
  - C点/D点基準の作業データ生成（PDF P34-35）
  - MTT偏心矢計算
  - 機種別フォーマット対応

#### 5. 手検測データ統合
- **実装ファイル**: `backend/src/analyzers/field-measurement.js`
- **機能**:
  - 最大25測点のデータ処理（PDF P15）
  - ピアソン相関による位置合わせ
  - ±20m範囲での相関検索

#### 6. 品質分析（σ値・良化率）
- **実装ファイル**: `backend/src/analyzers/quality-analyzer.js`
- **機能**:
  - 整備前後のσ値計算（PDF P27）
  - 良化率の算出
  - 区間別・波長帯域別評価

#### 7. 汎用移動量データ出力
- **実装ファイル**: `backend/src/exporters/general-exporter.js`
- **機能**:
  - CSV形式での汎用データ出力（PDF P37）
  - WB区間マーカー付与
  - 作業区間情報ファイル生成

#### 8. 縦曲線管理
- **実装ファイル**: `backend/src/analyzers/vertical-curve-manager.js`
- **機能**:
  - 縦断勾配管理（PDF P24-25）
  - クレスト/サグカーブ処理
  - 移動量制限計算

#### 9. 波長帯域分析
- **実装ファイル**: `backend/src/analyzers/waveband-analyzer.js`
- **機能**:
  - FFT周波数解析（PDF P18-20）
  - 短波長(3-10m)、中波長(10-30m)、長波長(30-70m)分析
  - 支配的波長の特定

#### 10. 総合レポート生成
- **実装ファイル**: `backend/src/reports/comprehensive-report.js`
- **機能**:
  - 全分析結果の統合レポート（PDF P38-40）
  - HTML/PDF形式出力
  - 推奨事項の自動生成

### Phase 3: UI実装（完了）

#### 11. フロントエンドコンポーネント
- **実装ファイル**: `frontend/src/components/MTTSettingsPanel.tsx`
- **機能**:
  - MTT機種選択UI
  - 補正設定パネル
  - 作業区間設定
  - リアルタイムバリデーション

### Phase 4: API統合（完了）

#### 12. バックエンドAPIエンドポイント
- **実装ファイル**:
  - `backend/server.js`（メインサーバー）
  - `backend/src/routes/analysis-routes.js`（分析API）
  - `backend/src/routes/mtt-routes.js`（MTT専用API）

## API エンドポイント一覧

### 分析系API
- `POST /api/analysis/waveband` - 波長帯域分析
- `POST /api/analysis/quality` - 品質分析（σ値・良化率）
- `POST /api/analysis/field-correlation` - 手検測データ相関
- `POST /api/analysis/vertical-curves` - 縦曲線処理
- `POST /api/analysis/batch` - バッチ分析処理

### エクスポート系API
- `POST /api/export/als` - ALS形式エクスポート
- `POST /api/export/alc` - ALC形式エクスポート
- `POST /api/export/mj` - MJ作業用データエクスポート
- `POST /api/export/general` - 汎用移動量データエクスポート

### MTT系API
- `GET /api/mtt-types` - MTT機種一覧取得
- `GET /api/mtt-types/:type` - MTT機種詳細取得
- `POST /api/mtt/correction` - MTT移動量補正計算
- `POST /api/mtt/front-guidance` - フロント誘導量計算
- `POST /api/mtt/simulation` - MTT作業シミュレーション

### レポート系API
- `POST /api/report/comprehensive` - 総合レポート生成
- `GET /api/exports` - エクスポート済みファイル一覧

## システム起動方法

### 必要環境
- Node.js v14以上
- npm v6以上

### インストール
```bash
cd rail-track-app/backend
npm install
```

### 起動
```bash
# 開発環境
npm run dev

# 本番環境
npm start
```

### アクセス
- サーバー: `http://localhost:3001`
- ヘルスチェック: `http://localhost:3001/api/health`

## データフロー

```
1. 軌道狂いデータ入力
   ↓
2. 復元波形計算（6m-40m波長フィルタ）
   ↓
3. 移動量計算
   ↓
4. MTT補正適用
   - 凸型計画線補正
   - フロント誘導補正
   - 固定点制約
   ↓
5. 品質分析
   - σ値計算
   - 良化率評価
   ↓
6. データエクスポート
   - ALS/ALC形式（MTT作業用）
   - MJ形式（詳細作業データ）
   - 汎用CSV形式
   ↓
7. レポート生成
```

## ファイル構成

```
rail-track-app/
├── backend/
│   ├── server.js                      # メインサーバー
│   ├── src/
│   │   ├── config/
│   │   │   └── mtt-config.js         # MTT機種設定
│   │   ├── calculators/
│   │   │   ├── movement-calculator.js # 移動量計算
│   │   │   └── movement-correction.js # 移動量補正
│   │   ├── analyzers/
│   │   │   ├── waveband-analyzer.js  # 波長帯域分析
│   │   │   ├── quality-analyzer.js   # 品質分析
│   │   │   ├── field-measurement.js  # 手検測統合
│   │   │   └── vertical-curve-manager.js # 縦曲線管理
│   │   ├── exporters/
│   │   │   ├── als-exporter.js       # ALS出力
│   │   │   ├── alc-exporter.js       # ALC出力
│   │   │   ├── mj-exporter.js        # MJ出力
│   │   │   └── general-exporter.js   # 汎用出力
│   │   ├── reports/
│   │   │   └── comprehensive-report.js # 総合レポート
│   │   └── routes/
│   │       ├── analysis-routes.js    # 分析API
│   │       └── mtt-routes.js         # MTT API
│   └── uploads/                      # アップロードファイル
│   └── output/                       # 出力ファイル
│       ├── IDOU/                     # 移動量データ
│       └── reports/                  # レポート
└── frontend/
    └── src/
        └── components/
            └── MTTSettingsPanel.tsx   # UI設定パネル
```

## 主な技術仕様

### MTT機種別弦長設定
| MTT機種 | レベリングBC | レベリングCD | ライニングBC | ライニングCD |
|---------|-------------|-------------|-------------|-------------|
| 08-16   | 3.63m       | 9.37m       | 3.21m       | 9.79m       |
| 08-475  | 2.62m       | 9.88m       | 2.32m       | 10.18m      |
| 09-16在 | 3.21m       | 9.79m       | 3.21m       | 9.79m       |

### データ間隔
- 標準: 0.5m間隔
- ALS/ALC出力: 5m間隔
- 汎用出力: 1m間隔

### 品質基準
- 目標σ値: 2.0mm以下
- 目標良化率: 40%以上
- 最大移動量: ±50mm

## テスト実行

```bash
# 単体テスト
npm test

# カバレッジ付きテスト
npm run test:coverage

# ウォッチモード
npm run test:watch
```

## 注意事項

1. **データ形式**: 入力データはUTF-8エンコーディングを推奨
2. **メモリ使用**: 大規模データ（75km以上）処理時は十分なメモリを確保
3. **ファイル出力**: 出力ディレクトリの書き込み権限を確認
4. **MTT機種**: 使用するMTT機種に応じた設定を必ず確認

## サポート

技術的な問題や質問については、プロジェクトのIssueトラッカーをご利用ください。

## ライセンス

本システムは社内利用専用です。無断での外部配布は禁止されています。

---

最終更新日: 2024年12月
バージョン: 1.0.0