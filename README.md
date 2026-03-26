# 社交平台影片搜尋器 Web 版

這個版本已經由 **本機版** 改成 **可上網站架設** 的版本。

## 適合你現在的需求

- 不用本地長期開住電腦
- 可部署成真正網站
- 免費起步
- 介面簡單，適合不太熟電腦的人
- 主要支援 Instagram 相關搜尋流程
- 亦可分析 TikTok / YouTube / Facebook / X 的公開影片頁面

## 這個版本的部署方式

### 推薦：Cloudflare Pages + Functions

原因：

1. 前端可以直接放在 Pages
2. 搜尋與 metadata 抓取可以放在 Functions
3. 免費方案可用 Workers / Pages Functions
4. 有 HTTPS、全球 CDN，部署簡單
5. 可直接接 GitHub，自動上線

## 專案結構

```text
social_video_finder_web_v1/
├─ public/
│  ├─ index.html
│  ├─ styles.css
│  └─ app.js
├─ functions/
│  └─ api/
│     ├─ _lib.js
│     ├─ search.js
│     └─ analyze.js
├─ package.json
├─ wrangler.toml
└─ README.md
```

## 主要功能

### 1. 網站搜尋模式
- 輸入主題關鍵字
- 選平台
- 選語言
- 選背景主色
- 選產品關鍵字
- 搜尋公開影片頁面
- 列出網址、簡介、縮圖、分數

### 2. 批量網址分析
- 可直接貼 Reel / Shorts / TikTok 連結
- 可上傳 TXT / CSV / JSON
- 統一分析 metadata
- 做語言、顏色、產品篩選

### 3. 匯出
- CSV
- JSON
- HTML 報告
- 複製全部網址

## 架設方法（最簡單，唔用 Wrangler）

### 方法 A：Cloudflare Dashboard + GitHub

1. 把整個專案上傳到 GitHub repository
2. 到 Cloudflare Dashboard
3. 進入 **Workers & Pages**
4. 點 **Create application**
5. 選 **Pages**
6. 連接 GitHub repository
7. Build settings 填：
   - **Framework preset**: None
   - **Build command**: 留空
   - **Build output directory**: `public`
8. 完成部署

Cloudflare 會自動識別 `functions/` 目錄，將裡面的 API 當成 Pages Functions。

## 架設方法（CLI）

### 先安裝 Node.js

下載並安裝 Node.js LTS。

### 安裝 Wrangler

```bash
npm install
npm install -g wrangler
```

### 登入 Cloudflare

```bash
wrangler login
```

### 本地預覽

```bash
npx wrangler pages dev public
```

### 部署

```bash
npx wrangler pages deploy public
```

## 若你之前出現 `'wrangler' 不是內部或外部命令`

代表你的電腦未安裝 Wrangler，或未加到 PATH。

你有兩個做法：

### 做法 1：直接用 Dashboard + GitHub
這個最適合你，基本上不用碰命令列。

### 做法 2：用 npx 直接跑
```bash
npx wrangler pages dev public
```

這樣即使全域未安裝，也通常可以直接執行。

## 注意事項

1. 這個工具依賴公開可索引頁面，不代表平台內所有影片都能抓到。
2. Instagram / TikTok 有時會阻擋頁面資料，所以有些影片只能抓到部分 metadata。
3. 背景色目前仍然是依據縮圖資料估算，不是完整逐幀影片分析。
4. 產品辨識目前仍以文字關鍵字為主，不是正式的 AI 物件辨識。
5. 語言判斷目前以標題與描述為主，不是語音辨識。

## 下一步可以再升級什麼

### 升級 1：真正 AI 物件辨識
- 用後端模型辨識產品
- 例如咖啡機、護膚品、化妝品、鞋、袋

### 升級 2：Whisper 語音轉文字
- 抽音訊
- 判斷真實語言
- 再做關鍵字檢索

### 升級 3：登入後收藏與專案管理
- 用 Cloudflare D1 / KV
- 每個使用者可保存結果

### 升級 4：IG 專用收集器
- 做 Chrome Extension
- 在頁面一鍵收集 Reel URL
- 再送回網站分析

## 最重要結論

如果你要：

- **真正放上網站**
- **不用本機運行**
- **免費開始**
- **介面簡單**

那這個版本應該用 **Cloudflare Pages + Functions**，而不是 GitHub Pages 單獨部署。
