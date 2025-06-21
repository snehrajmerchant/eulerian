// Eulerian variable defaults
window.alpha = 50;
window.lambda_c = 16;
window.exaggeration_factor = 2;
window.chromAttenuation = 0.1;
window.r1 = 0.4;
window.r2 = 0.05;
window.blurStrength = 1;
window.denoiseEnabled = false;
window.denoiseStrength = 1;

const originalCanvas = document.getElementById('originalCanvas');
const enhancedCanvas = document.getElementById('enhancedCanvas');
const oCtx = originalCanvas.getContext('2d');
const eCtx = enhancedCanvas.getContext('2d');

const video = document.createElement('video');
video.autoplay = true;
video.playsInline = true;
video.width = 320;
video.height = 240;

// Create hidden canvases for color.js
window.canvas = document.createElement('canvas');
window.savnac = document.createElement('canvas');
// Optionally, keep them hidden
window.canvas.style.display = 'none';
window.savnac.style.display = 'none';
document.body.appendChild(window.canvas);
document.body.appendChild(window.savnac);

// Sets up a slider UI element to control a global variable and display its value.
function setupSlider(id, variable) {
  const slider = document.getElementById(id);
  const valueSpan = document.getElementById(id.replace('Slider', 'Value'));
  slider.addEventListener('input', (e) => {
    window[variable] = parseFloat(e.target.value);
    valueSpan.textContent = e.target.value;
  });
  // Set initial value
  window[variable] = parseFloat(slider.value);
  valueSpan.textContent = slider.value;
}

setupSlider('alphaSlider', 'alpha');
setupSlider('lambdaSlider', 'lambda_c');
setupSlider('exaggerationSlider', 'exaggeration_factor');
setupSlider('chromSlider', 'chromAttenuation');
setupSlider('r1Slider', 'r1');
setupSlider('r2Slider', 'r2');
setupSlider('blurSlider', 'blurStrength');
setupSlider('denoiseSlider', 'denoiseStrength');

// Denoise toggle
const denoiseToggle = document.getElementById('denoiseToggle');
denoiseToggle.addEventListener('change', (e) => {
  window.denoiseEnabled = e.target.checked;
});
window.denoiseEnabled = denoiseToggle.checked;

// Eulerian state
let initialized = false;

// Temporal denoising buffer
const MAX_DENOISE_FRAMES = 10;
let denoiseFrameBuffer = [];

function getTemporalDenoisedImageData(ctx, width, height) {
  // Get current frame
  const imageData = ctx.getImageData(0, 0, width, height);
  // Add to buffer
  denoiseFrameBuffer.push(new Uint8ClampedArray(imageData.data));
  // Limit buffer size
  const framesToUse = Math.max(1, Math.round(window.denoiseStrength));
  while (denoiseFrameBuffer.length > framesToUse) {
    denoiseFrameBuffer.shift();
  }
  // If only one frame, return as is
  if (denoiseFrameBuffer.length === 1 || framesToUse === 1) {
    return imageData;
  }
  // Average frames
  const avgData = new Uint8ClampedArray(imageData.data.length);
  for (let i = 0; i < avgData.length; i++) {
    let sum = 0;
    for (let f = 0; f < denoiseFrameBuffer.length; f++) {
      sum += denoiseFrameBuffer[f][i];
    }
    avgData[i] = Math.round(sum / denoiseFrameBuffer.length);
  }
  return new ImageData(avgData, width, height);
}

// Initializes the Eulerian video magnification processing if not already initialized.
function initEulerian(videoWidth, videoHeight) {
  if (typeof demo_app === 'function') {
    demo_app(videoWidth, videoHeight);
    initialized = true;
  }
}

