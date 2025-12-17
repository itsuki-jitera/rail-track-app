/**
 * ダッシュボードページ
 * 統合ダッシュボードを表示するメインページ
 * Phase 4実装
 */

import React from 'react';
import { UnifiedDashboard } from '../components/UnifiedDashboard';
import './PageStyles.css';

export const DashboardPage: React.FC = () => {
  return (
    <div className="page-container">
      <UnifiedDashboard />
    </div>
  );
};