/** Coordinates measured on the approved, cleaned courtyard plate. */
export const COMIC_ATELIER_SOURCE = { width: 1671, height: 941 } as const;
export type ComicPoint = readonly [number, number];

/** Preserve the illustration's aspect ratio and the existing gameplay board. */
export function comicAtelierBounds(width: number, height: number) {
    const scale = Math.min(width / COMIC_ATELIER_SOURCE.width, height / COMIC_ATELIER_SOURCE.height);
    const w = COMIC_ATELIER_SOURCE.width * scale;
    const h = COMIC_ATELIER_SOURCE.height * scale;
    return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h };
}

/** Clockwise footprint traced along the inside of the approved stone arena.
 * Source-space coordinates share the same mapping as the scene artwork. */
export const COMIC_WALKABLE: readonly ComicPoint[] = [
    [200,490],[215,300],[230,170],[390,125],[560,130],[720,133],
    [900,132],[1080,150],[1200,205],[1315,275],[1410,330],[1470,380],
    [1470,500],[1460,610],[1415,705],[1300,800],[1120,830],[930,850],
    [720,840],[510,820],[330,790],[240,755],[190,700],[185,555],
];

/** Exact visual foreground, not the collision footprint. Replaying these pixels
 * from the same plate makes wall occlusion align without a second AI redraw. */
export const COMIC_FOREGROUND_POLYGONS: readonly (readonly ComicPoint[])[] = [
    // Southwest broken wall, gate and foliage; leave the central entry visible.
    [[0,557],[35,554],[55,580],[87,585],[109,596],[139,594],
     [163,606],[180,607],[180,601],[211,584],[244,595],[280,613],
     [279,655],[309,670],[316,647],[326,644],[331,659],[383,681],
     [438,713],[485,739],[512,722],[516,698],[535,692],[558,703],
     [584,715],[601,736],[594,786],[637,811],[663,810],[686,825],
     [711,836],[714,941],[0,941]],
    // Southeast terrace, drawing table, broken wall and foreground gate.
    [[788,941],[805,899],[820,871],[844,838],[876,825],[905,800],
     [945,789],[973,785],[975,768],[1006,750],[1045,739],
     [1052,721],[1052,693],[1058,668],[1064,671],[1067,701],
     [1076,708],[1080,685],[1092,666],[1097,669],[1089,705],
     [1110,688],[1126,686],[1152,695],[1160,689],[1171,692],
     [1175,707],[1187,717],[1185,744],[1238,723],[1237,691],
     [1276,675],[1302,675],[1319,647],[1369,627],[1419,599],
     [1423,541],[1431,532],[1441,534],[1451,548],[1462,552],
     [1466,542],[1478,542],[1489,556],[1510,562],[1557,538],
     [1562,471],[1590,456],[1625,458],[1671,466],[1671,941]],
];

/** Only existing lantern glass flickers; ambient illumination stays constant. */
export const COMIC_LIGHTS = [
    { x: 219, y: 154, radius: 8, phase: .4 },
    { x: 714, y: 19, radius: 8, phase: 2.3 },
    { x: 1375, y: 167, radius: 8, phase: 4.1 },
] as const;
