/** Mini-map overlay glyphs drawn in screen space: coral target pin and the cyan player arrow. */

export function drawPin(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + 1, 4, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FF4D5E';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x - 3, y - 5, x - 7, y - 8, x - 7, y - 12);
  ctx.arc(x, y - 12, 7, Math.PI, 0);
  ctx.bezierCurveTo(x + 7, y - 8, x + 3, y - 5, x, y);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x, y - 12, 2.6, 0, Math.PI * 2);
  ctx.fill();
}

export function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = 'rgba(62,230,212,.25)';
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3EE6D4';
  ctx.strokeStyle = '#151821';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y - 9);
  ctx.lineTo(x + 6.5, y + 7);
  ctx.lineTo(x, y + 3.5);
  ctx.lineTo(x - 6.5, y + 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}
