// Generates Fastline brand + store assets from one parametric SVG mark.
// Mark = a ring with a gap. The long arc is the fast; the gap is the eating window (amber).
// Usage: node scripts/make-assets.js            (renders candidates + chosen direction)
// Needs devDependencies: @resvg/resvg-js (SVG rasteriser), pngjs (alpha strip for opaque PNGs).
// Also writes the native launcher/notification/splash-dark assets into android/ and ios/ (bare React Native):
//   android/app/src/main/res/{mipmap-*,mipmap-anydpi-v26,drawable-*,values-night,drawable-night-*}
//   ios/Fastline/Images.xcassets/{AppIcon,Ocean,Dusk,Sunrise}.appiconset + Colors.xcassets/SplashBackground, Images.xcassets/SplashLogo (light + dark)
// `node scripts/make-assets.js splash` regenerates only the native splash assets.
const { Resvg } = require('@resvg/resvg-js');
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const STORE = path.join(ROOT, 'docs', 'store-assets');
const CAND = path.join(STORE, 'candidates');
[ASSETS, STORE, CAND].forEach((d) => fs.mkdirSync(d, { recursive: true }));

const CHOSEN = 'B';

// Colour tokens (mirror src/theme.ts).
const T = {
  accent: '#26705F', accentDark: '#4FB59E', amberLight: '#C27400', amberDark: '#F5B45E',
  amber: '#F2A541', bgLight: '#FAFAF7', bgDark: '#0F1412',
  tealTop: '#318A75', tealBot: '#1B5446', // icon field gradient, derived from accent
};

