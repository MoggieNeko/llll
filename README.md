# Instagram 影片收集分析器 V4

這一版不再假設可以在網站裡匿名精準全網搜尋 Instagram。

改為較穩定的實際工作流：

1. 先在 Instagram 站內搜尋
2. 用瀏覽器收集器抓當前頁面可見 Reel / Post
3. 回到網站貼上 JSON
4. 由網站按主題、語言、產品字眼、背景主色做分析與排序

## 適合場景

- IG 素材搜尋整理
- 品牌競品內容收集
- 美妝 / 咖啡 / 時尚等內容初步篩選
- 交付網址名單和簡報前的 shortlist

## 專案結構

- `public/`：前端網站
- `functions/api/analyze.js`：Cloudflare Pages Functions 分析 API
- `browser_helper/bookmarklet.txt`：一鍵收集器
- `browser_helper/chrome_extension/`：可選 Chrome Extension 範例

## 部署方式（Cloudflare Pages）

### GitHub + Cloudflare Dashboard

1. 把整個專案上傳到 GitHub repo
2. Cloudflare Pages → Create application → Pages → Import existing Git repository
3. 設定：
   - Framework preset: `None`
   - Build command: `exit 0`
   - Build output directory: `public`
4. Deploy

## 使用方法

### 方法 A：Bookmarklet

1. 打開 `browser_helper/bookmarklet.txt`
2. 把整段 Javascript 存成瀏覽器書籤
3. 去 Instagram 搜尋頁 / Reels 頁 / hashtag 頁 / 帳號頁
4. 按書籤
5. 工具會複製 JSON 到剪貼簿
6. 貼回網站分析

### 方法 B：Chrome Extension

1. 打開 Chrome `chrome://extensions`
2. 啟用「開發人員模式」
3. 選「載入未封裝項目」
4. 指向 `browser_helper/chrome_extension`
5. 去 Instagram 頁面按工具圖示
6. 會複製 JSON 到剪貼簿
7. 貼回網站分析

## 這版的改進

- 改回以 Instagram 為主，不再依賴 YouTube API
- 不需要先填 YouTube key
- 以收集器輸出的內容為主做分析，減少匿名抓頁失敗導致 0 結果
- 加入可信度標記
- 支援 JSON / 純網址雙模式
- 保留 Cloudflare Pages 架構，可直接網站上線

## 注意

- 如果只貼純網址而沒有收集器 JSON，系統會嘗試補抓頁面資料，但 Instagram 頁面資料可能不完整
- 背景主色是按縮圖資料估算，不是逐幀影片分析
- 產品判斷以文字內容命中為主，不是影像 AI 物件辨識

## 建議下一版

- 專案管理 / 收藏
- 多頁批次收集
- 自動去重與標籤系統
- 真正的本機或雲端 AI 視覺辨識
