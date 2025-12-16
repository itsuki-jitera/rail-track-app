/**
 * 上級者向け個別処理モード
 * 従来の個別画面へのクイックアクセスを提供
 */

import React, { useState } from 'react';
import { useGlobalWorkspace } from '../contexts/GlobalWorkspaceContext';
import './PageStyles.css';

interface MenuCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  available: boolean;
  onClick: () => void;
}

export const AdvancedModePage: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { state } = useGlobalWorkspace();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // メニューカード定義
  const menuCards: MenuCard[] = [
    // 入力系
    {
      id: 'kiya-import',
      title: 'キヤデータ読込',
      description: 'MTTデータの個別読込と管理',
      icon: '🚃',
      category: 'input',
      available: true,
      onClick: () => onNavigate('kiya-import')
    },
    {
      id: 'legacy',
      title: '旧Labocsデータ',
      description: 'レガシーシステムのデータ処理',
      icon: '📦',
      category: 'input',
      available: true,
      onClick: () => onNavigate('legacy')
    },

    // 設定系
    {
      id: 'work-section',
      title: '作業区間設定',
      description: '作業区間の詳細設定',
      icon: '📍',
      category: 'settings',
      available: state.status.dataLoaded,
      onClick: () => onNavigate('work-section')
    },
    {
      id: 'curve-spec',
      title: '曲線諸元設定',
      description: '曲線パラメータの管理',
      icon: '📐',
      category: 'settings',
      available: state.status.sectionCut,
      onClick: () => onNavigate('curve-spec')
    },
    {
      id: 'fixed-point',
      title: '固定点設定',
      description: '移動不可箇所の指定',
      icon: '📌',
      category: 'settings',
      available: state.status.sectionCut,
      onClick: () => onNavigate('fixed-point')
    },
    {
      id: 'movement-limit',
      title: '移動量制限',
      description: '移動量の上限設定',
      icon: '⚠️',
      category: 'settings',
      available: state.status.sectionCut,
      onClick: () => onNavigate('movement-limit')
    },
    {
      id: 'vertical-curve',
      title: '縦曲線設定',
      description: '縦断曲線の設定',
      icon: '📏',
      category: 'settings',
      available: state.status.sectionCut,
      onClick: () => onNavigate('vertical-curve')
    },
    {
      id: 'field-measurement',
      title: '手検測入力',
      description: '現地測定データの入力',
      icon: '📝',
      category: 'settings',
      available: state.status.sectionCut,
      onClick: () => onNavigate('field-measurement')
    },

    // 計算系
    {
      id: 'restoration',
      title: '復元波形計算',
      description: '個別復元計算の実行',
      icon: '⚙️',
      category: 'calculation',
      available: state.status.sectionCut,
      onClick: () => onNavigate('restoration')
    },
    {
      id: 'plan-line',
      title: '計画線設定',
      description: '詳細な計画線編集',
      icon: '📈',
      category: 'calculation',
      available: state.status.waveformCalculated,
      onClick: () => onNavigate('plan-line')
    },
    {
      id: 'movement-calc',
      title: '移動量算出',
      description: '移動量の詳細計算',
      icon: '🔧',
      category: 'calculation',
      available: state.status.planLineSet,
      onClick: () => onNavigate('movement-calc')
    },
    {
      id: 'before-after',
      title: '仕上り予測',
      description: '整備前後の比較分析',
      icon: '🔄',
      category: 'calculation',
      available: state.status.movementsCalculated,
      onClick: () => onNavigate('before-after')
    },

    // 評価系
    {
      id: 'waveband-analysis',
      title: 'FFT解析',
      description: '周波数解析の実行',
      icon: '📊',
      category: 'evaluation',
      available: state.status.waveformCalculated,
      onClick: () => onNavigate('waveband-analysis')
    },
    {
      id: 'quality-analysis',
      title: 'σ値・良化率解析',
      description: '品質指標の分析',
      icon: '📉',
      category: 'evaluation',
      available: state.status.movementsCalculated,
      onClick: () => onNavigate('quality-analysis')
    },
    {
      id: 'eccentric',
      title: '偏心矢計算',
      description: '偏心量の計算',
      icon: '🎯',
      category: 'evaluation',
      available: state.status.sectionCut,
      onClick: () => onNavigate('eccentric')
    },

    // 出力系
    {
      id: 'export-als',
      title: 'ALS出力',
      description: 'ALS形式での出力',
      icon: '💾',
      category: 'export',
      available: state.status.movementsCalculated,
      onClick: () => onNavigate('export-als')
    },
    {
      id: 'export-mj',
      title: 'MJ出力',
      description: 'MJ形式での出力',
      icon: '💾',
      category: 'export',
      available: state.status.movementsCalculated,
      onClick: () => onNavigate('export-mj')
    },
    {
      id: 'export-alc',
      title: 'ALC出力',
      description: 'ALC形式での出力',
      icon: '💾',
      category: 'export',
      available: state.status.movementsCalculated,
      onClick: () => onNavigate('export-alc')
    },
    {
      id: 'export-general',
      title: '汎用出力',
      description: '各種形式での出力',
      icon: '📤',
      category: 'export',
      available: true,
      onClick: () => onNavigate('export-general')
    },

    // レポート
    {
      id: 'report',
      title: '成果表作成',
      description: '総合レポートの生成',
      icon: '📑',
      category: 'report',
      available: state.status.movementsCalculated,
      onClick: () => onNavigate('report')
    }
  ];

  // カテゴリー定義
  const categories = [
    { id: 'all', label: '全て', icon: '📁' },
    { id: 'input', label: '入力系', icon: '📥' },
    { id: 'settings', label: '設定系', icon: '⚙️' },
    { id: 'calculation', label: '計算系', icon: '🧮' },
    { id: 'evaluation', label: '評価系', icon: '📊' },
    { id: 'export', label: '出力系', icon: '💾' },
    { id: 'report', label: 'レポート', icon: '📋' }
  ];

  // フィルター適用
  const filteredCards = selectedCategory === 'all'
    ? menuCards
    : menuCards.filter(card => card.category === selectedCategory);

  return (
    <div className="advanced-mode-page" style={{ padding: '20px' }}>
      {/* ヘッダー */}
      <div style={{
        marginBottom: '30px',
        padding: '20px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '12px',
        color: 'white'
      }}>
        <h1 style={{ margin: '0 0 10px 0' }}>🔧 上級者向け個別処理モード</h1>
        <p style={{ margin: 0, opacity: 0.9 }}>
          各機能に直接アクセスして、個別に処理を実行できます。
          通常は「軌道整正ワークフロー」の使用を推奨します。
        </p>
      </div>

      {/* 警告メッセージ */}
      <div style={{
        marginBottom: '20px',
        padding: '15px',
        background: '#fff3cd',
        border: '1px solid #ffc107',
        borderRadius: '8px',
        color: '#856404'
      }}>
        <strong>⚠️ 注意:</strong> 個別処理モードでは、処理順序の管理は利用者の責任となります。
        初めての方は「軌道整正ワークフロー」をご利用ください。
      </div>

      {/* カテゴリーフィルター */}
      <div style={{
        marginBottom: '20px',
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap'
      }}>
        {categories.map(category => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            style={{
              padding: '8px 16px',
              background: selectedCategory === category.id ? '#2196f3' : 'white',
              color: selectedCategory === category.id ? 'white' : '#333',
              border: selectedCategory === category.id ? 'none' : '1px solid #ddd',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: selectedCategory === category.id ? 'bold' : 'normal',
              transition: 'all 0.3s'
            }}
          >
            {category.icon} {category.label}
          </button>
        ))}
      </div>

      {/* メニューカードグリッド */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
        gap: '20px'
      }}>
        {filteredCards.map(card => (
          <div
            key={card.id}
            onClick={card.available ? card.onClick : undefined}
            style={{
              padding: '20px',
              background: card.available ? 'white' : '#f5f5f5',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              cursor: card.available ? 'pointer' : 'not-allowed',
              opacity: card.available ? 1 : 0.6,
              transition: 'all 0.3s',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              if (card.available) {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {!card.available && (
              <div style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: '#ff9800',
                color: 'white',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px'
              }}>
                要前提条件
              </div>
            )}

            <div style={{ fontSize: '32px', marginBottom: '15px' }}>
              {card.icon}
            </div>

            <h3 style={{
              margin: '0 0 8px 0',
              fontSize: '18px',
              color: card.available ? '#333' : '#999'
            }}>
              {card.title}
            </h3>

            <p style={{
              margin: 0,
              fontSize: '14px',
              color: '#666',
              lineHeight: '1.4'
            }}>
              {card.description}
            </p>

            {card.available && (
              <div style={{
                marginTop: '15px',
                paddingTop: '15px',
                borderTop: '1px solid #f0f0f0',
                fontSize: '13px',
                color: '#2196f3',
                fontWeight: '500'
              }}>
                クリックして開く →
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ステータスサマリー */}
      <div style={{
        marginTop: '40px',
        padding: '20px',
        background: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <h3 style={{ margin: '0 0 15px 0' }}>📊 現在の処理状態</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '15px'
        }}>
          <div>
            <span style={{ color: state.status.dataLoaded ? '#4caf50' : '#999' }}>
              {state.status.dataLoaded ? '✅' : '⭕'} データ読込
            </span>
          </div>
          <div>
            <span style={{ color: state.status.sectionCut ? '#4caf50' : '#999' }}>
              {state.status.sectionCut ? '✅' : '⭕'} 区間切取
            </span>
          </div>
          <div>
            <span style={{ color: state.status.positionAligned ? '#4caf50' : '#999' }}>
              {state.status.positionAligned ? '✅' : '⭕'} 位置合わせ
            </span>
          </div>
          <div>
            <span style={{ color: state.status.waveformCalculated ? '#4caf50' : '#999' }}>
              {state.status.waveformCalculated ? '✅' : '⭕'} 復元波形計算
            </span>
          </div>
          <div>
            <span style={{ color: state.status.planLineSet ? '#4caf50' : '#999' }}>
              {state.status.planLineSet ? '✅' : '⭕'} 計画線設定
            </span>
          </div>
          <div>
            <span style={{ color: state.status.movementsCalculated ? '#4caf50' : '#999' }}>
              {state.status.movementsCalculated ? '✅' : '⭕'} 移動量算出
            </span>
          </div>
        </div>
      </div>

      {/* ホームに戻るボタン */}
      <div style={{ marginTop: '30px', textAlign: 'center' }}>
        <button
          onClick={() => onNavigate('workflow')}
          style={{
            padding: '12px 30px',
            background: '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          ← ワークフロー画面に戻る
        </button>
      </div>
    </div>
  );
};

export default AdvancedModePage;