let uid = 0;
const rad = (d) => (d * Math.PI) / 180;
const pt = (cx, cy, R, a) => [cx + R * Math.sin(rad(a)), cy - R * Math.cos(rad(a))];
function arc(cx, cy, R, a0, a1) {
  const [x0, y0] = pt(cx, cy, R, a0), [x1, y1] = pt(cx, cy, R, a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

// Geometry in a 1024 box. Gap is centred at 45deg (upper right, clockwise from 12 o'clock).
const G = { R: 290, W: 96, g0: 13, g1: 77 };

/** Returns SVG elements for the mark centred at (512,512), scaled by s. */
function mark(variant, { fast, eat, track, shadow = true, s = 1 }) {
  const { R, W, g0, g1 } = G, c = 512, mid = (g0 + g1) / 2, id = `m${uid++}`;
  const fastArc = (col, extra = '') =>
    `<path d="${arc(c, c, R, g1, g0 + 360)}" fill="none" stroke="${col}" stroke-width="${W}" stroke-linecap="round" ${extra}/>`;
  let body = '', sh = '';
  if (variant === 'A') {
    const [dx, dy] = pt(c, c, R, mid);
    sh = fastArc('#000') + `<circle cx="${dx}" cy="${dy}" r="${W * 0.56}" fill="#000"/>`;
    body = fastArc(fast) + `<circle cx="${dx}" cy="${dy}" r="${W * 0.56}" fill="${eat}"/>`;
  } else if (variant === 'B') {
    const eatArc = (col) => `<path d="${arc(c, c, R, mid - 8, mid + 8)}" fill="none" stroke="${col}" stroke-width="${W}" stroke-linecap="round"/>`;
    sh = fastArc('#000') + eatArc('#000');
    body = `<circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke="${track.c}" stroke-opacity="${track.o}" stroke-width="${W}"/>`
      + fastArc(fast) + eatArc(eat);
  } else {
    // C: fast arc fades in from the start (tail) to full strength at the head; amber dot with halo.
    const N = 48, a0 = g1, a1 = g0 + 360, step = (a1 - a0) / N;
    let segs = '';
    for (let i = 0; i < N; i++) {
      const o = (0.28 + 0.72 * (i / (N - 1))).toFixed(3);
      segs += `<path d="${arc(c, c, R, a0 + i * step - 0.4, a0 + (i + 1) * step + 0.4)}" fill="none" stroke="${fast}" stroke-opacity="${o}" stroke-width="${W}"/>`;
    }
    const [sx, sy] = pt(c, c, R, a0), [ex, ey] = pt(c, c, R, a1), [dx, dy] = pt(c, c, R, mid);
    sh = fastArc('#000');
    body = segs + `<circle cx="${sx}" cy="${sy}" r="${W / 2}" fill="${fast}" fill-opacity="0.28"/>`
      + `<circle cx="${ex}" cy="${ey}" r="${W / 2}" fill="${fast}"/>`
      + `<circle cx="${dx}" cy="${dy}" r="${W * 0.95}" fill="${eat}" fill-opacity="0.18"/>`
      + `<circle cx="${dx}" cy="${dy}" r="${W * 0.5}" fill="${eat}"/>`;
  }
  const shadowEl = shadow
    ? `<defs><filter id="${id}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="16"/></filter></defs>`
      + `<g transform="translate(0 14)" opacity="0.28" filter="url(#${id})">${sh}</g>` : '';
  return `<g transform="translate(512 512) scale(${s}) translate(-512 -512)">${shadowEl}${body}</g>`;
}

const PAL = {
  A: { fast: '#FFFFFF', eat: T.amber, track: { c: '#fff', o: 0.2 }, field: [T.tealTop, T.tealBot], mono: 1 },
  B: { fast: '#FFFFFF', eat: T.amber, track: { c: '#fff', o: 0.2 }, field: [T.tealTop, T.tealBot], mono: 1 },
  C: { fast: T.accentDark, eat: T.amber, track: null, field: ['#16201C', '#0B100E'], mono: 1 },
};

const field = (v, grad) => {
  const [a, b] = grad || PAL[v].field, id = `f${uid++}`;
  return `<defs><linearGradient id="${id}" x1="0.15" y1="0" x2="0.85" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`
    + `<rect width="1024" height="1024" fill="url(#${id})"/>`;
};
const svgDoc = (w, h, inner, vb = `0 0 ${w} ${h}`) =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="${vb}">${inner}</svg>`;
const raster = (svg, size) => new Resvg(svg, { fitTo: { mode: 'width', value: size }, font: { loadSystemFonts: true } }).render().asPng();
const png = (v, kind, size, opts = {}) => raster(svgDoc(1024, 1024, kind(v, opts)), size);

// ---- layers --------------------------------------------------------------
const L = {
  icon: (v) => field(v) + mark(v, { ...PAL[v], s: 1.12 }),
  fg: (v) => mark(v, { ...PAL[v], s: 0.9 }), // outer radius ~59% of half-canvas: inside Android's 61% safe circle
  bg: (v) => field(v),
  mono: (v) => mark('A', { fast: '#000', eat: '#000', shadow: false, s: 0.9 }),
  splashLight: (v) => mark(v === 'C' ? 'B' : v, { fast: T.accent, eat: T.amberLight, track: { c: T.accent, o: 0.16 }, shadow: false, s: 1 }),
  splashDark: (v) => mark(v === 'C' ? 'B' : v, { fast: T.accentDark, eat: T.amberDark, track: { c: T.accentDark, o: 0.2 }, shadow: false, s: 1 }),
};

function stripAlpha(buf) {
  const p = PNG.sync.read(buf);
  const out = new PNG({ width: p.width, height: p.height, colorType: 2, inputHasAlpha: false });
  for (let i = 0, j = 0; i < p.data.length; i += 4, j += 4) {
    out.data[j] = p.data[i]; out.data[j + 1] = p.data[i + 1]; out.data[j + 2] = p.data[i + 2]; out.data[j + 3] = 255;
  }
  return PNG.sync.write(out, { colorType: 2 });
}
const w = (dir, f, buf) => { fs.writeFileSync(path.join(dir, f), buf); console.log('wrote', path.relative(ROOT, path.join(dir, f))); };
const uri = (buf) => 'data:image/png;base64,' + buf.toString('base64');

// ---- candidates + contact sheet -----------------------------------------
const NAMES = { A: 'A  Window dot', B: 'B  Track + two arcs', C: 'C  Dusk comet' };
function contactSheet() {
  const sizes = [180, 120, 60, 40], rowH = 330, W = 1900, pad = 40;
  let s = `<rect width="${W}" height="${rowH * 3 + 80}" fill="#1b1f1e"/>`;
  ['A', 'B', 'C'].forEach((v, r) => {
    const y0 = 60 + r * rowH;
    s += `<text x="${pad}" y="${y0 - 14}" font-family="Segoe UI, Arial" font-size="22" fill="#cfd8d4">${NAMES[v]}</text>`;
    const big = png(v, L.icon, 1024);
    s += `<clipPath id="cb${r}"><rect x="${pad}" y="${y0}" width="280" height="280" rx="62"/></clipPath><image href="${uri(raster(svgDoc(1024, 1024, L.icon(v)), 280))}" x="${pad}" y="${y0}" width="280" height="280" clip-path="url(#cb${r})"/>`;
    [['#EDEBE4', '#C9D6D0'], ['#101613', '#26342E']].forEach(([c1, c2], k) => {
      const x0 = 360 + k * 780;
      s += `<defs><linearGradient id="w${r}${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>`
        + `<rect x="${x0}" y="${y0}" width="740" height="280" rx="24" fill="url(#w${r}${k})"/>`;
      let x = x0 + 30;
      sizes.forEach((sz, i) => {
        const buf = raster(svgDoc(1024, 1024, L.icon(v)), sz);
        const rx = Math.round(sz * 0.2237), y = y0 + 40;
        s += `<clipPath id="c${r}${k}${i}"><rect x="${x}" y="${y}" width="${sz}" height="${sz}" rx="${rx}"/></clipPath>`
          + `<image href="${uri(buf)}" x="${x}" y="${y}" width="${sz}" height="${sz}" clip-path="url(#c${r}${k}${i})"/>`
          + `<text x="${x}" y="${y + sz + 26}" font-family="Segoe UI, Arial" font-size="15" fill="${k ? '#9fb2aa' : '#55625c'}">${sz}px</text>`;
        x += sz + 40;
      });
    });
    w(CAND, `candidate-${v}-1024.png`, stripAlpha(big));
  });
  w(CAND, 'contact-sheet.png', raster(svgDoc(W, rowH * 3 + 80, s), W));
}

