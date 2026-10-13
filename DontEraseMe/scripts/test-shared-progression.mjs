// Isolated browser profile: never reads or changes the developer's game save.
// Run against Vite; override URL/module path through the environment if needed.
import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: Number(process.env.PROGRESSION_TEST_HEIGHT || 900) } });
const page = await context.newPage();
const url = process.env.PROGRESSION_TEST_URL || 'http://127.0.0.1:5174';
const key = 'dont_erase_me_player_profile_v1';
const errors = [];
page.on('pageerror', error => errors.push(error.message));

try {
    await page.goto(url);
    await page.waitForFunction(() => Boolean(window.gameInstance));
    const ids = await page.evaluate(async () => {
        const { PlayerProfile } = await import('/src/core/PlayerProfile.ts');
        const { CHARACTERS } = await import('/src/config/EndlessConfig.ts');
        const { WEAPONS } = await import('/src/components/Weapon.ts');
        PlayerProfile.save({ ...PlayerProfile.load(), coins: 5000 });
        return { characters: CHARACTERS.map(character => character.id), weapons: WEAPONS.map(weapon => weapon.id) };
    });
    const profile = () => page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)), key);
    const changeMode = async mode => {
        await page.locator('#back-to-menu-btn').click();
        await page.locator(mode === 'defense' ? '#defense-mode-btn' : '#create-mode-btn').click();
    };
    const assertUnlocked = async (characterIndex, weaponIndex, balance) => {
        await page.locator('.char-card').nth(characterIndex).click();
        await page.locator('.weap-card').nth(weaponIndex).click();
        assert.equal(await page.locator('.char-card').nth(characterIndex).evaluate(el => el.classList.contains('locked')), false);
        assert.equal(await page.locator('.weap-card').nth(weaponIndex).evaluate(el => el.classList.contains('locked')), false);
        assert.equal(await page.locator('#unlock-character-btn').count(), 0);
        assert.equal(await page.locator('#unlock-weapon-btn').count(), 0);
        assert.equal(await page.locator('#start-run-btn').isEnabled(), true);
        assert.equal((await profile()).coins, balance);
        assert.match(await page.locator('#profile-coins').textContent(), new RegExp(String(balance)));
    };
    await page.locator('#create-mode-btn').click();
    await page.locator('.char-card').nth(1).click();
    await page.locator('#unlock-character-btn').click();
    assert.equal((await profile()).coins, 4400, 'one character costs 600');
    await page.locator('.weap-card').nth(3).click();
    await page.locator('#unlock-weapon-btn').click();
    assert.equal((await profile()).coins, 3900, 'fourth weapon costs 500');

    await changeMode('defense');
    await assertUnlocked(1, 3, 3900);
    await page.locator('.char-card').nth(2).click();
    await page.locator('#unlock-character-btn').click();
    await page.locator('.weap-card').nth(4).click();
    await page.locator('#unlock-weapon-btn').click();
    assert.equal((await profile()).coins, 2770, 'guard purchases debit the same wallet');
    await changeMode('endless');
    await assertUnlocked(2, 4, 2770);
    await assertUnlocked(1, 3, 2770);

    await page.evaluate(async ({ characterId, weaponId }) => {
        const { PlayerProfile } = await import('/src/core/PlayerProfile.ts');
        PlayerProfile.purchaseCharacter(characterId, 600);
        PlayerProfile.purchaseWeapon(weaponId, 500);
    }, { characterId: ids.characters[1], weaponId: ids.weapons[3] });
    assert.equal((await profile()).coins, 2770, 'repeated purchase calls must not charge again');

    // Settlement uses the same real Game path in both modes. Only the collected
    // amount is injected to keep this check short and deterministic.
    const settle = async (mode, coins, expected) => {
        await page.locator('#start-run-btn').click();
        if (mode === 'defense') await page.locator('#skip-defense-intro').click();
        await page.waitForFunction(() => window.gameInstance.state === 1);
        await page.evaluate(async amount => {
            const { Score } = await import('/src/components/Score.ts');
            const game = window.gameInstance;
            game.stop();
            const player = [...game.entities.values()].find(entity => entity.tags.has('player'));
            player.getComponent(Score).coins = amount;
            game.gameOver(0);
            game.gameOver(0); // A repeated result signal must not duplicate rewards.
        }, coins);
        assert.equal((await profile()).coins, expected, `${mode} must settle once into shared wallet`);
        await page.locator('#back-main-btn').click();
    };
    await settle('endless', 37, 2807);
    await page.locator('#defense-mode-btn').click();
    await assertUnlocked(2, 4, 2807);
    await settle('defense', 41, 2848);

    await page.reload();
    await page.waitForFunction(() => Boolean(window.gameInstance));
    await page.locator('#defense-mode-btn').click();
    await assertUnlocked(1, 3, 2848);
    await assertUnlocked(2, 4, 2848);
    await changeMode('endless');
    await assertUnlocked(1, 3, 2848);
    await assertUnlocked(2, 4, 2848);
    assert.deepEqual(errors, [], 'no browser errors');
    console.log('Shared progression checks passed:', { origin: new URL(url).origin, profile: await profile() });
} finally {
    await context.close();
    await browser.close();
}
