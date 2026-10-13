// Deterministic Web Audio checks: no sound device, network or real browser storage.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = join(await mkdtemp(join(tmpdir(), 'audio-tests-')), 'audio.mjs');
await build({ stdin: { contents: `
export * from './src/audio/AudioDirector';
export * from './src/audio/AudioSettings';
export * from './src/audio/AudioEvents';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', outfile: out });
const { AudioDirector, SOUND_CUES, DEFAULT_AUDIO_SETTINGS, AUDIO_SETTINGS_KEY, sanitizeAudioSettings,
    loadAudioSettings, saveAudioSettings, emitGameSound, listenGameSounds } = await import(pathToFileURL(out));
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const near = (actual, expected, message) => assert(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} != ${expected}`);

class FakeParam {
    value = 1;
    calls = [];
    cancelScheduledValues(time) { this.calls.push(['cancel', time]); }
    setTargetAtTime(value, time, smoothing) { this.calls.push(['target', value, time, smoothing]); this.value = value; }
    setValueAtTime(value, time) { this.calls.push(['set', value, time]); this.value = value; }
    linearRampToValueAtTime(value, time) { this.calls.push(['ramp', value, time]); }
}
class FakeNode {
    connections = [];
    disconnected = false;
    connect(node) { this.connections.push(node); return node; }
    disconnect() { this.disconnected = true; this.connections.length = 0; }
}
class FakeSource extends FakeNode {
    playbackRate = new FakeParam();
    buffer = null;
    loop = false;
    starts = [];
    stops = [];
    ended = false;
    constructor(context) { super(); this.context = context; }
    start(time = 0) { assert.equal(this.starts.length, 0, 'a buffer source starts at most once'); this.starts.push(time); }
    stop(time = this.context.currentTime) { this.stops.push(time); this.stopAt = time; if (time <= this.context.currentTime) this.finish(); }
    finish() { if (this.ended) return; this.ended = true; this.onended?.(); }
}

function harness({ scene = {}, held = [], httpFailures = [], decodeFailures = [], resumeError = false } = {}) {
    const env = {
        contexts: [], requests: [], storage: new Map(), held: new Map(held.map(name => [name, deferred()])),
        httpFailures: new Set(httpFailures), decodeFailures: new Set(decodeFailures), resumeError,
        readError: false, writeError: false, document: { hidden: false },
    };
    globalThis.document = env.document;
    globalThis.localStorage = {
        getItem(key) { if (env.readError) throw new Error('blocked storage'); return env.storage.get(key) ?? null; },
        setItem(key, value) { if (env.writeError) throw new Error('quota exceeded'); env.storage.set(key, value); },
    };
    globalThis.fetch = async url => {
        const name = url.slice('mock:'.length);
        env.requests.push(name);
        if (env.held.has(name)) await env.held.get(name).promise;
        return { ok: !env.httpFailures.has(name), status: env.httpFailures.has(name) ? 404 : 200,
            arrayBuffer: async () => new TextEncoder().encode(name).buffer };
    };
    globalThis.AudioContext = class {
        currentTime = 0;
        state = 'suspended';
        destination = new FakeNode();
        sources = [];
        gains = [];
        pans = [];
        decoded = [];
        resumeCalls = 0;
        suspendCalls = 0;
        closeCalls = 0;
        constructor(options) { this.options = options; env.contexts.push(this); }
        createGain() { const node = Object.assign(new FakeNode(), { gain: new FakeParam() }); this.gains.push(node); return node; }
        createStereoPanner() { const node = Object.assign(new FakeNode(), { pan: new FakeParam() }); this.pans.push(node); return node; }
        createDynamicsCompressor() { return Object.assign(new FakeNode(), Object.fromEntries(['threshold', 'knee', 'ratio', 'attack', 'release'].map(key => [key, new FakeParam()]))); }
        createBufferSource() { const node = new FakeSource(this); this.sources.push(node); return node; }
        async decodeAudioData(data) { const name = new TextDecoder().decode(data); this.decoded.push(name); if (env.decodeFailures.has(name)) throw new Error('bad WAV'); return { name, duration: 1 }; }
        async resume() { this.resumeCalls++; if (env.resumeError) throw new Error('gesture required'); this.state = 'running'; }
        async suspend() { this.suspendCalls++; this.state = 'suspended'; }
        async close() { this.closeCalls++; this.state = 'closed'; }
        advance(time) { assert(time >= this.currentTime); this.currentTime = time; for (const source of this.sources) if (source.stopAt <= time) source.finish(); }
    };
    const current = { music: null, combat: true, paused: false, x: 100, y: 200, ...scene };
    const urls = Object.fromEntries([...SOUND_CUES, 'menu', 'atelier', 'ruins'].map(name => [name, `mock:${name}`]));
    const audio = new AudioDirector(urls, () => current), statuses = [];
    audio.onStatus(message => statuses.push(message));
    return { env, audio, scene: current, statuses,
        get ctx() { return env.contexts[0]; },
        async start() { await audio.unlock(); await flush(); return env.contexts[0]; },
        resolve(name) { env.held.get(name).resolve(); },
    };
}

// Stored values are untrusted and denied storage must not break live controls.
{
    const h = harness();
    for (const invalid of [undefined, null, 4, 'loud', []]) assert.deepEqual(sanitizeAudioSettings(invalid), DEFAULT_AUDIO_SETTINGS);
    assert.deepEqual(sanitizeAudioSettings({ master: -3, music: 8, effects: .25, muted: true, unknown: 10 }), { master: 0, music: 1, effects: .25, muted: true });
    assert.deepEqual(sanitizeAudioSettings({ master: NaN, music: Infinity, effects: '0.2', muted: 'true' }), DEFAULT_AUDIO_SETTINGS);
    h.env.storage.set(AUDIO_SETTINGS_KEY, '{broken json');
    assert.deepEqual(loadAudioSettings(), DEFAULT_AUDIO_SETTINGS);
    h.env.readError = true;
    assert.deepEqual(loadAudioSettings(), DEFAULT_AUDIO_SETTINGS);
    h.env.readError = false;
    assert(saveAudioSettings({ master: 5, music: .2, effects: -.4, muted: true }));
    assert.deepEqual(loadAudioSettings(), { master: 1, music: .2, effects: 0, muted: true });
    h.env.writeError = true;
    assert.equal(saveAudioSettings(DEFAULT_AUDIO_SETTINGS), false);
    assert.equal(h.audio.setSettings({ master: .4, effects: .3 }), false);
    assert.equal(h.audio.settings.master, .4, 'failed persistence still applies in-memory settings');
    assert.match(h.audio.status, /保存失败/);
    assert.equal(h.env.contexts.length, 0, 'changing settings never unlocks audio');
    h.audio.dispose();
}

{
    const received = [];
    const offBroken = listenGameSounds(() => { throw new Error('optional audio unavailable'); });
    const off = listenGameSounds((cue, options) => received.push({ cue, options }));
    assert.doesNotThrow(() => emitGameSound('hit', { x: 1, y: 2 }));
    assert.deepEqual(received, [{ cue: 'hit', options: { x: 1, y: 2 } }], 'one failed listener cannot block another or gameplay');
    off(); offBroken(); emitGameSound('hit');
    assert.equal(received.length, 1, 'unsubscribing removes the listener');
}

// Unlock owns context creation; loading is shared and dropped events stay dropped.
{
    const h = harness({ held: ['hit'] });
    assert.equal(h.audio.diagnostics.state, 'locked');
    h.audio.sync(); await h.audio.setHidden(false);
    assert.equal(h.audio.play('hit'), false);
    assert.equal(h.env.contexts.length, 0);
    assert.equal(h.env.requests.length, 0);
    await h.start();
    assert.equal(h.ctx.resumeCalls, 1);
    assert.equal(h.ctx.state, 'running');
    assert.equal(h.audio.play('hit'), false, 'undecoded cue drops immediately');
    await h.audio.unlock(); await h.audio.unlock();
    assert.equal(h.env.contexts.length, 1, 'gesture repeats reuse one context');
    assert.equal(h.ctx.resumeCalls, 1, 'running context is not needlessly resumed');
    assert.equal(h.env.requests.filter(name => name === 'hit').length, 1, 'an in-flight decode has a single fetch');
    h.resolve('hit'); await flush();
    assert.equal(h.ctx.sources.length, 0, 'decoding never replays an old combat event');
    assert.equal(h.audio.diagnostics.decoded, SOUND_CUES.length);
    assert(h.audio.play('hit'));
    const source = h.ctx.sources.at(-1), gain = source.connections[0], pan = gain.connections[0];
    assert.equal(h.audio.diagnostics.voices, 1);
    source.finish();
    assert.equal(h.audio.diagnostics.voices, 0);
    assert(source.disconnected && gain.disconnected && pan.disconnected, 'ended effects release all per-voice nodes');
    h.ctx.state = 'suspended'; await h.audio.unlock();
    assert.equal(h.ctx.resumeCalls, 2, 'a later gesture recovers a suspended context');
    assert(h.env.requests.every(name => h.env.requests.filter(other => other === name).length === 1), 'cached buffers never refetch on unlock');
    h.audio.dispose();
}

{
    const h = harness({ resumeError: true });
    await h.start();
    assert.equal(h.audio.play('hit'), false);
    assert.match(h.audio.status, /暂不可用/);
    h.env.resumeError = false;
    await h.audio.unlock();
    assert.equal(h.env.contexts.length, 1, 'failed resume keeps the reusable graph');
    assert(h.audio.play('hit'), 'retry after a valid gesture enables audio');
    h.audio.dispose();
}

// Cue cooldown, one-second ordinary-effect budget, and hard voice cap.
{
    const h = harness(); await h.start();
    assert(h.audio.play('hit')); assert.equal(h.audio.play('hit'), false);
    h.ctx.advance(.064); assert.equal(h.audio.play('hit'), false);
    h.ctx.advance(.066); assert(h.audio.play('hit'));
    h.audio.dispose();
}
{
    const h = harness(); await h.start();
    const ordinary = ['shot-brush', 'shot-spray', 'shot-scrape', 'shot-chain'];
    for (let index = 0; index < 36; index++) {
        h.ctx.advance(index * .02);
        assert(h.audio.play(ordinary[index % ordinary.length]), `ordinary event ${index + 1} fits the one-second budget`);
        h.ctx.sources.at(-1).finish();
    }
    h.ctx.advance(.73);
    assert.equal(h.audio.play('shot-brush'), false, 'ordinary event 37 is suppressed within one second');
    assert(h.audio.play('hurt'), 'critical damage feedback can bypass the ordinary-effect budget');
    h.ctx.advance(1.1);
    assert(h.audio.play('shot-brush'), 'budget recovers when older events leave the rolling window');
    h.audio.dispose();
}
{
    const h = harness(); await h.start();
    for (let index = 0; index < 18; index++) {
        h.ctx.advance(index * .14); assert(h.audio.play('pickup'));
    }
    assert.equal(h.audio.diagnostics.voices, 18);
    const first = h.ctx.sources[0];
    assert(h.audio.play('hurt'), 'important feedback replaces a weaker voice');
    assert.equal(h.audio.diagnostics.voices, 18, 'replacement never exceeds the hard voice cap');
    assert(first.ended, 'the weakest old source is stopped');
    for (let index = 0; index < 18; index++) {
        h.ctx.advance(h.ctx.currentTime + .21); assert(h.audio.play('hurt'));
    }
    h.ctx.advance(h.ctx.currentTime + .14);
    assert.equal(h.audio.play('pickup'), false, 'a weak new effect never steals an important voice');
    assert.equal(h.audio.diagnostics.voices, 18);
    h.audio.dispose();
}

// Scene gates suppress combat, while menu/paused UI remains responsive.
{
    const h = harness(); await h.start();
    assert(h.audio.play('hit')); assert(h.audio.play('ui-click'));
    const combat = h.ctx.sources[0], ui = h.ctx.sources[1];
    h.scene.paused = true; h.audio.sync();
    assert(combat.ended && !ui.ended, 'pause stops existing combat but retains UI feedback');
    assert.equal(h.audio.play('hit-heavy'), false);
    h.ctx.advance(.1); assert(h.audio.play('ui-click'));
    near(h.ctx.gains[1].gain.value, DEFAULT_AUDIO_SETTINGS.music * .25, 'pause attenuates music');
    h.scene.paused = false; h.scene.combat = false; h.audio.sync();
    assert.equal(h.audio.play('shot-brush'), false);
    h.ctx.advance(.2); assert(h.audio.play('ui-click'), 'menu buttons still make sound');
    h.scene.combat = true; h.audio.sync();
    assert(h.audio.play('hit-heavy'));
    h.audio.setSettings({ muted: true });
    assert.equal(h.audio.diagnostics.voices, 0, 'mute immediately releases active effects');
    assert.equal(h.audio.play('ui-click'), false);
    near(h.ctx.gains[0].gain.value, 0, 'mute controls master bus');
    h.audio.setSettings({ muted: false, effects: 0 });
    assert.equal(h.audio.play('hit'), false);
    h.audio.setSettings({ effects: .5, master: 0 });
    assert.equal(h.audio.play('hit'), false);
    h.audio.setSettings({ master: .4 });
    near(h.ctx.gains[0].gain.value, .4, 'master slider reaches master bus');
    near(h.ctx.gains[2].gain.value, .5, 'effects slider reaches effects bus');
    assert(h.audio.play('hit'));
    h.audio.dispose();
}

// World distance changes gain, horizontal position changes pan; invalid input is safe.
{
    const h = harness(); await h.start();
    assert(h.audio.play('shot-brush', { x: 750, y: 200, gain: 1, pitch: 1 }));
    let source = h.ctx.sources.at(-1), gain = source.connections[0], pan = gain.connections[0];
    near(gain.gain.value, .65 / (1 + 650 / 500), 'position attenuates gain by world distance');
    near(pan.pan.value, .65, 'right pan is capped');
    assert(source.playbackRate.value >= .96 && source.playbackRate.value <= 1.04, 'combat pitch has subtle bounded variation');
    h.ctx.advance(.1);
    assert(h.audio.play('shot-brush', { x: -700, y: 200, gain: 100, pitch: 10 }));
    source = h.ctx.sources.at(-1); gain = source.connections[0]; pan = gain.connections[0];
    near(pan.pan.value, -.65, 'left pan is capped');
    near(gain.gain.value, .65 * 1.5 / (1 + 800 / 500), 'requested gain has a safe upper bound');
    near(source.playbackRate.value, 1.3, 'pitch has a safe upper bound');
    h.ctx.advance(.2);
    assert.equal(h.audio.play('shot-brush', { x: 1400, y: 200 }), false, 'inaudible distant cues allocate no source');
    assert(h.audio.play('shot-brush', { x: NaN, y: 200, gain: NaN, pitch: Infinity }), 'invalid optional values fall back to local safe defaults');
    source = h.ctx.sources.at(-1); gain = source.connections[0]; pan = gain.connections[0];
    near(gain.gain.value, .65, 'non-finite gain falls back to unity'); near(pan.pan.value, 0, 'invalid position is centered');
    assert(Number.isFinite(source.playbackRate.value));
    assert(h.audio.play('ui-click', { pitch: 1 }));
    near(h.ctx.sources.at(-1).playbackRate.value, 1, 'UI pitch remains exact');
    h.audio.dispose();
}

// Music waits for decoding; stale asynchronous results cannot replace the latest scene.
{
    const h = harness({ scene: { music: 'menu', combat: false }, held: ['menu', 'atelier'] }); await h.start();
    h.audio.sync(); h.audio.sync();
    assert.equal(h.env.requests.filter(name => name === 'menu').length, 1, 'repeated sync coalesces pending music loads');
    h.scene.music = 'atelier'; h.audio.sync();
    h.resolve('atelier'); await flush();
    assert.equal(h.audio.diagnostics.track, 'atelier');
    h.resolve('menu'); await flush();
    assert.equal(h.audio.diagnostics.track, 'atelier', 'late menu decode does not replace the newer scene');
    assert.equal(h.audio.diagnostics.musicVoices, 1);
    h.scene.music = 'menu'; h.audio.sync(); await flush();
    assert.equal(h.audio.diagnostics.track, 'menu');
    assert.equal(h.env.requests.filter(name => name === 'menu').length, 1, 'later revisit reuses the decoded track');
    h.audio.dispose();
}
{
    const h = harness({ scene: { music: 'menu' } }); await h.start();
    const menu = h.ctx.sources.find(source => source.loop), menuGain = menu.connections[0];
    assert.equal(menu.buffer.name, 'menu');
    assert(menuGain.gain.calls.some(call => call[0] === 'ramp' && call[1] === 1 && call[2] === .8), 'new music fades in');
    h.ctx.advance(2); h.scene.music = 'atelier'; h.audio.sync(); await flush();
    assert.equal(h.audio.diagnostics.musicVoices, 2, 'a switch briefly overlaps outgoing and incoming loops');
    assert(menuGain.gain.calls.some(call => call[0] === 'ramp' && call[1] === 0 && call[2] === 2.65), 'outgoing track ramps down before stopping');
    near(menu.stops.at(-1), 2.7, 'outgoing track receives its delayed stop');
    h.ctx.advance(2.1); h.scene.music = 'ruins'; h.audio.sync(); await flush();
    assert.equal(h.audio.diagnostics.track, 'ruins');
    assert.equal(h.audio.diagnostics.musicVoices, 2, 'rapid switches retain at most one fading predecessor');
    assert(menu.ended, 'the older predecessor is retired on another switch');
    h.ctx.advance(3); assert.equal(h.audio.diagnostics.musicVoices, 1);
    h.scene.music = null; h.audio.sync();
    assert.equal(h.audio.diagnostics.track, undefined);
    h.ctx.advance(4); assert.equal(h.audio.diagnostics.musicVoices, 0, 'a no-music scene fades all loops out');
    h.audio.dispose();
}
{
    const h = harness({ scene: { music: 'menu' }, held: ['menu'] }); await h.start();
    h.scene.music = null; h.audio.sync(); h.resolve('menu'); await flush();
    assert.equal(h.audio.diagnostics.musicVoices, 0, 'a null scene cancels a pending track without starting it');
    h.audio.dispose();
}

// Missing/bad assets degrade individually; visibility and disposal cancel late work.
{
    const h = harness({ scene: { music: 'menu' }, httpFailures: ['hit', 'ruins'], decodeFailures: ['pickup'] }); await h.start();
    assert(h.audio.diagnostics.failed.includes('hit') && h.audio.diagnostics.failed.includes('pickup'));
    assert.equal(h.audio.play('hit'), false); assert.equal(h.audio.play('pickup'), false);
    assert(h.audio.play('shot-brush'), 'one bad cue does not disable other effects');
    h.scene.music = 'ruins'; h.audio.sync(); await flush();
    assert.equal(h.audio.diagnostics.track, 'menu', 'a missing replacement preserves the currently playing music');
    for (let index = 0; index < 10; index++) h.audio.sync();
    await h.audio.unlock(); await flush();
    assert.equal(h.env.requests.filter(name => name === 'ruins').length, 1, 'failed asset is not repeatedly fetched each frame');
    assert.match(h.audio.status, /声音已启用|部分声音/);
    h.audio.dispose();
}
{
    const h = harness({ scene: { music: 'menu' }, held: ['menu'] }); await h.start();
    assert(h.audio.play('hit'));
    h.env.document.hidden = true; await h.audio.setHidden(true);
    assert.equal(h.ctx.state, 'suspended'); assert.equal(h.audio.diagnostics.voices, 0);
    assert.equal(h.audio.play('ui-click'), false, 'hidden page suppresses UI as well as combat');
    h.resolve('menu'); await flush();
    assert.equal(h.audio.diagnostics.musicVoices, 0, 'a decode finishing while hidden does not start music');
    h.env.document.hidden = false; await h.audio.setHidden(false); await flush();
    assert.equal(h.ctx.state, 'running'); assert.equal(h.audio.diagnostics.track, 'menu');
    assert.equal(h.env.requests.filter(name => name === 'menu').length, 1, 'foreground resume uses the hidden-time decoded buffer');
    assert.equal(h.audio.diagnostics.voices, 0, 'resume never replays stopped effects');
    const loops = h.ctx.sources.filter(source => source.loop).length;
    h.env.document.hidden = true; await h.audio.setHidden(true);
    h.env.document.hidden = false; await h.audio.setHidden(false); await flush();
    assert.equal(h.ctx.sources.filter(source => source.loop).length, loops, 'resume preserves the existing loop rather than duplicating it');
    h.audio.dispose();
}
{
    const h = harness({ scene: { music: 'menu' }, held: ['menu', 'hit'] }); await h.start();
    let cleanupCount = 0; h.audio.attachCleanup(() => cleanupCount++);
    assert(h.audio.play('shot-brush'));
    h.audio.dispose();
    assert.equal(cleanupCount, 1); assert.equal(h.ctx.closeCalls, 1);
    assert.equal(h.ctx.state, 'closed'); assert.equal(h.audio.diagnostics.voices, 0);
    const decoded = h.audio.diagnostics.decoded, sources = h.ctx.sources.length;
    h.resolve('menu'); h.resolve('hit'); await flush();
    assert.equal(h.audio.diagnostics.decoded, decoded, 'late decoding cannot repopulate a disposed cache');
    assert.equal(h.audio.diagnostics.musicVoices, 0);
    await h.audio.unlock(); await h.audio.setHidden(false); h.audio.sync();
    assert.equal(h.ctx.sources.length, sources, 'disposed director cannot create sources');
    assert.equal(h.env.contexts.length, 1, 'disposed director cannot unlock another context');
    assert.equal(h.audio.play('ui-click'), false);
}

console.log('PASS: audio settings/storage isolation, gesture unlock and recovery, one-copy loading, cooldown/36 ordinary events per second/18 voices, scene gates, spatial gain/pan, async music/crossfades, partial failure, visibility and disposal.');
