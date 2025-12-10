/**
 * ファイルアップロードAPI
 * File upload and parsing routes
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();

// パーサー
const { RSQParser } = require('../parsers/rsq-parser');
const { HDRDATParser } = require('../parsers/hdr-dat-parser');
const { DCPParser } = require('../parsers/dcp-parser');
const { PNTParser } = require('../parsers/pnt-parser');
const { TBLDDBParser } = require('../parsers/tbl-ddb-parser');

// Multer設定
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.rsq', '.hdr', '.dat', '.dcp', '.pnt', '.tbl', '.ddb', '.csv'];

    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}`));
    }
  }
});

/**
 * RSQファイルアップロード
 * POST /api/files/upload-rsq
 */
router.post('/upload-rsq', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const buffer = await fs.readFile(req.file.path);
    const parser = new RSQParser();
    const rsqData = parser.parse(buffer);
    const measurementData = parser.toMeasurementData(rsqData);

    // ファイル削除
    await fs.unlink(req.file.path);

    res.json({
      success: true,
      filename: req.file.originalname,
      header: rsqData.header,
      dataPoints: measurementData.length,
      measurementData,
      dataType: parser.getDataTypeName(rsqData.header.dataType)
    });
  } catch (error) {
    console.error('RSQ parse error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * HDR/DATファイルアップロード
 * POST /api/files/upload-hdrdat
 */
router.post('/upload-hdrdat', upload.fields([
  { name: 'hdr', maxCount: 1 },
  { name: 'dat', maxCount: 1 }
]), async (req, res) => {
  try {
    const hdrFile = req.files?.hdr?.[0];
    const datFile = req.files?.dat?.[0];

    if (!hdrFile || !datFile) {
      return res.status(400).json({
        success: false,
        error: 'Both HDR and DAT files are required'
      });
    }

    const hdrBuffer = await fs.readFile(hdrFile.path);
    const datBuffer = await fs.readFile(datFile.path);

    const parser = new HDRDATParser();
    const hdrDatData = parser.parse(hdrBuffer, datBuffer);
    const measurementData = parser.toMeasurementData(hdrDatData);

    // ファイル削除
    await fs.unlink(hdrFile.path);
    await fs.unlink(datFile.path);

    res.json({
      success: true,
      filename: `${hdrFile.originalname} + ${datFile.originalname}`,
      header: hdrDatData.header,
      dataPoints: measurementData.length,
      measurementData,
      dataType: parser.getDataTypeName(hdrDatData.header.dataType)
    });
  } catch (error) {
    console.error('HDR/DAT parse error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DCPファイルアップロード
 * POST /api/files/upload-dcp
 */
router.post('/upload-dcp', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const buffer = await fs.readFile(req.file.path);
    const parser = new DCPParser();
    const dcpData = parser.parse(buffer);

    // 全項目のデータを抽出
    const itemDefinitions = parser.getAllItemDefinitions();
    const extractedItems = {};

    for (const itemDef of itemDefinitions) {
      try {
        extractedItems[itemDef.key] = parser.extractItem(dcpData, itemDef.key);
      } catch (error) {
        console.warn(`Failed to extract ${itemDef.key}:`, error.message);
      }
    }

    // ファイル削除
    await fs.unlink(req.file.path);

    res.json({
      success: true,
      filename: req.file.originalname,
      header: dcpData.header,
      dataPoints: dcpData.header.dataPoints,
      items: extractedItems,
      availableItems: itemDefinitions.map(d => ({
        key: d.key,
        code: d.code,
        name: d.name
      }))
    });
  } catch (error) {
    console.error('DCP parse error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PNTファイルアップロード
 * POST /api/files/upload-pnt
 */
router.post('/upload-pnt', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const buffer = await fs.readFile(req.file.path);
    const parser = new PNTParser();
    const pntData = parser.parse(buffer);

    // ファイル削除
    await fs.unlink(req.file.path);

    res.json({
      success: true,
      filename: req.file.originalname,
      lineCode: pntData.lineCode,
      direction: pntData.direction,
      points: pntData.points,
      pointCount: pntData.points.length
    });
  } catch (error) {
    console.error('PNT parse error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * TBL/DDBファイルアップロード
 * POST /api/files/upload-tblddb
 */
router.post('/upload-tblddb', upload.fields([
  { name: 'ddb', maxCount: 1 },
  { name: 'tbl', maxCount: 1 }
]), async (req, res) => {
  try {
    const ddbFile = req.files?.ddb?.[0];
    const tblFile = req.files?.tbl?.[0];

    if (!ddbFile || !tblFile) {
      return res.status(400).json({
        success: false,
        error: 'Both DDB and TBL files are required'
      });
    }

    const ddbBuffer = await fs.readFile(ddbFile.path);
    const tblBuffer = await fs.readFile(tblFile.path);

    const parser = new TBLDDBParser();
    const tblData = parser.parse(ddbBuffer, tblBuffer);

    // テーブル種別に応じた特化パース
    let specializedData = null;
    const tableType = tblData.header.tableType;

    switch (tableType) {
      case 'EM':
        specializedData = parser.parseStationData(tblData);
        break;
      case 'JS':
        specializedData = parser.parseSlopeData(tblData);
        break;
      case 'HS':
        specializedData = parser.parseCurveData(tblData);
        break;
      case 'KR':
        specializedData = parser.parseStructureData(tblData);
        break;
    }

    // ファイル削除
    await fs.unlink(ddbFile.path);
    await fs.unlink(tblFile.path);

    res.json({
      success: true,
      filename: `${ddbFile.originalname} + ${tblFile.originalname}`,
      header: tblData.header,
      records: tblData.records,
      recordCount: tblData.records.length,
      tableTypeName: parser.getTableTypeName(tableType),
      specializedData
    });
  } catch (error) {
    console.error('TBL/DDB parse error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ファイル情報取得
 * GET /api/files/list
 */
router.get('/list', async (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, '../../uploads');
    const files = await fs.readdir(uploadsDir);

    const fileInfos = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(uploadsDir, file);
        const stats = await fs.stat(filePath);

        return {
          name: file,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      })
    );

    res.json({
      success: true,
      files: fileInfos,
      count: fileInfos.length
    });
  } catch (error) {
    console.error('File list error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
