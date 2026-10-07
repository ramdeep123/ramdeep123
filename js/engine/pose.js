// On-device pose detection (MediaPipe Pose Landmarker, vendored for offline use),
// camera access, frame-light check, and the "thermal" skeleton overlay.

import { CONNECTIONS, JOINT_IDX, METRIC_JOINTS } from './formcheck.js';

const LOCAL = new URL('../../vendor/mediapipe/', import.meta.url).href;
const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/';
const CDN_MODEL = (m) => `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${m}/float16/1/pose_landmarker_${m}.task`;

/** 'full' = precise (default), 'lite' = fast for older phones. */
export const MODELS = { full: 'Precise', lite: 'Fast' };
const loading = {};

async function create(vision, fileset, modelAssetPath) {
  const opts = (delegate) => ({
    baseOptions: { modelAssetPath, delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.6,
    minPosePresenceConfidence: 0.6,
    minTrackingConfidence: 0.6,
  });
  try {
    return await vision.PoseLandmarker.createFromOptions(fileset, opts('GPU'));
  } catch (e) {
    return await vision.PoseLandmarker.createFromOptions(fileset, opts('CPU'));
  }
}

/** Loads a landmarker once per model. Bundled copy first, then the CDN. */
export function loadPose(model = 'full') {
  if (loading[model]) return loading[model];
  loading[model] = (async () => {
    try {
      const vision = await import(LOCAL + 'vision_bundle.mjs');
      return await create(vision, {
        wasmLoaderPath: LOCAL + 'vision_wasm_internal.js',
        wasmBinaryPath: LOCAL + 'vision_wasm_internal.wasm',
      }, `${LOCAL}pose_landmarker_${model}.task`);
    } catch (localErr) {
      console.warn('Bundled pose model failed, trying CDN', localErr);
      const vision = await import(CDN + 'vision_bundle.mjs');
      const fileset = await vision.FilesetResolver.forVisionTasks(CDN + 'wasm');
      return await create(vision, fileset, CDN_MODEL(model));
    }
  })();
  loading[model].catch(() => { delete loading[model]; });
  return loading[model];
}

let lastTs = 0;
/** Returns {landmarks, world} for the first person, or null. */
export function detect(landmarker, video) {
  let ts = performance.now();
  if (ts <= lastTs) ts = lastTs + 1;
  lastTs = ts;
  const res = landmarker.detectForVideo(video, ts);
  const landmarks = res?.landmarks?.[0];
  if (!landmarks) return null;
  return { landmarks, world: res.worldLandmarks?.[0] || null };
}

export async function openCamera(video, facing = 'user') {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('no-camera-api');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
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

const probe = typeof document !== 'undefined' ? document.createElement('canvas') : null;
/** Average brightness 0–255 of the current video frame (cheap 32×24 sample). */
export function frameBrightness(video) {
  if (!probe || !video.videoWidth) return 128;
  probe.width = 32; probe.height = 24;
  const c = probe.getContext('2d', { willReadFrequently: true });
  c.drawImage(video, 0, 0, 32, 24);
  const d = c.getImageData(0, 0, 32, 24).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  return sum / (d.length / 4);
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

function heat(t, a = 1) {
  // thermal ramp: indigo → magenta → ember → gold → white-hot
  const stops = [[42, 26, 110], [123, 43, 176], [227, 54, 122], [255, 106, 43], [255, 194, 75], [255, 241, 201]];
  t = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(t)), f = t - i;
  const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f));
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

const trail = [];

/**
 * Draw the tracked skeleton. Limbs glow hotter as you approach full depth,
 * faulty joints turn red, and the key joint shows its live angle against the target.
 * focus: { metric, side: 'L'|'R', value, target, reached }
 */
export function drawSkeleton(ctx, lm, map, flagged = new Set(), progress = 0, focus = null) {
  const bad = new Set();
  for (const j of flagged) for (const i of JOINT_IDX[j] || []) bad.add(i);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // limbs: dark core + glowing thermal edge
  for (const [a, b] of CONNECTIONS) {
    if ((lm[a].visibility ?? 1) < 0.45 || (lm[b].visibility ?? 1) < 0.45) continue;
    const pa = map(lm[a]), pb = map(lm[b]);
    const isBad = bad.has(a) || bad.has(b);
    const col = isBad ? 'rgba(255,84,104,0.95)' : heat(0.45 + progress * 0.5, 0.95);
    ctx.shadowColor = isBad ? 'rgba(255,84,104,0.9)' : heat(0.5 + progress * 0.5, 0.8);
    ctx.shadowBlur = 16;
    ctx.strokeStyle = col;
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(12,10,18,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // joints
  for (let i = 11; i <= 32; i++) {
    if ((lm[i].visibility ?? 1) < 0.45) continue;
    const p = map(lm[i]);
    const r = bad.has(i) ? 10 : i <= 28 ? 6 : 4;
    ctx.fillStyle = bad.has(i) ? '#FF5468' : '#FFF1C9';
    ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(12,10,18,0.9)'; ctx.lineWidth = 2; ctx.stroke();
  }

  // head ring
  if ((lm[0].visibility ?? 1) > 0.45) {
    const n = map(lm[0]);
    const s1 = map(lm[11]), s2 = map(lm[12]);
    const r = Math.max(16, Math.hypot(s1[0] - s2[0], s1[1] - s2[1]) * 0.33);
    ctx.strokeStyle = heat(0.75, 0.85); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(n[0], n[1], r, 0, Math.PI * 2); ctx.stroke();
  }

  // live angle on the key joint, with the target marked
  if (focus && METRIC_JOINTS[focus.metric]) {
    const off = focus.side === 'R' ? 1 : 0;
    const [ia, ib, ic] = METRIC_JOINTS[focus.metric].map((i) => i + off);
    if ([ia, ib, ic].every((i) => (lm[i].visibility ?? 1) > 0.45)) {
      const A = map(lm[ia]), B = map(lm[ib]), C = map(lm[ic]);
      const a1 = Math.atan2(A[1] - B[1], A[0] - B[0]);
      let d = Math.atan2(C[1] - B[1], C[0] - B[0]) - a1;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const R = 34;
      ctx.fillStyle = focus.reached ? 'rgba(95,217,154,0.28)' : heat(0.3 + progress * 0.6, 0.28);
      ctx.beginPath(); ctx.moveTo(B[0], B[1]); ctx.arc(B[0], B[1], R, a1, a1 + d, d < 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = focus.reached ? '#5FD99A' : heat(0.55 + progress * 0.45, 1);
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(B[0], B[1], R, a1, a1 + d, d < 0); ctx.stroke();
      // motion trail of the key joint
      trail.push(B);
      if (trail.length > 24) trail.shift();
      for (let i = 1; i < trail.length; i++) {
        ctx.strokeStyle = heat(0.8, (i / trail.length) * 0.5);
        ctx.lineWidth = 2 + (i / trail.length) * 3;
        ctx.beginPath(); ctx.moveTo(trail[i - 1][0], trail[i - 1][1]); ctx.lineTo(trail[i][0], trail[i][1]); ctx.stroke();
      }
      const mid = a1 + d / 2;
      const tx = B[0] - Math.cos(mid) * (R + 30), ty = B[1] - Math.sin(mid) * (R + 30);
      const label = `${Math.round(focus.value)}°`;
      ctx.font = '700 22px "Big Shoulders Display", "Arial Narrow", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const w = ctx.measureText(label).width + 16;
      ctx.fillStyle = 'rgba(12,10,18,0.78)';
      ctx.beginPath(); ctx.roundRect(tx - w / 2, ty - 15, w, 30, 15); ctx.fill();
      ctx.fillStyle = focus.reached ? '#5FD99A' : '#FFF1C9';
      ctx.fillText(label, tx, ty + 1);
      if (focus.target != null) {
        ctx.font = '500 11px "Martian Mono", ui-monospace, monospace';
        ctx.fillStyle = 'rgba(255,241,201,0.8)';
        ctx.fillText(`target ${focus.dir === 'down' ? '≤' : '≥'}${Math.round(focus.target)}°`, tx, ty + 26);
      }
    }
  } else {
    trail.length = 0;
  }
}

export function resetTrail() { trail.length = 0; }
