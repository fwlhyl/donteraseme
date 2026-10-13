const PROFILE_STORAGE_KEY = 'dont_erase_me_player_profile_v1';

export interface PlayerProfileData {
    version: 2;
    coins: number;
    unlockedCharacterIds: string[];
    unlockedWeaponIds: number[];
    selectedCharacterId: string;
}

const DEFAULT_PROFILE: PlayerProfileData = {
    version: 2,
    coins: 0,
    unlockedCharacterIds: ['collector'],
    // 前三把基础画笔免费，后续武器由局外金币解锁。
    unlockedWeaponIds: [0, 1, 2],
    selectedCharacterId: 'collector'
};

function cloneDefaultProfile(): PlayerProfileData {
    return {
        ...DEFAULT_PROFILE,
        unlockedCharacterIds: [...DEFAULT_PROFILE.unlockedCharacterIds],
        unlockedWeaponIds: [...DEFAULT_PROFILE.unlockedWeaponIds]
    };
}

function sanitize(raw: unknown): PlayerProfileData {
    const fallback = cloneDefaultProfile();
    if (!raw || typeof raw !== 'object') return fallback;

    const candidate = raw as Partial<PlayerProfileData>;
    const coins = typeof candidate.coins === 'number' && Number.isFinite(candidate.coins)
        ? Math.max(0, Math.floor(candidate.coins))
        : fallback.coins;
    const unlockedCharacterIds = Array.isArray(candidate.unlockedCharacterIds)
        ? [...new Set(candidate.unlockedCharacterIds.filter((id): id is string => typeof id === 'string'))]
        : fallback.unlockedCharacterIds;
    // v1 存档曾默认开放全部武器；升级到 v2 时将其迁移为新的免费起始武器组。
    const unlockedWeaponIds = candidate.version === 2 && Array.isArray(candidate.unlockedWeaponIds)
        ? [...new Set(candidate.unlockedWeaponIds.filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id >= 0))]
        : fallback.unlockedWeaponIds;

    if (!unlockedCharacterIds.includes('collector')) unlockedCharacterIds.unshift('collector');

    const selectedCharacterId = typeof candidate.selectedCharacterId === 'string'
        ? candidate.selectedCharacterId
        : fallback.selectedCharacterId;

    return {
        version: 2,
        coins,
        unlockedCharacterIds,
        unlockedWeaponIds,
        selectedCharacterId: unlockedCharacterIds.includes(selectedCharacterId)
            ? selectedCharacterId
            : 'collector'
    };
}

/** Persistent, local-only progression for the current browser/Electron profile. */
export class PlayerProfile {
    public static load(): PlayerProfileData {
        try {
            return sanitize(JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || 'null'));
        } catch {
            return cloneDefaultProfile();
        }
    }

    public static save(profile: PlayerProfileData): PlayerProfileData {
        const normalized = sanitize(profile);
        try {
            localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(normalized));
        } catch (error) {
            console.error('Unable to save player profile', error);
        }
        return normalized;
    }

    public static addCoins(amount: number): PlayerProfileData {
        const profile = this.load();
        profile.coins += Math.max(0, Math.floor(amount));
        return this.save(profile);
    }

    public static purchaseCharacter(characterId: string, price: number): { purchased: boolean; profile: PlayerProfileData } {
        const profile = this.load();
        if (profile.unlockedCharacterIds.includes(characterId)) {
            return { purchased: true, profile };
        }
        if (!Number.isFinite(price) || price < 0 || profile.coins < price) {
            return { purchased: false, profile };
        }

        profile.coins -= Math.floor(price);
        profile.unlockedCharacterIds.push(characterId);
        profile.selectedCharacterId = characterId;
        return { purchased: true, profile: this.save(profile) };
    }

    public static purchaseWeapon(weaponId: number, price: number): { purchased: boolean; profile: PlayerProfileData } {
        const profile = this.load();
        if (profile.unlockedWeaponIds.includes(weaponId)) {
            return { purchased: true, profile };
        }
        if (!Number.isInteger(weaponId) || weaponId < 0 || !Number.isFinite(price) || price < 0 || profile.coins < price) {
            return { purchased: false, profile };
        }

        profile.coins -= Math.floor(price);
        profile.unlockedWeaponIds.push(weaponId);
        return { purchased: true, profile: this.save(profile) };
    }

    public static selectCharacter(characterId: string): PlayerProfileData {
        const profile = this.load();
        if (profile.unlockedCharacterIds.includes(characterId)) {
            profile.selectedCharacterId = characterId;
        }
        return this.save(profile);
    }
}
