# 🚀 Oracle Cloud A1.Flex 自動搶伺服器指南

這份指南將教您如何使用 `grab-oracle-vm.sh` 腳本來自動「搶」下 Oracle Cloud 的免費 ARM 執行個體（A1.Flex）。因為這類資源非常搶手，通常會出現「容量不足」的錯誤，本腳本能幫您自動重試直到成功。

---

## 📋 準備工作

在執行腳本前，請確保您的環境中已具備：
1. **OCI CLI 已設定**：已執行過 `oci setup config` 並上傳 API 公鑰至 Oracle 控制台。
2. **SSH 公鑰**：已生成 `~/.ssh/id_rsa.pub`（腳本會自動檢測，若無則自動生成）。
3. **正確的 OCID**：腳本內已填入您的 Compartment ID、Subnet ID 和 Image ID。

---

## 🛠️ 腳本位置
`scripts/grab-oracle-vm.sh`

---

## 🏃 執行方式

### 1. 給予執行權限
首次使用前，請先執行：
```bash
chmod +x scripts/grab-oracle-vm.sh
```

### 2. 在背景執行（推薦）
為了讓腳本在外關閉終端機後持續運作，建議使用 `nohup`：
```bash
nohup bash scripts/grab-oracle-vm.sh > ~/oracle-grab.log 2>&1 < /dev/null &
```

### 3. 查看即時進度
想看現在搶到第幾次了：
```bash
tail -f ~/oracle-grab.log
```

---

## 🔍 如何判斷成功？

1. **終端機顯示**：當搶到資源時，日誌會噴出 `🎉🎉🎉 成功建立執行個體！` 並顯示 **公開 IP**。
2. **macOS 通知**：腳本會自動發送系統通知至您的桌面。
3. **自動停止**：成功搶到後，腳本會自動退出，不再繼續重試。

---

## 🛑 如何手動停止？

如果您想放棄或是更換地區，可以使用以下指令強制終結腳本：
```bash
pkill -f "grab-oracle-vm"
```

---

## 💡 注意事項
- **重試頻率**：腳本目前設定為 **150 秒（2.5 分鐘）** 間隔，並帶有隨機延遲。請勿隨意縮短間隔，否則帳號可能會被 Oracle 暫時限流（Too many requests）。
- **休眠限制**：如果是在 Mac 上執行，請確保您的 Mac 不會進入睡眠模式（建議執行 `caffeinate -d &` 防止休眠）。
- **永久免費**：A1.Flex 每月有 3,000 OCPU 小時和 18,000 GB 小時的免費額度（約 4 個 OCPU，24GB 記憶體），腳本設定預設使用 **2 OCPU / 12GB RAM**。

---

> [!TIP]
> **搶到後第一件事**：
> 使用 `ssh ubuntu@您的公開IP` 連入伺服器，開始部署 Discord Bot！
