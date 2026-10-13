/** Original ink-outline UI drawings; no external fonts or emoji glyphs. */
const drawings: Record<string, string> = {
    heart: '<path fill="#df7180" d="M31 53C22 46 7 35 8 22 9 9 25 7 32 19 39 7 55 9 56 22 57 34 42 47 31 53Z"/><path d="M14 23q0-7 8-7" stroke="#fff4dd"/>',
    shield: '<path fill="#e9bc45" d="m32 5 22 10-3 23Q45 51 32 59 15 49 11 37L9 15Z"/><path fill="#fff2c8" d="m32 13 14 7-2 16q-4 10-12 15-9-6-12-16l-2-15Z"/><path d="m24 32 6 7 12-17"/>',
    brush: '<path fill="#438fc3" d="M27 35 44 8q7-6 10 0 2 3-2 8L35 41Z"/><path fill="#c5bfad" d="m26 34 12 8-6 9-12-8Z"/><path fill="#326dac" d="M21 42q-13 1-11 13l-6 4q20 4 27-9Z"/><path d="m16 51-4 5m21-22 12-19" stroke="#fff4dd"/>',
    spray: '<path fill="#438fc3" d="m19 24 24-1 3 33-27 2Z"/><path fill="#f6ead2" d="m24 14 14-1 2 10-16 1Z"/><path d="m28 13 7-1m-6 24 9-1m12-16 9-5m-8 12h8m-8 5 6 3"/>',
    blade: '<path fill="#a7bfc5" d="M14 9 54 23 33 43 19 36Z"/><path fill="#c38c57" d="m22 36 11 7-11 17-12-8Z"/><path d="m20 14 22 9" stroke="#fff4dd"/>',
    chain: '<path d="m17 44-5 5q-5 9 4 10 5 0 10-9l7-10q4-8-3-10-5-1-10 8m17-18 8-11q7-6 10 0 3 4-2 11L40 38q-5 5-10 1" fill="none" stroke="#438fc3" stroke-width="8"/><path d="m23 44 18-26"/>',
    ruler: '<path fill="#e9bc45" d="m12 10 15-5 26 47-16 9Z"/><path d="m20 17 6-4m0 14 6-4m0 15 6-4m0 15 6-4"/>',
    ribbon: '<path d="M14 10Q57 3 48 25T17 29Q2 40 42 54" fill="none" stroke="#df7180" stroke-width="11"/><path d="M14 7Q60 3 49 28T18 33Q8 39 42 51" fill="none"/>',
    vortex: '<path d="M31 30q-9-8-13 2-5 15 12 18 25 4 23-23Q49 2 24 9 2 17 8 39" fill="none" stroke="#8a76b7" stroke-width="8"/><path d="m5 36 4 12 9-8" fill="none"/>',
    bucket: '<path fill="#df7180" d="m10 24 45-2-6 34-31 2Z"/><ellipse cx="32" cy="23" rx="22" ry="7" fill="#f8f1de"/><path d="M14 25Q14-1 35 9q17 6 15 18M23 35l3 15" fill="none"/>',
    pen: '<path fill="#438fc3" d="m14 43 27-35 13 10-29 35Z"/><path fill="#e9bc45" d="m14 43 11 10-16 7Z"/><path d="m42 14-8 12m-21 29 3-5"/>',
    airbrush: '<path fill="#83b5c9" d="m10 25 41-7 6 9-26 9-3 22-9-2 2-22-12 1Z"/><path fill="#e9bc45" d="m24 10 15-2-1 15-12 2Z"/><path d="m54 15 6-6m-3 13 6-1m-3 9 3 3"/>',
    compass: '<path d="m31 17-17 39m19-39 18 36" stroke="#438fc3" stroke-width="8"/><circle cx="32" cy="14" r="7" fill="#e9bc45"/><path d="m14 54-3 7m40-9 3 7M20 35h25"/>',
    dropper: '<path fill="#8a76b7" d="M38 7q12-7 18 5l-10 14-12-9Z"/><path fill="#a4d4dc" d="m32 18 15 11-24 25-10 3 1-11Z"/><path d="m19 45 16-17"/><path fill="#438fc3" d="M9 52q-8 9-1 11 8-1 1-11Z"/>',
    vehicle: '<path fill="#8a76b7" d="m13 22 37 1 6 26-47 1Z"/><path fill="#a4d4dc" d="m20 12 23 1 6 12-34-1Z"/><circle cx="18" cy="50" r="8" fill="#e9bc45"/><circle cx="46" cy="50" r="8" fill="#e9bc45"/><path d="m27 34 10 1"/>',
    warning: '<path fill="#e9bc45" d="M31 5 60 55 4 56Z"/><path d="m31 21 1 16" stroke-width="5"/><circle cx="32" cy="46" r="2"/>',
};

export function hudIcon(name: string): string {
    return `<svg class="hud-icon" viewBox="0 0 64 64" aria-hidden="true" focusable="false" fill="none" stroke="#302d29" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${drawings[name] || drawings.brush}</svg>`;
}

export const weaponIcons: Record<string, string> = {
    standard: 'brush', shotgun: 'spray', melee: 'blade', chain: 'chain', ruler: 'ruler', ribbon: 'ribbon',
    gravity: 'vortex', rocket: 'bucket', sniper: 'pen', flamethrower: 'airbrush', compass: 'compass', mine: 'dropper',
};
