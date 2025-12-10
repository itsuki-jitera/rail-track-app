/**
 * 標準ボタンコンポーネント
 * 全ページで一貫したボタン表示を実現するための共通コンポーネント
 */

import React from 'react';
import './StandardButton.css';

// ボタンのタイプ定義
export type ButtonType = 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'info';
export type ButtonSize = 'small' | 'medium' | 'large';

interface StandardButtonProps {
  // 基本プロパティ
  label: string;
  onClick?: () => void | Promise<void>;

  // スタイリング
  type?: ButtonType;
  size?: ButtonSize;
  icon?: string;
  fullWidth?: boolean;

  // 状態
  disabled?: boolean;
  loading?: boolean;

  // その他
  className?: string;
  style?: React.CSSProperties;
}

export const StandardButton: React.FC<StandardButtonProps> = ({
  label,
  onClick,
  type = 'primary',
  size = 'medium',
  icon,
  fullWidth = false,
  disabled = false,
  loading = false,
  className = '',
  style = {}
}) => {
  const [isProcessing, setIsProcessing] = React.useState(false);

  const handleClick = async () => {
    if (disabled || loading || isProcessing || !onClick) return;

    setIsProcessing(true);
    try {
      await onClick();
    } catch (error) {
      console.error('Button action failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getButtonClassName = () => {
    const classes = ['standard-button'];

    // タイプ別クラス
    classes.push(`button-${type}`);

    // サイズ別クラス
    classes.push(`button-${size}`);

    // 状態別クラス
    if (disabled) classes.push('button-disabled');
    if (loading || isProcessing) classes.push('button-loading');
    if (fullWidth) classes.push('button-full-width');

    // カスタムクラス
    if (className) classes.push(className);

    return classes.join(' ');
  };

  return (
    <button
      className={getButtonClassName()}
      onClick={handleClick}
      disabled={disabled || loading || isProcessing}
      style={style}
    >
      {(loading || isProcessing) ? (
        <span className="button-spinner">⏳</span>
      ) : icon ? (
        <span className="button-icon">{icon}</span>
      ) : null}
      <span className="button-label">{label}</span>
    </button>
  );
};

// プリセットボタン - よく使うボタンパターンを事前定義
export const PresetButtons = {
  // 保存系
  Save: (props: Partial<StandardButtonProps>) => (
    <StandardButton label="設定を保存" icon="💾" type="primary" {...props} />
  ),
  SaveAndContinue: (props: Partial<StandardButtonProps>) => (
    <StandardButton label="保存して続行" icon="💾" type="primary" {...props} />
  ),

  // 実行系
  Execute: (props: Partial<StandardButtonProps>) => (
    <StandardButton label="実行" icon="▶️" type="primary" {...props} />
  ),
  Calculate: (props: Partial<StandardButtonProps>) => (
    <StandardButton label="計算実行" icon="🔢" type="primary" {...props} />
  ),

  // データ操作系
  Import: (props: Partial<StandardButtonProps>) => (
    <StandardButton label="インポート" icon="📥" type="primary" {...props} />
  ),
  Export: (props: Partial<StandardButtonProps>) => (
    <StandardButton label="エクスポート" icon="📤" type="primary" {...props} />
  ),
  Upload: (props: Partial<StandardButtonProps>) => (
    <StandardButton label="アップロード" icon="⬆️" type="primary" {...props} />
  ),
  Download: (props: Partial<StandardButtonProps>) => (
    <StandardButton label="ダウンロード" icon="⬇️" type="primary" {...props} />
  ),

  // ナビゲーション系
  Back: (props: Partial<StandardButtonProps>) => (
    <StandardButton label="戻る" icon="⬅️" type="secondary" {...props} />
  ),
  Next: (props: Partial<StandardButtonProps>) => (
    <StandardButton label="次へ" icon="➡️" type="primary" {...props} />
  ),

  // アクション系
  Add: (props: Partial<StandardButtonProps>) => (
    <StandardButton label="追加" icon="➕" type="success" {...props} />
  ),
  Edit: (props: Partial<StandardButtonProps>) => (
    <StandardButton label="編集" icon="✏️" type="info" {...props} />
  ),
  Delete: (props: Partial<StandardButtonProps>) => (
    <StandardButton label="削除" icon="🗑️" type="danger" {...props} />
  ),

  // その他
  Cancel: (props: Partial<StandardButtonProps>) => (
    <StandardButton label="キャンセル" icon="❌" type="secondary" {...props} />
  ),
  Reset: (props: Partial<StandardButtonProps>) => (
    <StandardButton label="リセット" icon="🔄" type="warning" {...props} />
  ),
  Refresh: (props: Partial<StandardButtonProps>) => (
    <StandardButton label="更新" icon="🔄" type="info" {...props} />
  ),
  Settings: (props: Partial<StandardButtonProps>) => (
    <StandardButton label="設定" icon="⚙️" type="secondary" {...props} />
  ),
};