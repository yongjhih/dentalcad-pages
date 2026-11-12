import { ClinicalPhoto } from '../types/dental';
import { BAKED_DEMO_PHOTOS } from './bakedDemoPhotos';

/**
 * Creates an SVG Data URL from an SVG markup string.
 */
export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

/**
 * Frontal Occlusion View (penta_front)
 * Displays upper and lower anterior & premolar teeth in Centric Occlusion with natural gingiva,
 * enamel shades (VITA A1/A2), incisal translucency, and interproximal embrasures.
 */
export function createFrontalViewSvg(): string {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <defs>
    <radialGradient id="bgFront" cx="50%" cy="50%" r="65%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="70%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#edf2f7"/>
    </radialGradient>
    <linearGradient id="gingivaUpper" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#c95064"/>
      <stop offset="65%" stop-color="#dc687a"/>
      <stop offset="100%" stop-color="#e87d8d"/>
    </linearGradient>
    <linearGradient id="gingivaLower" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#c95064"/>
      <stop offset="65%" stop-color="#dc687a"/>
      <stop offset="100%" stop-color="#e87d8d"/>
    </linearGradient>
    <linearGradient id="toothEnamelUpper" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f5e6cb"/>
      <stop offset="25%" stop-color="#fcf9f2"/>
      <stop offset="80%" stop-color="#fffffb"/>
      <stop offset="100%" stop-color="#d9e6ee"/>
    </linearGradient>
    <linearGradient id="toothEnamelLower" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#f5e6cb"/>
      <stop offset="25%" stop-color="#fcf9f2"/>
      <stop offset="80%" stop-color="#fffffb"/>
      <stop offset="100%" stop-color="#d9e6ee"/>
    </linearGradient>
    <filter id="shadowFront" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.12"/>
    </filter>
  </defs>

  <!-- Upper Gingiva -->
  <path d="M 170 190 C 230 140, 570 140, 630 190 C 600 240, 560 230, 530 235 C 500 230, 470 235, 440 235 C 410 230, 390 230, 360 235 C 330 235, 300 230, 270 235 C 240 230, 200 240, 170 190 Z" fill="url(#gingivaUpper)"/>

  <!-- Upper Teeth (Centric Occlusion, Maxillary Incisors & Canines) -->
  <g id="upperTeeth" filter="url(#shadowFront)">
    <!-- Right 1st Premolar (14) -->
    <path d="M 230 230 C 242 226, 260 228, 265 242 C 270 270, 265 295, 252 305 C 242 305, 235 290, 230 260 Z" fill="url(#toothEnamelUpper)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- Right Canine (13) -->
    <path d="M 267 228 C 280 222, 302 225, 308 240 C 315 275, 310 312, 296 322 C 280 322, 270 295, 267 255 Z" fill="url(#toothEnamelUpper)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- Right Lateral Incisor (12) -->
    <path d="M 312 225 C 325 220, 345 220, 352 235 C 358 270, 355 308, 345 315 C 330 315, 318 290, 312 250 Z" fill="url(#toothEnamelUpper)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- Right Central Incisor (11) -->
    <path d="M 355 222 C 370 215, 395 215, 398 230 C 402 275, 400 322, 390 328 C 368 328, 358 300, 355 250 Z" fill="url(#toothEnamelUpper)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- Left Central Incisor (21) -->
    <path d="M 402 230 C 405 215, 430 215, 445 222 C 442 250, 432 300, 410 328 C 400 322, 398 275, 402 230 Z" fill="url(#toothEnamelUpper)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- Left Lateral Incisor (22) -->
    <path d="M 448 235 C 455 220, 475 220, 488 225 C 482 250, 470 290, 455 315 C 445 308, 442 270, 448 235 Z" fill="url(#toothEnamelUpper)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- Left Canine (23) -->
    <path d="M 492 240 C 498 225, 520 222, 533 228 C 530 255, 520 295, 504 322 C 490 312, 485 275, 492 240 Z" fill="url(#toothEnamelUpper)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- Left 1st Premolar (24) -->
    <path d="M 535 242 C 540 228, 558 226, 570 230 C 570 260, 563 290, 548 305 C 535 295, 530 270, 535 242 Z" fill="url(#toothEnamelUpper)" stroke="#dcd3c1" stroke-width="1.2"/>
  </g>

  <!-- Lower Gingiva -->
  <path d="M 180 410 C 240 460, 560 460, 620 410 C 590 365, 550 375, 520 370 C 490 375, 460 370, 435 370 C 405 375, 375 375, 345 370 C 320 375, 280 370, 250 375 C 220 370, 190 365, 180 410 Z" fill="url(#gingivaLower)"/>

  <!-- Lower Teeth (Mandibular Incisors & Canines) -->
  <g id="lowerTeeth" filter="url(#shadowFront)">
    <!-- Right Canine (43) -->
    <path d="M 280 365 C 290 370, 305 370, 312 355 C 320 325, 315 305, 305 300 C 290 300, 282 325, 280 365 Z" fill="url(#toothEnamelLower)" stroke="#dcd3c1" stroke-width="1.1"/>
    <!-- Right Lateral Incisor (42) -->
    <path d="M 316 360 C 326 365, 342 365, 348 350 C 352 325, 350 308, 340 305 C 330 305, 322 325, 316 360 Z" fill="url(#toothEnamelLower)" stroke="#dcd3c1" stroke-width="1.1"/>
    <!-- Right Central Incisor (41) -->
    <path d="M 352 360 C 362 365, 378 365, 384 350 C 388 322, 386 308, 376 305 C 364 305, 358 325, 352 360 Z" fill="url(#toothEnamelLower)" stroke="#dcd3c1" stroke-width="1.1"/>
    <!-- Left Central Incisor (31) -->
    <path d="M 388 350 C 394 365, 410 365, 420 360 C 426 325, 420 305, 408 305 C 398 308, 396 322, 388 350 Z" fill="url(#toothEnamelLower)" stroke="#dcd3c1" stroke-width="1.1"/>
    <!-- Left Lateral Incisor (32) -->
    <path d="M 424 350 C 430 365, 446 365, 456 360 C 462 325, 454 305, 444 305 C 434 308, 432 325, 424 350 Z" fill="url(#toothEnamelLower)" stroke="#dcd3c1" stroke-width="1.1"/>
    <!-- Left Canine (33) -->
    <path d="M 460 355 C 467 370, 482 370, 492 365 C 490 325, 482 300, 467 300 C 457 305, 452 325, 460 355 Z" fill="url(#toothEnamelLower)" stroke="#dcd3c1" stroke-width="1.1"/>
  </g>
</svg>
`;
}

/**
 * Maxillary Occlusal View (penta_upper)
 * Full horseshoe arch of 14 upper teeth (17 to 27) with palate and anatomical occlusal anatomy.
 */
export function createUpperOcclusalViewSvg(): string {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 650" width="800" height="650">
  <defs>
    <radialGradient id="bgUpper" cx="50%" cy="45%" r="70%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="70%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </radialGradient>
    <radialGradient id="palateGrad" cx="50%" cy="40%" r="55%">
      <stop offset="0%" stop-color="#d46174"/>
      <stop offset="70%" stop-color="#c95064"/>
      <stop offset="100%" stop-color="#b83f52"/>
    </radialGradient>
    <linearGradient id="occlusalEnamel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fcf9f2"/>
      <stop offset="60%" stop-color="#f7efe0"/>
      <stop offset="100%" stop-color="#ece0cd"/>
    </linearGradient>
    <filter id="shadowUpper" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.14"/>
    </filter>
  </defs>

  <!-- Palatal Vault & Rugae -->
  <path d="M 230 460 C 220 280, 290 170, 400 170 C 510 170, 580 280, 570 460 C 520 480, 280 480, 230 460 Z" fill="url(#palateGrad)"/>
  <!-- Median Palatine Raphe & Rugae -->
  <path d="M 400 185 Q 400 350 400 450" stroke="#b84558" stroke-width="2.5" fill="none"/>
  <path d="M 370 220 Q 400 210 430 220 M 360 250 Q 400 240 440 250 M 355 285 Q 400 275 445 285 M 365 320 Q 400 312 435 320" stroke="#b84558" stroke-width="2" fill="none" opacity="0.6"/>

  <!-- Upper Arch 14 Teeth (Horseshoe from 17 down to 11, then 21 down to 27) -->
  <g id="upperArchTeeth" filter="url(#shadowUpper)">
    <!-- Right 2nd Molar (17) -->
    <rect x="200" y="450" width="48" height="52" rx="14" fill="url(#occlusalEnamel)" stroke="#dcd3c1" stroke-width="1.2"/>
    <path d="M 210 475 L 238 475 M 224 460 L 224 492" stroke="#938271" stroke-width="1.4" opacity="0.75"/>

    <!-- Right 1st Molar (16) -->
    <rect x="210" y="385" width="52" height="55" rx="15" fill="url(#occlusalEnamel)" stroke="#dcd3c1" stroke-width="1.2"/>
    <path d="M 220 412 L 252 412 M 236 395 L 236 430 M 224 402 L 248 422" stroke="#938271" stroke-width="1.5" opacity="0.8"/>

    <!-- Right 2nd Premolar (15) -->
    <rect x="225" y="330" width="44" height="46" rx="14" fill="url(#occlusalEnamel)" stroke="#dcd3c1" stroke-width="1.2"/>
    <path d="M 235 353 L 260 353" stroke="#938271" stroke-width="1.4" opacity="0.75"/>

    <!-- Right 1st Premolar (14) -->
    <rect x="242" y="278" width="42" height="44" rx="13" fill="url(#occlusalEnamel)" stroke="#dcd3c1" stroke-width="1.2"/>
    <path d="M 252 300 L 274 300" stroke="#938271" stroke-width="1.4" opacity="0.75"/>

    <!-- Right Canine (13) -->
    <path d="M 268 230 C 275 220, 298 220, 305 235 C 310 252, 295 275, 280 275 C 265 275, 260 250, 268 230 Z" fill="url(#occlusalEnamel)" stroke="#dcd3c1" stroke-width="1.2"/>
    <circle cx="286" cy="245" r="2.5" fill="#a49381"/>

    <!-- Right Lateral Incisor (12) -->
    <ellipse cx="330" cy="205" rx="18" ry="24" transform="rotate(-20 330 205)" fill="url(#occlusalEnamel)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- Right Central Incisor (11) -->
    <ellipse cx="378" cy="188" rx="20" ry="28" transform="rotate(-6 378 188)" fill="url(#occlusalEnamel)" stroke="#dcd3c1" stroke-width="1.2"/>

    <!-- Left Central Incisor (21) -->
    <ellipse cx="422" cy="188" rx="20" ry="28" transform="rotate(6 422 188)" fill="url(#occlusalEnamel)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- Left Lateral Incisor (22) -->
    <ellipse cx="470" cy="205" rx="18" ry="24" transform="rotate(20 470 205)" fill="url(#occlusalEnamel)" stroke="#dcd3c1" stroke-width="1.2"/>

    <!-- Left Canine (23) -->
    <path d="M 532 230 C 525 220, 502 220, 495 235 C 490 252, 505 275, 520 275 C 535 275, 540 250, 532 230 Z" fill="url(#occlusalEnamel)" stroke="#dcd3c1" stroke-width="1.2"/>
    <circle cx="514" cy="245" r="2.5" fill="#a49381"/>

    <!-- Left 1st Premolar (24) -->
    <rect x="516" y="278" width="42" height="44" rx="13" fill="url(#occlusalEnamel)" stroke="#dcd3c1" stroke-width="1.2"/>
    <path d="M 526 300 L 548 300" stroke="#938271" stroke-width="1.4" opacity="0.75"/>

    <!-- Left 2nd Premolar (25) -->
    <rect x="531" y="330" width="44" height="46" rx="14" fill="url(#occlusalEnamel)" stroke="#dcd3c1" stroke-width="1.2"/>
    <path d="M 540 353 L 565 353" stroke="#938271" stroke-width="1.4" opacity="0.75"/>

    <!-- Left 1st Molar (26) -->
    <rect x="538" y="385" width="52" height="55" rx="15" fill="url(#occlusalEnamel)" stroke="#dcd3c1" stroke-width="1.2"/>
    <path d="M 548 412 L 580 412 M 564 395 L 564 430 M 552 422 L 576 402" stroke="#938271" stroke-width="1.5" opacity="0.8"/>

    <!-- Left 2nd Molar (27) -->
    <rect x="552" y="450" width="48" height="52" rx="14" fill="url(#occlusalEnamel)" stroke="#dcd3c1" stroke-width="1.2"/>
    <path d="M 562 475 L 590 475 M 576 460 L 576 492" stroke="#938271" stroke-width="1.4" opacity="0.75"/>
  </g>
</svg>
`;
}

