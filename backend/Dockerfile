# Node.js ベースイメージ
FROM node:18-alpine

# 作業ディレクトリ設定
WORKDIR /app

# 依存関係ファイルのコピー
COPY package*.json ./

# 本番用依存関係のインストール
RUN npm ci --only=production

# アプリケーションコードのコピー
COPY . .

# uploadsディレクトリの作成
RUN mkdir -p uploads

# ポート公開
EXPOSE 3002

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})"

# アプリケーション起動
CMD ["npm", "start"]