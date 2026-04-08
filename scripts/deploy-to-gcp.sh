#!/bin/bash
# GCP 部署腳本
# 自動化將本機的 Discord 音樂機器人推送到 GCP 虛擬機上並啟動

echo "=========================================================="
echo "🚀 開始全自動傳送並部署服務到 GCP"
echo "=========================================================="

GCP_USER="abc12david"
GCP_IP="35.212.184.62"
KEY_PATH="$HOME/.ssh/id_rsa"
DEST_DIR="~/discord-music-bot"

echo "📦 1. 正在透過 Rsync 同步檔案 (這可能需要幾分鐘，若有圖形化密碼提示請同意)..."
rsync -avz --progress \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='node' \
    --exclude='.npm-cache' \
    --exclude='.ytdlp-cache' \
    --exclude='.DS_Store' \
    -e "ssh -i $KEY_PATH -o StrictHostKeyChecking=no" \
    ./ $GCP_USER@$GCP_IP:$DEST_DIR/

if [ $? -ne 0 ]; then
    echo "❌ 檔案傳輸失敗，請確認網路連線與金鑰權限。"
    exit 1
fi
echo "✅ 檔案傳輸完成！"

echo "----------------------------------------------------------"
echo "⚙️  2. 開始在 GCP 主機上安裝 Node.js 與環境依賴..."
ssh -o StrictHostKeyChecking=no -i $KEY_PATH $GCP_USER@$GCP_IP << 'ENDSSH'
    echo "   [遠端] 正在更新套件庫..."
    sudo apt-get update -y
    
    echo "   [遠端] 正在安裝 Node.js、ffmpeg 及編譯工具 (這會花一點時間)..."
    sudo apt-get install -y curl
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs build-essential ffmpeg python3
    
    echo "   [遠端] 正在安裝全域 pm2..."
    sudo npm install -g pm2
    
    echo "   [遠端] 開始安裝專案 NPM 套件..."
    cd ~/discord-music-bot
    npm install --omit=dev
    
    echo "   [遠端] 部署 Discord Slash Commands..."
    cd ~/discord-music-bot
    node scripts/deploy-commands.js
    
    echo "   [遠端] 使用 PM2 啟動機器人..."
    pm2 stop music-bot || true
    pm2 start npm --name "music-bot" -- run start
    pm2 save
ENDSSH

echo "=========================================================="
echo "🎉 部署完成！"
echo "您的機器人已經在 GCP 上以背景模式 (pm2) 運作中了！"
echo "您可以透過輸入: 'ssh $GCP_USER@$GCP_IP pm2 logs music-bot' 來即時監控日誌哦！"
echo "=========================================================="
