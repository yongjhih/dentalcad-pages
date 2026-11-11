# iTero OrthoCAD 3D & Case Viewer

一個符合 **Impeccable** 規範與 **shadcn/ui** 設計語言的臨床級牙科 3D CAD 與病例檢視系統。透過 **Three.js** 在瀏覽器中即時渲染高精度牙弓 STL 數位模型（包含上顎與下顎真確咬合對位），並完整整合五方位臨床攝影（Penta Gallery）與 iTero 數位處方資料。

![iTero OrthoCAD 3D](public/cases/297077963/gallery_overview.jpg)

## 資料與視圖分離架構 (Data Separation & Swapping)

本專案將所有臨床案例數據（STL 模型、XML 處方、五方位照片、PDF/HTML）與 UI 渲染層完全解耦，支援以下三種方式隨時抽換或擴充資料：

### 方式一：自動目錄掃描與建置 (`npm run sync-data`)
1. 將新的 iTero 匯出檔案直接放入**專案根目錄**或建立 **`data/<任意案例資料夾>/`**（包含 `*_shell_occlusion_u.stl`、`*_shell_occlusion_l.stl`、`itero_export_*_v50.xml`、`gallery_*.jpg`、`iTero_Rx_*.pdf`）。
2. 執行 `npm run sync-data`（執行 `npm run dev` 或 `npm run build` 時也會自動觸發）：
   - 腳本 [scripts/sync-data.mjs](scripts/sync-data.mjs) 會自動解析 XML 欄位、計算二進位 STL 的真實三角面數與毫米邊界尺寸（W × D × H）。
   - 自動在 `public/cases/<OrderID>/` 建立標準化資產連結，並產出 `public/cases/manifest.json` 案例清單。
3. 網頁頂部導覽列提供**案例下拉選單**，並支援網址參數直接指定案例（例如 `?case=297077963`）。

### 方式二：直接修改靜態清單 (`public/cases/manifest.json`)
- 前端啟動時會動態請求 `./cases/manifest.json`。在純靜態伺服器或 GitHub Pages 上，只需替換 `public/cases/<OrderID>/` 內的檔案或更新 `manifest.json`，無須重新編譯前端程式碼即可新增或切換案例。

### 方式三：瀏覽器即時拖曳 / 匯入整包資料 (Runtime Hot-Swap)
- 點擊頂部導覽列的 **「抽換案例資料」** 按鈕，或直接將新案例的檔案組（可同時選取 `.xml` + `.stl` + `.jpg` + `.pdf`）拖曳至 3D 畫布。
- 內建瀏覽器端解析器 ([src/data/caseData.ts](src/data/caseData.ts)) 會在記憶體中即時解析 XML 處方、重算 STL 法向量與包圍盒尺寸、更新五方位臨床相簿與 3D 咬合檢視，完全不經過任何外部伺服器。

## 核心功能

### 1. 3D 牙弓咬合檢視器 (Three.js WebGL)
- **真確咬合對位**：自動依據 iTero 掃描儀咬合矩陣對位上顎（Maxilla, ~31.9 萬三角面）與下顎（Mandible, ~29.9 萬三角面），總計逾 61.9 萬三角形幾何網格，流暢 60 FPS 渲染。
- **咬合間隙開離滑桿 (Occlusion Separation)**：支援由緊密咬合（0 mm）至垂直分開（+35 mm），方便同時檢查上下牙弓咬合面（Occlusal table）與接觸點。
- **五種臨床光學材質 (Shaders)**：
  - **臨床琺瑯質 (Enamel)**：模擬真實牙科光學折射率（IOR 1.55）與清漆光澤（Clearcoat）。
  - **石膏模型 (Plaster)**：高漫射啞光骨白質感，凸顯牙齒窩溝與形態學特徵。
  - **法向量圖 (Normals)**：RGB 色彩對應幾何面法線斜率，分析咬合引導斜面。
  - **拓撲線框 (Wireframe)**：直接檢視 3D 網格密度與三角形細分結構。
  - **半透明 X 光 (Translucent)**：半透明穿透檢視齒列長軸與內外側重疊。
