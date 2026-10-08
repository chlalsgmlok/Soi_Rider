import { fitText, roundRect, type SignPainter, THAI_FONT } from './sign-paint-kit';

/**
 * Sign artwork. "Ink" designs draw only lettering on transparency (the board colour comes from the vertex colour, so
 * one cell serves every board colour); "full" designs paint an opaque plate.
 */

/** fascia frame: a rounded rim in the ink colour (the board colour shows through) */
export function frameInk(ink: string): SignPainter {
  return (g, w, h) => {
    g.strokeStyle = ink;
    g.globalAlpha = 0.85;
    g.lineWidth = h * 0.07;
    roundRect(g, h * 0.1, h * 0.12, w - h * 0.2, h * 0.76, h * 0.14);
    g.stroke();
    g.globalAlpha = 1;
  };
}

/** one line of lettering filling its cell */
export function lineInk(text: string, ink: string, weight = 700): SignPainter {
  return (g, w, h) => {
    g.fillStyle = ink;
    fitText(g, text, w / 2, h * 0.54, w * 0.96, h * 0.92, weight);
  };
}

/** neon tube lettering: coloured halo + pale hot core */
export function neonLine(text: string, color: string): SignPainter {
  return (g, w, h) => {
    g.shadowColor = color;
    g.shadowBlur = h * 0.22;
    g.fillStyle = color;
    fitText(g, text, w / 2, h * 0.54, w * 0.9, h * 0.72, 600);
    g.shadowBlur = 0;
    g.fillStyle = '#fff6fb';
    g.globalAlpha = 0.6;
    fitText(g, text, w / 2, h * 0.54, w * 0.9, h * 0.72, 300);
    g.globalAlpha = 1;
  };
}

/** vertical board: stacked Han characters, or a rotated Thai line */
export function verticalInk(text: string, ink: string): SignPainter {
  return (g, w, h) => {
    g.fillStyle = ink;
    g.strokeStyle = ink;
    g.lineWidth = w * 0.05;
    g.strokeRect(w * 0.1, w * 0.1, w * 0.8, h - w * 0.2);
    const chars = [...text];
    if (/[一-鿿]/.test(text)) {
      const step = (h - w * 0.4) / chars.length;
      chars.forEach((c, i) => fitText(g, c, w / 2, w * 0.2 + step * (i + 0.5), w * 0.7, Math.min(step * 0.86, w * 0.7)));
      return;
    }
    g.save();
    g.translate(w / 2, h / 2);
    g.rotate(Math.PI / 2);
    fitText(g, text, 0, 0, h * 0.84, w * 0.62);
    g.restore();
  };
}

/** blue Bangkok soi plate: Thai over English */
export function soiPlate(th: string, en: string): SignPainter {
  return (g, w, h) => {
    g.fillStyle = '#2457A6';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#f4f1e8';
    g.lineWidth = h * 0.07;
    roundRect(g, h * 0.08, h * 0.08, w - h * 0.16, h * 0.84, h * 0.1);
    g.stroke();
    g.fillStyle = '#ffffff';
    fitText(g, th, w / 2, h * 0.38, w * 0.86, h * 0.4, 600);
    fitText(g, en, w / 2, h * 0.73, w * 0.8, h * 0.22, 500);
  };
}

