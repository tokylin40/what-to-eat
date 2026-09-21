(() => {
  const app = document.querySelector('#app');

  function card(kind, title, copy, small = false) {
    const el = document.createElement('div');
    el.className = 'brand-pengu ' + kind + (small ? ' small' : '');
    el.innerHTML = '<div class="pengu-copy"><b>' + title + '</b><span>' + copy + '</span></div>';
    return el;
  }

  function decorate() {
    if (!app || app.querySelector('.brand-pengu')) return;

    const hero = app.querySelector('.hero');
    if (hero) {
      const el = card('home', 'Open Pengu 幫你決定 🍽️', '又不知道吃什麼？你負責按，我負責把答案逼出來。');
      hero.prepend(el);
      return;
    }

    const result = app.querySelector('.result-card');
    if (result) {
      const name = result.querySelector('.result-name')?.textContent?.trim() || '這個';
      const el = card('result', '企鵝判決：' + name, '都轉到這裡了，就別再假裝你沒有答案。');
      result.insertBefore(el, result.firstChild);
      return;
    }

    const wheel = app.querySelector('.wheel-panel');
    if (wheel) {
      const detail = wheel.textContent.includes('細項');
      const el = card('wheel', detail ? '再細一點，企鵝幫你選' : '命運交給企鵝 🎡',
        detail ? '大方向有了，現在只差最後那一刀。' : '不要算機率。按下去，晚餐就有答案。', true);
      const hint = wheel.querySelector('.hint');
      (hint || wheel.firstChild).after(el);
      return;
    }

    const panel = app.querySelector('.panel');
    if (!panel) return;
    const text = panel.textContent || '';

    if (text.includes('我的胃')) {
      const el = card('stomach', '企鵝正在研究你的胃', '你玩得越多，我就越知道你嘴巴說都可以，其實根本很挑。', true);
      const hint = panel.querySelector('.hint');
      (hint || panel.firstChild).after(el);
      return;
    }

    if (text.includes('三問淘汰賽') || text.includes('最後一輪')) {
      const el = card('tournament', '企鵝裁判上線 🥊', '照直覺按。猶豫太久，只會證明你其實每個都想吃。', true);
      const hint = panel.querySelector('.hint');
      (hint || panel.firstChild).after(el);
      return;
    }

    if (text.includes('地獄')) {
      const el = card('tournament', '地獄企鵝不等人 🔥', '三秒內回答。你不選，我就替你選。', true);
      const hint = panel.querySelector('.hint');
      (hint || panel.firstChild).after(el);
      return;
    }

    if (panel.querySelector('.template-grid')) {
      const el = card('home', '先決定今天是哪一局', '真的沒想法就隨機；有方向就直接挑，不要跟自己的胃客氣。', true);
      const grid = panel.querySelector('.template-grid');
      grid.before(el);
    }
  }

  const observer = new MutationObserver(() => requestAnimationFrame(decorate));
  observer.observe(app, {childList:true, subtree:true});
  document.addEventListener('click', () => setTimeout(decorate, 60), true);
  decorate();
})();