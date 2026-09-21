(() => {
  const app = document.querySelector('#app');
  if (!app) return;

  const ASSETS = {
    home:'./assets/mascot-home.webp',
    judge:'./assets/mascot-judge.webp'
  };

  let currentStage = null;
  let currentAvatar = null;
  let reactionTimer = null;
  let lastPageSignature = '';

  const prefersReduced = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function makeStage(kind, title, copy, asset='home') {
    const el = document.createElement('div');
    el.className = 'pengu-stage ' + kind;
    el.dataset.kind = kind;
    el.innerHTML =
      '<div class="pengu-rig">' +
        '<div class="pengu-ground"></div>' +
        '<img class="pengu-avatar" src="' + ASSETS[asset] + '" alt="Open Pengu 企鵝吉祥物">' +
      '</div>' +
      '<div class="pengu-accent" aria-hidden="true"></div>' +
      '<div class="pengu-bubble"><b>' + title + '</b><span>' + copy + '</span></div>';
    return el;
  }

  function setCurrent(stage) {
    currentStage = stage || null;
    currentAvatar = stage?.querySelector('.pengu-avatar') || null;
    if (stage && !prefersReduced()) {
      currentAvatar?.animate(
        [
          {opacity:0, transform:'translateY(7px) scale(.985)'},
          {opacity:1, transform:'translateY(0) scale(1)'}
        ],
        {duration:360, easing:'cubic-bezier(.2,.8,.2,1)', fill:'none'}
      );
    }
  }

  function setBubble(title, copy) {
    if (!currentStage) return;
    const b = currentStage.querySelector('.pengu-bubble b');
    const s = currentStage.querySelector('.pengu-bubble span');
    if (b && title) b.textContent = title;
    if (s && copy) {
      s.animate(
        [{opacity:.25, transform:'translateY(2px)'},{opacity:1, transform:'translateY(0)'}],
        {duration:220, easing:'ease-out'}
      );
      s.textContent = copy;
    }
  }

  function react(name, direction = 0) {
    if (!currentAvatar || prefersReduced()) return;

    clearTimeout(reactionTimer);
    currentStage?.setAttribute('data-reacting','true');

    const sign = direction < 0 ? -1 : direction > 0 ? 1 : 0;
    let frames;
    let duration = 520;
    let easing = 'cubic-bezier(.2,.8,.2,1)';

    if (name === 'choice') {
      frames = [
        {transform:'translateX(0) translateY(0) rotate(0deg) scale(1)'},
        {transform:`translateX(${sign*5}px) translateY(-1px) rotate(${sign*2.2}deg) scale(1.012)`, offset:.42},
        {transform:'translateX(0) translateY(0) rotate(0deg) scale(1)'}
      ];
    } else if (name === 'spin') {
      duration = 1650;
      easing = 'cubic-bezier(.45,0,.25,1)';
      frames = [
        {transform:'translateY(0) rotate(0deg) scale(1)'},
        {transform:'translateY(1px) rotate(-1.2deg) scale(.995)', offset:.14},
        {transform:'translateY(-2px) rotate(1.8deg) scale(1.012)', offset:.35},
        {transform:'translateY(-1px) rotate(-1.5deg) scale(1.01)', offset:.58},
        {transform:'translateY(-2px) rotate(.8deg) scale(1.015)', offset:.78},
        {transform:'translateY(0) rotate(0deg) scale(1)'}
      ];
    } else if (name === 'hit') {
      duration = 620;
      frames = [
        {transform:'translateY(0) scale(1) rotate(0deg)'},
        {transform:'translateY(-6px) scale(1.045) rotate(-1deg)', offset:.34},
        {transform:'translateY(1px) scale(.995) rotate(.5deg)', offset:.7},
        {transform:'translateY(0) scale(1) rotate(0deg)'}
      ];
    } else if (name === 'regret') {
      duration = 650;
      easing = 'cubic-bezier(.36,.07,.19,.97)';
      frames = [
        {transform:'translateX(0) rotate(0deg)'},
        {transform:'translateX(-3px) rotate(-2deg)', offset:.24},
        {transform:'translateX(3px) rotate(2deg)', offset:.48},
        {transform:'translateX(-1.5px) rotate(-1deg)', offset:.7},
        {transform:'translateX(0) rotate(0deg)'}
      ];
    } else if (name === 'focus') {
      duration = 420;
      frames = [
        {transform:'translateY(0) scale(1)'},
        {transform:'translateY(-2px) scale(1.018)', offset:.55},
        {transform:'translateY(0) scale(1)'}
      ];
    } else {
      frames = [
        {transform:'translateY(0) scale(1)'},
        {transform:'translateY(-2px) scale(1.015)'},
        {transform:'translateY(0) scale(1)'}
      ];
    }

    currentAvatar.animate(frames,{duration,easing,fill:'none'});
    reactionTimer = setTimeout(() => currentStage?.removeAttribute('data-reacting'), duration + 40);
  }

  function decorate() {
    if (app.querySelector('.pengu-stage')) {
      setCurrent(app.querySelector('.pengu-stage'));
      return;
    }

    const hero = app.querySelector('.hero');
    if (hero) {
      const stage = makeStage('home','Open Pengu 幫你決定','你負責按，我負責把晚餐逼出來。','home');
      const kicker = hero.querySelector('.kicker');
      if (kicker) kicker.after(stage); else hero.prepend(stage);
      setCurrent(stage);
      return;
    }

    const result = app.querySelector('.result-card');
    if (result) {
      const name = result.querySelector('.result-name')?.textContent?.trim() || '這個';
      const stage = makeStage('result','企鵝判決：' + name,'停在這裡，就是這一餐。','home');
      const copy = result.querySelector('.result-copy');
      if (copy) copy.after(stage); else result.prepend(stage);
      setCurrent(stage);
      setTimeout(() => react('hit'), 120);
      return;
    }

    const wheel = app.querySelector('.wheel-panel');
    if (wheel) {
      const detail = (wheel.textContent || '').includes('細項');
      const stage = makeStage('wheel',
        detail ? '再細一點，我來收尾' : '命運交給企鵝',
        detail ? '大方向決定了，再轉一次就收工。' : '先看候選，再按下去。',
        'judge'
      );
      const candidates = wheel.querySelector('.wheel-candidates');
      if (candidates) candidates.after(stage); else wheel.prepend(stage);
      setCurrent(stage);
      return;
    }

    const panel = app.querySelector('.panel');
    if (!panel) return;
    const text = panel.textContent || '';

    if (text.includes('我的胃')) {
      const stage = makeStage('stomach','企鵝正在研究你的胃','你玩越多次，偏好就越藏不住。','home');
      const hint = panel.querySelector('.hint');
      if (hint) hint.after(stage); else panel.prepend(stage);
      setCurrent(stage);
      return;
    }

    if (text.includes('地獄')) {
      const stage = makeStage('hell','地獄企鵝不等人','三秒內回答；你不選，我就替你選。','judge');
      const hint = panel.querySelector('.hint');
      if (hint) hint.after(stage); else panel.prepend(stage);
      setCurrent(stage);
      return;
    }

    if (text.includes('三問淘汰賽') || text.includes('最後一輪')) {
      const stage = makeStage('tournament','企鵝裁判上線','照直覺按。這局規則不一定跟上一局一樣。','judge');
      const hint = panel.querySelector('.hint');
      if (hint) hint.after(stage); else panel.prepend(stage);
      setCurrent(stage);
      return;
    }

    const grid = panel.querySelector('.template-grid');
    if (grid) {
      const stage = makeStage('home','先選今天想玩的方向','真的沒想法就隨機；有方向就直接挑。','home');
      grid.before(stage);
      setCurrent(stage);
    }
  }

  function pageSignature() {
    const h = app.querySelector('.question')?.textContent?.trim() || '';
    const r = app.querySelector('.result-name')?.textContent?.trim() || '';
    return h + '|' + r + '|' + !!app.querySelector('.wheel-panel');
  }

  const observer = new MutationObserver(mutations => {
    requestAnimationFrame(() => {
      const sig = pageSignature();
      if (sig !== lastPageSignature) {
        lastPageSignature = sig;
        currentStage = null;
        currentAvatar = null;
      }
      decorate();

      for (const m of mutations) {
        if (m.type === 'attributes' && m.target.classList?.contains('wheel-hit')) {
          setBubble('停。就是這個。','先看結果，再決定要不要細分。');
          react('hit');
        }
      }
    });
  });
  observer.observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});

  document.addEventListener('pointerdown', e => {
    const card = e.target.closest('.food-card,[data-final-select],[data-option]');
    if (!card || !currentStage) return;
    const rect = card.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const dir = cx < innerWidth / 2 ? -1 : 1;
    setBubble(null,'看到了。你的手比你嘴巴快。');
    react('choice',dir);
  }, true);

  document.addEventListener('click', e => {
    if (!currentStage) return;

    if (e.target.closest('[data-spin]')) {
      setBubble('好，交給我。','轉動中先不要反悔。');
      react('spin');
      return;
    }

    if (e.target.closest('#regretBtn,.tiny-regret')) {
      setBubble('你又反悔？','我開始懷疑問題不是晚餐。');
      react('regret');
      return;
    }

    if (e.target.closest('[data-mode],[data-template],#acceptHell')) {
      react('focus');
    }
  }, true);

  decorate();
})();