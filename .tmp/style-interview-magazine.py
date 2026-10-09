from pathlib import Path
import re

path=Path('interview/style.css')
text=path.read_text(encoding='utf-8')
start=text.index('/* ===== Interview 卡片 ===== */')
end=text.index('/* ===== 响应式 ===== */',start)
cards='''/* ===== 杂志档案 ===== */
.interview-card { position:relative; display:block; min-width:0; color:inherit; text-decoration:none; cursor:pointer; -webkit-tap-highlight-color:transparent; transition:transform .3s var(--md-easing-emphasized); }
.interview-card:focus-visible { outline:2px solid #cb8c79; outline-offset:8px; border-radius:2px; }
.magazine-frame { position:relative; padding:0 7px 7px 0; isolation:isolate; }
.magazine-frame::before,.magazine-frame::after { content:""; position:absolute; z-index:-1; inset:5px 0 0 5px; border:1px solid #453b34; border-radius:2px; background:#24201c; transition:transform .35s var(--md-easing-emphasized),border-color .3s; }
.magazine-frame::before { inset:3px 3px 3px 3px; background:#312a23; }
.card-image { position:relative; display:flex; align-items:center; justify-content:center; width:100%; aspect-ratio:4/3; padding:7px; overflow:hidden; border:1px solid #4b3d31; border-radius:2px; background:radial-gradient(ellipse at 50% 35%,#2c242080,transparent 70%),#171412; box-shadow:0 5px 18px #0007; transition:transform .35s var(--md-easing-emphasized),border-color .3s,box-shadow .3s; }
.card-image img { display:block; width:100%; height:100%; object-fit:contain; }
.card-read { position:absolute; right:16px; bottom:16px; display:flex; align-items:center; gap:13px; padding:8px 12px; border:1px solid #b76b5670; border-radius:2px; background:#18120fe8; color:#ead6c5; font-size:11px; letter-spacing:1px; opacity:0; transform:translateY(5px); transition:opacity .25s,transform .25s; }
.card-read b { color:#cd7e69; font:16px/1 "Space Grotesk",sans-serif; }
.card-placeholder { display:grid; place-content:center; gap:8px; width:100%; height:100%; text-align:center; color:#9c8371; border:1px solid #ffffff05; background:repeating-linear-gradient(0deg,#ffffff02 0 1px,transparent 1px 4px); }
.card-placeholder span { font:20px "Cinzel",serif; letter-spacing:3px; }
.card-placeholder small { color:#897565; font-size:11px; letter-spacing:3px; }
.card-info { padding:17px 8px 0 1px; }
.card-meta { display:flex; align-items:center; justify-content:space-between; gap:12px; padding-bottom:10px; margin-bottom:11px; border-bottom:1px solid #382a246b; }
.card-date { color:#a28b79; font:11px/1.5 "Space Grotesk",monospace; letter-spacing:1px; }
.interview-status { display:inline-flex; align-items:center; gap:6px; color:#8e8580; font-size:10px; letter-spacing:1px; }
.interview-status::before { content:""; width:4px; height:4px; background:#756660; transform:rotate(45deg); }
.interview-status.is-translated { color:#bba689; }
.interview-status.is-translated::before { background:#b39266; }
.card-title { display:-webkit-box; min-height:3.2em; margin:0 0 9px; overflow:hidden; -webkit-line-clamp:2; -webkit-box-orient:vertical; color:#e4dacf; font:500 19px/1.6 "Noto Serif SC","Noto Serif JP","Songti SC",serif; overflow-wrap:anywhere; }
.card-interviewee { color:#9e938a; font-size:12px; line-height:1.8; overflow-wrap:anywhere; }
.interview-card:focus-visible .card-image { border-color:#b5705a; }
.interview-card:focus-visible .card-read { opacity:1; transform:none; }
@media (hover:hover) and (pointer:fine) {
  .interview-card:hover { transform:translateY(-4px); }
  .interview-card:hover .card-image { transform:translate(-2px,-2px); border-color:#b5705a; box-shadow:0 9px 22px #0008,0 0 20px #9c332115; }
  .interview-card:hover .magazine-frame::after { transform:translate(3px,2px); border-color:#705449; }
  .interview-card:hover .card-read { opacity:1; transform:none; }
}
@media (hover:none) { .card-read { opacity:1; transform:none; padding:6px 9px; font-size:10px; } }
@media (prefers-reduced-motion:reduce) {
  .interview-card,.card-image,.magazine-frame::before,.magazine-frame::after,.card-read { transition:none; }
  .interview-card:hover,.interview-card:hover .card-image,.interview-card:hover .magazine-frame::after { transform:none; }
}

'''
path.write_text(text[:start]+cards+text[end:],encoding='utf-8')
overlay=Path('css/interview-overlay.css')
text=overlay.read_text(encoding='utf-8')
text+='''
/* ===== 杂志阅读内页 ===== */
.shared-interview-overlay { --interview-primary:#be6653; --interview-on-surface:#ddd2c7; --interview-on-surface-variant:#aa9a8b; background:#14110f; }
.shared-interview-header { gap:28px; padding:22px 48px 18px; background:#191411; border-bottom-color:#5c3b282e; }
.shared-interview-date { color:#b3947a; font-size:10px; letter-spacing:1.5px; }
.shared-interview-title { color:#e9ded3; font:600 21px/1.55 "Noto Serif SC","Songti SC",serif; letter-spacing:.4px; overflow-wrap:anywhere; }
.shared-interview-interviewee { color:#a9998a; font-size:12px; }
.shared-interview-progress { flex:none; height:2px; background:#3a2b22; }
.shared-interview-progress>span { display:block; height:100%; background:linear-gradient(90deg,#9e483c,#c6a277); transform:scaleX(0); transform-origin:left; }
.shared-interview-body { padding-top:48px; padding-bottom:80px; scrollbar-color:#866149 transparent; }
.shared-interview-overlay .md-content { color:#d7ccc2; font-size:16px; line-height:2.2; }
.shared-interview-overlay .md-content h1 { margin-bottom:32px; padding-bottom:22px; border-bottom-color:#7c553137; color:#f0e4d7; font:600 30px/1.65 "Noto Serif SC","Noto Serif JP","Songti SC",serif; letter-spacing:.4px; }
.shared-interview-overlay .md-content h2 { margin-top:48px; margin-bottom:20px; padding-left:14px; border-left:2px solid #ab6650; color:#d5b89c; font:600 23px/1.7 "Noto Serif SC","Noto Serif JP",serif; letter-spacing:0; scroll-margin-top:24px; }
.shared-interview-overlay .md-content h3 { margin-top:30px; color:#d7bb9e; font:600 18px/1.8 "Noto Serif SC",serif; }
.shared-interview-overlay .md-content strong { color:#eee1d5; }
.shared-interview-overlay .md-content p.interview-question { padding-left:14px; border-left:2px solid #8c4b3f; color:#e3c5ac; font:600 17px/2 "Noto Serif SC","Songti SC",serif; }
.shared-interview-overlay .md-content p.interview-question strong { color:inherit; }
.shared-interview-overlay .md-content .manual-br { height:1.15em; }
.shared-interview-overlay .md-content img { max-width:100%; max-height:none; height:auto; margin:18px auto; padding:6px; border:1px solid #7554334d; border-radius:2px; background:#231b15; box-shadow:0 6px 24px #0004; }
.shared-interview-overlay .md-original { margin:16px 0; padding:14px 18px; border-top:0; border-left:1px solid #725e45; background:#ffffff03; color:#a5998c; font:400 13px/2.1 "Noto Serif JP","Noto Sans SC",serif; overflow-wrap:anywhere; }
.shared-interview-overlay .md-original strong { color:#b6a899; }
.shared-interview-overlay .md-original h1,.shared-interview-overlay .md-original h2,.shared-interview-overlay .md-original h3 { color:#b6a899; font-size:16px; }
.shared-interview-section-kicker { color:#aa937e; }
.shared-interview-section-link { color:#9f8c7b; padding-top:10px; padding-bottom:10px; }
.shared-interview-section-link span { color:#816b57; }
.shared-interview-section-link.active { color:#f0d9bf; background:#b4814b0b; }
.shared-interview-section-link.active::before { width:2px; background:#bd8a60; }
.shared-interview-section-link.active span { color:#bd8a60; }
.shared-interview-section-popover { background:#201913f7; border-color:#70553c4d; border-radius:3px; }
@media (max-width:750px) {
  .shared-interview-header { gap:10px; padding:18px 24px 12px; }
  .shared-interview-title { font-size:18px; }
  .shared-interview-body { padding-top:30px; padding-bottom:54px; }
  .shared-interview-overlay .md-content { font-size:15px; line-height:2.15; }
  .shared-interview-overlay .md-content h1 { font-size:24px; line-height:1.65; }
  .shared-interview-overlay .md-content h2 { font-size:20px; margin-top:36px; padding-left:10px; }
  .shared-interview-overlay .md-content p.interview-question { font-size:16px; padding-left:10px; }
  .shared-interview-overlay .md-original { padding:12px 14px; font-size:12px; }
}
@media (max-width:480px) { .shared-interview-header { padding:16px 16px 12px; } .shared-interview-title { font-size:17px; } }
@media (prefers-reduced-motion:reduce) { .shared-interview-overlay,.shared-interview-section-link { transition:none; } }
'''
overlay.write_text(text,encoding='utf-8')
# Update the shared reader version in all existing entry pages that load it.
for page in [Path('index.html'),*Path('.').glob('*/index.html')]:
    html=page.read_text(encoding='utf-8')
    updated=re.sub(r'((?:src|href)="(?:\.\./)?(?:js/interview-overlay\.js|css/interview-overlay\.css))\?v=[^"]+',r'\1?v=20261009-magazine',html)
    if page==Path('interview/index.html'):
        for asset in ['style.css','page.js']:
            updated=re.sub(r'((?:href|src)="'+re.escape(asset)+r')\?v=[^"]+',r'\1?v=20261009-magazine',updated)
        updated=updated.replace('Noto+Serif+SC:wght@500;600;700','Noto+Serif+SC:wght@400;500;600;700&family=Noto+Serif+JP:wght@400;500;600;700')
    if updated!=html: page.write_text(updated,encoding='utf-8')
print('Updated magazine cards, reader styles and cache versions.')
