/** Shared size contract for the procedural character rig, collision and review. */
export const PLAYER_PRESENTATION = {
    /** Authoring coordinates stay fixed so later characters reuse the same animation rig. */
    sourceSize: 64,
    displaySize: 52,
    /** Scale the original 20px gameplay radius by the exact same display factor. */
    hitRadius: 20 * 52 / 64,
    turnPreviewSpeed: 1.7,
    facingDeadZone: .06,
} as const;
