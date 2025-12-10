import React from 'react';
import './Sidebar.css';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, isOpen, onToggle }) => {
  const menuItems = [
    // === 入力系 (P6-8, P15) ===
    { id: 'kiya-import', label: 'キヤデータ読込', icon: '🚃' },
    { id: 'field-measurement', label: '手検測入力', icon: '📏' },

    // === 設定系 (P9-17, P21-23, P30-31) ===
    { id: 'work-section', label: '作業区間設定', icon: '📍' },
    { id: 'curve-spec', label: '曲線諸元設定', icon: '📐' },
    { id: 'vertical-curve', label: '縦曲線設定', icon: '📉' },
    { id: 'plan-line', label: '計画線設定', icon: '📈' },
    { id: 'fixed-point', label: '固定点設定', icon: '🔒' },
    { id: 'movement-limit', label: '移動量制限', icon: '⚠️' },
    { id: 'mtt-settings', label: 'マルタイ設定', icon: '🚄' },

    // === 計算系 (P6-8, P18-20, P24-26) ===
    { id: 'restoration', label: '復元波形計算', icon: '⚙️' },
    { id: 'movement-calc', label: '移動量算出', icon: '📊' },
    { id: 'waveband-analysis', label: 'FFT解析', icon: '🌊' },

    // === 評価系 (P27-29) ===
    { id: 'quality-analysis', label: 'σ値・良化率', icon: '📈' },
    { id: 'before-after', label: '整備前後比較', icon: '🔄' },

    // === 出力系 (P32-37) ===
    { id: 'export-als', label: 'ALS出力', icon: '💾' },
    { id: 'export-mj', label: 'MJ出力', icon: '📤' },
    { id: 'export-alc', label: 'ALC出力', icon: '📀' },
    { id: 'export-general', label: '汎用出力', icon: '📋' },

    // === レポート (P38-40) ===
    { id: 'report', label: '成果表作成', icon: '📑' }
  ];

  return (
    <>
      {/* モバイル用ハンバーガーメニュー */}
      <button className="sidebar-toggle" onClick={onToggle} aria-label="メニューを開く">
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
      </button>

      {/* オーバーレイ（モバイル時） */}
      {isOpen && <div className="sidebar-overlay" onClick={onToggle}></div>}

      {/* サイドバー本体 */}
      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div>
            <h2 className="sidebar-title">🚄 軌道復元システム</h2>
            <p className="sidebar-subtitle">Rail Track Restoration</p>
          </div>
          <button className="sidebar-close" onClick={onToggle} aria-label="メニューを閉じる">
            ✕
          </button>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <button
              key={item.id}
              className={`sidebar-item ${activeTab === item.id ? 'sidebar-item-active' : ''}`}
              onClick={() => {
                onTabChange(item.id);
                // モバイルでは選択後に自動的に閉じる
                if (window.innerWidth <= 768) {
                  onToggle();
                }
              }}
            >
              <span className="sidebar-item-icon">{item.icon}</span>
              <span className="sidebar-item-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-version">Version 2.0.0</div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;