// ---- app assets ----------------------------------------------------------
function appAssets(v) {
  w(ASSETS, 'icon.png', stripAlpha(png(v, L.icon, 1024)));
  w(ASSETS, 'android-icon-foreground.png', png(v, L.fg, 1024));
  w(ASSETS, 'android-icon-background.png', stripAlpha(png(v, L.bg, 1024)));
  w(ASSETS, 'android-icon-monochrome.png', png(v, L.mono, 1024));
  w(ASSETS, 'splash-icon.png', png(v, L.splashLight, 1024));
  w(ASSETS, 'splash-icon-dark.png', png(v, L.splashDark, 1024));
  w(ASSETS, 'favicon.png', stripAlpha(png(v, L.icon, 48)));
  w(ASSETS, 'favicon-192.png', stripAlpha(png(v, L.icon, 192)));

  // Safe-zone preview: adaptive icon (bg+fg) under circle / squircle / rounded masks, with 61% safe circle guide.
  const comp = raster(svgDoc(1024, 1024, L.bg(v) + L.fg(v)), 300);
  const shapes = [
    (id) => `<clipPath id="${id}"><circle cx="150" cy="150" r="150"/></clipPath>`,
    (id) => `<clipPath id="${id}"><path d="${squircle(150, 150, 150, 5)}"/></clipPath>`,
    (id) => `<clipPath id="${id}"><rect width="300" height="300" rx="66"/></clipPath>`,
  ];
  let s = '<rect width="1160" height="360" fill="#e9e9e4"/>';
  shapes.forEach((f, i) => {
    s += `<g transform="translate(${30 + i * 330} 30)">${f('k' + i)}<image href="${uri(comp)}" width="300" height="300" clip-path="url(#k${i})"/>`
      + `<circle cx="150" cy="150" r="${300 * 0.305}" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-dasharray="4 4"/></g>`;
  });
  s += `<g transform="translate(1020 30)"><rect width="110" height="110" rx="24" fill="#fff"/><image href="${uri(raster(svgDoc(1024, 1024, L.mono(v)), 110))}" width="110" height="110" opacity="0.9"/>`
    + `<text y="140" font-family="Segoe UI, Arial" font-size="14" fill="#444">monochrome</text></g>`;
  w(STORE, 'adaptive-safe-zone-preview.png', raster(svgDoc(1160, 360, s), 1160));
}
function squircle(cx, cy, r, n) {
  let d = '';
  for (let i = 0; i <= 120; i++) {
    const t = (i / 120) * 2 * Math.PI, c = Math.cos(t), sn = Math.sin(t);
    const x = cx + r * Math.sign(c) * Math.abs(c) ** (2 / n), y = cy + r * Math.sign(sn) * Math.abs(sn) ** (2 / n);
    d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
  }
  return d + 'Z';
}

