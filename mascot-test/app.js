(() => {
  'use strict';

  const DISHES = window.WTE_DISHES || [];
  const REGRET_LINES = window.WTE_REGRET_LINES || [];
  const HELL_QUESTIONS = window.WTE_HELL_QUESTIONS || [];
  const TEMPLATES = window.WTE_TEMPLATES || {};
  const MAIN_OPTIONS = window.WTE_MAIN_OPTIONS || [];
  const DETAIL_MAP = window.WTE_DETAIL_MAP || {};
  const WHEEL_GROUPS = window.WTE_WHEEL_GROUPS || {};
  const STORAGE_KEY = 'what-to-eat-v01';
  const CUSTOM_WHEELS_KEY = 'what-to-eat-custom-wheels-v1';
  const SOUND_KEY = 'what-to-eat-sound-v1';
  const app = document.querySelector('#app');
  const toastEl = document.querySelector('#toast');
  const asyncHandles = new Set();

  let sessionRegrets = 0;
  let tournament = null;
  let hell = null;
  let wheelItems = [];
  let wheelContext = null;
  let toastTimer = null;
  let lastTournamentFinalMode = null;
  let soundEnabled = localStorage.getItem(SOUND_KEY) !== 'off';
  let audioCtx = null;
  let audioMaster = null;
  let audioCompressor = null;
  let audioDestination = null;
  let customWheels = loadCustomWheels();

  function blankStats() {
    return {version:1, plays:0, regrets:0, dishes:{}, history:[]};
  }

  function loadStats() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return blankStats();
      const parsed = JSON.parse(raw);
      return {
        ...blankStats(),
        ...parsed,
        dishes: parsed.dishes && typeof parsed.dishes === 'object' ? parsed.dishes : {},
        history: Array.isArray(parsed.history) ? parsed.history : []
      };
    } catch {
      return blankStats();
    }
  }

  let stats = loadStats();

  function saveStats() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  }

  function loadCustomWheels() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CUSTOM_WHEELS_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(w => w && w.id && w.name && Array.isArray(w.items)) : [];
    } catch {
      return [];
    }
  }

  function saveCustomWheels() {
    localStorage.setItem(CUSTOM_WHEELS_KEY, JSON.stringify(customWheels));
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function detailItemsFor(dish) {
    const names = DETAIL_MAP[dish?.id] || [];
    const seen = new Set();
    return names.map(name => DISHES.find(d => d.name === name)).filter(d => {
      if (!d || seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });
  }

  function ensureAudioContext() {
    if (!soundEnabled) return null;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;

    if (!audioCtx) {
      audioCtx = new Ctx();
      audioMaster = audioCtx.createGain();
      audioMaster.gain.value = .78;

      if (typeof audioCtx.createDynamicsCompressor === 'function') {
        audioCompressor = audioCtx.createDynamicsCompressor();
        audioCompressor.threshold.value = -18;
        audioCompressor.knee.value = 18;
        audioCompressor.ratio.value = 6;
        audioCompressor.attack.value = .003;
        audioCompressor.release.value = .22;
        audioCompressor.connect(audioMaster);
        audioDestination = audioCompressor;
      } else {
        audioDestination = audioMaster;
      }
      audioMaster.connect(audioCtx.destination);
    }

    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  }

  function connectSoundNode(node) {
    node.connect(audioDestination || audioMaster || audioCtx.destination);
  }

  function playTone(freq = 440, duration = .06, type = 'sine', volume = .06, delay = 0, endFreq = null) {
    const ctx = ensureAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime + delay;
    const end = start + duration;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq && osc.frequency.exponentialRampToValueAtTime) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), end);
    }

    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(.001, volume), start + Math.min(.014, duration * .28));
    gain.gain.exponentialRampToValueAtTime(.0001, end);

    osc.connect(gain);
    connectSoundNode(gain);
    osc.start(start);
    osc.stop(end + .025);
  }

  function playNoiseBurst(duration = .14, volume = .035, delay = 0, cutoff = 1200) {
    const ctx = ensureAudioContext();
    if (!ctx) return;

    if (typeof ctx.createBuffer !== 'function' || typeof ctx.createBufferSource !== 'function') {
      playTone(180, duration, 'triangle', volume * .7, delay, 420);
      return;
    }

    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const start = ctx.currentTime + delay;
    source.buffer = buffer;

    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(.001, volume), start + .018);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);

    if (typeof ctx.createBiquadFilter === 'function') {
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(cutoff, start);
      filter.Q.value = .8;
      source.connect(filter);
      filter.connect(gain);
    } else {
      source.connect(gain);
    }

    connectSoundNode(gain);
    source.start(start);
    source.stop(start + duration + .02);
  }

  const SOUND_V2_GAIN = 1.6;
  function v2Gain(volume) {
    return Math.min(.16, volume * SOUND_V2_GAIN);
  }

  function playClickSound() {
    playTone(720,.052,'triangle',v2Gain(.045));
    playTone(1080,.036,'sine',v2Gain(.025),.012);
  }

  function playLoseSound() {
    playTone(330,.12,'triangle',v2Gain(.07),0,230);
    playTone(220,.14,'sine',v2Gain(.055),.07,150);
    playNoiseBurst(.08,v2Gain(.018),.015,650);
  }

  function playWinSound() {
    playNoiseBurst(.11,v2Gain(.028),0,1800);
    [523,659,784,1047].forEach((freq,i) => {
      playTone(freq,.16 + i*.025,i < 3 ? 'triangle' : 'sine',v2Gain(.062),i*.075);
    });
    playTone(130,.19,'sine',v2Gain(.055),0,78);
  }

  function playWheelStartSound() {
    playNoiseBurst(.24,v2Gain(.034),0,950);
    playTone(115,.22,'sine',v2Gain(.05),0,260);
    playTone(310,.16,'triangle',v2Gain(.026),.055,520);
  }

  function playSpinTicks() {
    const times = [0.08,.15,.22,.29,.36,.44,.52,.61,.71,.82,.94,1.08,1.23,1.39,1.53];
    times.forEach((time,i) => {
      const progress = i / (times.length - 1);
      const freq = 760 - progress * 280;
      const vol = .031 + (1 - progress) * .012;
      playTone(freq,.028,'triangle',v2Gain(vol),time);
      playTone(freq * 1.5,.02,'sine',v2Gain(vol * .34),time + .004);
    });
  }

  function playWheelHitSound() {
    playTone(105,.2,'sine',v2Gain(.075),0,62);
    playNoiseBurst(.075,v2Gain(.032),0,650);
    playTone(880,.14,'triangle',v2Gain(.072),.028);
    playTone(1320,.16,'sine',v2Gain(.042),.06);
  }

  function playHellPulse(intensity = 0) {
    const boost = Math.min(.025, intensity * .008);
    playTone(92 + intensity * 5,.11,'sine',v2Gain(.04 + boost),0,82);
    playTone(184 + intensity * 8,.055,'triangle',v2Gain(.018 + boost * .4),.018);
  }

  function playHellCountdown() {
    [[180,0],[930,1],[1580,2],[2140,3],[2580,4]].forEach(([ms,level]) => {
      later(() => playHellPulse(level), ms);
    });
  }

  function playHellAnswerSound() {
    playTone(620,.07,'triangle',v2Gain(.047));
    playTone(830,.09,'sine',v2Gain(.045),.045);
  }

  function playHellTimeoutSound() {
    playTone(210,.12,'sawtooth',v2Gain(.06),0,150);
    playTone(145,.18,'sine',v2Gain(.065),.08,92);
    playNoiseBurst(.1,v2Gain(.022),.02,500);
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem(SOUND_KEY, soundEnabled ? 'on' : 'off');
    const btn = document.querySelector('#soundBtn');
    if (btn) {
      btn.textContent = soundEnabled ? '🔊' : '🔇';
      btn.setAttribute('aria-label', soundEnabled ? '關閉音效' : '開啟音效');
    }
    if (soundEnabled) {
      playTone(660,.07,'sine',.090);
      showToast('音效已開啟');
    } else {
      showToast('已靜音');
    }
  }

  document.addEventListener('click', e => {
    const soundBtn = e.target.closest('#soundBtn');
    if (soundBtn) {
      toggleSound();
      return;
    }

    const interactive = e.target.closest('button, a');
    if (!interactive || !soundEnabled) return;

    const special = interactive.closest(
      '[data-spin], .food-card, [data-final-select], [data-mini], .lottery-item'
    );
    if (!special) playClickSound();
  });

  function celebrate() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const oldLayer = document.querySelector('.confetti-layer');
    if (oldLayer) oldLayer.remove();
    const layer = document.createElement('div');
    layer.className = 'confetti-layer';
    const symbols = ['●','■','▲','★','✦'];
    for (let i = 0; i < 24; i += 1) {
      const piece = document.createElement('i');
      piece.textContent = symbols[i % symbols.length];
      piece.style.setProperty('--x', (Math.random()*100).toFixed(1) + '%');
      piece.style.setProperty('--dx', ((Math.random()-.5)*150).toFixed(0) + 'px');
      piece.style.setProperty('--r', ((Math.random()-.5)*520).toFixed(0) + 'deg');
      piece.style.setProperty('--delay', (Math.random()*.18).toFixed(2) + 's');
      piece.style.setProperty('--dur', (.85 + Math.random()*.55).toFixed(2) + 's');
      layer.appendChild(piece);
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(),1700);
  }

  function dishStat(id) {
    const src = stats.dishes[id] || {};
    const ratings = src.ratings && typeof src.ratings === 'object' ? src.ratings : {};
    stats.dishes[id] = {
      selected: Number(src.selected) || 0,
      eliminated: Number(src.eliminated) || 0,
      ratings:{love:Number(ratings.love)||0, ok:Number(ratings.ok)||0, meh:Number(ratings.meh)||0, no:Number(ratings.no)||0}
    };
    return stats.dishes[id];
  }

  function recordElimination(id) {
    dishStat(id).eliminated += 1;
    saveStats();
  }

  function recordRegret() {
    stats.regrets += 1;
    sessionRegrets += 1;
    saveStats();
  }

  function recordResult(dish, mode, rating) {
    const ds = dishStat(dish.id);
    ds.selected += 1;
    ds.ratings[rating] = (ds.ratings[rating] || 0) + 1;
    stats.plays += 1;
    stats.history.unshift({dishId:dish.id, mode, rating, at:new Date().toISOString()});
    stats.history = stats.history.slice(0, 100);
    saveStats();
  }

  function shuffle(items) {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function sample(items, count) {
    return shuffle(items).slice(0, count);
  }

  function randomOf(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function getDish(id) {
    return MAIN_OPTIONS.find(d => d.id === id) || DISHES.find(d => d.id === id);
  }

  function clearAsync() {
    asyncHandles.forEach(h => {
      clearTimeout(h);
      clearInterval(h);
    });
    asyncHandles.clear();
  }

  function later(fn, ms) {
    const h = setTimeout(() => {
      asyncHandles.delete(h);
      fn();
    }, ms);
    asyncHandles.add(h);
    return h;
  }

  function every(fn, ms) {
    const h = setInterval(fn, ms);
    asyncHandles.add(h);
    return h;
  }

  function stopHandle(h) {
    clearTimeout(h);
    clearInterval(h);
    asyncHandles.delete(h);
  }

  function showToast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
  }

  function topbar(backAction = null) {
    return `<div class="topbar">
      <div class="brand">你想吃什麼？</div>
      <div class="top-actions">
        <button class="sound-btn" id="soundBtn" type="button" aria-label="${soundEnabled ? '關閉音效' : '開啟音效'}">${soundEnabled ? '🔊' : '🔇'}</button>
        ${backAction ? `<button class="icon-btn" id="backBtn" aria-label="回首頁">← 回去</button>` : `<button class="text-btn" id="stomachBtn">我的胃</button>`}
      </div>
    </div>`;
  }

  function attachBack(fn = renderHome) {
    const btn = document.querySelector('#backBtn');
    if (btn) btn.addEventListener('click', fn);
  }

  function attachStomach() {
    const btn = document.querySelector('#stomachBtn');
    if (btn) btn.addEventListener('click', renderStomach);
  }

  function mascot() {
    return `<div class="mascot" aria-hidden="true"><span>🍽️</span><i class="mascot-mouth"></i></div>`;
  }

  function sharePageUrl() {
    return window.location.origin + window.location.pathname;
  }

  function shareCopy() {
    return '又不知道吃什麼？來玩「你想吃什麼？」幫你決定今天吃什麼 😏';
  }

  async function shareToInstagram() {
    const url = sharePageUrl();
    if (navigator.share) {
      try {
        await navigator.share({title:'你想吃什麼？', text:shareCopy(), url});
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }
    window.open('https://www.instagram.com/', '_blank', 'noopener');
    try {
      await navigator.clipboard.writeText(url);
      showToast('連結已複製，可以貼到 IG 分享。');
    } catch {
      showToast('已開啟 Instagram，請貼上網站連結分享。');
    }
  }
  function renderHome() {
    clearAsync();
    tournament = null;
    hell = null;
    wheelItems = [];
    app.innerHTML = `<div class="shell">
      ${topbar()}
      <section class="hero">
        ${mascot()}
        <span class="kicker">今天不要再說都可以</span>
        <h1>又不知道吃什麼？<br>我就知道 😏</h1>
      </section>
      <section class="mode-grid" aria-label="選擇玩法">
        <button class="mode-card red" data-mode="tournament">
          <span class="mode-emoji">🥊</span><span><span class="mode-title">三問淘汰賽</span><span class="mode-desc">三組獨立對決，最後還會陰你一次。</span></span><span class="mode-arrow">→</span>
        </button>
        <button class="mode-card blue" data-mode="wheel">
          <span class="mode-emoji">🎡</span><span><span class="mode-title">命運大輪盤</span><span class="mode-desc">不要想了。讓宇宙承擔責任。</span></span><span class="mode-arrow">→</span>
        </button>
        <button class="mode-card yellow" data-mode="hell">
          <span class="mode-emoji">🔥</span><span><span class="mode-title">地獄直覺快答</span><span class="mode-desc">3 秒內回答。猶豫，地獄就替你按。</span></span><span class="mode-arrow">→</span>
        </button>
      </section>
      <div class="home-foot"><button class="link-btn" id="stomachLink">看看我的胃有多難搞 →</button></div>
<section class="share-strip" aria-label="分享網站">
  <div class="share-title">分享給還在問「吃什麼？」的人</div>
  <div class="share-row">
    <a class="share-btn line" id="shareLine" target="_blank" rel="noopener" aria-label="分享到 LINE">
      <span class="share-icon" aria-hidden="true"><svg viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#06C755"/><path fill="#fff" d="M25.6 14.5c0-4.5-4.5-8.1-10-8.1s-10 3.6-10 8.1c0 4 3.6 7.4 8.5 8 .3.1.8.2.9.5.1.3.1.7 0 1l-.2 1.1c-.1.3-.2 1.3 1.2.7 1.4-.6 7.4-4.4 10.1-7.5 1.8-1.9 2.5-3.8 2.5-3.8Zm-14.9 2.6H8.6V12h2.1v3.3h1.9v1.8h-1.9Zm3.1 0h-2.1V12h2.1v5.1Zm5.8 0h-1.8l-2.1-2.8v2.8h-2V12h1.8l2.1 2.8V12h2v5.1Zm4.6-3.4h-2v.7h1.9V16h-1.9v.7h2v1.6h-4.1V12h4.1v1.7Z"/></svg></span>
      <span>LINE</span>
    </a>
    <button class="share-btn ig" id="shareIg" type="button" aria-label="分享到 Instagram">
      <span class="share-icon" aria-hidden="true"><svg viewBox="0 0 32 32"><defs><linearGradient id="igGradient" x1="4" y1="28" x2="28" y2="4"><stop stop-color="#feda75"/><stop offset=".35" stop-color="#fa7e1e"/><stop offset=".68" stop-color="#d62976"/><stop offset="1" stop-color="#4f5bd5"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="url(#igGradient)"/><rect x="7.5" y="7.5" width="17" height="17" rx="5.4" fill="none" stroke="#fff" stroke-width="2.2"/><circle cx="16" cy="16" r="4.1" fill="none" stroke="#fff" stroke-width="2.2"/><circle cx="22.1" cy="9.9" r="1.5" fill="#fff"/></svg></span>
      <span>IG</span>
    </button>
    <a class="share-btn fb" id="shareFb" target="_blank" rel="noopener" aria-label="分享到 Facebook">
      <span class="share-icon" aria-hidden="true"><svg viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#1877F2"/><path fill="#fff" d="M18.3 27V17.5h3.2l.5-3.7h-3.7v-2.4c0-1.1.3-1.8 1.9-1.8H22V6.3c-.4-.1-1.6-.2-2.9-.2-2.9 0-4.9 1.8-4.9 5.1v2.8H11v3.7h3.2V27h4.1Z"/></svg></span>
      <span>FB</span>
    </a>
    <a class="share-btn x" id="shareX" target="_blank" rel="noopener" aria-label="分享到 X">
      <span class="share-icon" aria-hidden="true"><svg viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#111"/><path fill="#fff" d="M9 8h4.4l3.6 4.8L21.2 8H24l-5.7 6.6L24 24h-4.4l-4-5.3L11 24H8.2l6.1-7L9 8Zm3.1 2 8.5 12h1.3l-8.5-12h-1.3Z"/></svg></span>
      <span>X</span>
    </a>
  </div>
</section>
    </div>`;
    attachStomach();
    document.querySelector('#stomachLink').addEventListener('click', renderStomach);
    const shareUrl = sharePageUrl();
    const shareText = shareCopy();
    document.querySelector('#shareLine').href = 'https://social-plugins.line.me/lineit/share?url=' + encodeURIComponent(shareUrl);
    document.querySelector('#shareFb').href = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(shareUrl);
    document.querySelector('#shareX').href = 'https://twitter.com/intent/tweet?url=' + encodeURIComponent(shareUrl) + '&text=' + encodeURIComponent(shareText);
    document.querySelector('#shareIg').addEventListener('click', shareToInstagram);
    document.querySelectorAll('[data-mode]').forEach(btn => btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (mode === 'tournament') renderTemplatePicker('tournament');
      if (mode === 'wheel') renderTemplatePicker('wheel');
      if (mode === 'hell') renderHellIntro();
    }));
  }

  function templatePool(templateId) {
    const template = TEMPLATES[templateId] || TEMPLATES.all || {label:'全部隨機', ids:null};
    const pool = Array.isArray(template.ids) ? template.ids.map(getDish).filter(Boolean) : Array.isArray(template.tags) ? DISHES.filter(d => Array.isArray(d.tags) && template.tags.some(tag => d.tags.includes(tag))) : DISHES;
    return {template, pool: pool.length ? pool : DISHES};
  }

  function gamePool(templateId) {
    const detailModes = ['snack','late','dessert'];
    if (detailModes.includes(templateId)) return templatePool(templateId);
    const template = TEMPLATES[templateId] || TEMPLATES.all || {label:'隨便都可以'};
    const pool = templateId === 'all'
      ? MAIN_OPTIONS
      : MAIN_OPTIONS.filter(d => Array.isArray(d.tags) && d.tags.includes(templateId));
    return {template, pool: pool.length ? pool : MAIN_OPTIONS};
  }
  function wheelPool(templateId) {
    const template = TEMPLATES[templateId] || TEMPLATES.all || {label:'隨便都可以'};
    const detailModes = ['snack','late','dessert'];
    if (detailModes.includes(templateId)) return templatePool(templateId);
    if (templateId === 'all') return {template, pool:MAIN_OPTIONS};

    const grouped = WHEEL_GROUPS[templateId];
    if (Array.isArray(grouped) && grouped.length >= 2) {
      return {template, pool:grouped};
    }

    const main = MAIN_OPTIONS.filter(d => Array.isArray(d.tags) && d.tags.includes(templateId));
    return {template, pool:main.length ? main : MAIN_OPTIONS};
  }

  function wheelLabelHtml(name) {
    const aliases = {
      '小籠包／麵點':'麵點',
      '漢堡／速食':'速食',
      '烏龍／蕎麥麵':'烏龍／蕎麥',
      '滷肉飯／雞肉飯':'滷肉／雞肉',
      '壽司／生魚片':'壽司',
      '水餃／鍋貼':'水餃／鍋貼',
      '早餐／早午餐':'早午餐'
    };
    const safe = escapeHtml(aliases[name] || String(name));
    if (safe.includes('／')) return safe.replace('／','／<br>');
    if (safe.length >= 7) {
      const mid = Math.ceil(safe.length / 2);
      return safe.slice(0,mid) + '<br>' + safe.slice(mid);
    }
    return safe;
  }

  function tournamentMainPool() {
    return MAIN_OPTIONS;
  }
  function tournamentTemplateEntries() {
    const allowed = ['all','rice','noodle','hotpot','meat','fastfood','international','breakfast','healthy'];
    return allowed.map(id => [id, TEMPLATES[id]]).filter(([,t]) => t);
  }

  function customWheelSection() {
    const cards = customWheels.map(w => `<div class="custom-wheel-card">
      <div><b>🎯 ${escapeHtml(w.name)}</b><small>${w.items.map(escapeHtml).join('、')}</small></div>
      <div class="custom-wheel-actions">
        <button class="mini-action primary-mini" data-custom-play="${w.id}">開始</button>
        <button class="mini-action" data-custom-edit="${w.id}">編輯</button>
        <button class="mini-action danger-mini" data-custom-delete="${w.id}">刪除</button>
      </div>
    </div>`).join('');
    return `<section class="custom-wheel-section">
      <div class="custom-wheel-head"><div><b>🛠️ 自定義輪盤</b><small>自己填 2～8 個選項，可以存起來下次再玩。</small></div><button class="secondary compact-btn" id="newCustomWheel">＋ 新增</button></div>
      <div class="custom-wheel-list">${cards || '<div class="custom-wheel-empty">還沒有自定義輪盤。聚餐、飲料、遊戲都可以自己做一個。</div>'}</div>
    </section>`;
  }

  function renderCustomWheelEditor(id = null) {
    clearAsync();
    const existing = customWheels.find(w => w.id === id);
    app.innerHTML = `<div class="shell">
      ${topbar(true)}
      <section class="panel">
        <div class="progress-row"><span>自定義輪盤</span><span>2～8 項</span></div>
        <div class="question">${existing ? '修改這個輪盤' : '做自己的輪盤'}</div>
        <p class="hint">每行一個項目，也可以用逗號分隔。最多 8 項，手機上比較好看。</p>
        <label class="field-label">輪盤名稱</label>
        <input class="custom-input" id="customWheelName" maxlength="24" placeholder="例如：今晚聚餐" value="${escapeHtml(existing?.name || '')}">
        <label class="field-label">選項</label>
        <textarea class="custom-textarea" id="customWheelItems" rows="8" placeholder="火鍋&#10;燒肉&#10;壽司&#10;披薩">${escapeHtml((existing?.items || []).join('\n'))}</textarea>
        <div class="actions"><button class="primary" id="saveCustomWheel">${existing ? '儲存修改' : '儲存這個輪盤'}</button><button class="secondary" id="cancelCustomWheel">取消</button></div>
      </section>
    </div>`;
    attachBack(() => renderTemplatePicker('wheel'));
    document.querySelector('#cancelCustomWheel').addEventListener('click', () => renderTemplatePicker('wheel'));
    document.querySelector('#saveCustomWheel').addEventListener('click', () => {
      const name = document.querySelector('#customWheelName').value.trim() || '我的輪盤';
      const raw = document.querySelector('#customWheelItems').value;
      const items = [...new Set(raw.split(/[\n,，]+/).map(x => x.trim()).filter(Boolean))];
      if (items.length < 2) return showToast('至少要有 2 個選項。');
      if (items.length > 8) return showToast('最多 8 個選項，避免手機輪盤太擠。');
      const entry = {id:existing?.id || ('cw-' + Date.now().toString(36)), name, items, updatedAt:new Date().toISOString()};
      customWheels = existing ? customWheels.map(w => w.id === existing.id ? entry : w) : [entry, ...customWheels];
      saveCustomWheels();
      showToast('輪盤已存檔。');
      renderTemplatePicker('wheel');
    });
  }

  function renderTemplatePicker(mode) {
    clearAsync();
    let entries = mode === 'tournament' ? tournamentTemplateEntries() : Object.entries(TEMPLATES);
    if (mode === 'tournament') entries = entries.map(([id,t]) => [id, id === 'all' ? {...t, label:'隨機主食', description:'不知道吃什麼？只抽正餐主食，不混小吃、消夜、甜食。'} : t]);
    const title = mode === 'tournament' ? '三問淘汰賽' : '命運大輪盤';
    const copy = mode === 'tournament' ? '真的不知道就直接按「隨機主食」；有方向再挑下面分類。' : '先選現在想吃的方向，再把最後決定交給命運。';
    app.innerHTML = `<div class="shell">
      ${topbar(true)}
      <section class="panel">
        <div class="progress-row"><span>${title}</span><span>先選一種局</span></div>
        <div class="question">現在想吃哪一種？</div>
        <p class="hint">${copy}</p>
        <div class="template-grid">
          ${entries.map(([id,t]) => `<button class="template-card ${mode === 'tournament' && id === 'all' ? 'template-featured' : ''}" data-template="${id}"><span class="template-emoji">${t.emoji || '🍽️'}</span><span><b>${t.label}</b><small>${t.description || ''}</small></span></button>`).join('')}
        </div>
        ${mode === 'wheel' ? customWheelSection() : ''}
      </section>
    </div>`;
    attachBack(renderHome);
    document.querySelectorAll('[data-template]').forEach(btn => btn.addEventListener('click', () => {
      if (mode === 'tournament') startTournament(btn.dataset.template);
      else startWheel(btn.dataset.template);
    }));
    if (mode === 'wheel') {
      const addBtn = document.querySelector('#newCustomWheel');
      if (addBtn) addBtn.addEventListener('click', () => renderCustomWheelEditor());
      document.querySelectorAll('[data-custom-play]').forEach(btn => btn.addEventListener('click', () => startCustomWheel(btn.dataset.customPlay)));
      document.querySelectorAll('[data-custom-edit]').forEach(btn => btn.addEventListener('click', () => renderCustomWheelEditor(btn.dataset.customEdit)));
      document.querySelectorAll('[data-custom-delete]').forEach(btn => btn.addEventListener('click', () => {
        const wheel = customWheels.find(w => w.id === btn.dataset.customDelete);
        if (!wheel || !confirm(`刪除「${wheel.name}」？`)) return;
        customWheels = customWheels.filter(w => w.id !== wheel.id);
        saveCustomWheels();
        renderTemplatePicker('wheel');
      }));
    }
  }

  function foodCard(dish, extraClass = '') {
    return `<button class="food-card ${extraClass}" data-dish="${dish.id}">
      <span class="emoji">${dish.emoji}</span>
      <span class="name">${dish.name}</span>
      <span class="cat">${dish.category}</span>
    </button>`;
  }

  function startTournament(templateId = 'all') {
    clearAsync();
    const {template, pool} = gamePool(templateId);
    const source = pool.length >= 6 ? pool : tournamentMainPool();
    const six = sample(source, 6);
    tournament = {
      templateId,
      templateLabel:templateId === 'all' ? '隨機主食' : (template.label || '全部隨機'),
      pairs:[[six[0],six[1]],[six[2],six[3]],[six[4],six[5]]],
      round:0,
      survivors:[],
      fate:null,
      decoys:[]
    };
    renderTournamentRound();
  }

  function renderTournamentRound() {
    clearAsync();
    const pair = tournament.pairs[tournament.round];
    const roundNumber = tournament.round + 1;
    app.innerHTML = `<div class="shell">
      ${topbar(true)}
      <section class="panel">
        <div class="progress-row"><span>三問淘汰賽 · ${tournament.templateLabel}</span><div class="progress-dots">${[1,2,3,4].map(n => `<i class="dot ${n <= roundNumber ? 'on' : ''}"></i>`).join('')}</div></div>
        <div class="question">今天比較不想吃哪個？</div>
        <p class="hint">反向選擇：點你比較不想吃的。別想太久，你的手比腦誠實。</p>
        <div class="duel">${foodCard(pair[0])}${foodCard(pair[1])}</div>
        <div class="speech" id="speech">第 ${roundNumber} 組。這兩個先互相傷害一下。</div>
      </section>
    </div>`;
    attachBack(() => renderTemplatePicker('tournament'));
    document.querySelectorAll('.food-card').forEach(card => card.addEventListener('click', () => {
      const rejected = pair.find(d => d.id === card.dataset.dish);
      const survivor = pair.find(d => d.id !== card.dataset.dish);
      recordElimination(rejected.id);
      playLoseSound();
      document.querySelectorAll('.food-card').forEach(b => b.disabled = true);
      card.classList.add('loser');
      const survivorCard = document.querySelector(`[data-dish="${survivor.id}"]`);
      survivorCard.classList.add('winner');
      document.querySelector('#speech').textContent = `${rejected.name} 被你無情淘汰了。${survivor.name} 暫時逃過一劫。`;
      later(() => {
        tournament.survivors.push(survivor);
        tournament.round += 1;
        if (tournament.round < 3) renderTournamentRound();
        else renderTournamentTwist();
      }, 620);
    }));
  }

  function chooseTournamentFinalMode() {
    const modes = ['hidden','duel','direct','lottery'].filter(m => m !== lastTournamentFinalMode);
    const mode = randomOf(modes);
    lastTournamentFinalMode = mode;
    return mode;
  }

  function renderTournamentTwist() {
    clearAsync();
    const mode = chooseTournamentFinalMode();
    tournament.finalMode = mode;
    if (mode === 'hidden') return renderTournamentHiddenFinal();
    if (mode === 'duel') return renderTournamentDuelFinal();
    if (mode === 'direct') return renderTournamentDirectFinal();
    return renderTournamentLotteryFinal();
  }

  function renderTournamentHiddenFinal() {
    tournament.fate = randomOf(tournament.survivors);
    tournament.decoys = tournament.survivors.filter(d => d.id !== tournament.fate.id);
    app.innerHTML = `<div class="shell">
      ${topbar(true)}
      <section class="panel final-stage">
        <div class="progress-row"><span>最後一輪 · 🔒 命運保留席</span><div class="progress-dots">${[1,2,3,4].map(() => `<i class="dot on"></i>`).join('')}</div></div>
        <div class="question">剩下三個。<br>但我先偷走一個。</div>
        <p class="hint">這次是經典煙霧彈。剩下兩個讓你再刪一個。</p>
        <div class="final-three" id="finalThree">${tournament.survivors.map(d => `<div class="mini-food" data-mini="${d.id}"><span><span class="emoji">${d.emoji}</span><br>${d.name}</span></div>`).join('')}</div>
        <div class="twist-banner" id="twistBanner">命運正在偷偷動手腳…</div>
        <div class="duel" id="decoyDuel" style="opacity:.25;pointer-events:none">${foodCard(tournament.decoys[0])}${foodCard(tournament.decoys[1])}</div>
        <div class="speech" id="speech">這輪有詐，但哪裡有詐先不告訴你。</div>
      </section>
    </div>`;
    attachBack(renderHome);
    playClickSound();
    later(() => {
      const fateMini = document.querySelector(`[data-mini="${tournament.fate.id}"]`);
      fateMini.classList.add('fate','mystery');
      fateMini.innerHTML = '<span>🔒<br>命運保留席</span>';
      document.querySelector('#twistBanner').textContent = '一個被藏起來了。現在這兩個，再刪一個。';
      const duel = document.querySelector('#decoyDuel');
      duel.style.opacity = '1';
      duel.style.pointerEvents = 'auto';
      duel.querySelectorAll('.food-card').forEach(card => card.addEventListener('click', () => {
        const rejected = tournament.decoys.find(d => d.id === card.dataset.dish);
        recordElimination(rejected.id);
        playLoseSound();
        duel.querySelectorAll('.food-card').forEach(b => b.disabled = true);
        card.classList.add('decoy-hit');
        document.querySelector('#speech').textContent = `${rejected.name} 被你刪了——但真正答案還在鎖裡。`;
        later(() => renderResult(tournament.fate, 'tournament', `這次是煙霧彈。命運保留席裡的是——${tournament.fate.name}。`), 560);
      }));
    }, 650);
  }

  function renderTournamentDuelFinal() {
    const systemOut = randomOf(tournament.survivors);
    const finalists = tournament.survivors.filter(d => d.id !== systemOut.id);
    app.innerHTML = `<div class="shell">
      ${topbar(true)}
      <section class="panel final-stage">
        <div class="progress-row"><span>最後一輪 · ⚔️ 最後二選一</span><div class="progress-dots">${[1,2,3,4].map(() => `<i class="dot on"></i>`).join('')}</div></div>
        <div class="question">這次不玩煙霧彈。<br>系統先砍一個。</div>
        <div class="twist-banner system-out">💨 ${systemOut.name} 被系統先請出場</div>
        <p class="hint">剩下兩個，點你「比較不想吃」的；另一個就是答案。</p>
        <div class="duel" id="finalDuel">${foodCard(finalists[0])}${foodCard(finalists[1])}</div>
        <div class="speech" id="speech">這次答案真的在你手上。</div>
      </section>
    </div>`;
    attachBack(renderHome);
    playClickSound();
    document.querySelectorAll('#finalDuel .food-card').forEach(card => card.addEventListener('click', () => {
      const rejected = finalists.find(d => d.id === card.dataset.dish);
      const winner = finalists.find(d => d.id !== card.dataset.dish);
      recordElimination(rejected.id);
      playLoseSound();
      document.querySelectorAll('#finalDuel .food-card').forEach(b => b.disabled = true);
      card.classList.add('loser');
      document.querySelector(`[data-dish="${winner.id}"]`).classList.add('winner');
      document.querySelector('#speech').textContent = `${rejected.name} 出局。這次沒有詐，${winner.name} 就是答案。`;
      later(() => renderResult(winner, 'tournament', `最後二選一，由你親手留下了 ${winner.name}。`), 560);
    }));
  }

  function renderTournamentDirectFinal() {
    app.innerHTML = `<div class="shell">
      ${topbar(true)}
      <section class="panel final-stage">
        <div class="progress-row"><span>最後一輪 · ❤️ 直覺點名</span><div class="progress-dots">${[1,2,3,4].map(() => `<i class="dot on"></i>`).join('')}</div></div>
        <div class="question">反過來。<br>這次直接選最想吃的。</div>
        <p class="hint">三個都活著。別刪人，直接點你現在最想吃的那個。</p>
        <div class="final-three final-select-grid">${tournament.survivors.map(d => `<button class="mini-food final-choice" data-final-select="${d.id}"><span><span class="emoji">${d.emoji}</span><br>${d.name}</span></button>`).join('')}</div>
        <div class="speech" id="speech">沒有套路。你選誰就是誰。</div>
      </section>
    </div>`;
    attachBack(renderHome);
    document.querySelectorAll('[data-final-select]').forEach(btn => btn.addEventListener('click', () => {
      const chosen = tournament.survivors.find(d => d.id === btn.dataset.finalSelect);
      playClickSound();
      document.querySelectorAll('[data-final-select]').forEach(b => b.disabled = true);
      btn.classList.add('picked');
      document.querySelector('#speech').textContent = `手比嘴誠實。你剛剛直接點了 ${chosen.name}。`;
      later(() => renderResult(chosen, 'tournament', `這輪沒有陰你。你自己點名了 ${chosen.name}。`), 420);
    }));
  }

  function renderTournamentLotteryFinal() {
    const chosen = randomOf(tournament.survivors);
    app.innerHTML = `<div class="shell">
      ${topbar(true)}
      <section class="panel final-stage">
        <div class="progress-row"><span>最後一輪 · 🎰 命運抽籤</span><div class="progress-dots">${[1,2,3,4].map(() => `<i class="dot on"></i>`).join('')}</div></div>
        <div class="question">手收好。<br>這次命運自己抽。</div>
        <p class="hint">三個候選輪流亮起，停在哪個就吃哪個。</p>
        <div class="final-three lottery-grid">${tournament.survivors.map(d => `<div class="mini-food lottery-item" data-mini="${d.id}"><span><span class="emoji">${d.emoji}</span><br>${d.name}</span></div>`).join('')}</div>
        <div class="twist-banner" id="twistBanner">抽籤中…</div>
      </section>
    </div>`;
    attachBack(renderHome);
    let step = 0;
    const items = [...document.querySelectorAll('.lottery-item')];
    const timer = every(() => {
      items.forEach(x => x.classList.remove('lottery-active'));
      items[step % items.length].classList.add('lottery-active');
      playTone(360 + step*18,.025,'square',.018);
      step += 1;
      if (step >= 11) {
        stopHandle(timer);
        items.forEach(x => x.classList.remove('lottery-active'));
        const hit = document.querySelector(`[data-mini="${chosen.id}"]`);
        hit.classList.add('picked');
        document.querySelector('#twistBanner').textContent = `停！這輪是 ${chosen.name}。`;
        later(() => renderResult(chosen, 'tournament', `命運抽籤停在 ${chosen.name}。這次你連手都沒得怪。`), 650);
      }
    }, 135);
  }
  function renderWheelBoard(items, meta = {}) {
    clearAsync();
    wheelItems = items.slice(0,8);
    wheelContext = meta;
    const count = wheelItems.length;
    const slice = 360 / count;
    const palette = ['#f6ce62','#4b70d8','#7fc07d','#e65747','#f6b58e','#d980e7','#9da7ed','#8cccec'];
    const stops = wheelItems.map((_,i) => `${palette[i % palette.length]} ${i*slice}deg ${(i+1)*slice}deg`).join(',');
    const background = `repeating-conic-gradient(from 0deg, rgba(21,21,21,.9) 0 1.05deg, transparent 1.05deg ${slice}deg), conic-gradient(from 0deg, ${stops})`;
    const radiusPct = count >= 8 ? 35 : 36;
    const labels = wheelItems.map((d, i) => {
      const angle = i * slice + slice / 2;
      const rad = angle * Math.PI / 180;
      const left = 50 + Math.sin(rad) * radiusPct;
      const top = 50 - Math.cos(rad) * radiusPct;
      let textRotation = angle;
      if (angle > 90 && angle < 270) textRotation += 180;
      return `<span class="wheel-label wheel-count-${count}" data-wheel-index="${i}" data-dish-id="${d.id}" style="left:${left.toFixed(3)}%;top:${top.toFixed(3)}%;transform:translate(-50%,-50%) rotate(${textRotation}deg)"><span class="wheel-label-inner"><i>${d.emoji || '🎯'}</i><b>${wheelLabelHtml(d.name)}</b></span></span>`;
    }).join('');

    const isDetail = meta.kind === 'detail';
    const isCustom = meta.kind === 'custom';
    const isDirect = meta.kind === 'direct';
    const flowHtml = isCustom
      ? '<div class="wheel-flow"><span class="active">🎯 自定義輪盤</span><i>·</i><span>自己出的題</span></div>'
      : isDirect
        ? '<div class="wheel-flow"><span class="active">🎯 直接抽細項</span><i>·</i><span>抽到就決定</span></div>'
        : `<div class="wheel-flow"><span class="${isDetail ? 'done' : 'active'}">① 大方向</span><i>→</i><span class="${isDetail ? 'active' : ''}">② 細項（可選）</span></div>`;

    const candidateHtml = `<div class="wheel-candidates">
      <div class="wheel-candidates-title">本輪候選</div>
      <div class="wheel-candidate-chips">${wheelItems.map(d => `<span>${d.emoji || '🎯'} ${escapeHtml(d.name)}</span>`).join('')}</div>
    </div>`;

    app.innerHTML = `<div class="shell">
      ${topbar(true)}
      <section class="panel wheel-panel">
        <div class="progress-row"><span>${escapeHtml(meta.title || '命運大輪盤')}</span><span>${count} 選 1</span></div>
        <div class="question">${escapeHtml(meta.question || '不要想。轉就對了。')}</div>
        <p class="hint">${escapeHtml(meta.description || '今天的命運就交給這一圈。')}</p>
        ${flowHtml}
        ${candidateHtml}
        <div class="wheel-wrap"><div class="pointer"><span></span></div><div class="wheel" id="wheel" style="background:${background}">${labels}</div><button class="wheel-hub" data-spin>轉！</button></div>
        <button class="primary wheel-spin" data-spin>開始轉 🎡</button>
        <button class="link-btn wheel-change" id="changeWheelTemplate">${escapeHtml(meta.changeLabel || '換一組料理模板')}</button>
        <div class="wheel-note">${escapeHtml(meta.note || '抽到後可以直接接受；有細項的類別還能再轉一次。')}</div>
      </section>
    </div>`;
    attachBack(meta.backAction || renderHome);
    document.querySelectorAll('[data-spin]').forEach(btn => btn.addEventListener('click', spinWheel));
    document.querySelector('#changeWheelTemplate').addEventListener('click', meta.changeAction || meta.backAction || renderHome);
  }

  function startWheel(templateId = 'all') {
    const {template, pool} = wheelPool(templateId);
    const desired = Math.min(Number(template.wheelCount) || 8, 8);
    const items = sample(pool, Math.max(2, Math.min(desired, pool.length)));
    renderWheelBoard(items, {
      kind:['snack','late','dessert'].includes(templateId) ? 'direct' : 'main',
      templateId,
      title:`命運大輪盤 · ${template.label || '全部隨機'}`,
      description:template.description || '先決定大方向，想更細再繼續轉。',
      onFinish:chosen => renderResult(chosen,'wheel',`大項目先決定：${chosen.name}。想更細還可以再轉一次。`),
      backAction:() => renderTemplatePicker('wheel'),
      changeAction:() => renderTemplatePicker('wheel'),
      changeLabel:'換一組料理模板',
      weighted:true
    });
  }

  function startDetailWheel(parentDish) {
    const detail = detailItemsFor(parentDish);
    if (detail.length < 2) return showToast('這個項目目前沒有足夠細項。');
    const items = sample(detail, Math.min(8, detail.length));
    renderWheelBoard(items, {
      kind:'detail',
      parentDish,
      title:`細項輪盤 · ${parentDish.name}`,
      question:`${parentDish.name} 決定了，再細一點？`,
      description:'不想細分也可以直接回去接受大項目。',
      onFinish:chosen => renderResult(chosen,'wheel-detail',`大項目是 ${parentDish.name}，細項最後停在 ${chosen.name}。`),
      backAction:() => renderResult(parentDish,'wheel',`大項目先決定：${parentDish.name}。你可以直接接受，或再轉細項。`),
      changeAction:() => renderResult(parentDish,'wheel',`大項目先決定：${parentDish.name}。你可以直接接受，或再轉細項。`),
      changeLabel:`← 不細分，回到 ${parentDish.name}`,
      weighted:true
    });
  }

  function startCustomWheel(id) {
    const saved = customWheels.find(w => w.id === id);
    if (!saved) return showToast('找不到這個輪盤。');
    const items = saved.items.map((name,index) => ({id:`custom-${saved.id}-${index}`,name,emoji:'🎯',category:'自定義'}));
    renderWheelBoard(items, {
      kind:'custom',
      customWheelId:saved.id,
      title:`自定義 · ${saved.name}`,
      description:'你自己出的題，這次命運只負責抽。',
      onFinish:chosen => renderCustomWheelResult(chosen,saved),
      backAction:() => renderTemplatePicker('wheel'),
      changeAction:() => renderTemplatePicker('wheel'),
      changeLabel:'← 返回輪盤列表',
      weighted:false
    });
  }

  function renderCustomWheelResult(chosen, saved) {
    clearAsync();
    app.innerHTML = `<div class="shell">
      ${topbar(true)}
      <section class="panel result-card custom-result">
        <div class="result-emoji">🎯</div>
        <div class="result-label">${escapeHtml(saved.name)} 的結果</div>
        <div class="result-name">${escapeHtml(chosen.name)}</div>
        <div class="speech">你自己做的輪盤，這次真的不能怪系統。</div>
        <div class="actions"><button class="primary" id="customAgain">再轉一次</button><button class="secondary" id="customBack">返回輪盤列表</button></div>
      </section>
    </div>`;
    attachBack(() => renderTemplatePicker('wheel'));
    playWinSound();
    celebrate();
    document.querySelector('#customAgain').addEventListener('click', () => startCustomWheel(saved.id));
    document.querySelector('#customBack').addEventListener('click', () => renderTemplatePicker('wheel'));
  }
  function ratingWeight(dish) {
    const ds = dishStat(dish.id);
    const r = ds.ratings;
    const total = r.love + r.ok + r.meh + r.no;
    let weight = total ? ((r.love * 1.6 + r.ok * 1.18 + r.meh * .92 + r.no * .38) / total) : 1;
    const recent = stats.history.slice(0, 2).some(h => h.dishId === dish.id);
    if (recent) weight *= .55;
    return Math.max(.28, weight);
  }

  function weightedChoice(items) {
    const weighted = items.map(item => ({item, w:ratingWeight(item)}));
    const total = weighted.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total;
    for (const x of weighted) {
      r -= x.w;
      if (r <= 0) return x.item;
    }
    return weighted[weighted.length - 1].item;
  }

  function spinWheel() {
    const buttons = [...document.querySelectorAll('[data-spin]')];
    if (!buttons.length || buttons.some(b => b.disabled) || !wheelItems.length) return;
    buttons.forEach(b => {
      b.disabled = true;
      if (b.classList.contains('wheel-spin')) b.textContent = '命運正在亂來…';
    });

    playWheelStartSound();
    playSpinTicks();
    const meta = wheelContext || {};
    const chosen = meta.weighted === false ? randomOf(wheelItems) : weightedChoice(wheelItems);
    const idx = wheelItems.findIndex(d => d.id === chosen.id);
    const slice = 360 / wheelItems.length;
    const center = idx * slice + slice / 2;
    const rotation = 360 * 6 + (360 - center);
    const wheel = document.querySelector('#wheel');

    requestAnimationFrame(() => {
      wheel.classList.add('wheel-spinning');
      wheel.style.transform = `rotate(${rotation}deg)`;
    });

    later(() => {
      const hit = document.querySelector(`[data-wheel-index="${idx}"] .wheel-label-inner`);
      if (hit) hit.classList.add('wheel-hit');
      playWheelHitSound();
    }, 1550);

    later(() => {
      if (typeof meta.onFinish === 'function') {
        meta.onFinish(chosen);
        return;
      }
      renderResult(chosen, 'wheel', `宇宙已經決定了：${chosen.name}。不接受申訴。`);
    }, 1950);
  }

  function renderHellIntro() {
    clearAsync();
    app.innerHTML = `<div class="shell">
      ${topbar(true)}
      <section class="panel hell-intro">
        <div class="warning">⚠️</div>
        <div class="hell-title">地獄直覺快答</div>
        <p class="hint">這次不是填問卷。每題只有 3 秒，超時我就替你選。</p>
        <div class="rules"><div class="rule">① 只有一次機會</div><div class="rule">② 不能返回修改</div><div class="rule">③ 抽到什麼就吃什麼</div></div>
        <button class="danger" id="acceptHell" style="width:100%">我接受命運 🔥</button>
      </section>
    </div>`;
    attachBack(renderHome);
    document.querySelector('#acceptHell').addEventListener('click', startHell);
  }

  function startHell() {
    hell = {questions:sample(HELL_QUESTIONS, 3), index:0, answers:[]};
    renderHellQuestion();
  }

  function renderHellQuestion() {
    clearAsync();
    const q = hell.questions[hell.index];
    app.innerHTML = `<div class="shell">
      ${topbar(true)}
      <section class="panel">
        <div class="progress-row"><span>地獄直覺快答</span><span>${hell.index + 1} / 3</span></div>
        <div class="question">${q.q}</div>
        <p class="hint">第一直覺。不要分析。</p>
        <div class="timer-wrap"><div class="timer-bar" id="timerBar"></div></div>
        <div class="hell-options">${q.options.map((o, i) => `<button class="hell-option" data-option="${i}"><span class="e">${o.emoji}</span><span class="t">${o.label}</span></button>`).join('')}</div>
        <div class="speech" id="speech">3 秒。你的胃沒有那麼多會議要開。</div>
      </section>
    </div>`;
    attachBack(renderHome);
    playTone(560,.065,'triangle',.03);
    playTone(760,.08,'sine',.024,.035);
    playHellCountdown();
    let remaining = 3000;
    const bar = document.querySelector('#timerBar');
    const timer = every(() => {
      remaining -= 100;
      bar.style.width = `${Math.max(0, remaining / 30)}%`;
      if (remaining <= 0) {
        stopHandle(timer);
        answerHell(randomOf(q.options), true);
      }
    }, 100);
    document.querySelectorAll('[data-option]').forEach(btn => btn.addEventListener('click', () => {
      stopHandle(timer);
      answerHell(q.options[Number(btn.dataset.option)], false);
    }, {once:true}));
  }

  function answerHell(option, auto) {
    if (auto) playHellTimeoutSound();
    else playHellAnswerSound();
    document.querySelectorAll('[data-option]').forEach(b => b.disabled = true);
    hell.answers.push(option.prefs || {});
    if (auto) showToast('猶豫超時，地獄替你按了。');
    hell.index += 1;
    later(() => {
      if (hell.index < hell.questions.length) renderHellQuestion();
      else finishHell();
    }, 260);
  }

  function hellPreferenceScore(dish, prefs) {
    let score = 0;
    const matchBonus = {flavor:4.5, spice:3.5, carb:3.5, temp:2.8, price:2.4, meal:2.4};
    const mismatchPenalty = {flavor:4.8, spice:3.8, carb:3.2, temp:2.8, price:2.0, meal:1.8};

    Object.entries(prefs).forEach(([key, wanted]) => {
      if (!wanted || wanted === 'any') return;
      if (dish[key] === wanted) {
        score += matchBonus[key] || 2.5;
        return;
      }

      let penalty = mismatchPenalty[key] || 1.5;
      if (key === 'flavor' && wanted === 'light' && dish.flavor === 'rich') penalty = 6;
      if (key === 'spice' && wanted === 'none' && dish.spice === 'hot') penalty = 6;
      if (key === 'spice' && wanted === 'hot' && dish.spice !== 'hot') penalty = 4.5;
      if (key === 'price' && wanted === 'low' && dish.price === 'high') penalty = 4;
      if (key === 'meal' && wanted === 'simple' && dish.meal === 'feast') penalty = 3;
      score -= penalty;
    });
    return score;
  }

  function hellCandidatePool() {
    let pool = [...MAIN_OPTIONS];
    const answers = hell.answers || [];
    const wantsLight = answers.some(p => p.flavor === 'light');
    const wantedCarb = answers.map(p => p.carb).find(Boolean);

    if (wantsLight) {
      const lightPool = pool.filter(d =>
        d.flavor === 'light' ||
        (Array.isArray(d.tags) && d.tags.includes('healthy'))
      );
      if (lightPool.length >= 8) pool = lightPool;
    }

    if (wantedCarb) {
      const carbPool = pool.filter(d => d.carb === wantedCarb);
      if (carbPool.length >= 6) pool = carbPool;
    }

    return pool;
  }

  function finishHell() {
    clearAsync();
    const candidates = hellCandidatePool();
    const scored = candidates.map(dish => {
      let score = Math.random() * .2;
      hell.answers.forEach(prefs => {
        score += hellPreferenceScore(dish, prefs);
      });

      const ds = dishStat(dish.id);
      score += Math.min(.7, ds.ratings.love * .16 + ds.ratings.ok * .07);
      score -= Math.min(.6, ds.ratings.no * .14);
      return {dish, score};
    }).sort((a, b) => b.score - a.score);

    const top = scored.slice(0, Math.min(5, scored.length));
    const pickPool = top.slice(0, Math.min(3, top.length));
    const weights = [0.58, 0.29, 0.13];
    let roll = Math.random();
    let chosen = pickPool[0]?.dish || candidates[0] || DISHES[0];

    for (let i = 0; i < pickPool.length; i += 1) {
      roll -= weights[i] || 0;
      if (roll <= 0) {
        chosen = pickPool[i].dish;
        break;
      }
    }

    renderResult(chosen, 'hell', `你自己按的。地獄把答案算成了 ${chosen.name}。現在不要怪我。`);
  }

  function googleMapsSearchUrl(dish) {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('附近 ' + dish.name);
  }

  function renderResult(dish, mode, copy, meta = {}) {
    clearAsync();
    const isCustom = mode === 'custom-wheel';
    const safeName = escapeHtml(dish.name);
    const safeCopy = escapeHtml(copy);
    const detailItems = (meta.allowDetail || mode === 'wheel') ? detailItemsFor(dish) : [];
    const modeTitle = mode === 'tournament'
      ? '三問淘汰賽'
      : mode === 'wheel-detail'
        ? '細項輪盤'
        : mode === 'custom-wheel'
          ? '自定義輪盤'
          : mode === 'wheel'
            ? '命運大輪盤'
            : '地獄直覺快答';

    const nearbyHtml = isCustom ? '' : `<div class="nearby-box">
      <div class="nearby-title">📍 附近哪裡吃 ${safeName}？</div>
      <p>直接交給 Google 地圖找附近店家。</p>
      <a class="maps-direct-btn" href="${googleMapsSearchUrl(dish)}" target="_blank" rel="noopener">在 Google 地圖搜尋附近 ${safeName} →</a>
    </div>`;

    const actionsHtml = isCustom
      ? `<div class="actions">
          <button class="primary" id="customSpinAgain">再轉一次 🎡</button>
          <button class="secondary" id="customDone">完成，回首頁</button>
        </div>`
      : `<div class="actions">
          <button class="primary" id="acceptResult">${mode === 'hell' ? '我接受審判' : '認命，就吃這個'}</button>
          ${detailItems.length >= 2 ? `<button class="secondary detail-wheel-btn" id="detailWheelBtn">再轉「${safeName}」細項 🎡</button>` : ''}
          ${mode === 'hell' ? '' : '<button class="secondary" id="regretBtn">我想反悔</button>'}
        </div>
        ${mode === 'hell' ? '<button class="tiny-regret" id="regretBtn">你連地獄模式都想反悔？</button>' : ''}`;

    app.innerHTML = `<div class="shell">
      ${topbar(true)}
      <section class="panel result-card">
        <div class="result-emoji">${dish.emoji || '🎯'}</div>
        <div class="result-label">${modeTitle} 的判決</div>
        <div class="result-name">${safeName}</div>
        <div class="result-copy">${safeCopy}</div>
        <div class="speech">${isCustom ? '你自己做的輪盤，命運只是負責按下去。' : mode === 'wheel' && detailItems.length >= 2 ? '大方向決定了。想更精準，可以再轉一次細項。' : mode === 'hell' ? '你自己按的，現在不要怪我。' : '好了，晚餐有答案了。問題只剩你敢不敢承認。'}</div>
        ${nearbyHtml}
        ${actionsHtml}
      </section>
    </div>`;
    attachBack(renderHome);
    playWinSound();
    celebrate();

    if (isCustom) {
      const context = {...(wheelContext || {})};
      const items = [...wheelItems];
      document.querySelector('#customSpinAgain').addEventListener('click', () => renderWheelBoard(items, context));
      document.querySelector('#customDone').addEventListener('click', renderHome);
      return;
    }

    document.querySelector('#acceptResult').addEventListener('click', () => renderRating(dish, mode));
    const detailBtn = document.querySelector('#detailWheelBtn');
    if (detailBtn) detailBtn.addEventListener('click', () => startDetailWheel(dish));
    const regretBtn = document.querySelector('#regretBtn');
    if (regretBtn) regretBtn.addEventListener('click', () => handleRegret(dish, mode));
  }

  function handleRegret(dish, mode) {
    recordRegret();
    const quip = randomOf(REGRET_LINES);
    const hardStop = mode === 'hell' || sessionRegrets >= 2;
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="regretModal">
      <div class="modal">
        <h3>${quip}</h3>
        <p>${hardStop && mode !== 'hell' ? '你已經反悔兩次了。這輪不准再洗答案。' : mode === 'hell' ? '地獄模式沒有直接重抽。你可以回首頁重新做人。' : '可以再玩，但我有在記次數。'}</p>
        <div class="actions">
          <button class="secondary" id="modalAccept">算了，吃它</button>
          <button class="primary" id="modalRetry">${hardStop ? '回首頁' : '再玩一次'}</button>
        </div>
      </div>
    </div>`);
    document.querySelector('#modalAccept').addEventListener('click', () => {
      document.querySelector('#regretModal').remove();
      renderRating(dish, mode);
    });
    document.querySelector('#modalRetry').addEventListener('click', () => {
      document.querySelector('#regretModal').remove();
      if (hardStop) renderHome(); else restartMode(mode);
    });
  }

  function restartMode(mode) {
    if (mode === 'tournament') renderTemplatePicker('tournament');
    if (mode === 'wheel' || mode === 'wheel-detail') renderTemplatePicker('wheel');
    if (mode === 'hell') renderHome();
  }

  function renderRating(dish, mode) {
    clearAsync();
    app.innerHTML = `<div class="shell">
      ${topbar(true)}
      <section class="panel result-card">
        <div class="result-emoji" style="font-size:68px">${dish.emoji}</div>
        <div class="question" style="margin-top:18px">今天這個決定怎麼樣？</div>
        <p class="hint">這會留在你的瀏覽器，下次輪盤會稍微記得你的胃。</p>
        <div class="rating-grid">
          <button class="rating-btn love" data-rating="love">❤️ 超想吃</button>
          <button class="rating-btn ok" data-rating="ok">🙂 可以</button>
          <button class="rating-btn meh" data-rating="meh">😐 普通</button>
          <button class="rating-btn no" data-rating="no">💀 下次不要</button>
        </div>
      </section>
    </div>`;
    attachBack(renderHome);
    document.querySelectorAll('[data-rating]').forEach(btn => btn.addEventListener('click', () => {
      const rating = btn.dataset.rating;
      recordResult(dish, mode, rating);
      renderSaved(dish, rating);
    }, {once:true}));
  }

  function renderSaved(dish, rating) {
    const line = rating === 'love' ? `好，${dish.name} 已經被你的胃蓋章。` :
      rating === 'no' ? `收到。${dish.name} 進入觀察名單，但不會被永久封殺。` :
      `記住了。你的胃口黑歷史 +1。`;
    app.innerHTML = `<div class="shell">
      ${topbar(true)}
      <section class="success">
        <div class="big">✅</div><h2>已記住</h2><p class="muted">${line}</p>
        <div class="actions"><button class="primary" id="againBtn">再玩一局</button><button class="secondary" id="seeStatsBtn">看看我的胃</button></div>
      </section>
    </div>`;
    attachBack(renderHome);
    document.querySelector('#againBtn').addEventListener('click', renderHome);
    document.querySelector('#seeStatsBtn').addEventListener('click', renderStomach);
  }

  function statsDishUniverse() {
    const map = new Map();
    MAIN_OPTIONS.forEach(d => map.set(d.id, d));
    DISHES.forEach(d => {
      if (stats.dishes[d.id]) map.set(d.id, d);
    });
    return [...map.values()];
  }
  function favoriteDish() {
    let best = null;
    statsDishUniverse().forEach(d => {
      const s = dishStat(d.id);
      const r = s.ratings;
      const score = r.love * 4 + r.ok * 1.5 + s.selected * .3 - r.no * 2;
      if (!best || score > best.score) best = {dish:d, score};
    });
    return best && best.score > 0 ? best.dish : null;
  }

  function preferenceRanking(limit = 10) {
    const PRIOR_MEAN = 2.7;
    const PRIOR_WEIGHT = 4;
    return statsDishUniverse().map(dish => {
      const ds = dishStat(dish.id);
      const r = ds.ratings;
      const votes = r.love + r.ok + r.meh + r.no;
      if (votes <= 0) return null;
      const points = r.love * 5 + r.ok * 3.5 + r.meh * 2 + r.no * 0;
      const bayes = (points + PRIOR_MEAN * PRIOR_WEIGHT) / (votes + PRIOR_WEIGHT);
      const loveRate = r.love / votes;
      const noRate = r.no / votes;
      const eliminationPenalty = Math.min(0.45, ds.eliminated * 0.035);
      const score = Math.max(0, Math.min(5, bayes + loveRate * 0.35 - noRate * 0.35 - eliminationPenalty));
      return {dish, score, votes, selected:ds.selected, eliminated:ds.eliminated, ratings:r};
    }).filter(Boolean)
      .sort((a,b) => b.score - a.score || b.votes - a.votes || b.ratings.love - a.ratings.love || a.eliminated - b.eliminated)
      .slice(0, limit);
  }

  function rankingConfidence(votes) {
    if (votes >= 8) return '很懂你';
    if (votes >= 4) return '逐漸穩定';
    if (votes >= 2) return '開始有感';
    return '資料還少';
  }

  function mostEliminated() {
    let best = null;
    statsDishUniverse().forEach(d => {
      const n = dishStat(d.id).eliminated;
      if (!best || n > best.count) best = {dish:d, count:n};
    });
    return best && best.count > 0 ? best : null;
  }

  function stomachRoast(fav, eliminated) {
    if (stats.plays <= 0) return '目前還沒有黑歷史，先去玩一局。';
    const counts = {};
    stats.history.forEach(h => counts[h.dishId] = (counts[h.dishId] || 0) + 1);
    const top = Object.entries(counts).sort((a,b) => b[1] - a[1])[0];
    if (top && stats.plays >= 3) {
      const dish = getDish(top[0]);
      const pct = Math.round(top[1] / stats.plays * 100);
      if (pct >= 25) return `看起來你的人生有 ${pct}% 是${dish.name}。這已經不是巧合了。`;
    }
    if (eliminated && eliminated.count >= 2) return `你嘴上說什麼都吃，但${eliminated.dish.name}已經被你淘汰 ${eliminated.count} 次。`;
    if (fav) return `目前${fav.name}最得寵。你的胃已經默默站隊了。`;
    return '資料還不夠多。你的胃目前仍在裝神秘。';
  }

  function renderStomach() {
    clearAsync();
    const fav = favoriteDish();
    const eliminated = mostEliminated();
    const empty = stats.plays === 0 && !eliminated;
    const ranking = preferenceRanking(10);
    app.innerHTML = `<div class="shell">
      ${topbar(true)}
      <section class="panel">
        <div class="question">我的胃</div>
        <p class="hint">全部只存在這台裝置的瀏覽器裡。重新整理也不會消失。</p>
        ${empty ? `<div class="empty"><div class="e">🍽️</div><p>目前還沒有黑歷史，先去玩一局。</p><button class="primary" id="playNow">去玩</button></div>` : `
          <div class="stats-grid">
            <div class="stat"><div class="stat-value">🎮 ${stats.plays}</div><div class="stat-label">已完成遊戲</div></div>
            <div class="stat"><div class="stat-value">🤡 ${stats.regrets}</div><div class="stat-label">反悔次數</div></div>
            <div class="stat"><div class="stat-value">${fav ? fav.emoji + ' ' + fav.name : '—'}</div><div class="stat-label">目前最愛</div></div>
            <div class="stat"><div class="stat-value">${eliminated ? eliminated.dish.emoji + ' ' + eliminated.dish.name : '—'}</div><div class="stat-label">最常淘汰</div></div>
          </div>
          <div class="roast">${stomachRoast(fav, eliminated)}</div>
          <section class="preference-section">
            <div class="preference-head">
              <div><b>🏆 我的喜好排行榜</b><small>玩越多次，排名會越準。</small></div>
              <span>TOP 10</span>
            </div>
            ${ranking.length ? `<div class="preference-list">
              ${ranking.map((item, index) => `<div class="preference-row ${index < 3 ? `top-${index+1}` : ``}">
                <div class="rank-num">${index + 1}</div>
                <div class="rank-food"><span class="rank-emoji">${item.dish.emoji}</span><span><b>${item.dish.name}</b><small>${rankingConfidence(item.votes)} · 評價 ${item.votes} 次</small></span></div>
                <div class="rank-score"><b>${item.score.toFixed(1)}</b><small>/ 5</small></div>
                <div class="rank-detail">❤️ ${item.ratings.love}　🙂 ${item.ratings.ok}　😐 ${item.ratings.meh}　💀 ${item.ratings.no}<br><span>淘汰 ${item.eliminated} 次</span></div>
              </div>`).join(``)}
            </div>` : `<div class="preference-empty">先替幾道料理評分，排行榜才有東西可以吵架。</div>`}
          </section>
          <div class="actions"><button class="primary" id="playNow">再玩一局</button></div>`}
      </section>
    </div>`;
    attachBack(renderHome);
    document.querySelector('#playNow').addEventListener('click', renderHome);
  }

  renderHome();
})();
