#!/bin/bash
# =========================================
# Oracle Cloud A1.Flex 自動搶資源腳本 (進階版)
# =========================================

# ---- 設定區域（請勿修改） ----
COMPARTMENT_ID="ocid1.tenancy.oc1..aaaaaaaaqjvfojmefton5qh3flsllz2qo275y5aywtshgxf6sesth2stabga"
AVAILABILITY_DOMAIN="WPct:AP-KULAI-2-AD-1"
IMAGE_ID="ocid1.image.oc1.ap-kulai-2.aaaaaaaaxabtyo26yvpsihvqenlko5fadwhm7trqmb2hyaswsmdec66n4yfq"
SUBNET_ID="ocid1.subnet.oc1.ap-kulai-2.aaaaaaaa6x6s6fwwztd6s2zkya4mivjutz3tg7jo6jgxgsll2sccerpdktoa"
SSH_KEY_FILE="$HOME/.ssh/id_rsa.pub"
INSTANCE_NAME="music-bot-server"
RETRY_INTERVAL=150  # 每 150 秒重試一次，避免被封鎖

# ---- 顏色設定 ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}==========================================${NC}"
echo -e "${CYAN}  Oracle Cloud A1.Flex 自動搶資源腳本${NC}"
echo -e "${CYAN}==========================================${NC}"
echo ""

# ---- 確認 SSH 公鑰存在（若無則自動生成）----
if [ ! -f "$SSH_KEY_FILE" ]; then
  echo -e "${YELLOW}⚠ 找不到 SSH 公鑰，自動生成中...${NC}"
  ssh-keygen -t rsa -b 4096 -f "$HOME/.ssh/id_rsa" -N "" -q
  echo -e "${GREEN}✓ SSH 金鑰已生成：$HOME/.ssh/id_rsa${NC}"
fi

if [ ! -f "$SSH_KEY_FILE" ]; then
  echo -e "${RED}❌ SSH 公鑰生成失敗，請手動執行：ssh-keygen -t rsa -b 4096${NC}"
  exit 1
fi

SSH_PUBLIC_KEY=$(cat "$SSH_KEY_FILE")
echo -e "${GREEN}✓ SSH 公鑰：$SSH_KEY_FILE${NC}"
echo -e "${GREEN}✓ 執行個體名稱：$INSTANCE_NAME${NC}"
echo -e "${GREEN}✓ 基礎間隔：$RETRY_INTERVAL 秒${NC}"
echo ""
echo -e "${YELLOW}按 Ctrl+C 可以停止腳本${NC}"
echo ""

ATTEMPT=0

while true; do
  ATTEMPT=$((ATTEMPT + 1))
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  echo -e "${CYAN}[$TIMESTAMP] 第 $ATTEMPT 次嘗試...${NC}"

  RESULT=$(oci compute instance launch \
    --compartment-id "$COMPARTMENT_ID" \
    --availability-domain "$AVAILABILITY_DOMAIN" \
    --shape "VM.Standard.A1.Flex" \
    --shape-config '{"ocpus": 2, "memoryInGBs": 12}' \
    --image-id "$IMAGE_ID" \
    --subnet-id "$SUBNET_ID" \
    --display-name "$INSTANCE_NAME" \
    --assign-public-ip true \
    --ssh-authorized-keys-file "$SSH_KEY_FILE" \
    --metadata "{\"user_data\": \"\"}" \
    2>&1)

  if echo "$RESULT" | grep -q '"lifecycle-state"'; then
    # 成功！
    INSTANCE_ID=$(echo "$RESULT" | grep '"id"' | head -1 | awk -F'"' '{print $4}')
    echo ""
    echo -e "${GREEN}🎉🎉🎉 成功建立執行個體！ 🎉🎉🎉${NC}"
    echo -e "${GREEN}Instance ID: $INSTANCE_ID${NC}"
    echo ""
    echo "等待取得公開 IP（約 60 秒）..."
    sleep 60

    PUBLIC_IP=$(oci compute instance list-vnics \
      --instance-id "$INSTANCE_ID" \
      --query "data[0].\"public-ip\"" --raw-output 2>/dev/null)

    echo ""
    echo -e "${GREEN}==========================================${NC}"
    echo -e "${GREEN}  ✅ 伺服器已就緒！${NC}"
    echo -e "${GREEN}==========================================${NC}"
    echo -e "${GREEN}  公開 IP：$PUBLIC_IP${NC}"
    echo -e "${GREEN}  SSH 連線：ssh ubuntu@$PUBLIC_IP${NC}"
    echo -e "${GREEN}==========================================${NC}"

    # macOS 通知
    osascript -e "display notification \"✅ Oracle VM 建立成功！IP: $PUBLIC_IP\" with title \"搶資源成功！\" sound name \"Glass\""

    exit 0

  elif echo "$RESULT" | grep -q "InternalError\|out of host capacity\|capacity\|OutOfCapacity"; then
    echo -e "${RED}  ❌ 目標地區目前容量不足，繼續等待...${NC}"
  elif echo "$RESULT" | grep -q "Too many requests"; then
    echo -e "${YELLOW}  ⚠️ 觸發頻率限制！自動冷卻 10 分鐘...${NC}"
    sleep 600
  elif echo "$RESULT" | grep -q "LimitExceeded"; then
    echo -e "${RED}  ❌ 已達到免費帳號執行個體數量上限！${NC}"
    echo "$RESULT"
    exit 1
  else
    ERROR_MSG=$(echo "$RESULT" | grep -o '"message": *"[^"]*"' | head -1)
    if [ -z "$ERROR_MSG" ]; then
      echo -e "${RED}  ❌ 發生錯誤，完整訊息如下：${NC}"
      echo "$RESULT" | head -20
    else
      echo -e "${RED}  ❌ 錯誤：$ERROR_MSG${NC}"
    fi
  fi

  # 加入隨機抖動 (Jitter)，隨機增加 1-30 秒，讓行為更像人類，減少規律性
  JITTER=$(( RANDOM % 30 + 1 ))
  WAIT_TIME=$(( RETRY_INTERVAL + JITTER ))
  echo -e "${NC}  😴 等待 $WAIT_TIME 秒後再次嘗試...${NC}"
  sleep $WAIT_TIME
done
