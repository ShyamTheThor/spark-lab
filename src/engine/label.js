import * as THREE from "three";
import { tLabel } from "../i18n/config.js";

const FONT_STACK =
  "'Bricolage Grotesque', 'Noto Sans Devanagari', 'Noto Sans Kannada', 'Noto Sans Tamil', 'Noto Sans Telugu', 'Noto Sans Malayalam', 'Noto Sans Bengali', sans-serif";

function drawLabelCanvas(text, opts = {}) {
  const { fontSize = 40, color = "#1c1c1f", background = "rgba(255,255,255,0.88)" } = opts;
  const display = tLabel(text) || text;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const padX = 22;
  const padY = 14;
  ctx.font = `700 ${fontSize}px ${FONT_STACK}`;
  const textWidth = ctx.measureText(display).width || fontSize * display.length * 0.55;
  canvas.width = Math.ceil(textWidth + padX * 2);
  canvas.height = Math.ceil(fontSize + padY * 2);
  ctx.font = `700 ${fontSize}px ${FONT_STACK}`;

  const w = canvas.width;
  const h = canvas.height;
  const r = h / 2;
  ctx.fillStyle = background;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(w, 0, w, h, r);
  ctx.arcTo(w, h, 0, h, r);
  ctx.arcTo(0, h, 0, 0, r);
  ctx.arcTo(0, 0, w, 0, r);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(display, w / 2, h / 2 + 1);
  return { canvas, w, h };
}

const activeLabels = new Set();
if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
  document.addEventListener("spark-language", () => {
    for (const ref of activeLabels) {
      const sprite = ref.deref();
      if (!sprite) {
        activeLabels.delete(ref);
        continue;
      }
      const { text, opts } = sprite.userData._sparkLabel || {};
      if (!text) continue;
      const { canvas, w, h } = drawLabelCanvas(text, opts);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      sprite.material.map?.dispose?.();
      sprite.material.map = tex;
      sprite.material.needsUpdate = true;
      const baseHeight = 0.5 * (opts.scale ?? 1);
      sprite.scale.set(baseHeight * (w / h), baseHeight, 1);
    }
  });
}

export function createLabel(text, opts = {}) {
  const { scale = 1 } = opts;
  const { canvas, w, h } = drawLabelCanvas(text, opts);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.userData._sparkLabel = { text, opts };
  if (typeof WeakRef !== "undefined") activeLabels.add(new WeakRef(sprite));
  const aspect = w / h;
  const baseHeight = 0.5 * scale;
  sprite.scale.set(baseHeight * aspect, baseHeight, 1);
  sprite.renderOrder = 999;
  return sprite;
}
