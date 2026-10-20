/** Original ivory dry-ink tool marks. One pigment, no emoji or external glyphs. */
const drawings: Record<string, string> = {
    heart: '<path fill="currentColor" d="m32 54-19-19-4-13 4-9 10-2 9 10 9-10 10 2 4 9-4 13Z"/><path d="m32 21-5 16 10-4-4 13" stroke="#252621"/>',
    shield: '<path d="m32 6 21 8-3 25-18 19-18-19-3-25Z"/><path fill="currentColor" d="m32 14 13 5-2 16-11 14-11-14-2-16Z"/><path d="M32 19v25" stroke="#252621"/>',
    brush: '<path fill="currentColor" d="m30 34 19-27 8-4-4 9-18 27Z"/><path fill="currentColor" d="m27 33 11 7-6 9-11-8Z"/><path fill="currentColor" d="M22 42q-12 1-13 13l-5 5 12-1-3 3q13-2 18-13Z"/><path d="m18 48-7 9m12-10-7 10M35 29l12-17" stroke="#252621"/>',
    spray: '<path fill="currentColor" d="m18 24 26-1 3 34-29 1Z"/><path fill="currentColor" d="m24 14 14-1 2 7-16 1Z"/><path d="m29 12 6-1m17 8 8-5m-8 13h8m-8 5 6 4"/><path d="m25 36 13-1m-12 8 11-1" stroke="#252621"/>',
    blade: '<path fill="currentColor" d="M14 9 54 23 33 43 19 36Z"/><path d="m24 39 7 5-10 14-9-6Z"/><path d="m20 15 24 9" stroke="#252621"/>',
    chain: '<path d="m18 41-6 9q-4 8 3 10 5 1 10-8l7-11q3-7-3-9-5-1-10 7m17-17 8-12q6-6 10 0 2 4-3 11L40 36q-5 6-9 1" stroke-width="5"/><path d="m23 45 18-26" stroke-width="4"/>',
    ruler: '<path fill="currentColor" d="m12 10 15-5 26 47-16 9Z"/><path d="m20 17 6-4m0 14 6-4m0 15 6-4m0 15 6-4m-13-27 3-2m3 12 3-2m3 12 3-2" stroke="#252621"/>',
    ribbon: '<path d="M14 10Q57 3 48 25T17 29Q2 40 42 54" stroke-width="9"/><path d="M14 10Q54 5 46 25T18 30Q7 39 40 52" stroke="#252621" stroke-width="1.5"/>',
    vortex: '<path d="M31 30q-9-8-13 2-5 15 12 18 25 4 23-23Q49 2 24 9 2 17 8 39" stroke-width="5"/><path d="m5 36 4 12 9-8m6-29 10-1 10 4"/>',
    bucket: '<path fill="currentColor" d="m10 24 45-2-6 34-31 2Z"/><ellipse cx="32" cy="23" rx="22" ry="7" fill="#252621"/><path d="M14 25Q14-1 35 9q17 6 15 18"/><path d="m23 35 3 15m7-14 1 14m8-15-1 14" stroke="#252621"/>',
    pen: '<path fill="currentColor" d="m14 43 27-35 13 10-29 35Z"/><path fill="currentColor" d="m13 46 9 9-13 5Z"/><path d="m42 14-8 12m-15 17 27-32" stroke="#252621"/>',
    airbrush: '<path fill="currentColor" d="m10 25 41-7 6 9-26 9-3 22-9-2 2-22-12 1Z"/><path fill="currentColor" d="m24 10 15-2-1 15-12 2Z"/><path d="m54 15 6-6m-3 13 6-1m-3 9 3 3"/><path d="m26 36-2 16" stroke="#252621"/>',
    compass: '<path d="m31 17-17 39m19-39 18 36" stroke-width="5"/><circle cx="32" cy="14" r="7" fill="currentColor"/><path d="m14 54-3 7m40-9 3 7M20 35h25"/><path d="m32 11v6" stroke="#252621"/>',
    dropper: '<path fill="currentColor" d="M38 7q12-7 18 5l-10 14-12-9Z"/><path d="m32 20 13 10-22 24-10 3 1-11Z"/><path d="m19 45 16-17"/><path fill="currentColor" d="M9 52q-8 9-1 11 8-1 1-11Z"/>',
    vehicle: '<path fill="currentColor" d="m13 23 37 1 6 24-47 1Z"/><path d="m20 12 23 1 6 9-34-1Z"/><circle cx="18" cy="50" r="8" fill="#252621"/><circle cx="46" cy="50" r="8" fill="#252621"/><path d="m27 34 10 1" stroke="#252621"/>',
    warning: '<path d="M31 5 60 55 4 56Z"/><path d="m31 21 1 16" stroke-width="4"/><path d="m32 45 0 3" stroke-width="3"/>',
};

export function hudIcon(name: string): string {
    return `<svg class="hud-icon" viewBox="0 0 64 64" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">${drawings[name] || drawings.brush}</svg>`;
}

export const weaponIcons: Record<string, string> = {
    standard: 'brush', shotgun: 'spray', melee: 'blade', chain: 'chain', ruler: 'ruler', ribbon: 'ribbon',
    gravity: 'vortex', rocket: 'bucket', sniper: 'pen', flamethrower: 'airbrush', compass: 'compass', mine: 'dropper',
};