// ---- store graphics ------------------------------------------------------
function storeAssets(v) {
  w(STORE, 'play-icon-512.png', png(v, L.icon, 512)); // 32-bit RGBA PNG
  w(STORE, 'appstore-icon-1024.png', stripAlpha(png(v, L.icon, 1024))); // no alpha channel
  // Feature graphic 1024x500: mark at left, wordmark + tagline right. Few words, generous space.
  const [a, b] = PAL[v].field, FONT = 'Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif';
  const dark = v === 'C';
  const inner = `<defs><linearGradient id="fg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`
    + `<rect width="1024" height="500" fill="url(#fg)"/>`
    + `<g transform="translate(78 82) scale(0.34)">${mark(v, { ...PAL[v], s: 1 })}</g>`
    + `<text x="470" y="262" font-family="${FONT}" font-weight="700" font-size="104" letter-spacing="-2" fill="#fff">Fastline</text>`
    + `<text x="474" y="326" font-family="${FONT}" font-weight="400" font-size="34" fill="#fff" fill-opacity="${dark ? 0.72 : 0.86}">A calm fasting timer</text>`;
  w(STORE, 'play-feature-graphic-1024x500.png', stripAlpha(raster(svgDoc(1024, 500, inner), 1024)));
}

// ---- themed launcher icons (Pro "Themes & app icon") ----------------------
// One variant per accent theme, same B mark, per-theme gradient. Mirrors iconGradients in
// src/lib/themePalettes.ts. Names are what react-native-change-icon registers
// (Ocean/Dusk/Sunrise; teal = the default icon, shipped as the app icon and also emitted here for the in-app picker preview).
const THEME_ICONS = {
  teal: [T.tealTop, T.tealBot],
  ocean: ['#2F7FBF', '#173F63'],
  dusk: ['#7468C8', '#3A2F7A'],
  sunrise: ['#E0683A', '#8A2F14'],
};
function themedIcons(v) {
  const ICONS = path.join(ASSETS, 'icons');
  fs.mkdirSync(ICONS, { recursive: true });
  const mid = (a, b) => '#' + [1, 3, 5].map((i) => Math.round((parseInt(a.slice(i, i + 2), 16) + parseInt(b.slice(i, i + 2), 16)) / 2).toString(16).padStart(2, '0')).join('');
  const out = {};
  for (const [name, grad] of Object.entries(THEME_ICONS)) {
    w(ICONS, name + '-icon.png', stripAlpha(raster(svgDoc(1024, 1024, field(v, grad) + mark(v, { ...PAL[v], s: 1.12 })), 1024)));
    // Android adaptive: transparent foreground + solid background colour (the library takes a colour, not an image).
    w(ICONS, name + '-foreground.png', png(v, L.fg));
    out[name] = mid(grad[0], grad[1]);
  }
  console.log('mid-gradient colour per theme:', JSON.stringify(out));
}

// ---- native (bare React Native) assets -------------------------------------
const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
const XCASSETS = path.join(ROOT, 'ios', 'Fastline', 'Images.xcassets');
const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const ensure = (d) => { fs.mkdirSync(d, { recursive: true }); return d; };
const clipped = (inner, shape) => {
  const id = 'cl' + uid++;
  const clip = shape === 'circle' ? '<circle cx="512" cy="512" r="512"/>' : '<rect width="1024" height="1024" rx="228"/>';
  return `<clipPath id="${id}">${clip}</clipPath><g clip-path="url(#${id})">${inner}</g>`;
};
const ADAPTIVE_XML = (bg) => `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/${bg}"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`;