// Main animation loop: draws video, applies enhancement, and updates canvases each frame.
function draw() {
  if (video.readyState >= 2) {
    // Draw original
    oCtx.drawImage(video, 0, 0, originalCanvas.width, originalCanvas.height);
    // Draw enhanced
    if (!initialized) {
      initEulerian(originalCanvas.width, originalCanvas.height);
    }
    // Ensure hidden canvases are always the correct size
    if (window.canvas.width !== originalCanvas.width || window.canvas.height !== originalCanvas.height) {
      window.canvas.width = originalCanvas.width;
      window.canvas.height = originalCanvas.height;
    }
    if (window.savnac.width !== enhancedCanvas.width || window.savnac.height !== enhancedCanvas.height) {
      window.savnac.width = enhancedCanvas.width;
      window.savnac.height = enhancedCanvas.height;
    }
    // Draw video frame to hidden input canvas
    const cctx = window.canvas.getContext('2d');
    cctx.drawImage(video, 0, 0, window.canvas.width, window.canvas.height);
    // Apply temporal denoising if enabled
    let processedImageData = null;
    if (window.denoiseEnabled && window.denoiseStrength > 1) {
      processedImageData = getTemporalDenoisedImageData(cctx, window.canvas.width, window.canvas.height);
      cctx.putImageData(processedImageData, 0, 0);
    } else {
      // Reset buffer if not using temporal denoise
      denoiseFrameBuffer = [];
    }
    // Apply blur if blurStrength > 0
    if (window.blurStrength > 0) {
      cctx.filter = `blur(${window.blurStrength}px)`;
      cctx.drawImage(window.canvas, 0, 0);
      cctx.filter = 'none';
    }
    // Run Eulerian enhancement
    if (typeof evm === 'function') {
      evm();
      // Copy result from savnac (color.js output canvas) to enhancedCanvas
      eCtx.drawImage(window.savnac, 0, 0, enhancedCanvas.width, enhancedCanvas.height);
    }
  }
  requestAnimationFrame(draw);
}

let currentStream = null;

function stopCurrentStream() {
  if (currentStream && currentStream.getTracks) {
    currentStream.getTracks().forEach(track => track.stop());
  }
  currentStream = null;
}

function useCamera() {
  stopCurrentStream();
  video.loop = false;
  navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    .then((stream) => {
      video.srcObject = stream;
      currentStream = stream;
      video.onloadedmetadata = () => {
        video.play();
        requestAnimationFrame(draw);
      };
    })
    .catch((err) => {
      alert('Could not access webcam: ' + err.message);
    });
}

function useVideoFile(file) {
  stopCurrentStream();
  video.loop = true;
  const url = URL.createObjectURL(file);
  video.srcObject = null;
  video.src = url;
  video.onloadedmetadata = () => {
    video.play();
    requestAnimationFrame(draw);
  };
}

document.getElementById('useCameraBtn').addEventListener('click', useCamera);
document.getElementById('loadVideoBtn').addEventListener('click', function() {
  document.getElementById('videoFileInput').click();
});
document.getElementById('videoFileInput').addEventListener('change', function(e) {
  if (e.target.files && e.target.files[0]) {
    useVideoFile(e.target.files[0]);
  }
});

// Start with video file by default
window.addEventListener('DOMContentLoaded', function() {
  document.getElementById('videoFileInput').click();
});

function setPreset(params) {
  const mapping = [
    ['alpha', 'alphaSlider', 'alphaValue'],
    ['lambda_c', 'lambdaSlider', 'lambdaValue'],
    ['exaggeration_factor', 'exaggerationSlider', 'exaggerationValue'],
    ['chromAttenuation', 'chromSlider', 'chromValue'],
    ['r1', 'r1Slider', 'r1Value'],
    ['r2', 'r2Slider', 'r2Value'],
    ['blurStrength', 'blurSlider', 'blurValue'],
    ['denoiseStrength', 'denoiseSlider', 'denoiseValue']
  ];
  mapping.forEach(([v, slider, span]) => {
    if (params[v] !== undefined) {
      window[v] = params[v];
      document.getElementById(slider).value = params[v];
      document.getElementById(span).textContent = params[v];
    }
  });
  if (params.denoiseEnabled !== undefined) {
    window.denoiseEnabled = params.denoiseEnabled;
    document.getElementById('denoiseToggle').checked = params.denoiseEnabled;
  }
}

document.getElementById('presetDefault').addEventListener('click', function() {
  setPreset({
    alpha: 50, lambda_c: 16, exaggeration_factor: 2, chromAttenuation: 0.1, r1: 0.4, r2: 0.05, blurStrength: 1, denoiseEnabled: false, denoiseStrength: 1
  });
});
document.getElementById('presetSkin').addEventListener('click', function() {
  setPreset({
    alpha: 90, lambda_c: 8, exaggeration_factor: 4, chromAttenuation: 0.01, r1: 0.5, r2: 0.1, blurStrength: 0, denoiseEnabled: false, denoiseStrength: 1
  });
});
document.getElementById('presetHeartbeat').addEventListener('click', function() {
  setPreset({
    alpha: 80, lambda_c: 8, exaggeration_factor: 5, chromAttenuation: 0.05, r1: 0.6, r2: 0.2, blurStrength: 0, denoiseEnabled: false, denoiseStrength: 1
  });
});
document.getElementById('presetSubtle').addEventListener('click', function() {
  setPreset({
    alpha: 30, lambda_c: 20, exaggeration_factor: 1.5, chromAttenuation: 0.2, r1: 0.3, r2: 0.05, blurStrength: 1, denoiseEnabled: false, denoiseStrength: 1
  });
});