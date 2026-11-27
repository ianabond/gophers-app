import Phaser from 'phaser';
import type { PlatformMaterial } from '../types/game';

function makeCanvas(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  drawFn: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const ctx = tex.getContext();
  drawFn(ctx, w, h);
  tex.refresh();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function generateAllTextures(scene: Phaser.Scene): void {
  makeCanvas(scene, 'carrot', 46, 54, (ctx) => {
    ctx.fillStyle = '#3f9d47';
    ctx.beginPath();
    ctx.ellipse(23, 10, 5, 11, -0.35, 0, Math.PI * 2);
    ctx.ellipse(23, 9, 5, 12, 0.35, 0, Math.PI * 2);
    ctx.ellipse(23, 8, 4, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    const grad = ctx.createLinearGradient(14, 16, 32, 48);
    grad.addColorStop(0, '#ff9c38');
    grad.addColorStop(1, '#e05812');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(13, 18);
    ctx.quadraticCurveTo(23, 12, 33, 18);
    ctx.lineTo(25, 49);
    ctx.quadraticCurveTo(23, 52, 21, 49);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#993809';
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,240,200,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(18, 22);
    ctx.lineTo(21, 38);
    ctx.stroke();

    ctx.strokeStyle = '#b5440c';
    ctx.beginPath();
    ctx.moveTo(17, 25);
    ctx.lineTo(24, 25);
    ctx.moveTo(22, 33);
    ctx.lineTo(28, 33);
    ctx.stroke();
  });

  makeCanvas(scene, 'stump_nest', 124, 110, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(62, 102, 54, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    const barkGrad = ctx.createLinearGradient(22, 24, 102, 100);
    barkGrad.addColorStop(0, '#7c5032');
    barkGrad.addColorStop(0.55, '#643d24');
    barkGrad.addColorStop(1, '#492a17');
    ctx.fillStyle = barkGrad;
    ctx.beginPath();
    ctx.moveTo(26, 26);
    ctx.lineTo(98, 26);
    ctx.quadraticCurveTo(106, 75, 114, 98);
    ctx.lineTo(10, 98);
    ctx.quadraticCurveTo(18, 75, 26, 26);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#361d0e';
    ctx.stroke();

    ctx.strokeStyle = '#472816';
    ctx.lineWidth = 2;
    [36, 48, 84, 93].forEach((bx) => {
      ctx.beginPath();
      ctx.moveTo(bx, 34);
      ctx.lineTo(bx + (bx < 62 ? -4 : 4), 92);
      ctx.stroke();
    });

    ctx.fillStyle = '#d9b482';
    ctx.beginPath();
    ctx.ellipse(62, 26, 37, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6c4527';
    ctx.stroke();

    ctx.fillStyle = '#53a24c';
    ctx.beginPath();
    ctx.ellipse(44, 29, 20, 7, -0.1, 0, Math.PI * 2);
    ctx.ellipse(80, 29, 18, 6, 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1b110c';
    ctx.beginPath();
    ctx.moveTo(42, 98);
    ctx.lineTo(42, 64);
    ctx.arc(62, 64, 20, Math.PI, 0, false);
    ctx.lineTo(82, 98);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#996b45';
    ctx.stroke();

    const glow = ctx.createRadialGradient(62, 74, 2, 62, 74, 22);
    glow.addColorStop(0, 'rgba(255, 210, 105, 0.85)');
    glow.addColorStop(1, 'rgba(255, 160, 40, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(62, 74, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f2e8cf';
    ctx.fillRect(15, 86, 5, 10);
    ctx.fillStyle = '#e05344';
    ctx.beginPath();
    ctx.arc(17.5, 86, 8, Math.PI, 0);
    ctx.fill();
  });

  makeCanvas(scene, 'mushroom_pad', 76, 44, (ctx) => {
    ctx.fillStyle = '#f5ead6';
    roundRect(ctx, 27, 20, 22, 22, 6);
    ctx.fill();
    ctx.strokeStyle = '#bda88c';
    ctx.lineWidth = 2;
    ctx.stroke();

    const capGrad = ctx.createLinearGradient(6, 4, 70, 26);
    capGrad.addColorStop(0, '#ff6a5b');
    capGrad.addColorStop(1, '#c72c22');
    ctx.fillStyle = capGrad;
    ctx.beginPath();
    ctx.moveTo(6, 24);
    ctx.quadraticCurveTo(38, -6, 70, 24);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#7e1a13';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#fff5e4';
    [
      [22, 16, 5],
      [38, 10, 6],
      [54, 16, 4.5],
      [30, 20, 3],
    ].forEach(([sx, sy, sr]) => {
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  makeCanvas(scene, 'shaman_plank', 164, 20, (ctx) => {
    const grad = ctx.createLinearGradient(0, 0, 0, 20);
    grad.addColorStop(0, '#c88c4b');
    grad.addColorStop(1, '#8c5827');
    ctx.fillStyle = grad;
    roundRect(ctx, 1, 1, 162, 18, 5);
    ctx.fill();
    ctx.strokeStyle = '#f5cb6c';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffe59c';
    ctx.beginPath();
    ctx.arc(12, 10, 3, 0, Math.PI * 2);
    ctx.arc(152, 10, 3, 0, Math.PI * 2);
    ctx.arc(82, 10, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });

  makeCanvas(scene, 'shaman_crate', 52, 52, (ctx) => {
    ctx.fillStyle = '#b4773e';
    roundRect(ctx, 1, 1, 50, 50, 6);
    ctx.fill();
    ctx.strokeStyle = '#5c3818';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#915c2c';
    ctx.fillRect(8, 8, 36, 36);

    ctx.strokeStyle = '#d39a5d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(8, 8);
    ctx.lineTo(44, 44);
    ctx.moveTo(44, 8);
    ctx.lineTo(8, 44);
    ctx.stroke();
  });

  makeCanvas(scene, 'gust_orb', 96, 96, (ctx) => {
    const grad = ctx.createRadialGradient(48, 48, 4, 48, 48, 46);
    grad.addColorStop(0, 'rgba(170, 245, 225, 0.65)');
    grad.addColorStop(0.6, 'rgba(110, 215, 200, 0.28)');
    grad.addColorStop(1, 'rgba(110, 215, 200, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(48, 48, 46, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(230, 255, 250, 0.85)';
    ctx.lineWidth = 2.5;
    [32, 48, 64].forEach((y) => {
      ctx.beginPath();
      ctx.moveTo(24, y);
      ctx.quadraticCurveTo(48, y - 10, 72, y);
      ctx.stroke();
    });
  });

  makeCanvas(scene, 'particle_dust', 12, 12, (ctx) => {
    ctx.fillStyle = 'rgba(245, 235, 215, 0.85)';
    ctx.beginPath();
    ctx.arc(6, 6, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  makeCanvas(scene, 'particle_sparkle', 16, 16, (ctx) => {
    ctx.fillStyle = '#fff3a8';
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(10, 6);
    ctx.lineTo(16, 8);
    ctx.lineTo(10, 10);
    ctx.lineTo(8, 16);
    ctx.lineTo(6, 10);
    ctx.lineTo(0, 8);
    ctx.lineTo(6, 6);
    ctx.closePath();
    ctx.fill();
  });

  makeCanvas(scene, 'particle_leaf', 14, 14, (ctx) => {
    ctx.fillStyle = '#73c766';
    ctx.beginPath();
    ctx.ellipse(7, 7, 6, 3.5, 0.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function ensureBunnyTexture(scene: Phaser.Scene, furColor: string): string {
  const safeKey = `bunny_${furColor.replace('#', '')}`;
  if (scene.textures.exists(safeKey)) return safeKey;

  makeCanvas(scene, safeKey, 48, 56, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(10, 41, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3c3029';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = furColor;
    ctx.beginPath();
    ctx.ellipse(19, 13, 4.5, 11, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(28, 12, 4.8, 11.5, 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f5a9bc';
    ctx.beginPath();
    ctx.ellipse(28, 13, 2.3, 7, 0.14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = furColor;
    ctx.beginPath();
    ctx.ellipse(24, 40, 13, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(25, 27, 12, 10.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = furColor;
    ctx.beginPath();
    ctx.ellipse(19, 51, 5, 3.2, 0, 0, Math.PI * 2);
    ctx.ellipse(30, 51, 5, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(247, 148, 168, 0.55)';
    ctx.beginPath();
    ctx.arc(28, 30, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#241b17';
    ctx.beginPath();
    ctx.arc(31, 25, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(31.8, 24.1, 0.9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#eb7b93';
    ctx.beginPath();
    ctx.arc(36, 28, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  return safeKey;
}

export function drawPlatformTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  material: PlatformMaterial,
): void {
  makeCanvas(scene, key, w, h, (ctx) => {
    if (material === 'ice') {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#c8f0ff');
      grad.addColorStop(1, '#7bc4e8');
      ctx.fillStyle = grad;
      roundRect(ctx, 1, 1, w - 2, h - 2, 8);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(16, 6);
      ctx.lineTo(36, h - 6);
      ctx.moveTo(Math.max(50, w * 0.45), 6);
      ctx.lineTo(Math.max(70, w * 0.45 + 20), h - 6);
      ctx.stroke();
    } else if (material === 'wood') {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#b57b45');
      grad.addColorStop(1, '#7c4c23');
      ctx.fillStyle = grad;
      roundRect(ctx, 1, 1, w - 2, h - 2, 6);
      ctx.fill();
      ctx.strokeStyle = '#4c2c12';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (material === 'stone') {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#6b757d');
      grad.addColorStop(1, '#444b52');
      ctx.fillStyle = grad;
      roundRect(ctx, 1, 1, w - 2, h - 2, 8);
      ctx.fill();
      ctx.strokeStyle = '#2c3136';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#53d1b6';
      roundRect(ctx, 3, 2, w - 6, 7, 4);
      ctx.fill();
    } else {
      ctx.fillStyle = '#6f4b32';
      roundRect(ctx, 1, 6, w - 2, h - 7, 8);
      ctx.fill();
      ctx.strokeStyle = '#3b2415';
      ctx.lineWidth = 2;
      ctx.stroke();

      const grassGrad = ctx.createLinearGradient(0, 0, 0, 14);
      grassGrad.addColorStop(0, '#78c962');
      grassGrad.addColorStop(1, '#489340');
      ctx.fillStyle = grassGrad;
      roundRect(ctx, 0, 0, w, 15, 7);
      ctx.fill();
    }
  });
}
