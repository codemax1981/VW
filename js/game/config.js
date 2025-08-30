// --- js/game/config.js ---

// World generation settings
export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 64;
export const RENDER_DISTANCE = 8;

// Block types - UPDATED PALETTE
export const BLOCKS = {
    air: 0,
    stone: 1,
    cobblestone: 2,
    dirt: 3,
    grass: 4,
    logs: 5,
    leaves: 6,
    planks: 7,
    glass: 8,
    bricks: 9
};

// Block colors - UPDATED PALETTE
export const BLOCK_COLORS = {
    1: 0x9E9E9E, // stone
    2: 0x757575, // cobblestone
    3: 0x8D6E63, // dirt
    4: 0x7CB342, // grass
    5: 0x5D4037, // logs (oak log)
    6: 0x4CAF50, // leaves (oak leaves)
    7: 0xA1887F, // planks (oak planks)
    8: 0xE0F7FA, // glass
    9: 0xC62828  // bricks
};