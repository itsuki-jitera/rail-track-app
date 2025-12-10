/**
 * アルゴリズム解析ページ
 * Algorithm Analysis Page - Bs05, HSJ, Y1Y2
 */

import React, { useState } from 'react';
import { Bs05Analysis } from '../components/Bs05Analysis';
import { HSJAnalysis } from '../components/HSJAnalysis';
import { Y1Y2Analysis } from '../components/Y1Y2Analysis';
import { RestorationAnalysis } from '../components/RestorationAnalysis';

type AlgorithmType = 'bs05' | 'hsj' | 'y1y2' | 'restoration' | null;

export const AlgorithmAnalysisPage: React.FC = () => {
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<AlgorithmType>(null);

  return (
    <div className="algorithm-analysis-page">
      <div className="page-header">
        <h1>🔬 アルゴリズム解析</h1>
        <p className="page-description">
          VB版レガシーアルゴリズムによる軌道データ解析
        </p>
      </div>

      {/* アルゴリズム選択 */}
      {!selectedAlgorithm && (
        <div className="algorithm-selector">
          <h2>解析アルゴリズムを選択</h2>
          <div className="algorithm-cards">
            <div
              className="algorithm-card bs05"
              onClick={() => setSelectedAlgorithm('bs05')}
            >
              <div className="card-icon">🔄</div>
              <div className="card-title">Bs05</div>
              <div className="card-subtitle">曲線部バス補正</div>
              <div className="card-description">
                曲線区間における軌道狂いの補正。カント・スラックを考慮した理論バス値との差分を計算します。
              </div>
              <div className="card-features">
                <span className="feature-badge">緩和曲線対応</span>
                <span className="feature-badge">カント補正</span>
                <span className="feature-badge">理論バス値</span>
              </div>
            </div>

            <div
              className="algorithm-card hsj"
              onClick={() => setSelectedAlgorithm('hsj')}
            >
              <div className="card-icon">📊</div>
              <div className="card-title">HSJ</div>
              <div className="card-subtitle">波長帯制限フィルタ</div>
              <div className="card-description">
                特定波長帯域の軌道狂い成分を抽出。FFTベースの高精度フィルタリングを実行します。
              </div>
              <div className="card-features">
                <span className="feature-badge">短波長</span>
                <span className="feature-badge">中波長</span>
                <span className="feature-badge">長波長</span>
              </div>
            </div>

            <div
              className="algorithm-card y1y2"
              onClick={() => setSelectedAlgorithm('y1y2')}
            >
              <div className="card-icon">📈</div>
              <div className="card-title">Y1Y2</div>
              <div className="card-subtitle">矢中弦計算</div>
              <div className="card-description">
                2種類の矢中弦計算方法（Y1標準法・Y2修正法）を実行し、相関分析により異常箇所を検出します。
              </div>
              <div className="card-features">
                <span className="feature-badge">Y1標準法</span>
                <span className="feature-badge">Y2修正法</span>
                <span className="feature-badge">相関分析</span>
              </div>
            </div>

            <div
              className="algorithm-card restoration"
              onClick={() => setSelectedAlgorithm('restoration')}
            >
              <div className="card-icon">🔬</div>
              <div className="card-title">復元波形計算</div>
              <div className="card-subtitle">KANA3互換</div>
              <div className="card-description">
                FFTベース復元逆フィルターによる軌道波形復元計算。VB6のKANA3プロジェクト相当の中核機能です。
              </div>
              <div className="card-features">
                <span className="feature-badge">通り・高低</span>
                <span className="feature-badge">FFT処理</span>
                <span className="feature-badge">σ値計算</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bs05解析 */}
      {selectedAlgorithm === 'bs05' && (
        <div className="algorithm-content">
          <div className="content-header">
            <button
              className="back-btn"
              onClick={() => setSelectedAlgorithm(null)}
            >
              ← アルゴリズム選択に戻る
            </button>
            <h2>🔄 Bs05 曲線部バス補正</h2>
          </div>
          <Bs05Analysis />
        </div>
      )}

      {/* HSJ解析 */}
      {selectedAlgorithm === 'hsj' && (
        <div className="algorithm-content">
          <div className="content-header">
            <button
              className="back-btn"
              onClick={() => setSelectedAlgorithm(null)}
            >
              ← アルゴリズム選択に戻る
            </button>
            <h2>📊 HSJ 波長帯制限フィルタ</h2>
          </div>
          <HSJAnalysis />
        </div>
      )}

      {/* Y1Y2解析 */}
      {selectedAlgorithm === 'y1y2' && (
        <div className="algorithm-content">
          <div className="content-header">
            <button
              className="back-btn"
              onClick={() => setSelectedAlgorithm(null)}
            >
              ← アルゴリズム選択に戻る
            </button>
            <h2>📈 Y1Y2 矢中弦計算</h2>
          </div>
          <Y1Y2Analysis />
        </div>
      )}

      {/* 復元波形計算 */}
      {selectedAlgorithm === 'restoration' && (
        <div className="algorithm-content">
          <div className="content-header">
            <button
              className="back-btn"
              onClick={() => setSelectedAlgorithm(null)}
            >
              ← アルゴリズム選択に戻る
            </button>
            <h2>🔬 復元波形計算 (KANA3互換)</h2>
          </div>
          <RestorationAnalysis />
        </div>
      )}

      <style>{`
        .algorithm-analysis-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #f9fafb, #f3f4f6);
          padding: 24px;
        }

        .page-header {
          max-width: 1400px;
          margin: 0 auto 32px auto;
          text-align: center;
        }

        .page-header h1 {
          margin: 0 0 12px 0;
          font-size: 36px;
          font-weight: 700;
          color: #1f2937;
        }

        .page-description {
          margin: 0;
          font-size: 16px;
          color: #6b7280;
        }

        .algorithm-selector {
          max-width: 1400px;
          margin: 0 auto;
        }

        .algorithm-selector h2 {
          margin: 0 0 24px 0;
          font-size: 24px;
          font-weight: 700;
          color: #1f2937;
          text-align: center;
        }

        .algorithm-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 24px;
        }

        .algorithm-card {
          background: white;
          border: 3px solid #e5e7eb;
          border-radius: 16px;
          padding: 32px;
          cursor: pointer;
          transition: all 0.3s;
          text-align: center;
        }

        .algorithm-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
        }

        .algorithm-card.bs05:hover {
          border-color: #8b5cf6;
          box-shadow: 0 12px 24px rgba(139, 92, 246, 0.3);
        }

        .algorithm-card.hsj:hover {
          border-color: #3b82f6;
          box-shadow: 0 12px 24px rgba(59, 130, 246, 0.3);
        }

        .algorithm-card.y1y2:hover {
          border-color: #10b981;
          box-shadow: 0 12px 24px rgba(16, 185, 129, 0.3);
        }

        .algorithm-card.restoration:hover {
          border-color: #f59e0b;
          box-shadow: 0 12px 24px rgba(245, 158, 11, 0.3);
        }

        .card-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }

        .card-title {
          font-size: 28px;
          font-weight: 700;
          color: #1f2937;
          margin-bottom: 4px;
        }

        .card-subtitle {
          font-size: 14px;
          font-weight: 600;
          color: #6b7280;
          margin-bottom: 16px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .card-description {
          font-size: 14px;
          color: #4b5563;
          line-height: 1.6;
          margin-bottom: 20px;
        }

        .card-features {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
        }

        .feature-badge {
          padding: 6px 12px;
          background: linear-gradient(135deg, #dbeafe, #bfdbfe);
          border: 1px solid #93c5fd;
          border-radius: 16px;
          font-size: 12px;
          font-weight: 600;
          color: #1e40af;
        }

        .algorithm-content {
          max-width: 1400px;
          margin: 0 auto;
        }

        .content-header {
          margin-bottom: 24px;
        }

        .content-header h2 {
          margin: 16px 0 0 0;
          font-size: 28px;
          font-weight: 700;
          color: #1f2937;
        }

        .back-btn {
          padding: 10px 20px;
          background: white;
          border: 2px solid #d1d5db;
          border-radius: 8px;
          color: #374151;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .back-btn:hover {
          background: #f3f4f6;
          border-color: #9ca3af;
        }
      `}</style>
    </div>
  );
};

export default AlgorithmAnalysisPage;
