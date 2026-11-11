# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + TypeScript + Vite + Tailwind CSS + Lucide Icons + Three.js (STLLoader, OrbitControls)
Deploys statically to GitHub Pages (`https://yongjhih.github.io/dental-OrthoCAD/`) via GitHub Actions.

## Users

- Orthodontists, oral surgeons, dental lab technicians, and dental CAD/CAM professionals reviewing iTero digital impressions and Invisalign case prescriptions.
- Patient or clinical collaborators inspecting 3D dental anatomy (maxilla and mandible STL models) and treatment plans.
- Dental software engineers and researchers inspecting dental scan formats, occlusion transforms, and metadata exports.

## Product Purpose

A high-craft, precision orthodontic CAD web viewer and clinical case showcase for Align iTero digital dental scans. It provides immediate, high-fidelity browser-based 3D STL visualization with real-time dental shading, dual-arch occlusion analysis, clinical penta-view photography review, and digital prescription examination—running entirely client-side on GitHub Pages without requiring specialized desktop CAD installation.

## Positioning

Unlike generic 3D file visualizers or static web pages, this application is purpose-built for orthodontic scan workflows: native dual-arch upper/lower occlusion alignment, orthodontic standard camera angles (buccal, occlusal, frontal), clinical enamel shaders, metadata extraction directly from iTero XML / Rx schemas, and drag-and-drop support for ad-hoc dental STL inspection.

## Operating Context

- Used in dental clinic consultation rooms, laboratory CAD workstations, or mobile devices under clean clinical and diagnostic environments.
- Primary datasets:
  - Upper arch STL (`297077963_shell_occlusion_u.stl`)
  - Lower arch STL (`297077963_shell_occlusion_l.stl`)
  - 5-view orthodontic photos (`gallery_#297077963_penta_*.jpg`, `gallery_#297077963.jpg`)
  - Clinical metadata (`itero_export_#297077963_v50.xml`, `iTero_Rx_297077963.pdf`, `Rx_297077963.html`)

## Capabilities and Constraints

- **3D STL Occlusion Viewer**: Three.js WebGL rendering for binary/ASCII STL files, capable of handling 15MB+ meshes with multi-threaded or streaming buffer geometry, vertex normal recomputation, bounding box auto-centering, and occlusion positioning.
- **Arch Controls**: Independent upper/lower visibility toggles, opacity sliders, vertical jaw separation (exploded occlusion view), and arch distinction colors.
- **Rendering Modes**: Clinical Enamel (subsurface pearlescent effect), Diagnostic Matte Bone, Topology Wireframe, Normal Vector Visualization, and Semi-translucent Overlay.
- **Orthodontic Viewports**: Frontal, Maxillary Occlusal, Mandibular Occlusal, Right Buccal, Left Buccal, Free Orbit.
- **Penta Gallery**: Five-view clinical photography viewer with zoom, full-screen lightbox, and synchronized perspective cues.
- **Clinical Case Metadata**: Case ID, patient identifier, practitioner credentials, clinic location, scan date, ADA tooth ranges (1-16, 17-32), and export transforms.
- **Custom Model Ingestion**: Local drag-and-drop STL file dropzone to inspect any external dental scan client-side with zero server upload.
- **Zero Server Overhead**: 100% static client-side bundle deployable to GitHub Pages.

## Brand Commitments

- Precision medical CAD aesthetic adhering to the Impeccable craft floor: no marketing fluff, no gradient text, no non-functional card containers, crisp typography with tabular numbers for metric coordinates, subtle dental slate/charcoal dark theme matching diagnostic workstation screens.
- Respectful handling of clinical data with optional privacy toggle (anonymize patient name if desired).

## Evidence on Hand

- Real dental STL scan models: `297077963_shell_occlusion_l.stl` and `297077963_shell_occlusion_u.stl`.
- Real clinical 5-view photos and composite overview: `gallery_#297077963*.jpg`.
- Real iTero XML exports: `itero_export_#297077963_v50.xml` and `itero_export_#297077963_v30.xml`.
- Real prescription and logo: `iTero_Rx_297077963.pdf`, `Rx_297077963.html`, `itero_element_logo.png`.

## Product Principles

1. **Clinical Accuracy First**: 3D dental models must render with accurate geometry, smooth normal calculations, and faithful occlusion coordinates as exported by the scanner.
2. **Immediate Responsiveness**: Smooth 60fps orbit/pan/zoom interactions, progressive loading with informative progress metrics for 15MB STL meshes, zero UI freezing.
3. **Diagnostic Restraint**: Clean, dark workstation interface inspired by professional CAD suites (e.g. OrthoCAD, Maestro 3D, 3Shape, iTero Element). Every control has a specific clinical diagnostic purpose.
4. **Standalone Portability**: Fully self-contained static site that works across modern desktop and tablet browsers on GitHub Pages.
