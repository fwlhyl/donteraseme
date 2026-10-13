import { AudioDirector, type MusicTrack } from '../src/audio/AudioDirector';
import { AUDIO_URLS } from '../src/audio/AudioAssets';
import { SOUND_CUES, type SoundCue } from '../src/audio/AudioEvents';
let music: MusicTrack | null = null, paused = false;
const audio = new AudioDirector(AUDIO_URLS, () => ({ music, paused, combat:true, x:0, y:0 }));
// Preview volume intentionally does not write the user's real game preferences.
audio.settings = { master:.65, music:.32, effects:.8, muted:false };
const $ = (id: string) => document.getElementById(id)!;
audio.onStatus(message => $('status').textContent = message);
$('enable').onclick = () => { void audio.unlock(); };
$('stop').onclick = () => { music = null; audio.sync(); refresh(); };
$('pause').onclick = () => { paused = !paused; audio.sync(); $('pause').textContent = paused ? '恢复试听' : '模拟暂停'; };
$('volume').oninput = () => { audio.settings.master = Number(($('volume') as HTMLInputElement).value) / 100; audio.sync(); };
function refresh() { document.querySelectorAll<HTMLButtonElement>('[data-track]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.track === music))); }
document.querySelectorAll<HTMLButtonElement>('[data-track]').forEach(button => button.onclick = () => {
    music = button.dataset.track as MusicTrack; void audio.unlock(); audio.sync(); refresh();
});
const names = ['画笔 · 啪','喷罐 · 噗砰','刮刀 · 唰','墨链 · 咔甩','尺枪 · 嗒','缎带 · 轻扫','旋涡 · 低旋','颜料桶 · 重炮','钢笔 · 脆击','喷笔 · 喷气','圆规 · 甩回','滴管 · 滴弹',
    '命中','暴击 / 重击','击杀','受伤','护盾','冲刺','技能','爆炸','拾取','换弹','升级','胜利','失败','按钮','神笔具现'];
SOUND_CUES.forEach((cue, index) => {
    const button = document.createElement('button'); button.textContent = names[index]; button.dataset.cue = cue;
    button.onclick = () => { void audio.unlock(); audio.play(cue); };
    $(index < 12 ? 'weapons' : 'effects').append(button);
});
$('burst').onclick = () => { for (let i=0;i<40;i++) audio.play('hit',{x:i*3,y:0}); };
$('heavy').onclick = () => { for (const cue of ['hit-heavy','explosion','kill'] as SoundCue[]) audio.play(cue); };
let frame=0;
function tick() {
    audio.sync();
    const info=audio.diagnostics;
    $('status').textContent=`${audio.status} · ${info.state} · 已加载 ${info.decoded}/30 · 配乐 ${info.track??'无'} · 当前音效 ${info.voices}/18`;
    frame=requestAnimationFrame(tick);
}
frame=requestAnimationFrame(tick);
document.addEventListener('visibilitychange',()=>{void audio.setHidden(document.hidden);});
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);audio.dispose();},{once:true});
