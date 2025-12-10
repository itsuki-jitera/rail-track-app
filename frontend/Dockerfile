# ビルドステージ
FROM node:18-alpine as builder

WORKDIR /app

# 依存関係のコピーとインストール
COPY package*.json ./
RUN npm ci

# ソースコードのコピー
COPY . .

# ビルド
RUN npm run build

# 実行ステージ
FROM node:18-alpine

WORKDIR /app

# ビルド成果物のコピー
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# 本番用サーバーのインストール
RUN npm install -g serve

# ポート公開
EXPOSE 3000

# アプリケーション起動
CMD ["serve", "-s", "dist", "-l", "3000"]