const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const OUT_DIR = path.resolve(__dirname, '../public/demo');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getTabs() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function main() {
  // Launch Chrome headless
  const chromeProcess = spawn(
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    [
      '--headless=new',
      '--remote-debugging-port=9222',
      '--use-gl=angle',
      '--use-angle=metal',
      '--enable-webgl',
      '--enable-unsafe-webgl',
      '--disable-gpu-sandbox',
      '--no-first-run',
      '--user-data-dir=/tmp/chrome_bake_session',
      'http://localhost:5173/',
    ],
    { stdio: 'ignore' }
  );

  let connected = false;
  let tabs = [];
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    try {
      tabs = await getTabs();
      if (tabs.length > 0) {
        connected = true;
        break;
      }
    } catch {
      // wait
    }
  }

  if (!connected) {
    console.error('Failed to connect to Chrome CDP');
    chromeProcess.kill();
    process.exit(1);
  }

  const pageTab = tabs.find((t) => t.type === 'page') || tabs[0];
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  let id = 1;
  const pending = new Map();

  ws.on('message', (msg) => {
    const res = JSON.parse(msg);
    if (res.id && pending.has(res.id)) {
      const { resolve, reject } = pending.get(res.id);
      pending.delete(res.id);
      if (res.error) reject(res.error);
      else resolve(res.result);
    }
  });

  await new Promise((r) => ws.on('open', r));

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const reqId = id++;
      pending.set(reqId, { resolve, reject });
      ws.send(JSON.stringify({ id: reqId, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      console.error('Evaluation exception:', JSON.stringify(res.exceptionDetails, null, 2));
    }
    return res.result?.value;
  }

  // Wait for Three.js / React app to initialize
  await sleep(2000);

  console.log('Baking 5-view clinical photos from 3D procedural arches...');

  const bakeScript = `
    (async function() {
      // Use THREE from module
      const threeMod = await import('/node_modules/.vite/deps/three.js');
      const THREE = threeMod.WebGLRenderer ? threeMod : threeMod.default;

      // Import procedural arch generator from source
      const procMod = await import('/src/utils/proceduralArch.ts');
      const createGeom = procMod.createProceduralDentalArchGeometry;

      const upperGeom = createGeom(true);
      const lowerGeom = createGeom(false);

      const width = 1600;
      const height = 1200;

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(1);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xfbfcfe);

      // Studio lights
      const ambLight = new THREE.AmbientLight(0xffffff, 1.4);
      scene.add(ambLight);

      const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
      keyLight.position.set(-50, -120, 100);
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0xdbeafe, 1.1);
      fillLight.position.set(60, 80, 70);
      scene.add(fillLight);

      const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.7);
      rimLight.position.set(0, 100, -80);
      scene.add(rimLight);

      // Material utilizing vertex colors for realistic tooth enamel + gingiva
      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.32,
        metalness: 0.02,
        side: THREE.DoubleSide,
      });

      const upperMesh = new THREE.Mesh(upperGeom, mat);
      const lowerMesh = new THREE.Mesh(lowerGeom, mat);
      scene.add(upperMesh);
      scene.add(lowerMesh);

      // Orthographic camera for distortion-free 1:1 orthographic projection
      // Bounding box: X in [-33, 33] (span ~66), Y in [-47, 8] (span ~55), Z in [-15, 16] (span ~31)
      const camOrtho = new THREE.OrthographicCamera(-45, 45, 34, -34, 1, 500);

      const results = {};

      // 1. Front view: looking along +Y, upper + lower
      upperMesh.visible = true;
      lowerMesh.visible = true;
      camOrtho.left = -44;
      camOrtho.right = 44;
      camOrtho.top = 33;
      camOrtho.bottom = -33;
      camOrtho.updateProjectionMatrix();
      camOrtho.position.set(0, -120, 0.5);
      camOrtho.up.set(0, 0, 1);
      camOrtho.lookAt(0, -19.5, 0.5);
      renderer.render(scene, camOrtho);
      results.front = renderer.domElement.toDataURL('image/png');

      // 2. Upper occlusal view: looking along +Z from below (anterior at top, posterior at bottom)
      upperMesh.visible = true;
      lowerMesh.visible = false;
      camOrtho.left = -42;
      camOrtho.right = 42;
      camOrtho.top = 34;
      camOrtho.bottom = -34;
      camOrtho.updateProjectionMatrix();
      camOrtho.position.set(0, -19.5, -120);
      camOrtho.up.set(0, -1, 0); // Anterior (-Y) is at TOP of image
      camOrtho.lookAt(0, -19.5, 0);
      renderer.render(scene, camOrtho);
      results.upper = renderer.domElement.toDataURL('image/png');

      // 3. Lower occlusal view: looking along -Z from above (posterior at top, anterior at bottom)
      upperMesh.visible = false;
      lowerMesh.visible = true;
      camOrtho.left = -40;
      camOrtho.right = 40;
      camOrtho.top = 34;
      camOrtho.bottom = -34;
      camOrtho.updateProjectionMatrix();
      camOrtho.position.set(0, -19.5, 120);
      camOrtho.up.set(0, 1, 0); // Posterior (+Y) is at TOP of image
      camOrtho.lookAt(0, -19.5, 0);
      renderer.render(scene, camOrtho);
      results.lower = renderer.domElement.toDataURL('image/png');

      // 4. Right buccal view: looking along +X (Anterior on RIGHT, Posterior on LEFT)
      upperMesh.visible = true;
      lowerMesh.visible = true;
      camOrtho.left = -42;
      camOrtho.right = 42;
      camOrtho.top = 32;
      camOrtho.bottom = -32;
      camOrtho.updateProjectionMatrix();
      camOrtho.position.set(-120, -19.5, 0.5);
      camOrtho.up.set(0, 0, 1);
      camOrtho.lookAt(0, -19.5, 0.5);
      renderer.render(scene, camOrtho);
      results.patientright = renderer.domElement.toDataURL('image/png');

      // 5. Left buccal view: looking along -X (Anterior on LEFT, Posterior on RIGHT)
      upperMesh.visible = true;
      lowerMesh.visible = true;
      camOrtho.left = -42;
      camOrtho.right = 42;
      camOrtho.top = 32;
      camOrtho.bottom = -32;
      camOrtho.updateProjectionMatrix();
      camOrtho.position.set(120, -19.5, 0.5);
      camOrtho.up.set(0, 0, 1);
      camOrtho.lookAt(0, -19.5, 0.5);
      renderer.render(scene, camOrtho);
      results.patientleft = renderer.domElement.toDataURL('image/png');

      return results;
    })();
  `;

  const baked = await evaluate(bakeScript);

  if (!baked || !baked.front) {
    console.error('Baking failed: No image data returned');
    chromeProcess.kill();
    process.exit(1);
  }

  const views = ['front', 'upper', 'lower', 'patientright', 'patientleft'];
  for (const view of views) {
    const dataUrl = baked[view];
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    const outPath = path.join(OUT_DIR, `penta_${view}.png`);
    fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));
    console.log(`Saved ${outPath} (${(base64Data.length / 1024).toFixed(1)} KB)`);
  }

  // Generate bakedDemoPhotos.ts
  const tsContent = `// Auto-generated 3D offline baked clinical photos for demo dataset
// Rendered directly from createProceduralDentalArchGeometry with 100% orthographic alignment.

export const BAKED_DEMO_PHOTOS: Record<string, string> = {
  front: '${baked.front}',
  upper: '${baked.upper}',
  lower: '${baked.lower}',
  patientright: '${baked.patientright}',
  patientleft: '${baked.patientleft}',
};
`;

  const tsPath = path.resolve(__dirname, '../src/data/bakedDemoPhotos.ts');
  fs.writeFileSync(tsPath, tsContent);
  console.log(`Saved ${tsPath}`);

  chromeProcess.kill();
  console.log('Baking complete!');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
