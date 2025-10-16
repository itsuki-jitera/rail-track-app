import React, { useRef } from 'react'
import './FileUpload.css'

interface FileUploadProps {
  onFileUpload: (file: File) => void
  loading: boolean
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, loading }) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileUpload(file)
      // ファイル選択後に入力値をリセット（同じファイルの再選択を可能に）
      e.target.value = ''
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const file = e.dataTransfer.files?.[0]
    if (file && file.name.endsWith('.csv')) {
      onFileUpload(file)
    } else {
      alert('CSVファイルのみアップロード可能です')
    }
  }

  const handleClick = () => {
    // ファイルインプットをクリック前にリセット
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  return (
    <div className="file-upload">
      <div
        className="drop-zone"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".csv"
          style={{ display: 'none' }}
          disabled={loading}
        />
        <div className="drop-zone-content">
          {loading ? (
            <>
              <div className="spinner"></div>
              <p>処理中...</p>
            </>
          ) : (
            <>
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p>CSVファイルをドラッグ&amp;ドロップ</p>
              <p className="or">または</p>
              <button className="btn btn-secondary" disabled={loading}>
                ファイルを選択
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default FileUpload