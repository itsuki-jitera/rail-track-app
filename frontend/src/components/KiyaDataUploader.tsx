/**
 * キヤデータアップロードコンポーネント
 * CK/LKファイルのドラッグ&ドロップアップロード
 */
import React, { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useKiyaStore } from '../stores/kiyaStore'
import '../styles/KiyaDataUploader.css'

export const KiyaDataUploader: React.FC = () => {
  const { uploadKiyaFile, isLoading, error } = useKiyaStore()

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    const file = acceptedFiles[0]

    // ファイル名チェック（CK*.csv または LK*.csv）
    const fileName = file.name.toUpperCase()
    if (!fileName.endsWith('.CSV')) {
      alert('CSVファイルを選択してください')
      return
    }

    if (!fileName.startsWith('CK') && !fileName.startsWith('LK')) {
      alert('CKまたはLKで始まるファイルを選択してください')
      return
    }

    try {
      await uploadKiyaFile(file)
    } catch (err) {
      console.error('Upload error:', err)
    }
  }, [uploadKiyaFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    multiple: false,
    disabled: isLoading
  })

  return (
    <div className="kiya-uploader">
      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive ? 'active' : ''} ${isLoading ? 'loading' : ''}`}
      >
        <input {...getInputProps()} />

        {isLoading ? (
          <div className="upload-status">
            <div className="spinner"></div>
            <p>アップロード中...</p>
          </div>
        ) : (
          <div className="upload-prompt">
            <svg className="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            {isDragActive ? (
              <p className="drag-active">ここにドロップしてください</p>
            ) : (
              <>
                <p className="drag-prompt">
                  キヤデータファイル（CK*.csv / LK*.csv）をドラッグ&ドロップ
                </p>
                <p className="click-prompt">
                  または<span className="link">クリックして選択</span>
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          <svg className="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
