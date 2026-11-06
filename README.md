# 減脂 \Fight/ v2.4 — 部署教學

全部免費：GitHub Pages（網頁）＋ Google 試算表 / Apps Script（資料、同步、AI 代理、照片）＋ Gemini 免費額度（AI）。

```
上傳到 GitHub 的檔案（保持資料夾結構）：
index.html
version.json
icon.svg
icon-180.png
js/data.js
js/art.js
js/chars.js
js/views.js
js/app.js
assets/A/（整個資料夾）
assets/B/（整個資料夾）

貼到 Apps Script 的檔案（不要上傳到 GitHub）：
Code.gs
```

---

## 1. Google 試算表與後端（約 10 分鐘）

1. 建立新的 Google 試算表，命名「減脂 Fight 資料」→ 選單「擴充功能 → Apps Script」。
2. 刪掉預設內容，貼上 `Code.gs` → 儲存。
3. 左側齒輪「專案設定」：
   - **時區**改成「(GMT+08:00) 台北」
   - 最下方「指令碼屬性」新增：

   | 屬性 | 值 |
   |---|---|
   | `APP_TOKEN` | 自訂通關密語，16 碼以上英數混合 |
   | `GEMINI_API_KEY` | 第 2 步取得 |

4. 函式選 `setup` →「執行」→ 授權。畫面會出現「Google 尚未驗證這個應用程式」，點「進階 → 前往（不安全）」，因為這是你自己的程式。這次會要求試算表、雲端硬碟（存體態照片）、外部連線三種權限。
5. 「部署 → 新增部署作業」→ 類型「網頁應用程式」→ 執行身分「**我**」→ 誰可以存取「**所有人**」→ 部署 → 複製結尾是 `/exec` 的網址。

> 之後修改 `Code.gs`：「部署 → 管理部署作業 → 編輯（鉛筆）→ 版本：新版本」，這樣網址不變。

## 2. Gemini 免費金鑰（3 分鐘）

到 https://aistudio.google.com/apikey 建立金鑰，貼到 `GEMINI_API_KEY`。
免費方案的內容 Google 可能用於改善模型，所以照片不要拍到證件、帳單或人臉特寫。體態照片**不會**送給 AI，只存在你們的雲端硬碟。

## 3. GitHub Pages（5 分鐘）

1. GitHub 新增 Public repository，例如 `couple-fit`。
2. 「Add file → Upload files」，把 `index.html`、`icon.svg`、`icon-180.png` 和**整個 `js` 資料夾**拖進去。
3. 「Settings → Pages」→ Deploy from a branch → `main` / `(root)` → Save。
4. 約 1 分鐘後得到網址 `https://帳號.github.io/couple-fit/`。

## 4. 兩支 iPhone 設定

1. Safari 開網址 →「設定」→ 雲端同步：貼網址與通關密語 →「儲存並同步」。
2. 總覽頁選「我是 Inge」或「我是 17」，填個人資料、挑外觀 → 儲存。
3. Safari 分享 →「加入主畫面」，之後就像 App 一樣開啟。

## 5. 體重機自動同步（每人 5 分鐘）

App 裡「設定 → 體重機自動同步 → 看設定步驟」有完整步驟，網址和 uid 會直接顯示在那頁。重點：

- bpt care 打開「同步到 Apple 健康」。
- 捷徑：「尋找健康樣本」讀體重和體脂率 →「取得 URL 內容」用 POST 送 JSON（欄位 action=health、token、uid、weight、date、bodyfat）。
- 自動化：「App → bpt care → 已關閉 → 立即執行」，建議再加一個每天 10:00 的保險。
- 完整身體組成（肌肉量、內臟脂肪等）偶爾在 App 用「上傳 bpt care 報告」截圖就好。

## 6. 通知

不需要額外設定。右上角的鈴鐺會集中顯示：
- 今天還沒量體重、晚上 8 點後飲食記錄少於 2 筆、完整體組成報告超過 30 天沒更新
- 對方送的應援、對方完成訓練、週回顧與月報出爐
- 經期快到了、雲端同步失敗

「設定 → 個人資料 → App 內提醒」可以關掉待辦類提醒。

## 從 v1 升級

1. 把 Apps Script 換成新的 `Code.gs` → 執行一次 `setup`（因為多了雲端硬碟權限）→ 用「管理部署作業 → 新版本」部署。
2. GitHub 刪掉舊的 `index.html`，上傳 v2 全部檔案。
3. 舊資料全部保留，不用重新設定。iPhone 主畫面圖示如果沒更新，刪掉重新加入即可。

## 常見問題

| 狀況 | 解法 |
|---|---|
| 雲端回應格式錯誤 | 部署的存取權不是「所有人」，或網址不是 `/exec` 結尾 |
| 通關密語錯誤 | 手機、捷徑、指令碼屬性三邊要完全一樣（注意空白） |
| AI 免費額度用完 | 等一分鐘；每日額度在台灣時間下午 3～4 點重置 |
| 捷徑顯示錯誤 | 先手動執行一次看訊息；date 欄位要選「開始日期」並用 ISO 8601 格式 |
| 照片上傳失敗 | 重新執行一次 `setup` 授權雲端硬碟，再部署新版本 |
| 改了 Code.gs 沒生效 | 要用「管理部署作業 → 新版本」 |
| 換手機 | 重新填網址與密語，資料會全部拉回來 |

## 之後更新

把新的檔案覆蓋到 GitHub（`version.json` 一定要一起上傳）。手機打開 App 時會自動發現新版，底部出現「有新版本，立即更新」，點一下就好。GitHub 發布約需 1～5 分鐘；如果點了顯示「還在發布中」，過幾分鐘再按一次即可。
