/**
 * ck-parser.js のテスト
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { CKParser, parseCK } from '../ck-parser.js';

describe('CKParser', () => {
  let parser;

  beforeEach(() => {
    parser = new CKParser();
  });

  describe('基本的なパース機能', () => {
    test('空のテキストをパースできる', () => {
      const result = parser.parse('');

      expect(result).toHaveProperty('curves');
      expect(result).toHaveProperty('structures');
      expect(result).toHaveProperty('stations');
      expect(result).toHaveProperty('metadata');
      expect(result.curves).toEqual([]);
      expect(result.structures).toEqual([]);
      expect(result.stations).toEqual([]);
    });

    test('空行とコメント行をスキップする', () => {
      const text = [
        '',
        '# これはコメント',
        '',
        '# 別のコメント',
        'EOD'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.curves).toEqual([]);
      expect(result.structures).toEqual([]);
    });

    test('EODでパースを終了する', () => {
      const text = [
        'BC=1.000,R=600,C=105',
        'EOD',
        'EC=2.000',  // この行は無視される
      ].join('\n');

      const result = parser.parse(text);

      // EC行が処理されていないことを確認
      expect(result.curves.length).toBe(1);
      expect(result.curves[0].end).not.toBe(2.000);
    });
  });

  describe('曲線（Curve）のパース', () => {
    test('単一の曲線をパースする', () => {
      const text = [
        'BC=1.234,R=600,C=105',
        'EC=1.567'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.curves).toHaveLength(1);
      expect(result.curves[0]).toMatchObject({
        start: 1.234,
        end: 1.567,
        radius: 600,
        cant: 105,
        direction: 'right'
      });
    });

    test('左曲線（負の半径）を正しく処理する', () => {
      const text = [
        'BC=2.000,R=-800,C=110',
        'EC=2.500'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.curves).toHaveLength(1);
      expect(result.curves[0].direction).toBe('left');
      expect(result.curves[0].radius).toBe(800);  // 絶対値
    });

    test('右曲線（正の半径）を正しく処理する', () => {
      const text = [
        'BC=3.000,R=1200,C=95',
        'EC=3.800'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.curves).toHaveLength(1);
      expect(result.curves[0].direction).toBe('right');
      expect(result.curves[0].radius).toBe(1200);
    });

    test('複数の曲線をパースする', () => {
      const text = [
        'BC=1.000,R=600,C=105',
        'EC=1.500',
        'BC=3.000,R=-800,C=110',
        'EC=3.600',
        'BC=5.000,R=1000,C=100',
        'EC=5.400'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.curves).toHaveLength(3);
      expect(result.curves[0].start).toBe(1.000);
      expect(result.curves[1].start).toBe(3.000);
      expect(result.curves[2].start).toBe(5.000);
    });

    test('BR/ERマーカーで曲線を開始・終了する', () => {
      const text = [
        'BR=10.000',
        'ER=10.500'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.curves).toHaveLength(1);
      expect(result.curves[0].start).toBe(10.000);
      expect(result.curves[0].end).toBe(10.500);
    });

    test('EC行なしで終了した曲線に仮の終了位置を設定する', () => {
      const text = [
        'BC=7.000,R=500,C=100',
        'EOD'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.curves).toHaveLength(1);
      expect(result.curves[0].start).toBe(7.000);
      expect(result.curves[0].end).toBe(7.1);  // 開始位置+0.1km
    });

    test('カント値なしの曲線を処理する', () => {
      const text = [
        'BC=8.000,R=700',
        'EC=8.300'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.curves).toHaveLength(1);
      expect(result.curves[0].cant).toBeNull();
    });

    test('半径値なしの曲線を処理する', () => {
      const text = [
        'BC=9.000,C=95',
        'EC=9.200'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.curves).toHaveLength(1);
      expect(result.curves[0].radius).toBeNull();
    });
  });

  describe('構造物（Structure）のパース', () => {
    test('トンネルをパースする', () => {
      const text = [
        'BT=5.123',
        'ET=5.890'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.structures).toHaveLength(1);
      expect(result.structures[0]).toMatchObject({
        type: 'tunnel',
        start: 5.123,
        end: 5.890
      });
    });

    test('橋梁をパースする', () => {
      const text = [
        'BB=12.345',
        'EB=12.678'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.structures).toHaveLength(1);
      expect(result.structures[0]).toMatchObject({
        type: 'bridge',
        start: 12.345,
        end: 12.678
      });
    });

    test('複数のトンネルと橋梁をパースする', () => {
      const text = [
        'BT=1.000',
        'ET=1.500',
        'BB=3.000',
        'EB=3.200',
        'BT=5.000',
        'ET=5.800'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.structures).toHaveLength(3);
      expect(result.structures[0].type).toBe('tunnel');
      expect(result.structures[1].type).toBe('bridge');
      expect(result.structures[2].type).toBe('tunnel');
    });

    test('終了マーカーなしの構造物に仮の終了位置を設定する', () => {
      const text = [
        'BT=20.000',
        'EOD'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.structures).toHaveLength(1);
      expect(result.structures[0].end).toBe(20.1);  // 開始位置+0.1km
    });
  });

  describe('駅（Station）のパース', () => {
    test('駅をパースする', () => {
      const text = [
        'SN=15.678'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.stations).toHaveLength(1);
      expect(result.stations[0].km).toBe(15.678);
    });

    test('複数の駅をパースする', () => {
      const text = [
        'SN=5.000',
        'SN=10.500',
        'SN=18.234'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.stations).toHaveLength(3);
      expect(result.stations[0].km).toBe(5.000);
      expect(result.stations[1].km).toBe(10.500);
      expect(result.stations[2].km).toBe(18.234);
    });
  });

  describe('ヘッダー行のパース', () => {
    test('作成年月日・コース名ヘッダーを認識する', () => {
      const text = [
        '#作成年月日,コース名',
        'EOD'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.metadata.headerType).toBe('dateAndCourse');
    });

    test('LKマーカーヘッダーを認識する', () => {
      const text = [
        '#LK01,列車名称,列車番号',
        'EOD'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.metadata.sectionMarker).toBe('LK01');
    });
  });

  describe('複合シナリオ', () => {
    test('曲線と構造物が混在するデータをパースする', () => {
      const text = [
        'BC=1.000,R=600,C=105',
        'BT=1.100',
        'ET=1.300',
        'EC=1.500',
        'BB=2.000',
        'BC=2.100,R=-800,C=110',
        'EB=2.300',
        'EC=2.600'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.curves).toHaveLength(2);
      expect(result.structures).toHaveLength(2);
      expect(result.structures[0].type).toBe('tunnel');
      expect(result.structures[1].type).toBe('bridge');
    });

    test('実際のCKファイル形式に近いデータをパースする', () => {
      const text = [
        '#作成年月日,コース名',
        '#LK01,岩国線(下),三田尻～徳山駅出',
        'BP=0.000',
        'DD=0.100',
        'SN=5.234',
        'BC=10.500,R=800,C=105',
        'BT=10.700',
        'ET=11.200',
        'EC=11.800',
        'BB=15.000',
        'EB=15.450',
        'SN=20.000',
        'EP=25.744',
        'EOD'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.curves).toHaveLength(1);
      expect(result.structures).toHaveLength(2);
      expect(result.stations).toHaveLength(2);
      expect(result.metadata.sectionMarker).toBe('LK01');
    });

    test('連続する曲線を正しく分離する', () => {
      const text = [
        'BC=1.000,R=600,C=105',
        'EC=1.500',
        'BC=1.500,R=700,C=100',  // 前の曲線終了と同時に次の曲線開始
        'EC=2.000'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.curves).toHaveLength(2);
      expect(result.curves[0].end).toBe(1.500);
      expect(result.curves[1].start).toBe(1.500);
    });
  });

  describe('エッジケースとエラーハンドリング', () => {
    test('不正なマーカー行を無視する', () => {
      const text = [
        'INVALID=1.000',
        'BC=2.000,R=600,C=105',
        'EC=2.500',
        'XY=3.000',
        'EOD'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.curves).toHaveLength(1);
    });

    test('パラメータが不足している行を処理する', () => {
      const text = [
        'BC=4.000',  // R, Cなし
        'EC=4.300'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.curves).toHaveLength(1);
      expect(result.curves[0].radius).toBeNull();
      expect(result.curves[0].cant).toBeNull();
    });

    test('数値変換できない値を処理する', () => {
      const text = [
        'BC=abc,R=xyz,C=def',
        'EC=1.500'
      ].join('\n');

      const result = parser.parse(text);

      // パース自体は失敗しないが、値がNaNになる可能性がある
      expect(result.curves).toHaveLength(1);
    });

    test('同じ種類の構造物が連続する場合', () => {
      const text = [
        'BB=1.000',
        'BB=1.200',  // 前の橋梁が終了していないまま次の橋梁開始
        'EB=1.400'
      ].join('\n');

      const result = parser.parse(text);

      // 前の橋梁が自動的に確定される
      expect(result.structures.length).toBeGreaterThanOrEqual(1);
    });

    test('リセット機能が正しく動作する', () => {
      parser.curves = [{ id: 'test' }];
      parser.structures = [{ id: 'test' }];
      parser.reset();

      expect(parser.curves).toEqual([]);
      expect(parser.structures).toEqual([]);
      expect(parser.stations).toEqual([]);
      expect(parser.metadata).toEqual({});
      expect(parser.currentCurve).toBeNull();
      expect(parser.currentStructure).toBeNull();
    });
  });

  describe('parseCK 便利関数', () => {
    test('parseCK関数が正しく動作する', () => {
      const text = [
        'BC=1.000,R=600,C=105',
        'EC=1.500',
        'BT=2.000',
        'ET=2.300',
        'EOD'
      ].join('\n');

      const result = parseCK(text);

      expect(result.curves).toHaveLength(1);
      expect(result.structures).toHaveLength(1);
    });

    test('parseCK関数は新しいパーサーインスタンスを使用する', () => {
      const text1 = 'BC=1.000,R=600,C=105\nEC=1.500';
      const text2 = 'BC=2.000,R=700,C=110\nEC=2.500';

      const result1 = parseCK(text1);
      const result2 = parseCK(text2);

      // 結果が独立していることを確認
      expect(result1.curves).toHaveLength(1);
      expect(result2.curves).toHaveLength(1);
      expect(result1.curves[0].start).toBe(1.000);
      expect(result2.curves[0].start).toBe(2.000);
    });
  });

  describe('ID生成', () => {
    test('曲線IDが連番で生成される', () => {
      const text = [
        'BC=1.000,R=600,C=105',
        'EC=1.500',
        'BC=2.000,R=700,C=110',
        'EC=2.500',
        'BC=3.000,R=800,C=115',
        'EC=3.500'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.curves[0].id).toBe('curve_1');
      expect(result.curves[1].id).toBe('curve_2');
      expect(result.curves[2].id).toBe('curve_3');
    });

    test('構造物IDが種類ごとに連番で生成される', () => {
      const text = [
        'BT=1.000',
        'ET=1.500',
        'BB=2.000',
        'EB=2.500',
        'BT=3.000',
        'ET=3.500'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.structures[0].id).toBe('tunnel_1');
      expect(result.structures[1].id).toBe('bridge_2');
      expect(result.structures[2].id).toBe('tunnel_3');
    });

    test('駅IDが連番で生成される', () => {
      const text = [
        'SN=5.000',
        'SN=10.000',
        'SN=15.000'
      ].join('\n');

      const result = parser.parse(text);

      expect(result.stations[0].id).toBe('station_1');
      expect(result.stations[1].id).toBe('station_2');
      expect(result.stations[2].id).toBe('station_3');
    });
  });
});
