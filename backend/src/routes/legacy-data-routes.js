/**
 * レガシーデータ（MDT/O010）ルート
 * Legacy Data (MDT/O010) Routes
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { parseMDTFile } = require('../parsers/mdt-parser');
const { parseO010CSV } = require('../parsers/o010-parser');
const { convertO010ToStandard } = require('../utils/convertO010');

const router = express.Router();

// Multer設定
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/legacy');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    cb(null, `${basename}_${timestamp}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

/**
 * POST /api/legacy-data/upload
 * MDT/O010ファイルアップロード
 */
router.post('/upload', upload.fields([
  { name: 'mdt', maxCount: 1 },
  { name: 'o010', maxCount: 1 }
]), async (req, res) => {
  try {
    const mdtFile = req.files?.mdt?.[0];
    const o010File = req.files?.o010?.[0];

    if (!mdtFile && !o010File) {
      return res.status(400).json({
        success: false,
        error: 'MDTまたはO010ファイルが必要です'
      });
    }

    const response = {
      success: true,
      mdtData: null,
      o010Data: null,
      multiMeasurementData: null
    };

    // MDTファイルの処理
    if (mdtFile) {
      try {
        const mdtBuffer = await fs.readFile(mdtFile.path);
        const mdtResult = parseMDTFile(mdtBuffer);

        if (mdtResult.success) {
          response.mdtData = mdtResult.data;
          console.log('✓ MDTファイル解析成功:', mdtFile.originalname);
        } else {
          console.warn('MDT parsing warning:', mdtResult.error);
        }
      } catch (error) {
        console.error('MDT parsing error:', error);
      } finally {
        // ファイルを削除
        await fs.unlink(mdtFile.path).catch(err =>
          console.warn('Failed to delete MDT file:', err)
        );
      }
    }

    // O010ファイルの処理
    if (o010File) {
      try {
        const o010Buffer = await fs.readFile(o010File.path);
        const o010Result = parseO010CSV(o010Buffer);

        if (o010Result.success) {
          response.o010Data = o010Result.data;

          // 標準形式に変換
          const standardData = convertO010ToStandard(o010Result);
          response.multiMeasurementData = standardData;

          console.log(`✓ O010ファイル解析成功: ${o010File.originalname}`);
          console.log(`  データ点数: ${standardData?.length || 0}`);
        } else {
          console.warn('O010 parsing warning:', o010Result.error);
        }
      } catch (error) {
        console.error('O010 parsing error:', error);
      } finally {
        // ファイルを削除
        await fs.unlink(o010File.path).catch(err =>
          console.warn('Failed to delete O010 file:', err)
        );
      }
    }

    res.json(response);

  } catch (error) {
    console.error('Legacy data upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'ファイル処理中にエラーが発生しました'
    });
  }
});

/**
 * POST /api/legacy-data/parse-mdt
 * MDTファイル単体の解析
 */
router.post('/parse-mdt', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'MDTファイルが必要です'
      });
    }

    const mdtBuffer = await fs.readFile(req.file.path);
    const result = parseMDTFile(mdtBuffer);

    // ファイルを削除
    await fs.unlink(req.file.path).catch(err =>
      console.warn('Failed to delete file:', err)
    );

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('MDT parse error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/legacy-data/parse-o010
 * O010ファイル単体の解析
 */
router.post('/parse-o010', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'O010ファイルが必要です'
      });
    }

    const o010Buffer = await fs.readFile(req.file.path);
    const result = parseO010CSV(o010Buffer);

    // ファイルを削除
    await fs.unlink(req.file.path).catch(err =>
      console.warn('Failed to delete file:', err)
    );

    if (result.success) {
      // 標準形式に変換
      const standardData = convertO010ToStandard(result);

      res.json({
        success: true,
        data: result.data,
        multiMeasurementData: standardData
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('O010 parse error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/legacy-data/info
 * レガシーデータ処理情報
 */
router.get('/info', (req, res) => {
  res.json({
    success: true,
    info: {
      supportedFormats: {
        mdt: {
          description: 'MDT形式（ヘッダーファイル）',
          extensions: ['.mdt', '.MDT'],
          encoding: 'Shift-JIS'
        },
        o010: {
          description: 'O010形式（測定データファイル）',
          extensions: ['.csv', '.CSV'],
          pattern: 'O010*.csv',
          encoding: 'Shift-JIS'
        }
      },
      measurementTypes: {
        versine_left: '左高低',
        versine_right: '右高低',
        lateral_left: '左通り',
        lateral_right: '右通り',
        gauge: '軌間',
        cross_level: '水準',
        twist: 'ねじれ',
        pitch: 'ピッチ'
      },
      version: '1.0.0'
    }
  });
});

module.exports = router;