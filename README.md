# TDN Studio

TDN Studio 是一個小型團隊的入口網站，同時是：

- 團隊品牌網站
- 以 Markdown 為內容來源的技術／防災筆記 Blog
- 專案地圖（進行中／規劃中專案）
- 本地 Markdown 編輯器（於本機運作）

## 線上網站
[www.tdn.fj.kg](https://www.tdn.fj.kg/)

## 開發說明
本專案採用純前端技術（HTML/CSS/JS），無任何框架或建置流程。直接部署於 GitHub Pages。

## 更多資訊
詳見 `GEMINI.md` 或直接訪問線上網站。
## 停班停課頁面

資料夾分工：

- `suspension/` → **會部署到 GitHub Pages** 的頁面（純前端）。
- `worker/` → **不會部署**，是 Cloudflare Worker 的原始碼（代理 API），部署細節見 `worker/README.md`。

資料來源：行政院人事行政總處「天然災害停止上班及上課情形」。用戶訪問頁面時，前端才呼叫 Worker 即時抓取並解析，不需定時 commit。

部署：`cd worker && wrangler deploy` 後，把產生的 Worker 網址填入 `suspension/script.js` 的 `WORKER_URL`。
