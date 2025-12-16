import React, { useState, useRef, useEffect } from 'react';

interface NumericInputProps {
  value: number | '';
  onChange: (value: number | '') => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * 数値入力用のカスタムコンポーネント
 * カーソル位置の問題を解決し、数値の適切な管理を行う
 */
export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  placeholder,
  min,
  max,
  step,
  disabled,
  style,
  className
}) => {
  // 内部的には文字列として管理
  const [internalValue, setInternalValue] = useState<string>(() => {
    return value === '' ? '' : String(value);
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const cursorPositionRef = useRef<number | null>(null);

  // 外部からの値の変更を反映
  useEffect(() => {
    const newValue = value === '' ? '' : String(value);
    if (newValue !== internalValue) {
      setInternalValue(newValue);
    }
  }, [value]);

  // カーソル位置を復元
  useEffect(() => {
    if (inputRef.current && cursorPositionRef.current !== null) {
      inputRef.current.setSelectionRange(
        cursorPositionRef.current,
        cursorPositionRef.current
      );
      cursorPositionRef.current = null;
    }
  }, [internalValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;

    // カーソル位置を記憶
    cursorPositionRef.current = cursorPos;

    // 空文字列を許可
    if (newValue === '') {
      setInternalValue('');
      onChange('');
      return;
    }

    // 数値として妥当な入力のみ許可
    // 負の数、小数点を含む数値も許可
    const isValidInput = /^-?\d*\.?\d*$/.test(newValue);

    if (isValidInput) {
      setInternalValue(newValue);

      // 数値として完全な場合のみ親コンポーネントに通知
      const numValue = parseFloat(newValue);
      if (!isNaN(numValue)) {
        // min/maxの範囲チェック
        if (min !== undefined && numValue < min) return;
        if (max !== undefined && numValue > max) return;

        onChange(numValue);
      } else if (newValue === '-' || newValue === '.' || newValue === '-.') {
        // 入力途中の場合は文字列のまま保持
        setInternalValue(newValue);
      }
    }
  };

  const handleBlur = () => {
    // フォーカスを外した時に不完全な入力を修正
    if (internalValue === '' || internalValue === '-' || internalValue === '.') {
      setInternalValue('');
      onChange('');
      return;
    }

    const numValue = parseFloat(internalValue);
    if (!isNaN(numValue)) {
      // min/maxの範囲に収める
      let finalValue = numValue;
      if (min !== undefined && finalValue < min) finalValue = min;
      if (max !== undefined && finalValue > max) finalValue = max;

      setInternalValue(String(finalValue));
      onChange(finalValue);
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"  // type="number"ではなくtextを使用
      inputMode="decimal"  // モバイルで数値キーボードを表示
      value={internalValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      style={style}
      className={className}
      step={step}
    />
  );
};

export default NumericInput;