function androidIcons(v) {
  // Shared adaptive layers (foreground mark + monochrome). The background differs per theme.
  const variants = { '': THEME_ICONS.teal, _ocean: THEME_ICONS.ocean, _dusk: THEME_ICONS.dusk, _sunrise: THEME_ICONS.sunrise };
  for (const [dn, d] of Object.entries(DENS)) {
    const dir = ensure(path.join(RES, 'mipmap-' + dn));
    w(dir, 'ic_launcher_foreground.png', png(v, L.fg, Math.round(108 * d)));
    w(dir, 'ic_launcher_monochrome.png', png(v, L.mono, Math.round(108 * d)));
    for (const [suffix, grad] of Object.entries(variants)) {
      const icon = field(v, grad) + mark(v, { ...PAL[v], s: 1.12 });
      w(dir, `ic_launcher${suffix}_background.png`, stripAlpha(raster(svgDoc(1024, 1024, field(v, grad)), Math.round(108 * d))));
      w(dir, `ic_launcher${suffix}.png`, raster(svgDoc(1024, 1024, clipped(icon, 'square')), Math.round(48 * d)));
      w(dir, `ic_launcher${suffix}_round.png`, raster(svgDoc(1024, 1024, clipped(icon, 'circle')), Math.round(48 * d)));
    }
  }
  const any = ensure(path.join(RES, 'mipmap-anydpi-v26'));
  for (const suffix of Object.keys(variants)) {
    w(any, `ic_launcher${suffix}.xml`, Buffer.from(ADAPTIVE_XML(`ic_launcher${suffix}_background`)));
    w(any, `ic_launcher${suffix}_round.xml`, Buffer.from(ADAPTIVE_XML(`ic_launcher${suffix}_background`)));
  }
  // Notification small icon (white silhouette on transparent; Android uses alpha only). 24dp.
  const stat = mark('A', { fast: '#fff', eat: '#fff', shadow: false, s: 1.35 });
  for (const [dn, d] of Object.entries(DENS)) {
    w(ensure(path.join(RES, 'drawable-' + dn)), 'ic_stat_notification.png', raster(svgDoc(1024, 1024, stat), Math.round(24 * d)));
  }
}

// iOS icon sets: [pointSize, scale, idiom]
const IOS_SIZES = [
  [20, 2, 'iphone'], [20, 3, 'iphone'], [29, 2, 'iphone'], [29, 3, 'iphone'], [40, 2, 'iphone'], [40, 3, 'iphone'],
  [60, 2, 'iphone'], [60, 3, 'iphone'],
  [20, 1, 'ipad'], [20, 2, 'ipad'], [29, 1, 'ipad'], [29, 2, 'ipad'], [40, 1, 'ipad'], [40, 2, 'ipad'],
  [76, 1, 'ipad'], [76, 2, 'ipad'], [83.5, 2, 'ipad'],
];
function iosSet(v, name, grad) {
  const dir = ensure(path.join(XCASSETS, name + '.appiconset'));
  const svg = svgDoc(1024, 1024, field(v, grad) + mark(v, { ...PAL[v], s: 1.12 }));
  const images = [];
  const written = new Set();
  const emit = (px, file) => { if (!written.has(file)) { written.add(file); w(dir, file, stripAlpha(raster(svg, px))); } };
  for (const [pt, sc, idiom] of IOS_SIZES) {
    const px = Math.round(pt * sc), file = `icon-${px}.png`;
    emit(px, file);
    images.push({ filename: file, idiom, scale: sc + 'x', size: `${pt}x${pt}` });
  }
  emit(1024, 'icon-1024.png');
  images.push({ filename: 'icon-1024.png', idiom: 'ios-marketing', scale: '1x', size: '1024x1024' });
  fs.writeFileSync(path.join(dir, 'Contents.json'), JSON.stringify({ images, info: { author: 'xcode', version: 1 } }, null, 2) + '\n');
}
function iosIcons(v) {
  iosSet(v, 'AppIcon', THEME_ICONS.teal);
  for (const n of ['Ocean', 'Dusk', 'Sunrise']) iosSet(v, n, THEME_ICONS[n.toLowerCase()]);
}

