# 社交平台影片搜尋器 Web V2（較準確、較穩定版）

這一版是針對上一版兩個結構性問題重做：

1. **搜尋不精準**：原本主要靠公開搜尋引擎 + 抓頁面 metadata，相關度不足。
2. **要開 VPN 才較容易有結果**：原本流程依賴匿名抓取公開搜尋頁與社交平台頁面，容易被限制或回傳不完整資料。

所以 V2 改成 **兩條主線**：

- **YouTube 精準搜尋**：使用 YouTube Data API（免費配額）做真正搜尋，再由本工具做二次篩選和排序。
- **Instagram / TikTok / Facebook / X 較穩定工作流**：不再假裝可以「匿名全網精準搜」。改為 **瀏覽器收集器** 在使用者自己瀏覽平台時收集當前頁面可見影片網址，再交給網站做分析與排序。

## 這版能解決什麼

- 不再把不穩定的匿名抓取當核心搜尋來源
- 不再因為語言 / 顏色 / 產品條件過嚴而全部 0 結果
- 提供 **軟性排序** 與 **嚴格模式** 切換
- 讓結果有「為什麼排前」的說明
- 盡量避免因後端 IP 被限制而必須開 VPN

## 核心限制（請先看）

### 1) YouTube 可以做精準搜尋
因為可以接正式搜尋 API，再用本工具做細篩選。

### 2) Instagram / TikTok / Facebook / X 無法保證匿名全網精準搜尋
這不是程式小修可以解決的問題。若不使用官方 API、登入授權、付費資料源，或在使用者自己的瀏覽器中收集頁面內容，網站後端很難穩定、合法、精準地替你匿名全網搜尋影片。

因此這版把它改成：
- 用戶先在平台上正常搜尋 / Explore / Hashtag / Reels 頁面中打開結果
- 按 bookmarklet 收集當前頁面可見網址
- 把網址貼回本網站分析

這樣通常比「匿名後端代你爬」穩定得多。

## 功能

### 模式 A：YouTube 搜尋（推薦）
- 關鍵字搜尋
- 語言、顏色、產品字眼、平台加權
- 軟性排序 / 嚴格篩選
- 支援將 YouTube API Key 放在 Cloudflare 環境變數 `YOUTUBE_API_KEY`
- 也支援前端臨時輸入 API Key（只存在瀏覽器，不會儲存在後端）

### 模式 B：網址分析（推薦給 IG / TikTok）
- 貼上影片網址清單
- 分析標題、描述、縮圖、語言、關鍵字匹配
- 顯示匹配原因與分數

### 模式 C：瀏覽器收集器
- 在 IG / TikTok / YouTube / Facebook / X 頁面按 bookmarklet
- 把當前頁面可見影片 / post / reel 連結複製到剪貼簿
- 貼回本網站分析

## Cloudflare Pages 部署

### 結構
- `public/`：前端網站
- `functions/`：Cloudflare Pages Functions API

### 建議設定
- Framework preset: `None`
- Build command: `exit 0`
- Build output directory: `public`

## 環境變數

### 可選：YouTube API Key
在 Cloudflare Pages / Workers Settings 加：
- `YOUTUBE_API_KEY` = 你的 YouTube Data API key

如果未設定，前端也可以讓使用者暫時輸入 key。

## 使用流程

### YouTube 搜尋
1. 輸入主題，例如 `coffee review`
2. 選語言 / 顏色 / 產品字眼
3. 按「YouTube 搜尋」
4. 看排序結果
5. 匯出 CSV / HTML

### Instagram / TikTok
1. 自己到平台內搜尋，例如 `latte art`
2. 開到搜尋結果頁 / reel 列表 / hashtag 頁
3. 點 browser_helper 裡的 bookmarklet
4. 複製網址清單
5. 回到本網站貼上
6. 按「分析網址」

## 這版比上一版準在哪裡

- 搜尋來源更明確：YouTube 走正式 API，不再盲抓搜尋頁。
- IG / TikTok 不再用不穩定的匿名後端全網爬法。
- 排名改成「相關度 + 語言 + 產品 + 顏色 + metadata 完整度」綜合分數。
- 除了分數，還會顯示 `matchReasons` 告訴你為什麼它被排前。
- 新增嚴格模式開關。平時建議關閉，先看更多候選結果。

## 下一步可再升級

### 真 AI 版
如你真的要按「影片中的產品、背景顏色、說話語言」做更準確搜尋，下一步應加：
- 逐幀抽樣
- 本機或雲端物件辨識
- 語音轉文字
- 顏色佔比分析

沒有這些，任何只靠標題 / 描述 / 縮圖的網站版都只能算候選篩選器，不是最終精準檢索器。