/**
 * Mandibular Occlusal View (penta_lower)
 * Full horseshoe arch of 14 lower teeth (47 to 37) with lingual floor and anatomical fissures.
 */
export function createLowerOcclusalViewSvg(): string {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 650" width="800" height="650">
  <defs>
    <radialGradient id="bgLower" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="70%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </radialGradient>
    <radialGradient id="lingualFloor" cx="50%" cy="55%" r="50%">
      <stop offset="0%" stop-color="#d46174"/>
      <stop offset="75%" stop-color="#c95064"/>
      <stop offset="100%" stop-color="#ba4255"/>
    </radialGradient>
    <linearGradient id="occlusalEnamelLower" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fcf9f2"/>
      <stop offset="60%" stop-color="#f7efe0"/>
      <stop offset="100%" stop-color="#ece0cd"/>
    </linearGradient>
    <filter id="shadowLower" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.14"/>
    </filter>
  </defs>

  <!-- Lingual Floor & Attached Gingiva -->
  <path d="M 240 180 C 235 350, 300 460, 400 460 C 500 460, 565 350, 560 180 C 510 160, 290 160, 240 180 Z" fill="url(#lingualFloor)"/>

  <!-- Lower Arch 14 Teeth (Horseshoe from 47 up to 41, then 31 up to 37) -->
  <g id="lowerArchTeeth" filter="url(#shadowLower)">
    <!-- Right 2nd Molar (47) -->
    <rect x="210" y="145" width="46" height="50" rx="14" fill="url(#occlusalEnamelLower)" stroke="#dcd3c1" stroke-width="1.2"/>
    <path d="M 220 170 L 246 170 M 233 155 L 233 185" stroke="#938271" stroke-width="1.4" opacity="0.75"/>

    <!-- Right 1st Molar (46 - Y5 groove pattern) -->
    <rect x="218" y="210" width="50" height="54" rx="15" fill="url(#occlusalEnamelLower)" stroke="#dcd3c1" stroke-width="1.2"/>
    <path d="M 228 237 L 258 237 M 243 220 L 243 254 M 232 247 L 254 227" stroke="#938271" stroke-width="1.5" opacity="0.8"/>

    <!-- Right 2nd Premolar (45) -->
    <rect x="232" y="278" width="42" height="44" rx="13" fill="url(#occlusalEnamelLower)" stroke="#dcd3c1" stroke-width="1.2"/>
    <path d="M 242 300 L 264 300" stroke="#938271" stroke-width="1.4" opacity="0.75"/>

    <!-- Right 1st Premolar (44) -->
    <rect x="248" y="335" width="40" height="42" rx="12" fill="url(#occlusalEnamelLower)" stroke="#dcd3c1" stroke-width="1.2"/>
    <path d="M 258 356 L 278 356" stroke="#938271" stroke-width="1.4" opacity="0.75"/>

    <!-- Right Canine (43) -->
    <ellipse cx="295" cy="395" rx="16" ry="22" transform="rotate(35 295 395)" fill="url(#occlusalEnamelLower)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- Right Lateral Incisor (42) -->
    <ellipse cx="335" cy="428" rx="14" ry="20" transform="rotate(16 335 428)" fill="url(#occlusalEnamelLower)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- Right Central Incisor (41) -->
    <ellipse cx="378" cy="442" rx="14" ry="18" transform="rotate(4 378 442)" fill="url(#occlusalEnamelLower)" stroke="#dcd3c1" stroke-width="1.2"/>

    <!-- Left Central Incisor (31) -->
    <ellipse cx="422" cy="442" rx="14" ry="18" transform="rotate(-4 422 442)" fill="url(#occlusalEnamelLower)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- Left Lateral Incisor (32) -->
    <ellipse cx="465" cy="428" rx="14" ry="20" transform="rotate(-16 465 428)" fill="url(#occlusalEnamelLower)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- Left Canine (33) -->
    <ellipse cx="505" cy="395" rx="16" ry="22" transform="rotate(-35 505 395)" fill="url(#occlusalEnamelLower)" stroke="#dcd3c1" stroke-width="1.2"/>

    <!-- Left 1st Premolar (34) -->
    <rect x="512" y="335" width="40" height="42" rx="12" fill="url(#occlusalEnamelLower)" stroke="#dcd3c1" stroke-width="1.2"/>
    <path d="M 522 356 L 542 356" stroke="#938271" stroke-width="1.4" opacity="0.75"/>

    <!-- Left 2nd Premolar (35) -->
    <rect x="526" y="278" width="42" height="44" rx="13" fill="url(#occlusalEnamelLower)" stroke="#dcd3c1" stroke-width="1.2"/>
    <path d="M 536 300 L 558 300" stroke="#938271" stroke-width="1.4" opacity="0.75"/>

    <!-- Left 1st Molar (36 - Y5 groove pattern) -->
    <rect x="532" y="210" width="50" height="54" rx="15" fill="url(#occlusalEnamelLower)" stroke="#dcd3c1" stroke-width="1.2"/>
    <path d="M 542 237 L 572 237 M 557 220 L 557 254 M 546 227 L 568 247" stroke="#938271" stroke-width="1.5" opacity="0.8"/>

    <!-- Left 2nd Molar (37) -->
    <rect x="544" y="145" width="46" height="50" rx="14" fill="url(#occlusalEnamelLower)" stroke="#dcd3c1" stroke-width="1.2"/>
    <path d="M 554 170 L 580 170 M 567 155 L 567 185" stroke="#938271" stroke-width="1.4" opacity="0.75"/>
  </g>
</svg>
`;
}

/**
 * Right Buccal Occlusion View (penta_patientright)
 * Right side molar and canine relationship in Class I interdigitation.
 */
export function createRightBuccalViewSvg(): string {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <defs>
    <radialGradient id="bgRight" cx="50%" cy="50%" r="65%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="70%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#edf2f7"/>
    </radialGradient>
    <linearGradient id="gingivaBuccalUp" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ba4255"/>
      <stop offset="60%" stop-color="#ce596b"/>
      <stop offset="100%" stop-color="#e07283"/>
    </linearGradient>
    <linearGradient id="gingivaBuccalLo" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#ba4255"/>
      <stop offset="60%" stop-color="#ce596b"/>
      <stop offset="100%" stop-color="#e07283"/>
    </linearGradient>
    <linearGradient id="buccalEnamel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f5e6cb"/>
      <stop offset="30%" stop-color="#fcf9f2"/>
      <stop offset="85%" stop-color="#fffffb"/>
      <stop offset="100%" stop-color="#d9e6ee"/>
    </linearGradient>
    <filter id="shadowBuccal" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.12"/>
    </filter>
  </defs>

  <!-- Upper Gingival Scallop -->
  <path d="M 120 180 C 260 160, 600 160, 680 180 C 650 240, 600 230, 560 235 C 510 230, 460 235, 420 235 C 380 230, 330 235, 290 235 C 250 230, 160 240, 120 180 Z" fill="url(#gingivaBuccalUp)"/>

  <!-- Upper Right Buccal Teeth (Posterior to Anterior from Left to Right: 17, 16, 15, 14, 13) -->
  <g id="upperRightTeeth" filter="url(#shadowBuccal)">
    <!-- 2nd Molar (17) -->
    <path d="M 150 230 C 160 220, 205 220, 215 230 C 218 265, 212 300, 200 305 C 165 305, 155 265, 150 230 Z" fill="url(#buccalEnamel)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- 1st Molar (16 - Mesiobuccal Cusp) -->
    <path d="M 225 230 C 235 220, 290 220, 300 230 C 304 270, 296 310, 282 315 C 245 315, 235 270, 225 230 Z" fill="url(#buccalEnamel)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- 2nd Premolar (15) -->
    <path d="M 312 232 C 322 222, 360 222, 370 232 C 374 270, 368 312, 355 318 C 328 318, 320 270, 312 232 Z" fill="url(#buccalEnamel)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- 1st Premolar (14) -->
    <path d="M 382 235 C 392 225, 430 225, 440 235 C 444 275, 438 315, 424 320 C 398 320, 390 275, 382 235 Z" fill="url(#buccalEnamel)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- Canine (13 - Class I Key Cusp Tip) -->
    <path d="M 452 238 C 462 228, 510 228, 520 238 C 526 280, 515 328, 498 335 C 470 328, 460 280, 452 238 Z" fill="url(#buccalEnamel)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- Lateral Incisor (12) -->
    <path d="M 530 242 C 540 232, 580 232, 590 242 C 592 280, 585 325, 570 328 C 550 325, 538 280, 530 242 Z" fill="url(#buccalEnamel)" stroke="#dcd3c1" stroke-width="1.2"/>
  </g>

  <!-- Lower Gingival Scallop -->
  <path d="M 130 420 C 260 440, 600 440, 670 420 C 640 365, 590 375, 550 370 C 500 375, 450 370, 410 370 C 370 375, 320 370, 280 370 C 240 375, 160 365, 130 420 Z" fill="url(#gingivaBuccalLo)"/>

  <!-- Lower Right Buccal Teeth (47, 46, 45, 44, 43 in Class I Interdigitation) -->
  <g id="lowerRightTeeth" filter="url(#shadowBuccal)">
    <!-- 2nd Molar (47) -->
    <path d="M 160 370 C 170 380, 215 380, 225 370 C 220 330, 215 298, 202 295 C 170 295, 165 330, 160 370 Z" fill="url(#buccalEnamel)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- 1st Molar (46 - Mesiobuccal Groove receives Upper 16 Cusp) -->
    <path d="M 235 370 C 245 380, 300 380, 310 370 C 305 325, 298 295, 285 290 C 248 290, 240 325, 235 370 Z" fill="url(#buccalEnamel)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- 2nd Premolar (45) -->
    <path d="M 322 368 C 332 378, 370 378, 380 368 C 375 325, 368 298, 355 295 C 330 295, 326 325, 322 368 Z" fill="url(#buccalEnamel)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- 1st Premolar (44) -->
    <path d="M 392 365 C 402 375, 440 375, 450 365 C 445 322, 438 298, 425 295 C 400 295, 396 322, 392 365 Z" fill="url(#buccalEnamel)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- Canine (43) -->
    <path d="M 462 362 C 472 372, 515 372, 525 362 C 520 318, 512 295, 498 290 C 472 290, 466 318, 462 362 Z" fill="url(#buccalEnamel)" stroke="#dcd3c1" stroke-width="1.2"/>
  </g>
</svg>
`;
}

