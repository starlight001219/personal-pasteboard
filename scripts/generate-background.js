const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const out = path.join(__dirname, '..', 'public', 'assets', 'background.png');

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c8deec"/>
      <stop offset="0.42" stop-color="#edf7fb"/>
      <stop offset="0.74" stop-color="#a9bfcb"/>
      <stop offset="1" stop-color="#314553"/>
    </linearGradient>
    <radialGradient id="light" cx="50%" cy="31%" r="46%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.82"/>
      <stop offset="0.42" stop-color="#ffffff" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="island" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#edf7fb"/>
      <stop offset="0.38" stop-color="#cad8de"/>
      <stop offset="1" stop-color="#263844"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="14"/>
    </filter>
    <filter id="treeGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur"/>
      <feFlood flood-color="#ffffff" flood-opacity="0.72"/>
      <feComposite in2="blur" operator="in"/>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="1920" height="1080" fill="url(#sky)"/>
  <rect width="1920" height="1080" fill="url(#light)"/>

  <g opacity="0.42" filter="url(#soft)">
    <ellipse cx="460" cy="442" rx="410" ry="94" fill="#ffffff"/>
    <ellipse cx="920" cy="408" rx="520" ry="112" fill="#ffffff"/>
    <ellipse cx="1410" cy="462" rx="440" ry="116" fill="#ffffff"/>
  </g>

  <g opacity="0.56">
    <path d="M0 655 L190 482 L326 608 L480 418 L640 636 L807 486 L1005 664 Z" fill="#55707f"/>
    <path d="M840 662 L1020 452 L1160 618 L1275 488 L1442 664 Z" fill="#496474"/>
    <path d="M1210 650 L1438 398 L1582 600 L1710 462 L1920 655 Z" fill="#425b69"/>
    <path d="M0 715 C350 640 612 704 910 652 C1262 592 1550 642 1920 592 L1920 1080 L0 1080 Z" fill="#243744" opacity="0.62"/>
  </g>

  <g opacity="0.52">
    <path d="M176 292 L292 232 L250 392 Z" fill="#3c5361"/>
    <path d="M308 214 L456 176 L382 410 Z" fill="#2e4454"/>
    <path d="M528 172 L600 224 L542 302 Z" fill="#69808d"/>
    <path d="M1238 238 L1308 210 L1285 312 Z" fill="#607783"/>
  </g>

  <g transform="translate(960 633)">
    <ellipse cx="0" cy="-14" rx="476" ry="82" fill="#f3fbff"/>
    <path d="M-472 -6 C-352 -78 -92 -94 92 -82 C260 -70 408 -38 474 -2 C380 38 224 56 12 58 C-206 60 -372 40 -472 -6 Z" fill="#eef8fc"/>
    <path d="M-456 14 C-308 58 -104 64 100 58 C278 52 406 34 474 -2 C424 86 266 178 94 238 C-112 308 -318 244 -456 14 Z" fill="url(#island)"/>
    <path d="M-372 30 C-252 86 -78 88 98 82 C236 78 358 54 430 12 C368 102 218 166 66 204 C-128 254 -282 196 -372 30 Z" fill="#293c49" opacity="0.42"/>
    <path d="M-308 -42 C-126 -72 150 -68 314 -30" stroke="#b8ccd5" stroke-width="10" fill="none" opacity="0.7"/>
    <path d="M-388 2 C-224 44 98 42 376 0" stroke="#a7bdc7" stroke-width="7" fill="none" opacity="0.42"/>
  </g>

  <g transform="translate(960 548)" filter="url(#treeGlow)">
    <path d="M-15 138 C-9 84 -12 34 -8 -18 C-2 -78 11 -126 24 -184 C36 -116 42 -58 34 2 C27 58 24 98 30 140 Z" fill="#6d5e54"/>
    <path d="M2 -34 C-34 -86 -86 -122 -146 -138" stroke="#6d5e54" stroke-width="10" stroke-linecap="round" fill="none"/>
    <path d="M12 -62 C68 -102 118 -146 150 -196" stroke="#6d5e54" stroke-width="10" stroke-linecap="round" fill="none"/>
    <path d="M11 -104 C-22 -142 -52 -178 -86 -226" stroke="#6d5e54" stroke-width="8" stroke-linecap="round" fill="none"/>
    <path d="M26 -116 C70 -150 105 -176 140 -214" stroke="#6d5e54" stroke-width="7" stroke-linecap="round" fill="none"/>
    <circle cx="-122" cy="-142" r="80" fill="#f7fcff"/>
    <circle cx="-54" cy="-178" r="112" fill="#ffffff"/>
    <circle cx="42" cy="-184" r="132" fill="#f5fbff"/>
    <circle cx="132" cy="-134" r="90" fill="#f8fdff"/>
    <circle cx="-10" cy="-254" r="78" fill="#ffffff"/>
    <circle cx="74" cy="-266" r="62" fill="#f2f9fd"/>
  </g>

  <g opacity="0.84">
    <path d="M714 454 C760 434 816 432 872 452" stroke="#f9fdff" stroke-width="8" stroke-linecap="round"/>
    <path d="M1068 446 C1128 420 1202 424 1260 456" stroke="#f9fdff" stroke-width="7" stroke-linecap="round"/>
    <path d="M832 704 C906 684 1016 682 1110 704" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
  </g>

  <g opacity="0.44">
    <circle cx="640" cy="620" r="2.6" fill="#ffffff"/>
    <circle cx="780" cy="534" r="2.1" fill="#ffffff"/>
    <circle cx="1118" cy="506" r="2.8" fill="#ffffff"/>
    <circle cx="1320" cy="650" r="2.2" fill="#ffffff"/>
    <circle cx="960" cy="340" r="2.4" fill="#ffffff"/>
  </g>
</svg>`;

fs.mkdirSync(path.dirname(out), { recursive: true });
sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out).then(() => {
  process.stdout.write(`${out}\n`);
});
