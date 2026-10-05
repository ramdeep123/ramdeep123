// On-device pose detection (MediaPipe Pose Landmarker, vendored for offline use),
// camera access, and the skeleton overlay drawn over the live video.

import { CONNECTIONS, JOINT_IDX } from './formcheck.js';

const LOCAL = new URL('../../vendor/mediapipe/', import.meta.url).href;
const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/';
const CDN_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

let loading = null;

async function create(vision, fileset, modelAssetPath) {
  const opts = (delegate) => ({
    baseOptions: { modelAssetPath, delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  try {
    return await vision.PoseLandmarker.createFromOptions(fileset, opts('GPU'));
  } catch (e) {
    return await vision.PoseLandmarker.createFromOptions(fileset, opts('CPU'));
  }
}

/** Loads the landmarker once. Tries the bundled copy first, then the CDN. */
export function loadPose() {
  if (loading) return loading;
  loading = (async () => {
    try {
      const vision = await import(LOCAL + 'vision_bundle.mjs');
      return await create(vision, {
        wasmLoaderPath: LOCAL + 'vision_wasm_internal.js',
        wasmBinaryPath: LOCAL + 'vision_wasm_internal.wasm',
      }, LOCAL + 'pose_landmarker_lite.task');
    } catch (localErr) {
      console.warn('Bundled pose model failed, trying CDN', localErr);
      const vision = await import(CDN + 'vision_bundle.mjs');
      const fileset = await vision.FilesetResolver.forVisionTasks(CDN + 'wasm');
      return await create(vision, fileset, CDN_MODEL);
    }
  })();
  loading.catch(() => { loading = null; });
  return loading;
}

let lastTs = 0;
export function detect(landmarker, video) {
  let ts = performance.now();
  if (ts <= lastTs) ts = lastTs + 1;
  lastTs = ts;
  const res = landmarker.detectForVideo(video, ts);
  return res?.landmarks?.[0] || null;
}

export async function openCamera(video, facing = 'user') {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('no-camera-api');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: facing, width: { ideal: 960 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
  });
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  return stream;
}

export function stopStream(stream) {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Map a normalized landmark into the canvas, matching object-fit: cover. */
export function coverMapper(video, cw, ch, mirror) {
  const vw = video.videoWidth || cw, vh = video.videoHeight || ch;
  const s = Math.max(cw / vw, ch / vh);
  const ox = (cw - vw * s) / 2, oy = (ch - vh * s) / 2;
  return (p) => {
    let x = p.x * vw * s + ox;
    if (mirror) x = cw - x;
    return [x, p.y * vh * s + oy];
  };
}

/** Draw the tracked skeleton in thermal colours; flagged joints turn red. */
export function drawSkeleton(ctx, lm, map, flagged = new Set(), progress = 0) {
  const bad = new Set();
  for (const j of flagged) for (const i of JOINT_IDX[j] || []) bad.add(i);
  const hot = `hsl(${28 - progress * 20}, 100%, ${58 + progress * 8}%)`;
  ctx.lineCap = 'round';
  for (const [a, b] of CONNECTIONS) {
    if ((lm[a].visibility ?? 1) < 0.4 || (lm[b].visibility ?? 1) < 0.4) continue;
    const pa = map(lm[a]), pb = map(lm[b]);
    const isBad = bad.has(a) || bad.has(b);
    ctx.strokeStyle = isBad ? 'rgba(255,84,104,0.95)' : 'rgba(255,106,43,0.9)';
    ctx.shadowColor = isBad ? 'rgba(255,84,104,0.9)' : 'rgba(255,106,43,0.7)';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
  }
  ctx.shadowBlur = 0;
  for (let i = 11; i <= 32; i++) {
    if ((lm[i].visibility ?? 1) < 0.4) continue;
    const p = map(lm[i]);
    ctx.fillStyle = bad.has(i) ? '#FF5468' : hot;
    ctx.beginPath(); ctx.arc(p[0], p[1], bad.has(i) ? 9 : 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(12,10,18,0.9)'; ctx.lineWidth = 2; ctx.stroke();
  }
  if ((lm[0].visibility ?? 1) > 0.4) {
    const n = map(lm[0]);
    const s1 = map(lm[11]), s2 = map(lm[12]);
    const r = Math.max(14, Math.hypot(s1[0] - s2[0], s1[1] - s2[1]) * 0.33);
    ctx.strokeStyle = 'rgba(255,194,75,0.8)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(n[0], n[1], r, 0, Math.PI * 2); ctx.stroke();
  }
}
