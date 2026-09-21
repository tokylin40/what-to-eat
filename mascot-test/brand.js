(() => {
  const app = document.querySelector('#app');
  if (!app) return;

  const ASSETS = {
    home: './assets/mascot-home.webp',
    judge: './assets/mascot-judge.webp'
  };

  function makeStage(kind, title, copy, asset = 'home') {
    const el = document.createElement('div');
    el.className = 'pengu-stage pengu-' + kind;
    el.innerHTML =
      '<div class="pengu-rig">' +
        '<img class="pengu-avatar" src="' + ASSETS[asset] + '" alt="Open Pengu 企鵝吉祥物">' +
      '</div>' +
      '<div class="pengu-bubble"><b>' + title + '</b><span>' + copy + '</span></div>';
    return el;
  }

  function decorate() {
    if (app.querySelector('.pengu-stage')) return;

    const hero = app.querySelector('.hero');
    if (hero) {
      const stage = makeStage('home', 'Open Pengu 幫你決定', '你負責按，我負責把晚餐逼出來。', 'home');
      const kicker = hero.querySelector('.kicker');
      if (kicker) kicker.after(stage); else hero.prepend(stage);
      return;
    }

    const result = app.querySelector('.result-card');
    if (result) {
      const name = result.querySelector('.result-name')?.textContent?.trim() || '這個';
      const stage = makeStage('result', '企鵝判決：' + name, '都抽到這裡了，先別急著反悔。', 'home');
      const copy = result.querySelector('.result-copy');
      if (copy) copy.after(stage); else result.prepend(stage);
      return;
    }

    const wheel = app.querySelector('.wheel-panel');
    if (wheel) {
      const detail = (wheel.textContent || '').includes('細項');
      const stage = makeStage(
        'wheel',
        detail ? '再細一點，我來收尾' : '命運交給企鵝',
        detail ? '大方向決定了，再轉一次就收工。' : '先看候選，再按下去。',
        'judge'
      );
      const candidates = wheel.querySelector('.wheel-candidates');
      if (candidates) candidates.after(stage); else wheel.prepend(stage);
      return;
    }

    const panel = app.querySelector('.panel');
    if (!panel) return;
    const text = panel.textContent || '';

    if (text.includes('我的胃')) {
      const stage = makeStage('stomach', '企鵝正在研究你的胃', '玩越多次，偏好就越藏不住。', 'home');
      const hint = panel.querySelector('.hint');
      if (hint) hint.after(stage); else panel.prepend(stage);
      return;
    }

    if (text.includes('地獄')) {
      const stage = makeStage('hell', '地獄企鵝不等人', '三秒內回答；你不選，我就替你選。', 'judge');
      const hint = panel.querySelector('.hint');
      if (hint) hint.after(stage); else panel.prepend(stage);
      return;
    }

    if (text.includes('三問淘汰賽') || text.includes('最後一輪')) {
      const stage = makeStage('tournament', '企鵝裁判上線', '照直覺按。這局規則不一定跟上一局一樣。', 'judge');
      const hint = panel.querySelector('.hint');
      if (hint) hint.after(stage); else panel.prepend(stage);
      return;
    }

    const grid = panel.querySelector('.template-grid');
    if (grid) {
      const stage = makeStage('home', '先選今天想玩的方向', '真的沒想法就隨機；有方向就直接挑。', 'home');
      grid.before(stage);
    }
  }

  const observer = new MutationObserver(() => requestAnimationFrame(decorate));
  observer.observe(app, { childList: true, subtree: true });
  document.addEventListener('click', () => setTimeout(decorate, 50), true);
  decorate();
})();
