import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../App';
import { detectScannerVendor, parseScannerXmlString } from '@ios-pages/core';

describe('IOS Pages Application Integration Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('boots in zero-PHI browser sandbox mode, places secondary metadata in Dossier tab, and toggles privacy', () => {
    render(<App />);

    // Navigate to the Dossier & Specifications tab where secondary administrative archive info lives
    fireEvent.click(screen.getByTestId('tab-dossier'));

    // Default state: anonymizePatient = true ("Demo, Calibration Arch" -> "D***, C***** A***", "Universal IOS Dental Clinic" -> "U***** I** Dental Clinic")
    expect(screen.queryByText(/Demo, Calibration Arch/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Universal IOS Dental Clinic/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/D\*\*\*, C\*\*\*\*\* A\*\*\*/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/U\*\*\*\*\* I\*\* Dental Clinic/).length).toBeGreaterThan(0);

    // Click the privacy toggle button in the header ("匿名已啟用")
    const privacyBtn = screen.getByTitle(/目前為匿名保護模式/);
    fireEvent.click(privacyBtn);

    // Synthetic demo clinic, doctor, and patient names should now be visible in the secondary archive section
    expect(screen.getAllByText(/Demo, Calibration Arch/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Universal IOS Dental Clinic/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Dr\. Demo, Clinician/).length).toBeGreaterThan(0);
  });

  it('auto-detects multiple intraoral scanner vendors (iTero, 3Shape TRIOS, Medit, Shining3D, Generic) via @ios-pages/core', () => {
    expect(detectScannerVendor([{ name: '12345_shell_occlusion_u.stl' }]).vendor).toBe('itero');
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
    expect(localStorage.getItem('orthocad_theme')).toBe('light');

    const backToDarkBtn = screen.getByTitle(/切換為暗色佈景/);
    fireEvent.click(backToDarkBtn);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('orthocad_theme')).toBe('dark');
  });

  it('simulates 6-DOF mandibular articulation and updates trajectory when curve & condylar parameters change', () => {
    render(<App />);

    // Articulator tab is the default tab
    expect(screen.getByText('iTero 虛擬咬合器與下顎運動模擬')).toBeInTheDocument();

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

  it('toggles iTero Occlusogram heatmap and manages OrthoCAD 3D Digital Caliper measurements', () => {
    render(<App />);

    // Toggle iTero Occlusogram ON
    const occBtn = screen.getByTestId('occlusogram-toggle-btn');
    expect(occBtn).toHaveTextContent('開啟咬合熱力圖');
    fireEvent.click(occBtn);
    expect(occBtn).toHaveTextContent('熱力圖已開啟');

    // Verify OrthoCAD Arch Metrics are rendered
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
});