// Splash assets (light + dark). Android: values[-night]/splash_colors.xml + drawable[-night]-*dpi/splash_icon.png,
// consumed by Theme.SplashScreen (androidx.core:core-splashscreen) in styles.xml. iOS: SplashBackground.colorset
// and SplashLogo.imageset (dark appearance included), consumed by LaunchScreen.storyboard.
function splashAssets(v) {
  const BG_L = T.bgLight, BG_D = T.bgDark;
  const lightSvg = svgDoc(1024, 1024, L.splashLight(v));
  const darkSvg = svgDoc(1024, 1024, L.splashDark(v));
  const colorsXml = (bg) => Buffer.from(`<resources>\n    <color name="splash_background">${bg.toLowerCase()}</color>\n</resources>\n`);
  w(ensure(path.join(RES, 'values')), 'splash_colors.xml', colorsXml(BG_L));
  w(ensure(path.join(RES, 'values-night')), 'splash_colors.xml', colorsXml(BG_D));
  // 288dp icon canvas with a 160dp logo centred (the splash window crops the icon to a circle).
  for (const [dn, d] of Object.entries(DENS)) {
    const canvas = Math.round(288 * d), logo = Math.round(160 * d);
    for (const [dir, svg] of [['drawable-', lightSvg], ['drawable-night-', darkSvg]]) {
      const mk = new PNG({ width: canvas, height: canvas });
      const lg = PNG.sync.read(raster(svg, logo));
      PNG.bitblt(lg, mk, 0, 0, logo, logo, Math.round((canvas - logo) / 2), Math.round((canvas - logo) / 2));
      w(ensure(path.join(RES, dir + dn)), 'splash_icon.png', PNG.sync.write(mk));
    }
  }
  // iOS
  const hex = (h) => { const n = parseInt(h.slice(1), 16); const f = (x) => (x / 255).toFixed(6); return { red: f((n >> 16) & 255), green: f((n >> 8) & 255), blue: f(n & 255), alpha: '1.000' }; };
  const dark = [{ appearance: 'luminosity', value: 'dark' }];
  const colorDir = ensure(path.join(ROOT, 'ios', 'Fastline', 'Colors.xcassets', 'SplashBackground.colorset'));
  fs.writeFileSync(path.join(colorDir, 'Contents.json'), JSON.stringify({
    colors: [
      { idiom: 'universal', color: { 'color-space': 'srgb', components: hex(BG_L) } },
      { idiom: 'universal', appearances: dark, color: { 'color-space': 'srgb', components: hex(BG_D) } },
    ], info: { author: 'xcode', version: 1 } }, null, 2) + '\n');
  const imDir = ensure(path.join(XCASSETS, 'SplashLogo.imageset'));
  const images = [];
  for (const sc of [1, 2, 3]) {
    const f = `logo${sc > 1 ? '@' + sc + 'x' : ''}.png`;
    w(imDir, f, raster(lightSvg, 160 * sc));
    images.push({ idiom: 'universal', filename: f, scale: sc + 'x' });
  }
  for (const sc of [1, 2, 3]) {
    const f = `logo-dark${sc > 1 ? '@' + sc + 'x' : ''}.png`;
    w(imDir, f, raster(darkSvg, 160 * sc));
    images.push({ idiom: 'universal', appearances: dark, filename: f, scale: sc + 'x' });
  }
  fs.writeFileSync(path.join(imDir, 'Contents.json'), JSON.stringify({ images, info: { author: 'xcode', version: 1 } }, null, 2) + '\n');
}

if (process.argv[2] === 'splash') {
  splashAssets(CHOSEN); // `node scripts/make-assets.js splash` regenerates only the native splash assets
  process.exit(0);
}
contactSheet();
appAssets(CHOSEN);
storeAssets(CHOSEN);
themedIcons(CHOSEN);
androidIcons(CHOSEN);
iosIcons(CHOSEN);
splashAssets(CHOSEN);