/** motorcycle-taxi stand crest: "วิน" + stand number */
export function winSign(num: string): SignPainter {
  return (g, w, h) => {
    g.fillStyle = '#FF7A1A';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#fffaf0';
    fitText(g, 'วิน', w * 0.38, h * 0.55, w * 0.5, h * 0.82, 800);
    g.beginPath();
    g.arc(w * 0.78, h * 0.5, h * 0.36, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#FF7A1A';
    fitText(g, num, w * 0.78, h * 0.53, h * 0.6, h * 0.5, 800);
  };
}

/** bus stop route plate */
export function busPlate(routes: readonly string[]): SignPainter {
  return (g, w, h) => {
    g.fillStyle = '#f2f1ec';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#2457A6';
    g.fillRect(0, 0, w, h * 0.34);
    g.fillStyle = '#ffffff';
    fitText(g, 'ป้ายรถเมล์', w / 2, h * 0.18, w * 0.9, h * 0.24, 600);
    g.fillStyle = '#c8302c';
    const step = w / (routes.length + 1);
    routes.forEach((r, i) => fitText(g, r, step * (i + 1), h * 0.68, step * 0.9, h * 0.4, 800));
  };
}

/** convenience store fascia: livery stripes, name, 24H pill */
export function martSign(text: string, en: string, paint: string, paint2: string): SignPainter {
  return (g, w, h) => {
    g.fillStyle = paint;
    g.fillRect(0, 0, w, h);
    g.fillStyle = paint2;
    g.fillRect(0, h * 0.74, w, h * 0.26);
    g.fillStyle = '#ffffff';
    fitText(g, text, w * 0.42, h * 0.4, w * 0.7, h * 0.48, 800);
    roundRect(g, w * 0.8, h * 0.18, w * 0.16, h * 0.42, h * 0.2);
    g.fill();
    g.fillStyle = paint;
    fitText(g, en, w * 0.88, h * 0.4, w * 0.13, h * 0.3, 800);
  };
}

/** mall LED billboard: gradient ad with the mall name and a sale line */
export function mallScreen(name: string): SignPainter {
  return (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#ff4fa3');
    grad.addColorStop(0.55, '#8a5bff');
    grad.addColorStop(1, '#3ee6d4');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.arc(w * ((i * 37) % 100) / 100, h * ((i * 53) % 100) / 100, h * 0.05, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#ffffff';
    fitText(g, name, w / 2, h * 0.38, w * 0.88, h * 0.3, 800);
    g.fillStyle = '#ffe14d';
    fitText(g, 'SALE ลดสูงสุด 70%', w / 2, h * 0.72, w * 0.8, h * 0.18, 700);
  };
}

/** elevated station name board */
export function stationSign(th: string, en: string): SignPainter {
  return (g, w, h) => {
    g.fillStyle = '#16244a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#34b04a';
    roundRect(g, h * 0.12, h * 0.15, h * 1.3, h * 0.7, h * 0.12);
    g.fill();
    g.fillStyle = '#ffffff';
    fitText(g, 'BTS', h * 0.77, h * 0.52, h * 1.1, h * 0.46, 800);
    fitText(g, th, w * 0.48, h * 0.5, w * 0.42, h * 0.6, 700);
    fitText(g, en, w * 0.83, h * 0.52, w * 0.28, h * 0.4, 500);
  };
}

/** chalkboard menu with wooden frame */
export function menuBoard(title: string, items: ReadonlyArray<readonly [string, string]>): SignPainter {
  return (g, w, h) => {
    g.fillStyle = '#7a4a24';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#22362b';
    g.fillRect(w * 0.06, w * 0.06, w * 0.88, h - w * 0.12);
    g.fillStyle = '#ffe58a';
    fitText(g, title, w / 2, h * 0.14, w * 0.8, h * 0.11, 700);
    g.fillStyle = '#f4f1e8';
    g.font = `500 ${h * 0.075}px ${THAI_FONT}`;
    items.slice(0, 4).forEach(([item, price], i) => {
      const y = h * (0.32 + i * 0.16);
      g.textAlign = 'left';
      g.fillText(item, w * 0.14, y);
      g.textAlign = 'right';
      g.fillText(`${price}.-`, w * 0.86, y);
    });
  };
}

/** temple name plaque: gold on lacquer red */
export function templePlaque(name: string): SignPainter {
  return (g, w, h) => {
    g.fillStyle = '#9e1c16';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#e8b640';
    g.lineWidth = h * 0.08;
    g.strokeRect(h * 0.1, h * 0.1, w - h * 0.2, h * 0.8);
    g.fillStyle = '#f1c75a';
    fitText(g, name, w / 2, h * 0.54, w * 0.84, h * 0.56, 700);
  };
}