- **標準牙科視角切換**：正視咬合面（Frontal）、上顎面（Upper Arch）、下顎面（Lower Arch）、右側頰面（Right Buccal）、左側頰面（Left Buccal）、立體等角（Isometric）。
- **剖面剖切 (Cross-Section Clipping)**：支援 X / Y / Z 三軸剖切滑桿，即時剖析牙齒內部截面與厚度。
- **外部 STL 拖曳預覽 (Drag & Drop Ingestion)**：支援將自訂牙科 `.stl` 檔案拖入畫布或上傳，純前端本機解析，無資料外洩風險。
- **高解析畫面截圖 (Snapshot)**：一鍵輸出當前 3D 牙弓畫面（PNG）。

### 2. 五方位臨床攝影 (Penta Gallery)
- 內建由 iTero Element 產生的五方位臨床照片與總覽圖：
  - 正視咬合面 (`penta_front.jpg`)
  - 上顎齒列面 (`penta_upper.jpg`)
  - 下顎齒列面 (`penta_lower.jpg`)
  - 右側頰面咬合 (`penta_patientright.jpg`)
  - 左側頰面咬合 (`penta_patientleft.jpg`)
  - 複合全覽圖 (`gallery_overview.jpg`)
- 點擊開啟高解析燈箱（Lightbox），支援平移、縮放，並提供 **「同步 3D 視角」** 功能，一鍵將 3D 模型轉至對應照片的角度。

### 3. 臨床處方箋與病例檔案 (Case Dossier)
- 完整呈現 Order ID (`#297077963`)、Order Code (`0ACP263H`)、醫師執照、機構地址、ADA 牙位代碼（#1–16, #17–32）。
- **隱私遮罩開關 (HIPAA Anonymize Toggle)**：一鍵切換病患姓名遮罩保護模式，方便臨床教學或案例公開演示。
- 內嵌原始檔案下載與預覽連結：
  - 處方箋 PDF (`iTero_Rx_297077963.pdf`)
  - 處方 HTML 網頁 (`Rx_297077963.html`)
  - 原始 STL 檔 (`297077963_shell_occlusion_u.stl`, `297077963_shell_occlusion_l.stl`)

### 4. iTero XML 原始數據檢視器 (XmlInspector)
- 語法高亮展示 `itero_export_#297077963_v50.xml` 原始檔案，提供一鍵複製與原始檔案下載。

---

## 技術棧

- **框架**：React 18 + TypeScript + Vite
- **3D 引擎**：Three.js (`STLLoader`, `OrbitControls`, `ACESFilmicToneMapping`)
- **樣式與介面**：Tailwind CSS (shadcn/ui 深色工作站風格) + Lucide Icons
- **設計規範**：符合 Impeccable 4.6+ 工藝規範（高對比、等寬數據排版、無無用漸層、無多餘卡片巢狀）

---

## 本機開發與建置

```bash
# 1. 安裝依賴
npm install

# 2. 啟動開發伺服器
npm run dev

# 3. 靜態建置 (輸出至 dist/)
npm run build

# 4. 本地預覽建置成果
npm run preview
```

---

## GitHub Pages 部署設定

本專案已配置完整的 GitHub Actions 自動部署工作流程 (`.github/workflows/deploy.yml`)。

只需在 GitHub 儲存庫中進行一次性設定：
1. 前往 GitHub 儲存庫頁面：`Settings` -> `Pages`
2. 在 **Build and deployment** > **Source** 選擇 **`GitHub Actions`**。
3. 將代碼推送到 `main` 分支：
   ```bash
   git add .
   git commit -m "feat: complete impeccable 3D OrthoCAD dental viewer for GitHub Pages"
   git push origin main
   ```
4. GitHub Actions 將自動建置並發布至：
   `https://yongjhih.github.io/itero-pages/`
