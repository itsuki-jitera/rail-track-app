/**
 * lk-parser.js のテスト
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { LKParser, parseLK } from '../lk-parser.js';

describe('LKParser', () => {
  let parser;

  beforeEach(() => {
    parser = new LKParser();
  });

  describe('基本的なパース機能', () => {
    test('空のテキストをパースできる', () => {
      const result = parser.parse('');

      expect(result).toHaveProperty('sections');
      expect(result).toHaveProperty('managementValues');
      expect(result).toHaveProperty('managementSections');
      expect(result.sections).toEqual([]);
      expect(result.managementValues).toEqual([]);
      expect(result.managementSections).toEqual([]);
    });

    test('空行をスキップする', () => {
      const text = [
        '',
        'LK01,岩国線(下),三田尻～徳山駅出',
        '',
        'EOD'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.sections).toHaveLength(1);
    });

    test('コメント行をスキップする', () => {
      const text = [
        '# これはコメント',
        'LK01,岩国線(下),三田尻～徳山駅出',
        '# 別のコメント',
        'EOD'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.sections).toHaveLength(1);
    });

    test('EODでパースを終了する', () => {
      const text = [
        'LK01,岩国線(下),三田尻～徳山駅出',
        'EOD',
        'LK02,別の線区,別の区間'  // この行は無視される
      ].join('\n');

      const result = parser.parse(text);

      expect(result.sections).toHaveLength(1);
    });
  });

  describe('LK行（区間定義）のパース', () => {
    test('単一のLK行をパースする', () => {
      const text = 'LK01,岩国線(下),三田尻～徳山駅出';
      const result = parser.parse(text);

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0]).toMatchObject({
        marker: 'LK01',
        routeName: '岩国線(下)',
        sectionName: '三田尻～徳山駅出'
      });
    });

    test('複数のLK行をパースする', () => {
      const text = [
        'LK01,岩国線(下),三田尻～徳山駅出',
        'LK02,山陽線(上),広島～岩国',
        'LK03,山陽線(下),岩国～広島'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.sections).toHaveLength(3);
      expect(result.sections[0].marker).toBe('LK01');
      expect(result.sections[1].marker).toBe('LK02');
      expect(result.sections[2].marker).toBe('LK03');
    });

    test('フィールドが不足しているLK行を処理する', () => {
      const text = 'LK01,岩国線(下)';
      const result = parser.parse(text);

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].marker).toBe('LK01');
      expect(result.sections[0].routeName).toBe('岩国線(下)');
      expect(result.sections[0].sectionName).toBe('');
    });
  });

  describe('L行（管理値）のパース', () => {
    test('基本的な管理値をパースする', () => {
      const text = 'L01,000.000,075.744,229,21,B,2,0210,0200,0190,9999,0300,0150,0200,0200';
      const result = parser.parse(text);

      expect(result.managementValues).toHaveLength(1);
      const value = result.managementValues[0];

      expect(value.marker).toBe('L01');
      expect(value.startKm).toBe(0.000);
      expect(value.endKm).toBe(75.744);
      expect(value.lineCode).toBe('229');
      expect(value.routeCode).toBe('21');
      expect(value.construction).toBe('B');
      expect(value.type).toBe('2');
    });

    test('直線部管理値を正しくパースする', () => {
      const text = 'L01,000.000,075.744,229,21,B,2,0210,0200,0190,9999,0300,0150,0200,0200';
      const result = parser.parse(text);

      const value = result.managementValues[0];

      expect(value.standard10m).toBe(210);
      expect(value.straightness10m).toBe(200);
      expect(value.gauge).toBe(190);
      expect(value.elevation).toBeNull();  // 9999は無効値
      expect(value.levelPlus).toBe(300);
      expect(value.levelMinus).toBe(150);
      expect(value.trackUpDown).toBe(200);
      expect(value.trackLeftRight).toBe(200);
    });

    test('9999（無効値）をnullに変換する', () => {
      const text = 'L01,000.000,075.744,229,21,B,2,9999,9999,9999,9999,9999,9999,9999,9999';
      const result = parser.parse(text);

      const value = result.managementValues[0];

      expect(value.standard10m).toBeNull();
      expect(value.straightness10m).toBeNull();
      expect(value.gauge).toBeNull();
      expect(value.elevation).toBeNull();
    });

    test('予備の管理値セット（2組目）をパースする', () => {
      const text = 'L01,000.000,075.744,229,21,B,2,0210,0200,0190,9999,0300,0150,0200,0200,0220,0210,0195,9999,0310,0160,0210,0210';
      const result = parser.parse(text);

      const value = result.managementValues[0];

      expect(value.standard10m2).toBe(220);
      expect(value.straightness10m2).toBe(210);
      expect(value.gauge2).toBe(195);
      expect(value.elevation2).toBeNull();  // 9999
    });

    test('曲線部管理値をパースする', () => {
      const text = 'L01,000.000,075.744,229,21,B,2,0210,0200,0190,9999,0300,0150,0200,0200,0220,0210,0195,9999,0310,0160,0210,0210,0250,0180,0170,0160,0190,0185';
      const result = parser.parse(text);

      const value = result.managementValues[0];

      expect(value.curveStandard).toBe(250);
      expect(value.straightness).toBe(180);
      expect(value.irregularity).toBe(170);
      expect(value.sharpness).toBe(160);
      expect(value.curveUpDown).toBe(190);
      expect(value.curveLeftRight).toBe(185);
    });

    test('複数のL行をパースする', () => {
      const text = [
        'L01,000.000,075.744,229,21,B,2,0210,0200,0190,9999,0300,0150,0200,0200',
        'L02,075.744,150.000,229,21,B,2,0220,0210,0195,9999,0310,0160,0210,0210',
        'L03,150.000,200.000,229,21,B,2,0230,0220,0200,9999,0320,0170,0220,0220'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.managementValues).toHaveLength(3);
      expect(result.managementValues[0].marker).toBe('L01');
      expect(result.managementValues[1].marker).toBe('L02');
      expect(result.managementValues[2].marker).toBe('L03');
    });

    test('フィールドが不足しているL行を処理する', () => {
      const text = 'L01,000.000,075.744,229,21';
      const result = parser.parse(text);

      expect(result.managementValues).toHaveLength(1);
      const value = result.managementValues[0];

      expect(value.marker).toBe('L01');
      expect(value.startKm).toBe(0.000);
      expect(value.endKm).toBe(75.744);
      expect(value.standard10m).toBeNull();  // フィールドなし
    });
  });

  describe('K行（管理区間）のパース', () => {
    test('基本的な管理区間をパースする', () => {
      const text = 'K01,000.000,001.268,229,1,616,77027,7,0';
      const result = parser.parse(text);

      expect(result.managementSections).toHaveLength(1);
      const section = result.managementSections[0];

      expect(section.marker).toBe('K01');
      expect(section.startKm).toBe(0.000);
      expect(section.endKm).toBe(1.268);
      expect(section.lineCode).toBe('229');
      expect(section.division).toBe('1');
      expect(section.workArea).toBe('616');
      expect(section.workNumber).toBe('77027');
      expect(section.flag1).toBe('7');
      expect(section.flag2).toBe('0');
    });

    test('複数のK行をパースする', () => {
      const text = [
        'K01,000.000,001.268,229,1,616,77027,7,0',
        'K02,001.268,005.000,229,1,617,77028,7,0',
        'K03,005.000,010.000,229,1,618,77029,7,0'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.managementSections).toHaveLength(3);
      expect(result.managementSections[0].marker).toBe('K01');
      expect(result.managementSections[1].marker).toBe('K02');
      expect(result.managementSections[2].marker).toBe('K03');
    });

    test('フィールドが不足しているK行を処理する', () => {
      const text = 'K01,000.000,001.268,229';
      const result = parser.parse(text);

      expect(result.managementSections).toHaveLength(1);
      const section = result.managementSections[0];

      expect(section.marker).toBe('K01');
      expect(section.startKm).toBe(0.000);
      expect(section.endKm).toBe(1.268);
      expect(section.division).toBe('');
    });
  });

  describe('parseValue メソッド', () => {
    test('通常の数値を正しくパースする', () => {
      const value = parser.parseValue('0210');
      expect(value).toBe(210);
    });

    test('9999をnullに変換する', () => {
      const value = parser.parseValue('9999');
      expect(value).toBeNull();
    });

    test('空文字列をnullに変換する', () => {
      const value = parser.parseValue('');
      expect(value).toBeNull();
    });

    test('数値変換できない文字列をnullに変換する', () => {
      const value = parser.parseValue('abc');
      expect(value).toBeNull();
    });

    test('0を正しく処理する', () => {
      const value = parser.parseValue('0');
      expect(value).toBe(0);
    });

    test('負の数値を正しく処理する', () => {
      const value = parser.parseValue('-100');
      expect(value).toBe(-100);
    });
  });

  describe('複合シナリオ', () => {
    test('LK, L, K行が混在するデータをパースする', () => {
      const text = [
        'LK01,岩国線(下),三田尻～徳山駅出',
        'L01,000.000,075.744,229,21,B,2,0210,0200,0190,9999,0300,0150,0200,0200',
        'K01,000.000,001.268,229,1,616,77027,7,0',
        'L02,075.744,150.000,229,21,B,2,0220,0210,0195,9999,0310,0160,0210,0210',
        'K02,001.268,005.000,229,1,617,77028,7,0',
        'EOD'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.sections).toHaveLength(1);
      expect(result.managementValues).toHaveLength(2);
      expect(result.managementSections).toHaveLength(2);
    });

    test('実際のLKファイル形式に近いデータをパースする', () => {
      const text = [
        '# コメント行',
        'LK01,岩国線(下),三田尻～徳山駅出',
        '',
        'L01,000.000,075.744,229,21,B,2,0210,0200,0190,9999,0300,0150,0200,0200,0220,0210,0195,9999,0310,0160,0210,0210,0250,0180,0170,0160,0190,0185',
        'L02,075.744,150.000,229,21,B,2,0220,0210,0195,9999,0310,0160,0210,0210,0230,0220,0200,9999,0320,0170,0220,0220,0260,0190,0180,0170,0200,0195',
        '',
        'K01,000.000,001.268,229,1,616,77027,7,0',
        'K02,001.268,005.000,229,1,617,77028,7,0',
        'K03,005.000,010.000,229,1,618,77029,7,0',
        '',
        'EOD'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.sections).toHaveLength(1);
      expect(result.managementValues).toHaveLength(2);
      expect(result.managementSections).toHaveLength(3);

      // 詳細な値の検証
      const firstValue = result.managementValues[0];
      expect(firstValue.startKm).toBe(0.000);
      expect(firstValue.endKm).toBe(75.744);
      expect(firstValue.curveStandard).toBe(250);
      expect(firstValue.curveLeftRight).toBe(185);
    });
  });

  describe('エッジケースとエラーハンドリング', () => {
    test('L で始まるがL行でない行を無視する', () => {
      const text = [
        'LABEL=test',
        'L01,000.000,075.744,229,21,B,2,0210,0200,0190,9999,0300,0150,0200,0200',
        'EOD'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.managementValues).toHaveLength(1);
    });

    test('K で始まるがK行でない行を無視する', () => {
      const text = [
        'KEY=value',
        'K01,000.000,001.268,229,1,616,77027,7,0',
        'EOD'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.managementSections).toHaveLength(1);
    });

    test('すべてのフィールドが空の行を処理する', () => {
      const text = 'L01,,,,,,,,,,,,,';
      const result = parser.parse(text);

      expect(result.managementValues).toHaveLength(1);
      const value = result.managementValues[0];

      expect(value.marker).toBe('L01');
      expect(value.startKm).toBe(0);  // parseFloat('') = 0
      expect(value.standard10m).toBeNull();
    });

    test('先頭・末尾に空白がある行を正しく処理する', () => {
      const text = '  L01 , 000.000 , 075.744 , 229 , 21 , B , 2 , 0210 , 0200 , 0190 , 9999  ';
      const result = parser.parse(text);

      expect(result.managementValues).toHaveLength(1);
      const value = result.managementValues[0];

      expect(value.marker).toBe('L01');
      expect(value.standard10m).toBe(210);
    });

    test('小数点以下のキロ程を正しく処理する', () => {
      const text = 'L01,123.456,789.012,229,21,B,2,0210,0200,0190,9999,0300,0150,0200,0200';
      const result = parser.parse(text);

      const value = result.managementValues[0];

      expect(value.startKm).toBe(123.456);
      expect(value.endKm).toBe(789.012);
    });

    test('マーカー番号が3桁の場合を処理する', () => {
      const text = [
        'L99,000.000,075.744,229,21,B,2,0210,0200,0190,9999,0300,0150,0200,0200',
        'L100,075.744,150.000,229,21,B,2,0220,0210,0195,9999,0310,0160,0210,0210'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.managementValues).toHaveLength(2);
      expect(result.managementValues[0].marker).toBe('L99');
      expect(result.managementValues[1].marker).toBe('L100');
    });
  });

  describe('parseLK 便利関数', () => {
    test('parseLK関数が正しく動作する', () => {
      const text = [
        'LK01,岩国線(下),三田尻～徳山駅出',
        'L01,000.000,075.744,229,21,B,2,0210,0200,0190,9999,0300,0150,0200,0200',
        'K01,000.000,001.268,229,1,616,77027,7,0',
        'EOD'
      ].join('\n');

      const result = parseLK(text);

      expect(result.sections).toHaveLength(1);
      expect(result.managementValues).toHaveLength(1);
      expect(result.managementSections).toHaveLength(1);
    });

    test('parseLK関数は新しいパーサーインスタンスを使用する', () => {
      const text1 = 'LK01,岩国線(下),三田尻～徳山駅出';
      const text2 = 'LK02,山陽線(上),広島～岩国';

      const result1 = parseLK(text1);
      const result2 = parseLK(text2);

      // 結果が独立していることを確認
      expect(result1.sections).toHaveLength(1);
      expect(result2.sections).toHaveLength(1);
      expect(result1.sections[0].marker).toBe('LK01');
      expect(result2.sections[0].marker).toBe('LK02');
    });
  });

  describe('データ整合性', () => {
    test('管理値の区間が連続していることを確認できる', () => {
      const text = [
        'L01,000.000,075.744,229,21,B,2,0210,0200,0190,9999,0300,0150,0200,0200',
        'L02,075.744,150.000,229,21,B,2,0220,0210,0195,9999,0310,0160,0210,0210',
        'L03,150.000,200.000,229,21,B,2,0230,0220,0200,9999,0320,0170,0220,0220'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.managementValues).toHaveLength(3);

      // 連続性を確認
      expect(result.managementValues[0].endKm).toBe(result.managementValues[1].startKm);
      expect(result.managementValues[1].endKm).toBe(result.managementValues[2].startKm);
    });

    test('管理区間の区間が連続していることを確認できる', () => {
      const text = [
        'K01,000.000,001.268,229,1,616,77027,7,0',
        'K02,001.268,005.000,229,1,617,77028,7,0',
        'K03,005.000,010.000,229,1,618,77029,7,0'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.managementSections).toHaveLength(3);

      // 連続性を確認
      expect(result.managementSections[0].endKm).toBe(result.managementSections[1].startKm);
      expect(result.managementSections[1].endKm).toBe(result.managementSections[2].startKm);
    });
  });
});
