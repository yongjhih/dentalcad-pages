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
  detectInitialLocale,
  LOCALE_STORAGE_KEY,
} from '@dentalcad-pages/core';

describe('DentalCAD Pages Application Integration Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('auto-detects browser language and defaults to English (en) when non-Chinese or undetectable', () => {
    // Undetectable or empty navigator -> defaults to 'en'
    expect(detectInitialLocale({ language: '', languages: [] }, '')).toBe('en');
    // English or other non-Chinese languages -> defaults to 'en'
    expect(detectInitialLocale({ language: 'en-US', languages: ['en-US', 'en'] }, '')).toBe('en');
    expect(detectInitialLocale({ language: 'ja-JP', languages: ['ja-JP'] }, '')).toBe('en');
    // Chinese variants -> detects 'zh-TW'
    expect(detectInitialLocale({ language: 'zh-TW', languages: ['zh-TW', 'en'] }, '')).toBe(
      'zh-TW'
    );
    expect(detectInitialLocale({ language: 'zh-Hant-HK', languages: ['zh-Hant-HK'] }, '')).toBe(
      'zh-TW'
    );
    // URL query param override
    expect(detectInitialLocale({ language: 'en-US', languages: ['en-US'] }, '?lang=zh-TW')).toBe(
      'zh-TW'
    );
    expect(detectInitialLocale({ language: 'zh-TW', languages: ['zh-TW'] }, '?lang=en')).toBe(
      'en'
    );
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

    // Click the privacy toggle button in the header
    const privacyBtn = screen.getByTestId('header-privacy-toggle-btn');
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

    const themeBtn = screen.getByTestId('theme-toggle-btn');
    fireEvent.click(themeBtn);

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('dentalcad_theme')).toBe('light');

    fireEvent.click(themeBtn);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('dentalcad_theme')).toBe('dark');
  });

  it('renders all buttons, camera presets, and tabs in English by default and switches cleanly to Traditional Chinese (zh-TW)', () => {
    // In jsdom navigator.language is 'en-US' -> defaults to 'en'
    render(<App />);

    expect(document.documentElement.lang).toBe('en');
    expect(
      screen.getByText('Virtual Articulator & 6-DOF Mandibular Kinematics')
    ).toBeInTheDocument();
    expect(screen.getByTestId('header-upload-btn')).toHaveTextContent('Load');
    expect(screen.getByTestId('camera-preset-front')).toHaveTextContent('Front');
    expect(screen.getByTestId('camera-preset-isometric')).toHaveTextContent('Isometric');
    expect(screen.getByTestId('articulator-play-toggle')).toHaveTextContent('Auto-Play Motion');
    expect(screen.getByTestId('curve-preset-posselt')).toHaveTextContent(
      'Posselt Envelope (Biphasic)'
    );

    // Check English copy across all other tabs
    fireEvent.click(screen.getByTestId('tab-gallery'));
    expect(
      screen.getByText('5-View Intraoral Clinical Photography')
    ).toBeInTheDocument();
    expect(screen.getByTestId('gallery-upload-label')).toHaveTextContent(
      'Load Intraoral Photos & STL Files'
    );

    fireEvent.click(screen.getByTestId('tab-tools'));
    expect(screen.getByText('Surface Shaders & Optical Materials')).toBeInTheDocument();
    expect(screen.getByTestId('tools-load-bundle-btn')).toHaveTextContent(
      'Load Case Files (.zip / .xml / .stl / .jpg)'
    );
    expect(screen.getByTestId('tools-load-upper-btn')).toHaveTextContent('Load Upper STL');
    expect(screen.getByTestId('tools-load-lower-btn')).toHaveTextContent('Load Lower STL');

    fireEvent.click(screen.getByTestId('tab-dossier'));
    expect(screen.getByText('Maxillary Arch (Upper)')).toBeInTheDocument();
    expect(screen.getByText('Download Upper STL')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('tab-xml'));
    expect(screen.getByTestId('xml-copy-btn')).toHaveTextContent('Copy XML');

    // Switch back to Articulator tab and toggle language to zh-TW
    fireEvent.click(screen.getByTestId('tab-articulator'));
    const localeBtn = screen.getByTestId('locale-toggle-btn');
    fireEvent.click(localeBtn);

    expect(document.documentElement.lang).toBe('zh-TW');
    expect(screen.getByText('虛擬咬合器與下顎運動模擬')).toBeInTheDocument();
    expect(screen.getByTestId('header-upload-btn')).toHaveTextContent('加載');
    expect(screen.getByTestId('camera-preset-front')).toHaveTextContent('正視咬合');
    expect(screen.getByTestId('articulator-play-toggle')).toHaveTextContent('自動播放運動');
  });

  it('simulates 6-DOF mandibular articulation and updates trajectory when curve & condylar parameters change', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'zh-TW');
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
    localStorage.setItem(LOCALE_STORAGE_KEY, 'zh-TW');
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
    localStorage.setItem(LOCALE_STORAGE_KEY, 'zh-TW');
    render(<App />);

    // Verify Header upload button and file input are accessible
    const headerUploadBtn = screen.getByTestId('header-upload-btn');
    expect(headerUploadBtn).toBeInTheDocument();
    expect(headerUploadBtn).toHaveTextContent(/加載/);

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
      'Load Export_99887766.zip'
    );

    window.history.replaceState({}, '', originalUrl);
  });

  it('supports collapsing and expanding the right sidebar panel on both desktop and mobile', () => {
    render(<App />);

    const sidebar = screen.getByTestId('right-sidebar-panel');
    expect(sidebar).not.toHaveClass('hidden');
    expect(screen.queryByTestId('sidebar-expand-btn')).not.toBeInTheDocument();

    // Collapse sidebar via desktop/tab-bar button
    fireEvent.click(screen.getByTestId('sidebar-collapse-btn'));
    expect(sidebar).toHaveClass('hidden');

    const expandBtn = screen.getByTestId('sidebar-expand-btn');
    expect(expandBtn).toBeInTheDocument();

    // Expand sidebar via floating expand button
    fireEvent.click(expandBtn);
    expect(sidebar).not.toHaveClass('hidden');
    expect(screen.queryByTestId('sidebar-expand-btn')).not.toBeInTheDocument();

    // Collapse & expand via mobile quick bar toggle button
    const mobileToggleBtn = screen.getByTestId('mobile-sidebar-toggle-btn');
    fireEvent.click(mobileToggleBtn);
    expect(sidebar).toHaveClass('hidden');
    fireEvent.click(mobileToggleBtn);
    expect(sidebar).not.toHaveClass('hidden');
  });

  it('exposes MCP Pages link, covpages link, and interactive Ask AI assistant drawer', async () => {
    render(<App />);

    // Verify MCP and covpages links in Header
    const mcpLink = screen.getByTestId('header-mcp-link');
    expect(mcpLink).toHaveAttribute('href', 'mcp.html');

    const covLink = screen.getByTestId('header-covpages-link');
    expect(covLink).toHaveAttribute('href', 'covpages/');

    // Open Ask AI drawer
    const askAiBtn = screen.getByTestId('header-ask-ai-btn');
    fireEvent.click(askAiBtn);

    const drawer = screen.getByTestId('ask-ai-drawer');
    expect(drawer).toBeInTheDocument();

    // Toggle settings panel inside Ask AI drawer
    fireEvent.click(screen.getByTestId('ask-ai-settings-toggle'));
    expect(screen.getByTestId('ask-ai-settings-panel')).toBeInTheDocument();

    // Click quick prompt chips to verify MCP, Heatmap, and Coverage replies
    fireEvent.click(screen.getByTestId('ask-ai-chip-mcp'));
    expect(await screen.findByText(/dentalcad_get_overview/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ask-ai-chip-heatmap'));
    expect(await screen.findByText(/Occlusogram Contact Heatmap/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ask-ai-chip-covpages'));
    expect(await screen.findByText(/GitHub Primer-styled/i)).toBeInTheDocument();

    // Close Ask AI drawer
    fireEvent.click(screen.getByTestId('ask-ai-close-btn'));
    expect(screen.queryByTestId('ask-ai-drawer')).not.toBeInTheDocument();
  });

  it('provides dedicated vertical articulation seek bar and spring-back mandibular joystick', () => {
    render(<App />);

    // Vertical seek bar
    const verticalSeekBar = screen.getByTestId('vertical-articulation-seekbar');
    expect(verticalSeekBar).toBeInTheDocument();
    fireEvent.change(verticalSeekBar, { target: { value: '0.45' } });
    expect(verticalSeekBar).toHaveValue('0.45');

    // Play/Pause button on vertical toolbar
    const playBtn = screen.getByTestId('vertical-play-toggle-btn');
    expect(playBtn).toBeInTheDocument();
    fireEvent.click(playBtn);

    // Spring-back joystick pad and thumb
    const joystickPad = screen.getByTestId('mandibular-joystick-pad');
    const joystickThumb = screen.getByTestId('mandibular-joystick-thumb');
    expect(joystickPad).toBeInTheDocument();
    expect(joystickThumb).toBeInTheDocument();

    // Simulate drag and release
    fireEvent.pointerDown(joystickPad, { clientX: 50, clientY: 80 });
    fireEvent.pointerMove(joystickPad, { clientX: 65, clientY: 95 });
    fireEvent.pointerUp(joystickPad);

    // Verify spring back
    expect(verticalSeekBar).toHaveValue('0');
  });

  it('supports 5-view photo texture as a material shader alongside enamel, and allows simultaneous occlusogram heatmap overlay', async () => {
    render(<App />);

    // Switch to CAD Tools tab
    fireEvent.click(screen.getByTestId('tab-tools'));

    // Check that '5-View Photo Texture' is available in the Shaders list
    const textureRadio = screen.getByRole('radio', { name: /5-View Photo Texture|五方位臨床貼圖/i });
    expect(textureRadio).toBeInTheDocument();

    // Select Texture shading mode
    fireEvent.click(textureRadio);
    expect(textureRadio).toBeChecked();

    // Toggle Occlusogram Heatmap from the 3D HUD quick toggle
    const occlusogramBtn = screen.getByTestId('hud-occlusogram-btn');
    expect(occlusogramBtn).toBeInTheDocument();

    fireEvent.click(occlusogramBtn);
    // Button becomes active (red background)
    expect(occlusogramBtn.className).toContain('bg-rose-600');

    // Texture should STILL remain checked/selected in the shader list!
    expect(textureRadio).toBeChecked();

    // Switch to Plaster shading mode while Occlusogram is active
    const plasterRadio = screen.getByRole('radio', { name: /Plaster|石膏模型/i });
    fireEvent.click(plasterRadio);
    expect(plasterRadio).toBeChecked();

    // Occlusogram should STILL remain active!
    expect(occlusogramBtn.className).toContain('bg-rose-600');
  });
});
