/**
 * ファイル形式変換API
 * File Format Conversion Routes
 *
 * サポートされている変換:
 * - DCP → RSQ (全項目一括データから項目別データへ)
 * - CSV → LABOCS (Oracle形式からLABOCS形式へ)
 * - TBL/DDB → CSV (LABOCS形式からCSV形式へ)
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const { DCPToRSQConverter } = require('../converters/dcp-to-rsq-converter');
const { OracleToLabocsConverter } = require('../converters/oracle-to-labocs-converter');
const { DCPParser } = require('../parsers/dcp-parser');
const { TBLDDBParser } = require('../parsers/tbl-ddb-parser');

/**
 * DCP → RSQ 変換
 * POST /api/conversion/dcp-to-rsq
 *
 * Request body (multipart/form-data):
 * - file: DCPファイル
 * - items: 抽出する項目のJSON配列（省略時は全項目）
 *
 * Response:
 * - success: boolean
 * - files: 変換されたRSQファイル情報配列
 */
router.post('/dcp-to-rsq', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'DCP file is required'
      });
    }

    // DCPファイルをパース
    const dcpParser = new DCPParser();
    const dcpData = dcpParser.parse(req.file.buffer);

    // 変換する項目を取得
    let itemKeys = null;
    if (req.body.items) {
      try {
        itemKeys = JSON.parse(req.body.items);
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: 'Invalid items format'
        });
      }
    }

    // DCP → RSQ 変換
    const converter = new DCPToRSQConverter();
    const rsqFiles = converter.convertToRSQFiles(dcpData, itemKeys);

    // ファイル情報をBase64エンコードして返す
    const filesData = rsqFiles.map(file => ({
      fileName: file.fileName,
      itemCode: file.itemCode,
      data: file.buffer.toString('base64'),
      size: file.buffer.length
    }));

    res.json({
      success: true,
      message: `${rsqFiles.length} RSQ files generated`,
      files: filesData,
      sourceFile: req.file.originalname,
      conversion: 'DCP → RSQ'
    });
  } catch (error) {
    console.error('DCP to RSQ conversion error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * CSV → LABOCS (TBL/DDB) 変換
 * POST /api/conversion/csv-to-labocs
 *
 * Request body (multipart/form-data):
 * - file: CSVファイル
 * - tableType: テーブル種別 (EM, JS, HS, KR, etc.)
 * - lineCode: 路線コード
 * - direction: 上下区分
 *
 * Response:
 * - success: boolean
 * - ddbFile: DDBファイル情報
 * - tblFile: TBLファイル情報
 */
router.post('/csv-to-labocs', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'CSV file is required'
      });
    }

    const { tableType, lineCode, direction } = req.body;

    if (!tableType) {
      return res.status(400).json({
        success: false,
        error: 'Table type is required'
      });
    }

    const converter = new OracleToLabocsConverter();

    // 変換実行
    const { ddbBuffer, tblBuffer } = converter.convertFromCSV(
      req.file.buffer,
      tableType
    );

    // ファイル名生成
    const { ddbFileName, tblFileName } = converter.generateFileNames(
      tableType,
      lineCode || 'TK',
      direction || 'D'
    );

    res.json({
      success: true,
      message: 'CSV to LABOCS conversion successful',
      ddbFile: {
        fileName: ddbFileName,
        data: ddbBuffer.toString('base64'),
        size: ddbBuffer.length
      },
      tblFile: {
        fileName: tblFileName,
        data: tblBuffer.toString('base64'),
        size: tblBuffer.length
      },
      sourceFile: req.file.originalname,
      conversion: 'CSV → LABOCS'
    });
  } catch (error) {
    console.error('CSV to LABOCS conversion error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * LABOCS (TBL/DDB) → CSV 変換
 * POST /api/conversion/labocs-to-csv
 *
 * Request body (multipart/form-data):
 * - ddb: DDBファイル
 * - tbl: TBLファイル
 *
 * Response:
 * - success: boolean
 * - csvFile: CSVファイル情報
 */
router.post('/labocs-to-csv', upload.fields([
  { name: 'ddb', maxCount: 1 },
  { name: 'tbl', maxCount: 1 }
]), async (req, res) => {
  try {
    if (!req.files || !req.files.ddb || !req.files.tbl) {
      return res.status(400).json({
        success: false,
        error: 'Both DDB and TBL files are required'
      });
    }

    const ddbFile = req.files.ddb[0];
    const tblFile = req.files.tbl[0];

    // LABOCS データをパース
    const parser = new TBLDDBParser();
    const labocsData = parser.parse(ddbFile.buffer, tblFile.buffer);

    // CSV形式に変換
    const csvLines = [];

    // ヘッダー行
    const headers = ['開始キロ程', '終了キロ程'];
    if (labocsData.header && labocsData.header.fields) {
      for (const field of labocsData.header.fields) {
        headers.push(field.name);
      }
    }
    csvLines.push(headers.join(','));

    // データ行
    if (labocsData.records) {
      for (const record of labocsData.records) {
        const row = [record.from || 0, record.to || 0];

        if (labocsData.header && labocsData.header.fields) {
          for (const field of labocsData.header.fields) {
            const value = record[field.name] || '';
            row.push(value);
          }
        }

        csvLines.push(row.join(','));
      }
    }

    const csvContent = csvLines.join('\r\n');
    const csvBuffer = Buffer.from(csvContent, 'utf8');

    // ファイル名生成
    const csvFileName = ddbFile.originalname.replace(/\.ddb$/i, '.csv');

    res.json({
      success: true,
      message: 'LABOCS to CSV conversion successful',
      csvFile: {
        fileName: csvFileName,
        data: csvBuffer.toString('base64'),
        size: csvBuffer.length,
        recordCount: labocsData.records ? labocsData.records.length : 0
      },
      sourceFiles: {
        ddb: ddbFile.originalname,
        tbl: tblFile.originalname
      },
      conversion: 'LABOCS → CSV'
    });
  } catch (error) {
    console.error('LABOCS to CSV conversion error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * サポートされている変換タイプを取得
 * GET /api/conversion/supported
 */
router.get('/supported', (req, res) => {
  const dcpConverter = new DCPToRSQConverter();
  const oracleConverter = new OracleToLabocsConverter();

  res.json({
    success: true,
    conversions: [
      {
        type: 'DCP_TO_RSQ',
        name: 'DCP → RSQ',
        description: '全項目一括データから項目別データへ変換',
        supportedItems: dcpConverter.getSupportedItemCodes(),
        inputFormat: 'DCP (single file)',
        outputFormat: 'RSQ (multiple files)',
        endpoint: '/api/conversion/dcp-to-rsq'
      },
      {
        type: 'CSV_TO_LABOCS',
        name: 'CSV → LABOCS',
        description: 'Oracle形式CSVからLABOCS表形式へ変換',
        supportedTableTypes: oracleConverter.getSupportedTableTypes(),
        inputFormat: 'CSV (single file)',
        outputFormat: 'TBL + DDB (2 files)',
        endpoint: '/api/conversion/csv-to-labocs'
      },
      {
        type: 'LABOCS_TO_CSV',
        name: 'LABOCS → CSV',
        description: 'LABOCS表形式からCSVへ変換',
        inputFormat: 'TBL + DDB (2 files)',
        outputFormat: 'CSV (single file)',
        endpoint: '/api/conversion/labocs-to-csv'
      }
    ]
  });
});

/**
 * DCP項目コードマッピングを取得
 * GET /api/conversion/dcp-items
 */
router.get('/dcp-items', (req, res) => {
  const converter = new DCPToRSQConverter();

  const itemDefinitions = [
    { key: 'alignment10mRight', code: '5C', name: '通り右 10m弦' },
    { key: 'alignment10mLeft', code: '6C', name: '通り左 10m弦' },
    { key: 'level10mRight', code: '1C', name: '高低右 10m弦' },
    { key: 'level10mLeft', code: '2C', name: '高低左 10m弦' },
    { key: 'eccentricRight', code: '3C', name: '偏心矢右' },
    { key: 'eccentricLeft', code: '4C', name: '偏心矢左' },
    { key: 'gauge', code: 'GC', name: '軌間' },
    { key: 'crossLevel', code: 'SC', name: '水準' },
    { key: 'atsMarker', code: 'AC', name: 'ATS検知' },
    { key: 'slope', code: 'BC', name: '勾配' },
    { key: 'jointMarkerLeft', code: 'RC', name: '継目検知左' },
    { key: 'kmMarker', code: 'PC', name: '1km検知' }
  ];

  res.json({
    success: true,
    items: itemDefinitions
  });
});

/**
 * LABOCSテーブル種別を取得
 * GET /api/conversion/labocs-tables
 */
router.get('/labocs-tables', (req, res) => {
  const converter = new OracleToLabocsConverter();
  const tableTypes = converter.getSupportedTableTypes();

  const tableDefinitions = tableTypes.map(type => {
    const def = converter.getTableDefinition(type);
    return {
      type,
      name: def.tableName,
      fields: def.fields
    };
  });

  res.json({
    success: true,
    tables: tableDefinitions
  });
});

module.exports = router;
