/**
 * encoding-detector.js のテスト
 */
import { describe, test, expect } from '@jest/globals';
import {
  detectEncoding,
  convertToUTF8,
  analyzeEncoding,
  smartDecode
} from '../encoding-detector.js';

describe('encoding-detector', () => {
  describe('detectEncoding', () => {
    test('UTF-8テキストを正しく検出する', () => {
      const utf8Text = 'こんにちは世界';
      const buffer = Buffer.from(utf8Text, 'utf-8');
      const encoding = detectEncoding(buffer);

      expect(encoding).toBe('UTF8');
    });

    test('Shift-JISテキストを検出する', () => {
      // Shift-JIS エンコードされた「こんにちは」
      const sjisBuffer = Buffer.from([0x82, 0xb1, 0x82, 0xf1, 0x82, 0xc9, 0x82, 0xbf, 0x82, 0xcd]);
      const encoding = detectEncoding(sjisBuffer);

      // Shift-JIS または SJIS として検出されることを確認
      expect(['SJIS', 'SHIFT_JIS', 'SHIFTJIS']).toContain(encoding);
    });

    test('空のバッファでもエラーにならない', () => {
      const buffer = Buffer.from([]);
      const encoding = detectEncoding(buffer);

      expect(encoding).toBeDefined();
    });
  });

  describe('convertToUTF8', () => {
    test('UTF-8からUTF-8への変換（変換なし）', () => {
      const originalText = 'テスト用テキスト';
      const buffer = Buffer.from(originalText, 'utf-8');
      const converted = convertToUTF8(buffer, 'UTF8');

      expect(converted).toBe(originalText);
    });

    test('Shift-JISからUTF-8への変換', () => {
      // Shift-JIS エンコードされた「鉄道」
      const sjisBuffer = Buffer.from([0x93, 0x53, 0x93, 0xb9]);
      const converted = convertToUTF8(sjisBuffer, 'SJIS');

      expect(converted).toBe('鉄道');
    });

    test('EUC-JPからUTF-8への変換', () => {
      // EUC-JP エンコードされた「軌道」
      const eucBuffer = Buffer.from([0xb5, 0xb0, 0xc6, 0xbb]);
      const converted = convertToUTF8(eucBuffer, 'EUCJP');

      expect(converted).toBe('軌道');
    });
  });

  describe('analyzeEncoding', () => {
    test('UTF-8テキストの解析結果を返す', () => {
      const utf8Text = '線路の管理値';
      const buffer = Buffer.from(utf8Text, 'utf-8');
      const result = analyzeEncoding(buffer);

      expect(result).toHaveProperty('encoding');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('bom');
      expect(result.encoding).toBe('UTF8');
    });

    test('UTF-8 BOMを検出する', () => {
      // UTF-8 BOM付きテキスト
      const bomBuffer = Buffer.from([0xEF, 0xBB, 0xBF, 0x74, 0x65, 0x73, 0x74]);
      const result = analyzeEncoding(bomBuffer);

      expect(result.bom).toBe('UTF-8');
    });

    test('BOMなしの場合はnullを返す', () => {
      const buffer = Buffer.from('test', 'utf-8');
      const result = analyzeEncoding(buffer);

      expect(result.bom).toBeNull();
    });

    test('信頼度が0-1の範囲内である', () => {
      const buffer = Buffer.from('テスト', 'utf-8');
      const result = analyzeEncoding(buffer);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('smartDecode', () => {
    test('UTF-8テキストを正しくデコードする', () => {
      const originalText = 'CK0101.csvファイル';
      const buffer = Buffer.from(originalText, 'utf-8');
      const result = smartDecode(buffer);

      expect(result.success).toBe(true);
      expect(result.text).toBe(originalText);
      expect(result.encoding).toBe('UTF8');
    });

    test('Shift-JISテキストを自動検出してデコードする', () => {
      // Shift-JIS エンコードされた「曲線情報」
      const sjisBuffer = Buffer.from([0x8b, 0xc8, 0x90, 0xfc, 0x8f, 0xee, 0x95, 0xf1]);
      const result = smartDecode(sjisBuffer);

      expect(result.success).toBe(true);
      expect(result.text).toBe('曲線情報');
    });

    test('文字化けを検出して代替エンコーディングを試行する', () => {
      // 不正なバイト列（文字化けの可能性）
      const buffer = Buffer.from([0xFF, 0xFE, 0x00, 0x00, 0x41, 0x42, 0x43]);
      const result = smartDecode(buffer);

      // 失敗しても結果は返される
      expect(result).toHaveProperty('encoding');
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('success');
    });

    test('空のバッファでもエラーにならない', () => {
      const buffer = Buffer.from([]);
      const result = smartDecode(buffer);

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
    });

    test('LKファイル形式のShift-JISテキストを処理できる', () => {
      // 実際のLKファイルに近いフォーマット（Shift-JIS）
      const lkContent = 'LK01,岩国線(下),三田尻～徳山駅出\n';
      const sjisBuffer = Buffer.from(lkContent, 'shift_jis');
      const result = smartDecode(sjisBuffer);

      expect(result.success).toBe(true);
      expect(result.text).toContain('LK01');
      expect(result.text).toContain('岩国線');
    });

    test('CKファイル形式のマーカーを処理できる', () => {
      const ckContent = 'BC=1.234,R=600,C=105\nEC=1.567\n';
      const buffer = Buffer.from(ckContent, 'utf-8');
      const result = smartDecode(buffer);

      expect(result.success).toBe(true);
      expect(result.text).toContain('BC=');
      expect(result.text).toContain('R=');
    });
  });

  describe('エッジケースとエラーハンドリング', () => {
    test('非常に短いバッファを処理できる', () => {
      const buffer = Buffer.from([0x41]); // 'A'
      const result = smartDecode(buffer);

      expect(result.text).toBe('A');
    });

    test('バイナリデータでもエラーにならない', () => {
      const binaryBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE]);
      const result = smartDecode(binaryBuffer);

      expect(result).toBeDefined();
    });

    test('混在エンコーディング（文字化け可能性）を処理する', () => {
      // UTF-8とShift-JISが混在した不正なデータ
      const mixedBuffer = Buffer.concat([
        Buffer.from('ABC', 'utf-8'),
        Buffer.from([0x82, 0xa0]),  // Shift-JIS 'あ'
        Buffer.from('XYZ', 'utf-8')
      ]);

      const result = smartDecode(mixedBuffer);
      expect(result).toBeDefined();
    });

    test('9999（無効値）を含むデータを処理できる', () => {
      const content = 'L01,000.000,075.744,229,21,B,2,0210,0200,9999,9999\n';
      const buffer = Buffer.from(content, 'utf-8');
      const result = smartDecode(buffer);

      expect(result.success).toBe(true);
      expect(result.text).toContain('9999');
    });
  });

  describe('実際のファイル形式のシミュレーション', () => {
    test('複数行のLKファイルをデコードする', () => {
      const lkContent = [
        'LK01,岩国線(下),三田尻～徳山駅出',
        'L01,000.000,075.744,229,21,B,2,0210,0200,0190,9999,0300,0150',
        'K01,000.000,001.268,229,1,616,77027,7,0',
        'EOD'
      ].join('\n');

      const buffer = Buffer.from(lkContent, 'utf-8');
      const result = smartDecode(buffer);

      expect(result.success).toBe(true);
      expect(result.text).toContain('LK01');
      expect(result.text).toContain('L01');
      expect(result.text).toContain('K01');
      expect(result.text).toContain('EOD');
    });

    test('複数行のCKファイルをデコードする', () => {
      const ckContent = [
        '#作成年月日,コース名',
        '#LK01,列車名称,列車番号',
        'BC=1.234,R=600,C=105',
        'EC=1.567',
        'BT=2.345',
        'ET=2.890',
        'EOD'
      ].join('\n');

      const buffer = Buffer.from(ckContent, 'utf-8');
      const result = smartDecode(buffer);

      expect(result.success).toBe(true);
      expect(result.text).toContain('BC=');
      expect(result.text).toContain('EC=');
      expect(result.text).toContain('BT=');
      expect(result.text).toContain('ET=');
    });
  });
});
