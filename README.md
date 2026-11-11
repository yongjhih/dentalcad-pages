# IOS Pages — Universal Intraoral Scanner 3D CAD & Articulator

一個符合 **Impeccable** 規範與 **shadcn/ui** 設計語言的**跨品牌口掃機通用 (Universal Intraoral Scanner, IOS) 臨床 3D CAD 與咬合運動模擬系統**。支援 **Align iTero**、**3Shape TRIOS**、**Medit i-Series**、**Shining 3D Aoralscan**、**Carestream** 及各類標準 `.stl` 牙弓模型，透過 **Three.js** 在純瀏覽器環境中即時進行 6-DOF 下顎生理運動模擬、咬合接觸熱力圖 (Occlusogram)、五方位臨床照片 3D 正交投影貼圖與 3D 數位游標尺測距。

- **線上展示 (GitHub Pages)**：https://yongjhih.github.io/itero-pages/

---

## 🔒 純瀏覽器上傳與零隱私外洩架構 (Zero Local Preload / Browser-Only Ingestion)

為確保通用性與病患醫療隱私 (HIPAA / 零個資外洩)：
1. **不預載任何本地病患資料**：儲存庫與建置產物 (`dist/`) 不打包、不讀取任何本地端病患 `.stl`、`.xml` 或臨床照片。預設啟動時以程序化生成之 **14 顆全牙列標準示範牙弓 (`DEMO-ARCH-01`)** 提供即時 3D 沙盒體驗。
2. **純瀏覽器選擇 / 拖曳上傳渲染**：
   - 點擊頂部導覽列 **「抽換並存入瀏覽器」**、3D 視窗右下角上傳按鈕，或直接將口掃匯出檔案組（`.stl` + `.xml` + `.jpg/.png` + `.pdf`）拖曳至 3D 畫布。
   - 內建跨品牌解析器會自動識別口掃廠牌（iTero / 3Shape TRIOS / Medit / Shining3D / Generic STL）、解析處方與座標變換矩陣，並直接於瀏覽器記憶體渲染。
3. **瀏覽器 IndexedDB 本地持久化 (`OrthoCAD_CaseDB`)**：
   - 上傳的檔案以原始二進位 `Blob` 儲存於使用者本機瀏覽器的 **IndexedDB**，不會上傳至任何外部伺服器，下次開啟網頁仍可直接切換檢視。
4. **預設啟用全方位隱私匿名遮罩**：
   - 預設自動遮罩 **病患姓名 (Patient)**、**主治醫師 (Practitioner)**、**醫療機構 (Clinic)** 與 **原始 XML 標籤**。

---

## 📦 模組化 Package 架構（支援第三方專案引用與二次開發）

本專案採用 Monorepo Workspaces 模組化設計，將核心演算法與 React 3D 視覺組件解耦為獨立套件，方便其他專案直接引用進行二次開發：

```text
packages/
├── core/     (@ios-pages/core)   # 無 UI 依賴之純 TypeScript + Three.js 牙科 CAD 核心引擎與多廠牌口掃解析器
└── viewer/   (@ios-pages/viewer) # 可複用之 React + Three.js 3D 牙弓檢視器、咬合器面板與臨床工具組件
```

### 1. `@ios-pages/core` — 牙科 3D 運動學、熱力圖與口掃解析核心套件
提供純函式與 Three.js Shader / Geometry 工具，不依賴 React，可在任意前端框架（React / Vue / Svelte / Vanilla TS）中引用：
- **`@ios-pages/core/kinematics`**：6-DOF 顳顎關節 (TMJ) 生理軸旋轉 + 髁頭滑動運動學、Posselt 曲線預設與自訂三次貝茲曲線 (`computeMandibularKinematics`, `sampleArticulationTrajectory`, `evalCubicBezier`)
- **`@ios-pages/core/occlusogram`**：上下顎咬合面高程圖 (`buildOcclusalElevationMap`)、即時對咬接觸統計 (`computeOcclusogramStats`) 與 GPU GLSL 咬合接觸熱力圖材質 (`createOcclusogramMaterial`)
- **`@ios-pages/core/metrics`**：自動牙弓診斷指標（尖牙間寬 U3-U3、大臼齒間寬 U6-U6、Overjet、Overbite）與 3D 數位游標尺 (`computeOrthoArchMetrics`, `createCaliperMeasurement`)
- **`@ios-pages/core/shaders`**：五方位臨床照片正交投影至 3D 模型之自訂 GLSL Shader (`loadPentaViewTextures`, `createPentaTexturedMaterial`)
- **`@ios-pages/core/geometry`**：零外部檔案依賴之程序化 14 顆全牙列 3D 網格生成器 (`createProceduralDentalArchGeometry`)
- **`@ios-pages/core/parsers`**：跨品牌口掃檔案解析器，自動識別 iTero、3Shape TRIOS、Medit、Shining3D 與通用 STL/XML (`buildCaseBundleFromFiles`, `detectScannerVendor`, `parseScannerXmlString`)
- **`@ios-pages/core/storage` & `@ios-pages/core/privacy`**：瀏覽器 IndexedDB 持久化 (`saveCaseRecordToIndexedDB`, `loadAllCasesFromIndexedDB`) 與醫療個資去識別化 (`getDisplayMetadata`, `anonymizeXmlString`)

#### 二次開發引用範例 (`@ios-pages/core`)
```ts
import {
  DEFAULT_ARTICULATOR_SETTINGS,
  computeMandibularKinematics,
  createProceduralDentalArchGeometry,
  detectScannerVendor,
} from '@ios-pages/core';

// 1. 生成程序化上下顎 3D BufferGeometry
const upperGeom = createProceduralDentalArchGeometry(true);
const lowerGeom = createProceduralDentalArchGeometry(false);

// 2. 計算下顎在開口 65% 時的 6-DOF 剛體變換矩陣与前牙切端軌跡
const state = computeMandibularKinematics({
  ...DEFAULT_ARTICULATOR_SETTINGS,
  mode: 'hinge',
  progress: 0.65,
});
```

### 2. `@ios-pages/viewer` — React 3D 口掃工作站 UI 組件套件
提供開箱即用的 React 臨床檢視組件：
- `DentalViewer3D`：支援多材質、五方照片貼圖投影、即時 Occlusogram 熱力圖、3D 運動軌跡 Gizmo 與 3D 游標尺點選測距的 WebGL 視窗
- `ArticulatorPanel`：6-DOF 虛擬咬合器、互動式 Bezier 運動曲線編輯器、熱力圖統計與 3D 游標尺控制面板
- `PentaGallery`：五方位臨床攝影燈箱與 3D 視角一鍵同步組件
- `CaseDossier` / `CadToolsPanel` / `XmlInspector`：齒科數位規格、剖面剖切控制與原始 XML 檢視組件

#### 二次開發引用範例 (`@ios-pages/viewer`)
```tsx
import { DentalViewer3D, ArticulatorPanel } from '@ios-pages/viewer';
import { DEFAULT_ARTICULATOR_SETTINGS } from '@ios-pages/core';
```

---

## 本機開發與測試

```bash
# 1. 安裝依賴
npm install

# 2. 執行單元測試與整合測試 (Vitest + Testing Library)
npm test

# 3. 啟動開發伺服器
npm run dev

# 4. 靜態建置 (輸出至 dist/)
npm run build
```
