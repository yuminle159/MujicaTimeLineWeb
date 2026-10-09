from pathlib import Path

path = Path('songs/style.css')
text = path.read_text(encoding='utf-8')
start = text.index('/* ===== 专辑分隔带 ===== */')
end = text.index('/* ===== 意图感应式返回顶部 ===== */', start)
css = '''/* ===== 年份收藏区 ===== */
.album-section { padding:0 60px; margin-bottom:52px; }
.album-divider { display:flex; align-items:center; gap:20px; padding:16px 0 20px; margin-bottom:22px; }
.album-divider::after { content:""; height:1px; flex:1; background:linear-gradient(90deg,#453332,#252020 70%,transparent); }
.album-divider .album-name { margin:0; color:#aaa09a; font:500 clamp(36px,4.4vw,58px)/1 "Space Grotesk",sans-serif; letter-spacing:-2px; }
.album-year { display:grid; gap:3px; border-left:2px solid #853c3c; padding-left:14px; }
.album-year>span { color:#786e6b; font:9px/1.4 "Space Grotesk",sans-serif; letter-spacing:1.8px; }
.album-year strong { font-size:11px; font-weight:400; color:#b9aaa1; }

/* ===== 唱片收藏架 ===== */
.cover-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(var(--cover-size),1fr)); gap:28px var(--cover-gap); align-items:start; }
.cover-card { --record-accent:#bda574; position:relative; display:block; width:100%; min-width:0; margin:0; padding:0; border:0; border-radius:3px; background:transparent; color:inherit; font:inherit; text-align:left; cursor:pointer; -webkit-tap-highlight-color:transparent; transition:transform .3s var(--md-easing-emphasized); }
.cover-card.type-cover { --record-accent:#839fba; }
.cover-card.type-other { --record-accent:#99918b; }
.cover-card:focus-visible { outline:2px solid #df8d83; outline-offset:7px; }
.record-sleeve { position:relative; display:block; padding:0 8px 8px 0; isolation:isolate; }
.record-back { position:absolute; z-index:-1; inset:5px 0 0 5px; border:1px solid #45403b; border-radius:2px; background:repeating-linear-gradient(90deg,#24201e 0 2px,#2c2724 2px 3px); box-shadow:2px 4px 9px #0005; transition:transform .35s var(--md-easing-emphasized),border-color .3s; }
.record-back::after { content:""; position:absolute; inset:8px 4px 8px auto; width:1px; background:#645647; opacity:.5; }
.record-face { position:relative; display:block; aspect-ratio:1; overflow:hidden; padding:5px; border:1px solid #44382b; border-color:color-mix(in srgb,var(--record-accent) 38%,#242020); border-radius:2px; background:linear-gradient(135deg,#302a26,#171514); box-shadow:0 5px 14px #0008,inset 0 0 0 1px #ffffff05; transition:transform .35s var(--md-easing-emphasized),box-shadow .3s,border-color .3s; }
.record-face img { display:block; width:100%; height:100%; object-fit:contain; background:#111; }
.song-caption { display:block; padding:10px 8px 0 1px; }
.song-card-meta { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:7px; }
.song-kind { display:flex; align-items:center; gap:6px; color:var(--record-accent); font-size:9px; letter-spacing:1px; }
.song-kind::before { content:""; width:14px; height:1px; background:currentColor; }
.song-open-arrow { color:#857773; font:16px/1 "Space Grotesk",sans-serif; opacity:.35; transition:transform .3s,color .3s,opacity .3s; }
.cover-song-name { display:-webkit-box; min-height:2.9em; overflow:hidden; -webkit-line-clamp:2; -webkit-box-orient:vertical; color:#e0d8d2; font:500 clamp(13px,1.15vw,16px)/1.45 "Cinzel","Noto Serif JP","Noto Sans SC",serif; overflow-wrap:anywhere; }
.cover-song-name-cn { display:-webkit-box; min-height:1.7em; margin-top:4px; overflow:hidden; -webkit-line-clamp:1; -webkit-box-orient:vertical; color:#9c928d; font-size:11px; line-height:1.7; }
.song-release-date { display:block; margin-top:9px; color:#81756e; font:10px/1.5 "Space Grotesk",sans-serif; letter-spacing:.7px; }
.cover-new-badge,.cover-countdown-badge { position:absolute; top:11px; left:11px; max-width:calc(100% - 22px); padding:5px 7px; border:1px solid #c7695b; border-radius:2px; background:#571f1bea; color:#ffddd4; font:600 9px/1.4 "Space Grotesk","Noto Sans SC",sans-serif; letter-spacing:.6px; box-shadow:0 2px 8px #0005; }
.cover-countdown-badge { border-color:#bd975b; background:#302515ed; color:#f6d69d; letter-spacing:0; }
.cover-card.is-upcoming .record-back { border-color:#775f3d; }
.cover-card.is-upcoming .song-release-date { color:#c2a374; }
.cover-placeholder { position:absolute; inset:5px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; overflow:hidden; background:radial-gradient(ellipse at 50% 35%,#3a282b55,transparent 65%),#151315; }
.cover-placeholder::before,.cover-placeholder::after { content:""; position:absolute; width:55%; aspect-ratio:1; border:1px solid #55453b; transform:rotate(45deg); opacity:.45; }
.cover-placeholder::after { width:37%; border-color:#824a42; }
.cover-placeholder i { z-index:1; width:5px; height:5px; background:#b18263; transform:rotate(45deg); }
.cover-placeholder strong { z-index:1; max-width:75%; color:#b7aaa0; font:500 12px/1.5 "Cinzel","Noto Sans SC",serif; text-align:center; overflow-wrap:anywhere; }
.cover-placeholder small { z-index:1; color:#978478; font-size:9px; letter-spacing:1px; }
.cover-card:focus-visible .record-face { border-color:#bf635b; box-shadow:0 7px 20px #0009,0 0 18px #ba3a2a15; }
.cover-card:focus-visible .song-open-arrow { opacity:1; color:#df8d83; }
@media (hover:hover) and (pointer:fine) {
  .cover-card:hover { transform:translateY(-5px); }
  .cover-card:hover .record-face { transform:translate(-3px,-2px); border-color:#bf635b; box-shadow:0 10px 24px #0009,0 0 18px #ba3a2a18; }
  .cover-card:hover .record-back { transform:translate(3px,1px); border-color:#66504a; }
  .cover-card:hover .song-open-arrow { opacity:1; color:#df8d83; transform:translate(2px,-2px); }
}
.cover-card:active .record-face { transform:translateY(1px); }
@media (max-width:480px) {
  .album-divider { gap:12px; margin-bottom:16px; }
  .album-divider .album-name { font-size:38px; }
  .album-year { padding-left:10px; }
  .album-year>span { font-size:8px; letter-spacing:1px; }
  .cover-grid { row-gap:24px; }
  .record-face { padding:4px; }
  .song-caption { padding-top:8px; }
  .cover-song-name { font-size:13px; }
  .cover-song-name-cn { font-size:10px; }
  .cover-countdown-badge { font-size:8px; padding:4px 6px; }
}
@media (prefers-reduced-motion:reduce) {
  .cover-card,.record-face,.record-back,.song-open-arrow { transition:none; }
  .cover-card:hover,.cover-card:hover .record-face,.cover-card:hover .record-back,.cover-card:hover .song-open-arrow { transform:none; }
}

'''
path.write_text(text[:start]+css+text[end:],encoding='utf-8')
page=Path('songs/index.html')
html=page.read_text(encoding='utf-8')
import re
for asset in ['style.css','page.js']:
    html=re.sub(r'((?:href|src)="'+re.escape(asset)+r')\?v=[^"]+',r'\1?v=20261009-record-shelf',html)
page.write_text(html,encoding='utf-8')
print('Updated collection CSS and asset versions.')
