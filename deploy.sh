#!/bin/bash

echo "🚀 Railway Track App Deployment Script"
echo "======================================"

# 環境変数チェック
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "✅ .env file created. Please update it with your settings."
fi

# Dockerを使用したデプロイ
if command -v docker &> /dev/null; then
    echo "🐳 Docker found. Starting deployment..."

    # ビルドと起動
    docker-compose build
    docker-compose up -d

    echo "✅ Application deployed with Docker!"
    echo "📍 Frontend: http://localhost:3000"
    echo "📍 Backend: http://localhost:3002"
    echo "📍 Nginx Proxy: http://localhost:80"
else
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi

echo ""
echo "======================================"
echo "🎉 Deployment Complete!"