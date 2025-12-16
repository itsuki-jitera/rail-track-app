# レールトラック軌道整正システム - 実装計画書

## 実装フェーズと優先順位

### 📅 フェーズ1: 基本機能の改善（1-2週間）
**目的**: 既存機能の改善と重要な基本機能の追加

#### 1.1 作業方向に基づくチャート表示改善
**ファイル**: `frontend/src/components/ChartDisplay.tsx`
```typescript
// 実装内容
interface ChartDisplayProps {
  originalData: TrackData[]
  workDirection?: 'forward' | 'backward'  // 追加
  railSide?: 'left' | 'right'  // 追加
}

// チャートオプションの更新
scales: {
  x: {
    reverse: workDirection === 'backward',  // 作業方向による反転
    title: {
      text: `距離 (m) - ${workDirection === 'forward' ? '下り方向→' : '←上り方向'}`
    }
  }
}
```

#### 1.2 こう上優先の計画線生成アルゴリズム
**ファイル**: `backend/src/algorithms/convex-plan-line.js` (新規作成)
```javascript
class ConvexPlanLine {
  /**
   * こう上優先の凸型計画線を生成
   * - 下方向の移動を最小限に抑える
   * - 道床への負荷を軽減
   */
  static generateConvexPlan(restoredWaveform, constraints) {
    // 1. ゼロクロス点の検出
    // 2. 上方向移動を優先した最適化
    // 3. 移動量制限の考慮
    return planLine;
  }
}
```

#### 1.3 WB区間のキロ程特別処理
**ファイル**: `backend/src/services/kilometer-service.js` (新規作成)
```javascript
class KilometerService {
  /**
   * WB区間のキロ程データ処理
   * - ラボックス元データをそのまま使用
   * - 通常区間は データ数 × データ間隔で計算
   */
  static processKilometer(data, wbSections) {
    // WB区間の識別と特別処理
    // KK.KDTファイルからの読み込み
  }
}
```

### 📅 フェーズ2: 移動量と補正機能（1週間）
**目的**: 移動量計算の明確化と各種補正機能の実装

#### 2.1 移動量計算の可視化
**ファイル**: `frontend/src/components/MovementAmountDisplay.tsx` (新規作成)
```typescript
interface MovementData {
  position: number
  currentHeight: number  // 復元波形
  targetHeight: number   // 計画線（ゼロ点）
  movementAmount: number // 移動量
  constraint?: number    // 移動量制限
}

// 移動量の視覚的表示コンポーネント
const MovementAmountDisplay: React.FC = () => {
  // 復元波形から計画線への移動量を表示
  // 移動量制限との比較
  // 制限超過箇所のハイライト
}
```

#### 2.2 通り狂い補正率の実装
**ファイル**: `backend/src/algorithms/alignment-correction.js` (新規作成)
```javascript
class AlignmentCorrection {
  /**
   * マヤ車の通り狂い補正
   * @param {number} correctionRate - 補正率（デフォルト1.0）
   */
  static applyCorrectionRate(alignmentData, correctionRate = 1.0) {
    // マヤ車データの補正処理
    // 曲線諸元の台形差引
  }
}
```

#### 2.3 レール左右の明確な定義
**ファイル**: `frontend/src/types/track-types.ts` (拡張)
```typescript
export interface RailData {
  left: {
    level: number[]      // 高低
    alignment: number[]  // 通り
  }
  right: {
    level: number[]
    alignment: number[]
  }
  workDirection: 'forward' | 'backward'
}
```

### 📅 フェーズ3: 手検測と位置合わせ（1週間）
**目的**: 現地との正確な位置対応付け

#### 3.1 相関係数による自動位置合わせ
**ファイル**: `backend/src/algorithms/correlation-matching.js` (新規作成)
```javascript
class CorrelationMatching {
  /**
   * 手検測データとの相関計算
   * ±20m範囲で最大相関係数を検索
   */
  static findBestMatch(handMeasurement, laboxData, searchRange = 20) {
    // 相関係数計算
    // 最適位置の検出
    // 信頼度スコアの算出
  }
}
```

#### 3.2 手検測入力UI改善
**ファイル**: `frontend/src/pages/HandMeasurementPage.tsx` (改善)
```typescript
// 追加機能
- 複数区間の測定データ入力
- 1mごと最大25mまでの入力フォーム
- 相関結果の視覚的表示
- キロ程調整機能
```

### 📅 フェーズ4: MTT種別対応と高度な機能（1週間）
**目的**: 実運用に必要な詳細機能の実装

