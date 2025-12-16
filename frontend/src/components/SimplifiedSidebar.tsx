/**
 * 簡略化されたサイドバー
 * メインワークフローと管理機能のみを表示
 */

import React from 'react';
import './Sidebar.css';

interface SimplifiedSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const SimplifiedSidebar: React.FC<SimplifiedSidebarProps> = ({
  activeTab,
  onTabChange,
  isOpen,
  onToggle
}) => {
  const menuItems = [
    {
      category: 'メイン',
      items: [
        { id: 'workflow', label: '🚄 軌道整正ワークフロー', description: 'メイン処理画面' },
        { id: 'analysis', label: '📊 軌道データ解析', description: '個別解析ツール' }
      ]
    },
    {
      category: 'データ管理',
      items: [
        { id: 'import', label: '📂 データインポート', description: '各種データの取込' },
        { id: 'conversion', label: '🔄 ファイル形式変換', description: 'データ形式の変換' },
        { id: 'batch', label: '⚡ バッチ処理', description: '一括処理実行' }
      ]
    },
    {
      category: 'レポート',
      items: [
        { id: 'report', label: '📋 成果表作成', description: '報告書の生成' },
        { id: 'export-general', label: '💾 汎用出力', description: '各種形式でエクスポート' }
      ]
    },
    {
      category: '設定',
      items: [
        { id: 'mtt-settings', label: '⚙️ MTT機種設定', description: 'MTT機器の設定' },
        { id: 'environment', label: '🌍 軌道環境データ', description: '環境パラメータ設定' }
      ]
    },
    {
      category: '上級者向け（個別画面）',
      items: [
        { id: 'advanced-mode', label: '🔧 個別処理モード', description: '従来の個別画面アクセス' }
      ]
    }
  ];

  return (
    <>
      {/* トグルボタン */}
      <button
        className={`sidebar-toggle ${isOpen ? 'open' : ''}`}
        onClick={onToggle}
        aria-label="メニュー切り替え"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {/* サイドバー本体 */}
      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>レールトラック</h2>
          <span className="version">v3.0 統合版</span>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((category) => (
            <div key={category.category} className="menu-category">
              <h3>{category.category}</h3>
              {category.items.map((item) => (
                <button
                  key={item.id}
                  className={`menu-item ${activeTab === item.id ? 'active' : ''}`}
                  onClick={() => onTabChange(item.id)}
                  title={item.description}
                >
                  <span className="menu-label">{item.label}</span>
                  {activeTab === item.id && (
                    <span className="active-indicator">▶</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="help-section">
            <button className="help-btn" onClick={() => alert('ヘルプ機能は準備中です')}>
              ❓ ヘルプ
            </button>
            <button className="help-btn" onClick={() => onTabChange('workflow')}>
              🏠 ホーム
            </button>
          </div>
          <div className="copyright">
            © 2024 Rail Track System
          </div>
        </div>
      </div>

      {/* オーバーレイ */}
      {isOpen && (
        <div
          className="sidebar-overlay"
          onClick={onToggle}
        />
      )}
    </>
  );
};

export default SimplifiedSidebar;