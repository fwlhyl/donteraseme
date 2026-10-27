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

/** Clockwise ground footprint: table/press legs, barrels, masonry and gates are
 * solid. The broad middle remains open. Image and collision share this mapping. */
export const COMIC_WALKABLE: readonly ComicPoint[] = [
    [112,563],[184,520],[238,480],[247,441],[317,403],[350,376],
    [401,355],[417,326],[518,285],[565,276],[582,252],[649,231],
    [710,205],[758,179],[801,156],[850,155],[906,178],[953,193],
    [1003,198],[1061,224],[1123,241],[1181,267],[1239,293],
    [1280,296],[1345,320],[1414,347],[1472,377],[1511,391],
    [1558,420],[1581,449],[1553,488],[1538,519],[1479,548],
    [1430,584],[1385,617],[1318,651],[1298,683],[1247,708],
    [1210,719],[1185,716],[1168,681],[1127,669],[1088,681],
    [1056,715],[1011,728],[969,753],[903,784],[848,813],
    [795,835],[745,857],[706,855],[662,827],[632,796],
    [596,782],[568,760],[544,748],[516,764],[481,759],
    [424,729],[375,701],[324,679],[281,656],[253,628],
    [215,615],[185,597],[157,585],
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
