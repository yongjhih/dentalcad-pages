import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../App';
import {
  detectScannerVendor,
  parseScannerXmlString,
  parseUrlDataParameter,
  createUncompressedZipBuffer,
  extractDentalFilesFromZip,
  buildCaseBundleFromFiles,
  DEFAULT_CASE_BUNDLE,
} from '@dentalcad-pages/core';

describe('DentalCAD Pages Application Integration Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('boots in zero-PHI browser sandbox mode, places secondary metadata in Dossier tab, and toggles privacy', () => {
    render(<App />);

    // Navigate to the Dossier & Specifications tab where secondary administrative archive info lives
    fireEvent.click(screen.getByTestId('tab-dossier'));

    // Default state: anonymizePatient = true ("Demo, Calibration Arch" -> "D***, C***** A***", "Universal DentalCAD Clinic" -> "U***** D***** Dental Clinic")
    expect(screen.queryByText(/Demo, Calibration Arch/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Universal DentalCAD Clinic/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/D\*\*\*, C\*\*\*\*\* A\*\*\*/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/U\*\*\*\*\* D\*\*\*\*\* Clinic/).length).toBeGreaterThan(0);

    // Click the privacy toggle button in the header ("匿名已啟用")
    const privacyBtn = screen.getByTitle(/目前為匿名保護模式/);
    fireEvent.click(privacyBtn);

    // Synthetic demo clinic, doctor, and patient names should now be visible in the secondary archive section
    expect(screen.getAllByText(/Demo, Calibration Arch/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Universal DentalCAD Clinic/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Dr\. Demo, Clinician/).length).toBeGreaterThan(0);
  });

  it('auto-detects multiple intraoral scanner vendors (3Shape TRIOS, Medit, Shining3D, Generic) via @dentalcad-pages/core', () => {
    expect(detectScannerVendor([{ name: '12345_shell_occlusion_u.stl' }]).vendor).toBe('scanner_a');
    expect(detectScannerVendor([{ name: 'UpperJawScan.stl' }, { name: '3ShapeOrder.xml' }]).vendor).toBe('3shape');
    expect(detectScannerVendor([{ name: 'medit_maxilla.stl' }]).vendor).toBe('medit');
    expect(detectScannerVendor([{ name: 'aoralscan_upper.stl' }]).vendor).toBe('shining3d');
    expect(detectScannerVendor([{ name: 'arch_upper.stl' }]).vendor).toBe('generic');

    const triosMeta = parseScannerXmlString(
      '<ThreeShape><OrderID>TRIOS-99</OrderID><PatientName>Lin, Mei</PatientName><UserName>Dr. Wang</UserName></ThreeShape>',
      'fallback',
      [{ name: 'UpperJawScan.stl' }]
    );
    expect(triosMeta.scannerVendor).toBe('3shape');
    expect(triosMeta.orderId).toBe('TRIOS-99');
  });

  it('switches between Dark and Light themes and persists in localStorage', () => {
    render(<App />);

    // Default theme is dark
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    const themeBtn = screen.getByTitle(/切換為亮色佈景/);
    fireEvent.click(themeBtn);

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('dentalcad_theme')).toBe('light');

    const backToDarkBtn = screen.getByTitle(/切換為暗色佈景/);
    fireEvent.click(backToDarkBtn);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('dentalcad_theme')).toBe('dark');
  });

  it('switches between Traditional Chinese (zh-TW) and English (en) locales', () => {
    render(<App />);

    expect(screen.getByText('虛擬咬合器與下顎運動模擬')).toBeInTheDocument();

    const localeBtn = screen.getByTestId('locale-toggle-btn');
    fireEvent.click(localeBtn);

    expect(document.documentElement.lang).toBe('en');
    expect(
      screen.getByText('Virtual Articulator & 6-DOF Mandibular Kinematics')
    ).toBeInTheDocument();
    expect(screen.getByTestId('tab-articulator')).toHaveTextContent(
      'Articulator & Occlusogram'
    );

    fireEvent.click(localeBtn);
    expect(document.documentElement.lang).toBe('zh-TW');
    expect(screen.getByText('虛擬咬合器與下顎運動模擬')).toBeInTheDocument();
  });

  it('simulates 6-DOF mandibular articulation and updates trajectory when curve & condylar parameters change', () => {
    render(<App />);

    // Articulator tab is the default tab
    expect(screen.getByText('虛擬咬合器與下顎運動模擬')).toBeInTheDocument();

    // At initial progress = 0, incisal opening and rotation are 0.0
    expect(screen.getByTestId('kinematic-incisal-opening')).toHaveTextContent('0.0 mm');
    expect(screen.getByTestId('kinematic-rotation-deg')).toHaveTextContent('0.0°');

    // Move progress slider to 0.70 (70% opening along Posselt curve)
    const progressSlider = screen.getByTestId('articulator-progress-slider');
    fireEvent.change(progressSlider, { target: { value: '0.7' } });

    const openingAfterSlide = screen.getByTestId('kinematic-incisal-opening').textContent!;
    const rotAfterSlide = screen.getByTestId('kinematic-rotation-deg').textContent!;
    expect(parseFloat(openingAfterSlide)).toBeGreaterThan(15);
    expect(parseFloat(rotAfterSlide)).toBeGreaterThan(10);

    // Switch curve preset from Posselt to Pure Hinge and verify condylar slip changes
    const slipBeforePreset = parseFloat(
      screen.getByTestId('kinematic-condylar-slip').textContent!
    );
    fireEvent.click(screen.getByTestId('curve-preset-pure_hinge'));
    const slipAfterPureHinge = parseFloat(
      screen.getByTestId('kinematic-condylar-slip').textContent!
    );
    expect(slipAfterPureHinge).not.toBe(slipBeforePreset);

    // Adjust custom Bezier control point P1 Y slider
    const p1ySlider = screen.getByTestId('bezier-p1y-slider');
    fireEvent.change(p1ySlider, { target: { value: '0.82' } });
    expect(screen.getByText('Custom Curve')).toBeInTheDocument();

    // Switch articulation mode to Protrusion and Lateral Left
    fireEvent.click(screen.getByTestId('articulation-mode-protrusion'));
    expect(
      parseFloat(screen.getByTestId('kinematic-incisal-opening').textContent!)
    ).toBeGreaterThan(3);

    fireEvent.click(screen.getByTestId('articulation-mode-lateral_left'));
    expect(
      parseFloat(screen.getByTestId('kinematic-incisal-opening').textContent!)
    ).toBeGreaterThan(2);
  });

  it('toggles Occlusogram heatmap and manages 3D Digital Caliper measurements', () => {
    render(<App />);

    // Toggle Occlusogram ON
    const occBtn = screen.getByTestId('occlusogram-toggle-btn');
    expect(occBtn).toHaveTextContent('開啟咬合熱力圖');
    fireEvent.click(occBtn);
    expect(occBtn).toHaveTextContent('熱力圖已開啟');

    // Verify Arch Metrics are rendered
    expect(screen.getByTestId('arch-canine-width')).toHaveTextContent('34.8 / 27.4 mm');
    expect(screen.getByTestId('arch-molar-width')).toHaveTextContent('52.6 / 47.2 mm');
    expect(screen.getByTestId('arch-overjet-overbite')).toHaveTextContent(
      'OJ 2.6 mm · OB 2.4 mm'
    );

    // Verify 3D Digital Caliper measurements can be added and cleared
    expect(screen.getAllByTestId('caliper-measurement-item')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('add-sample-caliper-btn'));
    expect(screen.getAllByTestId('caliper-measurement-item')).toHaveLength(2);

    fireEvent.click(screen.getByTestId('clear-caliper-btn'));
    expect(screen.queryAllByTestId('caliper-measurement-item')).toHaveLength(0);
  });

  it('provides mobile-friendly upload buttons, viewport HUD collapse toggle, and mobile split layout controls', async () => {
    render(<App />);

    // Verify Header upload button and file input are accessible
    const headerUploadBtn = screen.getByTestId('header-upload-btn');
    expect(headerUploadBtn).toBeInTheDocument();
    expect(headerUploadBtn).toHaveTextContent(/上傳檔案/);

    // Verify 3D Viewport upload trigger is rendered (not hidden on mobile)
    const viewportUploadLabel = screen.getByTestId('viewport-upload-label');
    expect(viewportUploadLabel).toBeInTheDocument();

    // Verify Mobile Quick Upload & Layout Bar buttons are present
    expect(screen.getByTestId('mobile-quick-bar')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-upload-bundle-btn')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-upload-upper-btn')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-upload-lower-btn')).toBeInTheDocument();

    // Verify Mobile Viewport Layout ratio switcher works (3D Max / Split / Panel)
    fireEvent.click(screen.getByTestId('mobile-layout-3d'));
    fireEvent.click(screen.getByTestId('mobile-layout-panel'));
    fireEvent.click(screen.getByTestId('mobile-layout-split'));

    // Verify 3D Viewport floating HUD can be collapsed and expanded on mobile
    const hudToggleBtn = screen.getByTestId('viewport-hud-toggle');
    expect(screen.getByText('下顎運動行程')).toBeInTheDocument();
    fireEvent.click(hudToggleBtn);
    expect(screen.queryByText('下顎運動行程')).not.toBeInTheDocument();
    fireEvent.click(hudToggleBtn);
    expect(screen.getByText('下顎運動行程')).toBeInTheDocument();
  });

  it('extracts dental files (.stl, .xml, .jpg) from .zip archives and resolves ?url= parameters', async () => {
    // 1. Test ?url= parameter parsing (with wrapped double quotes and local macOS path)
    const parsed = parseUrlDataParameter(
      '"/Users/yongjhih/Downloads/Export_99887766.zip"'
    );
    expect(parsed.cleanedUrlOrPath).toBe('/Users/yongjhih/Downloads/Export_99887766.zip');
    expect(parsed.fileName).toBe('Export_99887766.zip');
    expect(parsed.inferredCaseId).toBe('99887766');
    expect(parsed.isLocalFilePath).toBe(true);
    expect(parsed.isRemoteHttpUrl).toBe(false);

    // 2. Test in-memory ZIP extraction of .stl, .xml, and .jpg while ignoring __MACOSX resource forks
    const zipBuffer = createUncompressedZipBuffer([
      { name: 'Export_99887766/99887766_shell_occlusion_u.stl', content: 'solid upper' },
      { name: 'Export_99887766/99887766_shell_occlusion_l.stl', content: 'solid lower' },
      {
        name: 'Export_99887766/99887766_v50.xml',
        content: '<DentalCAD><OrderID>99887766</OrderID></DentalCAD>',
      },
      { name: '__MACOSX/Export_99887766/._99887766_shell_occlusion_u.stl', content: 'junk' },
    ]);

    const extracted = await extractDentalFilesFromZip(zipBuffer);
    expect(extracted.map((f) => f.name)).toEqual([
      '99887766_shell_occlusion_u.stl',
      '99887766_shell_occlusion_l.stl',
      '99887766_v50.xml',
    ]);

    // 3. Test uploading a .zip file directly into buildCaseBundleFromFiles
    const zipFile = new File([zipBuffer], 'Export_99887766.zip', {
      type: 'application/zip',
    });
    const bundleFromZip = await buildCaseBundleFromFiles([zipFile], DEFAULT_CASE_BUNDLE);
    expect(bundleFromZip.id).toBe('99887766');
    expect(bundleFromZip.assets.upperStlFileName).toBe('99887766_shell_occlusion_u.stl');
    expect(bundleFromZip.assets.lowerStlFileName).toBe('99887766_shell_occlusion_l.stl');

    // 4. Test ?url= local path banner rendering when opening with ?url="/Users/.../Export_99887766.zip"
    const originalUrl = window.location.href;
    window.history.replaceState(
      {},
      '',
      '/?url=%22/Users/yongjhih/Downloads/Export_99887766.zip%22'
    );

    render(<App />);
    const banner = await screen.findByTestId('url-param-loader-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('/Users/yongjhih/Downloads/Export_99887766.zip');
    expect(screen.getByTestId('url-param-pick-btn')).toHaveTextContent(
      '選擇 Export_99887766.zip 載入'
    );

    window.history.replaceState({}, '', originalUrl);
  });
});
