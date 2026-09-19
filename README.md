# 你想吃什麼？ GitHub Prototype V0.2

一個手機優先、零後端、零 API 的吃飯決策遊戲。唯一目標：**玩完一次，還想再玩一次。**

## V0.2 重點

- **三問淘汰賽**：前三輪完全獨立，最後三個候選進入「命運保留席」反轉。
- **命運大輪盤**：10 格大型輪盤；Local Storage 評價會輕微影響權重，但低評價料理不會消失。
- **地獄直覺快答**：每次隨機抽 3 題，每題只有 3 秒；超時系統自動代答。
- **反悔限制**：一般模式單次 session 最多洗兩次，地獄模式不提供直接重抽。
- **我的胃**：完成次數、最愛、最常淘汰、反悔次數與動態吐槽。
- **Local Storage**：固定 key `what-to-eat-v01`，重新整理後保留。

## 本機試玩

不需要 npm。直接用任意靜態伺服器即可：

```bash
python -m http.server 8080
```

然後開啟 `http://localhost:8080`。

## GitHub Pages

此專案已附 `.github/workflows/pages.yml`。建立 GitHub repository 後，把整個資料夾 push 到 `main`，再到：

`Settings → Pages → Source → GitHub Actions`

之後每次 push 到 `main` 都會重新部署。

## 手機驗收

優先測試：

- 375 × 812
- 390 × 844
- 不應出現水平捲動
- 三種玩法都能完成並評價
- 重新整理後「我的胃」資料仍存在