#### 4.1 MTT種別によるALS補正
**ファイル**: `backend/src/services/mtt-als-service.js` (新規作成)
```javascript
class MTTAlsService {
  static MTT_TYPES = {
    TYPE_A: { alsOffset: 0.5, frontCorrection: 1.02 },
    TYPE_B: { alsOffset: 0.3, frontCorrection: 1.01 },
    // ...
  }

  /**
   * MTT種別に応じたALS用移動量補正
   */
  static correctForALS(movementData, mttType) {
    // フロント誘導位置の補正
    // ALS用データの生成
  }
}
```

#### 4.2 駅付近・特殊区間対応
**ファイル**: `backend/src/services/special-section-handler.js` (新規作成)
```javascript
class SpecialSectionHandler {
  /**
   * 特殊区間の処理
   * - 駅ホーム区間
   * - 不動点制約区間
   * - 緩和曲線延伸箇所
   */
  static handleSpecialSections(planLine, specialSections) {
    // 特殊区間の識別
    // 制約条件の適用
    // 警告メッセージの生成
  }
}
```

### 📅 フェーズ5: 統合テストと最適化（1週間）
**目的**: 全機能の統合と性能最適化

#### 5.1 エンドツーエンドテスト
```javascript
// test/e2e/workflow.test.js
- データ読込から移動量出力までの完全フロー
- 各種パラメータでの動作確認
- エッジケースの処理
```

#### 5.2 性能最適化
- 大規模データ（100km以上）での処理速度改善
- メモリ使用量の最適化
- チャート描画のパフォーマンス向上

## 実装スケジュール

| フェーズ | 期間 | 主要成果物 | 依存関係 |
|---------|------|------------|----------|
| フェーズ1 | 週1-2 | チャート改善、凸型計画線、WB区間処理 | なし |
| フェーズ2 | 週3 | 移動量可視化、通り狂い補正 | フェーズ1 |
| フェーズ3 | 週4 | 手検測位置合わせ | フェーズ1 |
| フェーズ4 | 週5 | MTT対応、特殊区間処理 | フェーズ2,3 |
| フェーズ5 | 週6 | 統合テスト、最適化 | 全フェーズ |

## 各フェーズの完了基準

### フェーズ1
- [ ] 作業方向による表示が正しく反転する
- [ ] こう上優先の計画線が生成される
- [ ] WB区間のキロ程が正しく表示される

### フェーズ2
- [ ] 移動量が視覚的に確認できる
- [ ] 通り狂い補正率が適用される
- [ ] 左右レールが明確に区別される

### フェーズ3
- [ ] 手検測データとの自動位置合わせが動作する
- [ ] 相関係数が表示される
- [ ] キロ程が現地と一致する

### フェーズ4
- [ ] MTT種別選択が可能
- [ ] ALS用データが出力される
- [ ] 特殊区間で警告が表示される

### フェーズ5
- [ ] 全ワークフローが正常動作する
- [ ] 100km以上のデータが5分以内に処理される
- [ ] ユーザーマニュアルが完成する

## リスクと対策

| リスク | 影響度 | 発生確率 | 対策 |
|--------|--------|----------|------|
| 既存データ形式との非互換 | 高 | 中 | 段階的移行、変換ツール作成 |
| 性能要件未達 | 中 | 低 | 早期性能テスト、並列処理導入 |
| 仕様理解の相違 | 高 | 中 | プロトタイプによる早期確認 |
| WB区間データの特殊性 | 中 | 高 | サンプルデータでの事前検証 |

## 必要なリソース

### 開発環境
- Node.js 18+ (既存)
- React 18+ (既存)
- Chart.js (既存)
- 追加ライブラリ:
  - numeric.js (行列計算用)
  - worker-threads (並列処理用)

### テストデータ
- 実際のMTTデータサンプル（各種条件）
- WB区間を含むデータ
- 手検測データサンプル
- 各MTT種別のパラメータ

### ドキュメント
- 詳細仕様書（PDF提供済み）
- ラボックスデータフォーマット仕様
- MTT種別仕様
- ALS仕様

## 成功指標

1. **機能完全性**: 仕様書の全要件を満たす
2. **性能**: 100kmデータを5分以内に処理
3. **精度**: 手検測との位置誤差±1m以内
4. **使いやすさ**: ワークフロー完了率90%以上
5. **保守性**: コードカバレッジ80%以上

## 次のアクション

1. **即座に開始可能**:
   - フェーズ1.1: ChartDisplay.tsxの改善
   - フェーズ1.2: 凸型計画線アルゴリズムの実装

2. **準備が必要**:
   - WB区間のサンプルデータ取得
   - MTT種別パラメータの確認

3. **調査が必要**:
   - ラボックスKK.KDTファイル形式
   - ALS通信プロトコル

---

この計画書は随時更新され、実装の進捗に応じて調整されます。