/**
 * ファイル形式変換ページ
 * File Format Conversion Page
 */

import React from 'react';
import { FileConverter } from '../components/FileConverter';

export const FileConversionPage: React.FC = () => {
  return (
    <div className="file-conversion-page">
      <div className="page-header">
        <h1>🔄 ファイル形式変換</h1>
        <p className="page-description">
          異なるファイル形式間での双方向変換を実行します
        </p>
      </div>

      <div className="page-content">
        <FileConverter />
      </div>

      <style>{`
        .file-conversion-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #f9fafb, #f3f4f6);
          padding: 24px;
        }

        .page-header {
          max-width: 1200px;
          margin: 0 auto 32px auto;
          text-align: center;
        }

        .page-header h1 {
          margin: 0 0 12px 0;
          font-size: 36px;
          font-weight: 700;
          color: #1f2937;
        }

        .page-description {
          margin: 0;
          font-size: 16px;
          color: #6b7280;
        }

        .page-content {
          max-width: 1200px;
          margin: 0 auto;
        }
      `}</style>
    </div>
  );
};

export default FileConversionPage;
