import * as THREE from 'three/webgpu';
import { AppHost } from './src/core/AppHost';

THREE.ColorManagement.enabled = true;

const updateLoadingProgressBar = async (fraction: number, delay = 0) => {
  const progress = document.getElementById('progress');
  if (!progress) return;
  progress.style.width = `${fraction * 200}px`;
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
};

function createRenderer() {
  const renderer = new THREE.WebGPURenderer({});
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

function showError(message: string) {
  const progressBar = document.getElementById('progress-bar');
  if (progressBar) {
    progressBar.style.opacity = '0';
  }
  const error = document.getElementById('error');
  if (error) {
    error.style.visibility = 'visible';
    error.innerText = `Error: ${message}`;
    error.style.pointerEvents = 'auto';
  }
}

async function run() {
  if (!navigator.gpu) {
    showError('Your device does not support WebGPU.');
    return;
  }

  const renderer = createRenderer();
  await renderer.init();
  const backend = renderer.backend as unknown as { isWebGPUBackend?: boolean };
  if (!backend.isWebGPUBackend) {
    showError("Couldn't initialize WebGPU. Make sure WebGPU is supported by your Browser!");
    return;
  }

  const container = document.getElementById('container');
  if (!container) {
    showError('Missing container element.');
    return;
  }
  container.appendChild(renderer.domElement);

  const app = new AppHost(renderer);
  await app.init(updateLoadingProgressBar);

  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    app.resize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', resize);
  resize();

  const veil = document.getElementById('veil');
  if (veil) {
    veil.style.opacity = '0';
  }
  const progressBar = document.getElementById('progress-bar');
  if (progressBar) {
    progressBar.style.opacity = '0';
  }

  const clock = new THREE.Clock();
  const animate = async () => {
    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();
    await app.update(delta, elapsed);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}

run().catch((error) => {
  console.error(error);
  showError(error instanceof Error ? error.message : String(error));
});
