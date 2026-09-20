(() => {
  'use strict';

  const DISHES = window.WTE_DISHES || [];
  const REGRET_LINES = window.WTE_REGRET_LINES || [];
  const HELL_QUESTIONS = window.WTE_HELL_QUESTIONS || [];
  const TEMPLATES = window.WTE_TEMPLATES || {};
  const STORAGE_KEY = 'what-to-eat-v01';
  const app = document.querySelector('#app');
  const toastEl = document.querySelector('#toast');
  const asyncHandles = new Set();

  let sessionRegrets = 0;
  let tournament = null;
  let hell = null;
  let wheelItems = [];
  let toastTimer = null;

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
    return DISHES.find(d => d.id === id);
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
      ${backAction ? `<button class="icon-btn" id="backBtn" aria-label="回首頁">← 回去</button>` : `<button class="text-btn" id="stomachBtn">我的胃</button>`}
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
        <p class="subtitle">不要再問「都可以」了。你只要負責按，我負責把晚餐推到你面前。</p>
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
    const pool = Array.isArray(template.ids) ? template.ids.map(getDish).filter(Boolean) : DISHES;
    return {template, pool: pool.length ? pool : DISHES};
  }

  function renderTemplatePicker(mode) {
    clearAsync();
    const entries = Object.entries(TEMPLATES);
    const title = mode === 'tournament' ? '三問淘汰賽' : '命運大輪盤';
    const copy = mode === 'tournament' ? '先縮小今天的範圍，再開始三組獨立對決。' : '先決定今天是哪一種局，再交給命運。';
    app.innerHTML = `<div class="shell">
      ${topbar(true)}
      <section class="panel">
        <div class="progress-row"><span>${title}</span><span>先選一種局</span></div>
        <div class="question">今天想從哪一類開始？</div>
        <p class="hint">${copy}</p>
        <div class="template-grid">
          ${entries.map(([id,t]) => `<button class="template-card" data-template="${id}"><span class="template-emoji">${t.emoji || '🍽️'}</span><span><b>${t.label}</b><small>${t.description || ''}</small></span></button>`).join('')}
        </div>
      </section>
    </div>`;
    attachBack(renderHome);
    document.querySelectorAll('[data-template]').forEach(btn => btn.addEventListener('click', () => {
      if (mode === 'tournament') startTournament(btn.dataset.template);
      else startWheel(btn.dataset.template);
    }));
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
    const {template, pool} = templatePool(templateId);
    const source = pool.length >= 6 ? pool : DISHES;
    const six = sample(source, 6);
    tournament = {
      templateId,
      templateLabel:template.label || '全部隨機',
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

  function renderTournamentTwist() {
    clearAsync();
    tournament.fate = randomOf(tournament.survivors);
    tournament.decoys = tournament.survivors.filter(d => d.id !== tournament.fate.id);
    app.innerHTML = `<div class="shell">
      ${topbar(true)}
      <section class="panel">
        <div class="progress-row"><span>最後一輪</span><div class="progress-dots">${[1,2,3,4].map(() => `<i class="dot on"></i>`).join('')}</div></div>
        <div class="question">剩下三個。<br>但我先偷走一個。</div>
        <p class="hint">系統會保送一個候選。剩下兩個讓你再刪一個——但這輪有詐。</p>
        <div class="final-three" id="finalThree">
          ${tournament.survivors.map(d => `<div class="mini-food" data-mini="${d.id}"><span><span class="emoji">${d.emoji}</span><br>${d.name}</span></div>`).join('')}
        </div>
        <div class="twist-banner" id="twistBanner">命運正在偷偷動手腳…</div>
        <div class="duel" id="decoyDuel" style="opacity:.25;pointer-events:none">${foodCard(tournament.decoys[0])}${foodCard(tournament.decoys[1])}</div>
        <div class="speech" id="speech">嘴巴說都可以，手倒是很誠實。</div>
      </section>
    </div>`;
    attachBack(renderHome);
    later(() => {
      const fateMini = document.querySelector(`[data-mini="${tournament.fate.id}"]`);
      fateMini.classList.add('fate','mystery');
      fateMini.innerHTML = '<span>🔒<br>命運保留席</span>';
      document.querySelector('#twistBanner').textContent = '好，一個被我藏起來了。現在這兩個，再刪一個。';
      const duel = document.querySelector('#decoyDuel');
      duel.style.opacity = '1';
      duel.style.pointerEvents = 'auto';
      duel.querySelectorAll('.food-card').forEach(card => card.addEventListener('click', () => {
        const rejected = tournament.decoys.find(d => d.id === card.dataset.dish);
        recordElimination(rejected.id);
        duel.querySelectorAll('.food-card').forEach(b => b.disabled = true);
        card.classList.add('decoy-hit');
        document.querySelector('#speech').textContent = `${rejected.name} 又被你刪了。很好——但剛剛被我藏起來的才是答案。`;
        later(() => renderResult(tournament.fate, 'tournament', `你最後那一下其實是煙霧彈。命運保留席裡的是——${tournament.fate.name}。`), 620);
      }));
    }, 760);
  }

  function startWheel(templateId = 'all') {
    clearAsync();
    const {template, pool} = templatePool(templateId);
    const desired = Number(template.wheelCount) || 8;
    const count = Math.max(6, Math.min(12, Math.min(desired, pool.length)));
    wheelItems = sample(pool, count);
    const slice = 360 / count;
    const palette = ['#f6ce62','#4b70d8','#7fc07d','#e65747','#f6b58e','#d980e7','#9da7ed','#8cccec','#fff1a6','#b4efb2','#f3a5a5','#f0d77a'];
    const stops = wheelItems.map((_,i) => `${palette[i % palette.length]} ${i*slice}deg ${(i+1)*slice}deg`).join(',');
    const background = `repeating-conic-gradient(from 0deg, rgba(21,21,21,.9) 0 1.2deg, transparent 1.2deg ${slice}deg), conic-gradient(from 0deg, ${stops})`;
    const labels = wheelItems.map((d, i) => {
      const angle = i * slice + slice / 2;
      const flip = angle > 90 && angle < 270 ? 180 : 0;
      return `<span class="wheel-label" data-wheel-index="${i}" style="transform:translate(-50%,-50%) rotate(${angle}deg) translateY(-122px)"><span class="wheel-label-inner" style="transform:rotate(${flip}deg)"><i>${d.emoji}</i><b>${d.name}</b></span></span>`;
    }).join('');
    app.innerHTML = `<div class="shell">
      ${topbar(true)}
      <section class="panel wheel-panel">
        <div class="progress-row"><span>命運大輪盤 · ${template.label || '全部隨機'}</span><span>${count} 選 1</span></div>
        <div class="question">不要想。轉就對了。</div>
        <p class="hint">${template.description || '今天的命運就交給這一圈。'}</p>
        <div class="wheel-wrap"><div class="pointer"><span></span></div><div class="wheel" id="wheel" style="background:${background}">${labels}</div><button class="wheel-hub" data-spin>轉！</button></div>
        <button class="primary wheel-spin" data-spin>開始轉 🎡</button>
        <button class="link-btn wheel-change" id="changeWheelTemplate">換一組料理模板</button>
        <div class="wheel-note">宇宙不負責售後服務。</div>
      </section>
    </div>`;
    attachBack(() => renderTemplatePicker('wheel'));
    document.querySelectorAll('[data-spin]').forEach(btn => btn.addEventListener('click', spinWheel));
    document.querySelector('#changeWheelTemplate').addEventListener('click', () => renderTemplatePicker('wheel'));
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
    if (!buttons.length || buttons.some(b => b.disabled)) return;
    buttons.forEach(b => { b.disabled = true; if (b.classList.contains('wheel-spin')) b.textContent = '命運正在亂來…'; });
    const chosen = weightedChoice(wheelItems);
    const idx = wheelItems.findIndex(d => d.id === chosen.id);
    const slice = 360 / wheelItems.length;
    const center = idx * slice + slice / 2;
    const rotation = 360 * 6 + (360 - center);
    const wheel = document.querySelector('#wheel');
    requestAnimationFrame(() => { wheel.style.transform = `rotate(${rotation}deg)`; });
    later(() => { const hit = document.querySelector(`[data-wheel-index="${idx}"] .wheel-label-inner`); if (hit) hit.classList.add('wheel-hit'); }, 1550);
    later(() => renderResult(chosen, 'wheel', `宇宙已經決定了：${chosen.name}。不接受申訴。`), 1950);
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
    document.querySelectorAll('[data-option]').forEach(b => b.disabled = true);
    hell.answers.push(option.prefs || {});
    if (auto) showToast('猶豫超時，地獄替你按了。');
    hell.index += 1;
    later(() => {
      if (hell.index < hell.questions.length) renderHellQuestion();
      else finishHell();
    }, 260);
  }

  function finishHell() {
    clearAsync();
    const scored = DISHES.map(dish => {
      let score = Math.random() * .35;
      hell.answers.forEach(prefs => {
        Object.entries(prefs).forEach(([k, v]) => {
          if (dish[k] === v) score += 2.5;
        });
      });
      const ds = dishStat(dish.id);
      score += Math.min(.8, ds.ratings.love * .18 + ds.ratings.ok * .08);
      score -= Math.min(.5, ds.ratings.no * .12);
      return {dish, score};
    }).sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 3);
    const roll = Math.random();
    const chosen = roll < .55 ? top[0].dish : roll < .83 ? top[1].dish : top[2].dish;
    renderResult(chosen, 'hell', `你自己按的。地獄把答案算成了 ${chosen.name}。現在不要怪我。`);
  }

  function googleMapsSearchUrl(dish) {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('附近 ' + dish.name);
  }

  function renderResult(dish, mode, copy) {
    clearAsync();
    const modeTitle = mode === 'tournament' ? '三問淘汰賽' : mode === 'wheel' ? '命運大輪盤' : '地獄直覺快答';
    app.innerHTML = `<div class="shell">
      ${topbar(true)}
      <section class="panel result-card">
        <div class="result-emoji">${dish.emoji}</div>
        <div class="result-label">${modeTitle} 的判決</div>
        <div class="result-name">${dish.name}</div>
        <div class="result-copy">${copy}</div>
        <div class="speech">${mode === 'hell' ? '你自己按的，現在不要怪我。' : '好了，晚餐有答案了。問題只剩你敢不敢承認。'}</div>
        <div class="nearby-box">
          <div class="nearby-title">📍 附近哪裡吃 ${dish.name}？</div>
          <p>直接交給 Google 地圖找附近店家。</p>
          <a class="maps-direct-btn" href="${googleMapsSearchUrl(dish)}" target="_blank" rel="noopener">在 Google 地圖搜尋附近 ${dish.name} →</a>
        </div>
        <div class="actions">
          <button class="primary" id="acceptResult">${mode === 'hell' ? '我接受審判' : '認命，就吃這個'}</button>
          ${mode === 'hell' ? '' : '<button class="secondary" id="regretBtn">我想反悔</button>'}
        </div>
        ${mode === 'hell' ? '<button class="tiny-regret" id="regretBtn">你連地獄模式都想反悔？</button>' : ''}
      </section>
    </div>`;
    attachBack(renderHome);
    document.querySelector('#acceptResult').addEventListener('click', () => renderRating(dish, mode));
    document.querySelector('#regretBtn').addEventListener('click', () => handleRegret(dish, mode));
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
    if (mode === 'wheel') renderTemplatePicker('wheel');
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

  function favoriteDish() {
    let best = null;
    DISHES.forEach(d => {
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
    return DISHES.map(dish => {
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
    DISHES.forEach(d => {
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
