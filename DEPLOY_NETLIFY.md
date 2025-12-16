# Netlify デプロイガイド

## 📌 重要な確認事項

本アプリケーションは以下の2つの部分で構成されています：
1. **フロントエンド（React）** - Netlifyで静的サイトとしてホスト
2. **バックエンドAPI（Node.js/Express）** - 別途ホスティングが必要

**データ共有機能について**：
- キヤデータページでアップロードしたデータ（O010、CK、LK）は、React Context APIとLocalStorageを使用してクライアント側で保存されます
- このため、**Netlifyデプロイでもデータ共有機能は正常に動作します**
- ただし、ファイル処理や復元波形計算などの機能にはバックエンドAPIが必要です

## 🚀 デプロイ方法

### 1. Netlifyへのフロントエンドのデプロイ

#### 方法A: Netlify CLIを使用（推奨）

```bash
# Netlify CLIをインストール
npm install -g netlify-cli

# プロジェクトのルートディレクトリで実行
cd rail-track-app

# Netlifyにログイン
netlify login

# デプロイ
netlify deploy

# 本番環境にデプロイ
netlify deploy --prod
```

#### 方法B: GitHubと連携

1. このプロジェクトをGitHubにプッシュ
2. Netlifyダッシュボードにログイン
3. "New site from Git"をクリック
4. GitHubリポジトリを選択
5. ビルド設定:
   - Base directory: `/`
   - Build command: `cd frontend && npm install && npm run build`
   - Publish directory: `frontend/dist`

### 2. 環境変数の設定

Netlifyダッシュボードで以下の環境変数を設定：

1. Netlifyダッシュボードにログイン
2. サイト設定 → Environment variables
3. 以下の変数を追加：

```
VITE_API_URL = [バックエンドAPIのURL]
```

**バックエンドAPIのURL例**：
- Heroku: `https://your-app.herokuapp.com`
- Railway: `https://your-app.up.railway.app`
- Render: `https://your-app.onrender.com`
- AWS: `https://your-api.amazonaws.com`
- Azure: `https://your-app.azurewebsites.net`

### 3. バックエンドAPIのデプロイオプション

#### オプション1: Railway（推奨 - 簡単）

```bash
# Railway CLIをインストール
npm install -g @railway/cli

# backendディレクトリで実行
cd rail-track-app/backend

# Railwayにデプロイ
railway login
railway init
railway up

# 環境変数を設定
railway variables set PORT=3003
railway variables set CORS_ORIGIN=https://your-netlify-site.netlify.app
```

#### オプション2: Heroku

```bash
# Heroku CLIをインストールしてログイン
heroku login

# backendディレクトリで実行
cd rail-track-app/backend

# Herokuアプリを作成
heroku create your-app-name

# デプロイ
git push heroku main

# 環境変数を設定
heroku config:set CORS_ORIGIN=https://your-netlify-site.netlify.app
```

#### オプション3: Render

1. [Render](https://render.com)にログイン
2. New → Web Service
3. GitHubリポジトリを接続
4. 設定:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
5. 環境変数:
   - `PORT`: 3003
   - `CORS_ORIGIN`: `https://your-netlify-site.netlify.app`

### 4. CORS設定の更新

バックエンドの `backend/server.js` または `backend/index.js` で、CORS設定を更新：

```javascript
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
```

## 📝 デプロイ後の確認事項

1. **API接続確認**
   - ブラウザの開発者ツール（F12）でネットワークタブを開く
   - APIリクエストが正しいURLに送信されているか確認

2. **データ共有機能確認**
   - キヤデータページでファイルをアップロード
   - 他のページ（復元波形、曲線諸元管理）でデータが自動的に利用可能か確認

3. **LocalStorage確認**
   - ブラウザの開発者ツール → Application → Local Storage
   - `railtrack_workspace`キーでデータが保存されているか確認

## 🔧 トラブルシューティング

### API接続エラー

```
エラー: Network Error
```

**解決方法**：
1. バックエンドAPIが起動しているか確認
2. VITE_API_URL環境変数が正しく設定されているか確認
3. CORS設定が正しいか確認

### データ共有が機能しない

**解決方法**：
1. ブラウザのLocalStorageをクリア
2. ページをリロード
3. 再度ファイルをアップロード

### ビルドエラー

```
エラー: Module not found
```

**解決方法**：
1. `frontend`ディレクトリで `npm install` を実行
2. 依存関係が正しくインストールされているか確認

## 📱 ローカル開発とNetlifyの切り替え

開発環境と本番環境で異なるAPIを使用する場合：

```javascript
// frontend/src/config/api.ts
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3003';
```

これにより：
- ローカル開発時: `http://localhost:3003`
- Netlifyデプロイ時: 環境変数で指定したURL

## 🔒 セキュリティ上の注意

1. **APIキーや秘密情報は環境変数で管理**
2. **CORS設定で許可するオリジンを制限**
3. **HTTPSを使用（NetlifyとバックエンドAPI両方）**
4. **機密データはLocalStorageではなくセキュアな方法で保存**

## 📞 サポート

問題が発生した場合は、以下の情報を含めてイシューを報告してください：
- ブラウザのコンソールエラー
- ネットワークタブのエラーレスポンス
- 環境変数の設定（APIキーなどの機密情報は除く）
- デプロイ方法とプラットフォーム