# IOS Pages — Universal Intraoral Scanner 3D CAD & Articulator

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)

**[English](#english) | [繁體中文](#繁體中文)**

---

## English

**IOS Pages** is a clinical-grade, vendor-neutral **Universal Intraoral Scanner (IOS) 3D CAD & Occlusal Articulation Workstation** built with **React 18**, **TypeScript**, **Three.js**, and **Tailwind CSS** (conforming to **Impeccable** and **shadcn/ui** design standards).

It supports intraoral scans from **Align iTero**, **3Shape TRIOS**, **Medit i-Series**, **Shining 3D Aoralscan**, **Carestream**, and standard `.stl` dental arch meshes — running 100% client-side in the browser with **6-DOF mandibular kinematics**, **real-time Occlusogram bite contact heatmaps**, **5-view clinical photo orthographic texture projection**, and **3D digital caliper biometrics**.

- **Live Demo (GitHub Pages)**: https://yongjhih.github.io/itero-pages/
- **License**: [Apache License 2.0](./LICENSE)

### 🔒 Zero-PHI Preload & Pure Browser Ingestion Architecture

To guarantee cross-scanner versatility and strict clinical privacy (HIPAA-ready / zero data leakage):
1. **No Preloaded Local Patient Data**: The repository and production build (`dist/`) never bundle or load local patient `.stl`, `.xml`, or clinical photography files from disk. On initial startup, the app generates a **synthetic 14-tooth full-arch calibration model (`DEMO-ARCH-01`)** directly in memory.
2. **Browser-Only File Selection & Drag-and-Drop**:
   - Users select or drag-and-drop their local intraoral scanner files (`.stl`, `.xml`, `.jpg/.png`, `.pdf`, `.html`) directly into the browser viewport.
   - The multi-vendor parser automatically detects scanner conventions (**iTero**, **3Shape TRIOS**, **Medit**, **Shining 3D**, **Carestream**, or **Generic STL**) and renders them in-memory without uploading anything to an external server.
3. **Browser `IndexedDB` Persistence (`OrthoCAD_CaseDB`)**:
   - Uploaded cases are stored as binary `Blob` records inside the user's local browser `IndexedDB` so they remain available across page reloads.
4. **Default-Enabled Privacy Anonymization**:
   - Masks **Patient Name**, **Practitioner Name**, **Clinic Name**, and **raw XML PHI tags** by default, with a one-click toggle in the top header.
5. **Bilingual Interface (`EN` / `繁體中文`) & Light / Dark Themes**:
   - Switch seamlessly between **English (`en`)** and **Traditional Chinese (`zh-TW`)**, as well as clinical **Dark** and **Light** themes.

### 📦 Modular Workspace Packages (For Secondary Development)

The project is structured as a modular monorepo workspace (`packages/*`) so external applications can import either the headless 3D dental CAD engine or the React UI components:

```text
packages/
├── core/     (@ios-pages/core)   # Framework-agnostic TypeScript + Three.js dental CAD engine & multi-scanner parser
└── viewer/   (@ios-pages/viewer) # Reusable React + Three.js 3D Dental Viewport, Articulator Panel & Dossier UI
```

#### 1. `@ios-pages/core` — Headless Dental 3D Kinematics, Shaders & Parser SDK
Zero React dependency; usable in React, Vue, Svelte, or vanilla Three.js projects:
- **`@ios-pages/core/kinematics`**: 6-DOF TMJ hinge rotation + condylar translation, Posselt envelope presets, and interactive cubic Bezier trajectory solver (`computeMandibularKinematics`, `sampleArticulationTrajectory`, `evalCubicBezier`).
- **`@ios-pages/core/occlusogram`**: Maxillary/mandibular occlusal elevation maps (`buildOcclusalElevationMap`), real-time contact clearance stats (`computeOcclusogramStats`), and custom GLSL heatmap shader (`createOcclusogramMaterial`).
- **`@ios-pages/core/metrics`**: Automated orthodontic arch metrics (intercanine width `U3-U3`, intermolar width `U6-U6`, Overjet, Overbite) and 3D digital caliper (`computeOrthoArchMetrics`, `createCaliperMeasurement`).
- **`@ios-pages/core/shaders`**: Calibrated 5-view clinical photography orthographic texture projection shader (`loadPentaViewTextures`, `createPentaTexturedMaterial`).
- **`@ios-pages/core/geometry`**: Procedural 14-tooth maxillary & mandibular 3D `BufferGeometry` generator (`createProceduralDentalArchGeometry`).
- **`@ios-pages/core/parsers`**: Multi-scanner file bundle ingestion and vendor auto-detection (`buildCaseBundleFromFiles`, `detectScannerVendor`, `parseScannerXmlString`).
- **`@ios-pages/core/storage` & `@ios-pages/core/privacy` & `@ios-pages/core/i18n`**: Browser `IndexedDB` storage (`saveCaseRecordToIndexedDB`, `loadAllCasesFromIndexedDB`), PHI anonymizer (`getDisplayMetadata`, `anonymizeXmlString`), and bilingual helper (`tr`).

```ts
import {
  DEFAULT_ARTICULATOR_SETTINGS,
  computeMandibularKinematics,
  createProceduralDentalArchGeometry,
  detectScannerVendor,
} from '@ios-pages/core';

const upperGeom = createProceduralDentalArchGeometry(true);
const lowerGeom = createProceduralDentalArchGeometry(false);

const kinematics = computeMandibularKinematics({
  ...DEFAULT_ARTICULATOR_SETTINGS,
  mode: 'hinge',
  progress: 0.65,
});
```

#### 2. `@ios-pages/viewer` — React 3D Dental CAD Workstation Components
Exports reusable React components: `DentalViewer3D`, `ArticulatorPanel`, `PentaGallery`, `CaseDossier`, `CadToolsPanel`, `XmlInspector`, and `Header`.

```tsx
import { DentalViewer3D, ArticulatorPanel } from '@ios-pages/viewer';
import { DEFAULT_ARTICULATOR_SETTINGS } from '@ios-pages/core';
```

### 🛠️ Local Development & Testing

```bash
# 1. Install dependencies
npm install

# 2. Run unit & integration test suites (Vitest + Testing Library)
npm test

# 3. Start local Vite development server
npm run dev

# 4. Build static production bundle (outputs to dist/)
npm run build
```

---

## 繁體中文

**IOS Pages** 是一個符合 **Impeccable** 規範與 **shadcn/ui** 設計語言的**跨品牌口掃機通用 (Universal Intraoral Scanner, IOS) 臨床 3D CAD 與咬合運動模擬工作站**。支援 **Align iTero**、**3Shape TRIOS**、**Medit i-Series**、**Shining 3D Aoralscan**、**Carestream** 及各類標準 `.stl` 牙弓模型，透過 **Three.js** 在純瀏覽器環境中即時進行 **6-DOF 下顎生理運動模擬**、**咬合接觸熱力圖 (Occlusogram)**、**五方位臨床照片 3D 正交投影貼圖**與 **3D 數位游標尺測距**。

- **線上展示 (GitHub Pages)**：https://yongjhih.github.io/itero-pages/
- **開源授權**：[Apache License 2.0](./LICENSE)

### 🔒 純瀏覽器上傳與零隱私外洩架構 (Zero Local Preload / Browser-Only Ingestion)

1. **不預載任何本地病患資料**：儲存庫與建置產物 (`dist/`) 不打包、不讀取任何本地端病患 `.stl`、`.xml` 或臨床照片。預設啟動時以程序化生成之 **14 顆全牙列標準示範牙弓 (`DEMO-ARCH-01`)** 提供即時 3D 沙盒體驗。
2. **純瀏覽器選擇 / 拖曳上傳渲染**：
   - 點擊頂部導覽列 **「抽換並存入瀏覽器 (Upload Scan Bundle)」**、3D 視窗右下角上傳按鈕，或直接將口掃匯出檔案組（`.stl` + `.xml` + `.jpg/.png` + `.pdf`）拖曳至 3D 畫布。
   - 內建跨品牌解析器會自動識別口掃廠牌（iTero / 3Shape TRIOS / Medit / Shining3D / Carestream / Generic STL），直接於瀏覽器記憶體渲染並存入本機 **IndexedDB** (`OrthoCAD_CaseDB`)，絕不上傳至外部伺服器。
3. **預設啟用隱私匿名遮罩 & 中英雙語 (`EN` / `中文`) 切換**：
   - 預設自動遮罩 **病患姓名 (Patient)**、**主治醫師 (Practitioner)**、**醫療機構 (Clinic)** 與 **原始 XML 標籤**。
   - 頂部導覽列支援一鍵切換 **英文 (`EN`) / 繁體中文 (`中文`)** 以及 **暗色 / 亮色佈景**。

### 📦 模組化 Package 架構（支援第三方專案引用與二次開發）

- **`@ios-pages/core`** ([`packages/core`](file:///Users/yongjhih/works/yongjhih-dental-OrthoCAD/packages/core/package.json))：無 UI 依賴之純 TypeScript + Three.js 牙科 3D 運動學、Occlusogram 熱力圖、五方照片正交投影 Shader、程序化牙弓生成、多廠牌口掃解析器與 IndexedDB 儲存引擎。
- **`@ios-pages/viewer`** ([`packages/viewer`](file:///Users/yongjhih/works/yongjhih-dental-OrthoCAD/packages/viewer/package.json))：可複用之 React + Three.js 3D 牙弓檢視器 (`DentalViewer3D`)、虛擬咬合器面板 (`ArticulatorPanel`)、五方相簿 (`PentaGallery`) 與規格面板組件。

---

## License

Licensed under the **Apache License, Version 2.0**. See [LICENSE](./LICENSE) for details.