/**
 * Left Buccal Occlusion View (penta_patientleft)
 * Left side molar and canine relationship in Class I interdigitation.
 */
export function createLeftBuccalViewSvg(): string {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <defs>
    <radialGradient id="bgLeft" cx="50%" cy="50%" r="65%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="70%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#edf2f7"/>
    </radialGradient>
    <linearGradient id="gingivaBuccalUpL" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ba4255"/>
      <stop offset="60%" stop-color="#ce596b"/>
      <stop offset="100%" stop-color="#e07283"/>
    </linearGradient>
    <linearGradient id="gingivaBuccalLoL" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#ba4255"/>
      <stop offset="60%" stop-color="#ce596b"/>
      <stop offset="100%" stop-color="#e07283"/>
    </linearGradient>
    <linearGradient id="buccalEnamelL" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f5e6cb"/>
      <stop offset="30%" stop-color="#fcf9f2"/>
      <stop offset="85%" stop-color="#fffffb"/>
      <stop offset="100%" stop-color="#d9e6ee"/>
    </linearGradient>
    <filter id="shadowBuccalL" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.12"/>
    </filter>
  </defs>

  <!-- Upper Gingival Scallop -->
  <path d="M 680 180 C 540 160, 200 160, 120 180 C 150 240, 200 230, 240 235 C 290 230, 340 235, 380 235 C 420 230, 470 235, 510 235 C 550 230, 640 240, 680 180 Z" fill="url(#gingivaBuccalUpL)"/>

  <!-- Upper Left Buccal Teeth (Anterior to Posterior from Left to Right: 22, 23, 24, 25, 26, 27) -->
  <g id="upperLeftTeeth" filter="url(#shadowBuccalL)">
    <!-- Lateral Incisor (22) -->
    <path d="M 210 242 C 220 232, 260 232, 270 242 C 265 280, 258 325, 242 328 C 220 325, 215 280, 210 242 Z" fill="url(#buccalEnamelL)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- Canine (23 - Class I Key Cusp Tip) -->
    <path d="M 280 238 C 290 228, 338 228, 348 238 C 342 280, 335 328, 318 335 C 290 328, 285 280, 280 238 Z" fill="url(#buccalEnamelL)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- 1st Premolar (24) -->
    <path d="M 360 235 C 370 225, 408 225, 418 235 C 412 275, 405 315, 392 320 C 368 320, 365 275, 360 235 Z" fill="url(#buccalEnamelL)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- 2nd Premolar (25) -->
    <path d="M 430 232 C 440 222, 478 222, 488 232 C 482 270, 475 312, 462 318 C 438 318, 435 270, 430 232 Z" fill="url(#buccalEnamelL)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- 1st Molar (26) -->
    <path d="M 500 230 C 510 220, 565 220, 575 230 C 570 270, 562 310, 548 315 C 512 315, 505 270, 500 230 Z" fill="url(#buccalEnamelL)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- 2nd Molar (27) -->
    <path d="M 585 230 C 595 220, 640 220, 650 230 C 645 265, 638 300, 626 305 C 595 305, 590 265, 585 230 Z" fill="url(#buccalEnamelL)" stroke="#dcd3c1" stroke-width="1.2"/>
  </g>

  <!-- Lower Gingival Scallop -->
  <path d="M 670 420 C 540 440, 200 440, 130 420 C 160 365, 210 375, 250 370 C 290 375, 340 370, 380 370 C 420 375, 470 370, 510 370 C 550 375, 640 365, 670 420 Z" fill="url(#gingivaBuccalLoL)"/>

  <!-- Lower Left Buccal Teeth (33, 34, 35, 36, 37 in Class I Interdigitation) -->
  <g id="lowerLeftTeeth" filter="url(#shadowBuccalL)">
    <!-- Canine (33) -->
    <path d="M 275 362 C 285 372, 328 372, 338 362 C 332 318, 325 295, 312 290 C 286 290, 280 318, 275 362 Z" fill="url(#buccalEnamelL)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- 1st Premolar (34) -->
    <path d="M 350 365 C 360 375, 398 375, 408 365 C 402 322, 395 298, 382 295 C 358 295, 355 322, 350 365 Z" fill="url(#buccalEnamelL)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- 2nd Premolar (35) -->
    <path d="M 420 368 C 430 378, 468 378, 478 368 C 472 325, 465 298, 452 295 C 428 295, 425 325, 420 368 Z" fill="url(#buccalEnamelL)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- 1st Molar (36) -->
    <path d="M 490 370 C 500 380, 555 380, 565 370 C 560 325, 552 295, 538 290 C 502 290, 495 325, 490 370 Z" fill="url(#buccalEnamelL)" stroke="#dcd3c1" stroke-width="1.2"/>
    <!-- 2nd Molar (37) -->
    <path d="M 575 370 C 585 380, 630 380, 640 370 C 635 330, 628 298, 616 295 C 585 295, 580 330, 575 370 Z" fill="url(#buccalEnamelL)" stroke="#dcd3c1" stroke-width="1.2"/>
  </g>
</svg>
`;
}

/**
 * Returns the 5 high-resolution procedural clinical photos for the built-in demo case,
 * baked directly from the 3D procedural arch geometry for 100% orthographic alignment.
 */
export function createDemoClinicalPhotos(): ClinicalPhoto[] {
  return [
    {
      id: 'front',
      title: '正視臨床咬合照片 (Frontal View)',
      viewName: 'Frontal Occlusion',
      description: '正中咬合門齒關係、覆咬與覆蓋、中線對齊與微笑曲線。',
      fileName: 'demo_penta_front.png',
      src: BAKED_DEMO_PHOTOS.front,
      cameraPreset: 'front',
    },
    {
      id: 'upper',
      title: '上顎齒列咬合面 (Upper Arch)',
      viewName: 'Maxillary Occlusal',
      description: '上顎牙弓型態、顎面窩溝咬合點以及牙弓寬度。',
      fileName: 'demo_penta_upper.png',
      src: BAKED_DEMO_PHOTOS.upper,
      cameraPreset: 'upper',
    },
    {
      id: 'lower',
      title: '下顎齒列咬合面 (Lower Arch)',
      viewName: 'Mandibular Occlusal',
      description: '下顎牙弓對稱性、舌側傾斜度及前牙擁擠分析。',
      fileName: 'demo_penta_lower.png',
      src: BAKED_DEMO_PHOTOS.lower,
      cameraPreset: 'lower',
    },
    {
      id: 'patientright',
      title: '右側頰面咬合 (Right Buccal)',
      viewName: 'Right Buccal Occlusion',
      description: '右側犬齒與第一大臼齒咬合關係與齒間接觸。',
      fileName: 'demo_penta_patientright.png',
      src: BAKED_DEMO_PHOTOS.patientright,
      cameraPreset: 'right',
    },
    {
      id: 'patientleft',
      title: '左側頰面咬合 (Left Buccal)',
      viewName: 'Left Buccal Occlusion',
      description: '左側犬齒與第一大臼齒咬合關係及後牙側方引導。',
      fileName: 'demo_penta_patientleft.png',
      src: BAKED_DEMO_PHOTOS.patientleft,
      cameraPreset: 'left',
    },
  ];
}
