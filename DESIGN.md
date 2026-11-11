---
name: iTero OrthoCAD 3D Design System
description: Clinical orthodontic 3D CAD viewer and diagnostic case review suite
colors:
  primary: "#0284c7"
  primary-hover: "#0369a1"
  accent-cyan: "#38bdf8"
  bg-deep: "#090d16"
  surface-card: "#0f172a"
  surface-panel: "#131d31"
  border-subtle: "#1e293b"
  text-primary: "#f8fafc"
  text-muted: "#94a3b8"
  enamel-maxilla: "#fed7aa"
  enamel-mandible: "#93c5fd"
typography:
  display:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  small:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  caption:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "normal"
  micro:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "normal"
  data-mono:
    fontFamily: "JetBrains Mono, SFMono-Regular, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  button-secondary:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
---

# Design System: iTero OrthoCAD 3D

## Overview
A precision orthodontic CAD and diagnostic review interface engineered for digital dental scans, 3D occlusion evaluation, and clinical case analysis. Adheres to the Impeccable craft floor: no marketing gradient fluff, no decorative blur, high-contrast surgical legibility, and tabular numerals for spatial coordinates.

## Colors
- **Ground / Obsidian Black** (`#090d16`): Low-glare dark environment matching medical CAD diagnostic monitors.
- **Surface Card** (`#0f172a`): Distinct tonal layer for clinical panels and tool groups.
- **Border Subtle** (`#1e293b`): Crisp 1px structural framing.
- **Accent Cyan** (`#38bdf8`): Active camera pill highlights, focus rings, and selection accents.
- **Maxilla / Mandible Distinction**: Soft warm ivory (`#fed7aa`) and cool sky ivory (`#93c5fd`) for occlusion contact differentiation.

## Typography
- **Primary Interface**: Inter (system-ui fallback), clean weights (400, 500, 600) with balanced headings.
- **Metric & Clinical Data**: JetBrains Mono / SFMono with `font-variant-numeric: tabular-nums` for triangle counts, coordinate bounding boxes, order codes, and XML data.
- **Craft Rules**: No gradient text; emphasis achieved purely through font weight, size, and tonal contrast.

## Layout
- **Dual-Pane Workstation Split**:
  - Primary CAD 3D Viewport on the left (60-70% desktop width, dominant focus).
  - Diagnostic Dossier & Tool Drawer on the right (30-40% desktop width).
  - Responsive collapse to stacked view on mobile / tablet.
- **Spacing**: Generous separation between functional groups, tight internal clustering (8px/12px).

## Elevation & Depth
- Soft, realistic shadows (`box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.4)`) with an offset and blur. No harsh zero-blur cartoon borders.
- Tonal layering: Ground (`#090d16`) → Card (`#0f172a`) → Sub-panel (`#131d31`) → Interactive hover (`#1e293b`).

## Shapes
- Radius: `4px` (sub-components, pills) and `8px` (panels, modal dialogs).
- Medical toolbar design with tactile micro-indicators and active status rings.

## Components
- **3D Dental Canvas**: WebGL Three.js viewport with camera preset pills, occlusion separation slider, and real-time FPS/triangle counter.
- **Case Dossier**: Structured medical record sheet with patient anonymization toggle.
- **Penta Gallery**: 5-view clinical photography grid with synchronized 3D camera navigation.
- **CAD Tools**: Multi-axis cross-section clipping, enamel/plaster/normal/wireframe shaders, and external STL file dropzone.

## Do's and Don'ts
- **DO** use `tabular-nums` for all dental measurements, triangle counts, and order timestamps.
- **DO** preserve accurate scanner orientation and occlusion matrices.
- **DON'T** use gradient text or decorative non-functional emojis.
- **DON'T** use bounce or elastic animations; use smooth exponential decelerations.
