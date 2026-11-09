from pathlib import Path
source=Path('timeline/index.html').read_text(encoding='utf-8')
source=source.replace('<script src="../js/page-memory.js', '<script data-disabled-src="../js/page-memory.js')
test=r'''<script>
window.addEventListener('error',e=>{document.documentElement.dataset.qaError=e.message});
window.addEventListener('load',async()=>{
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const output=document.createElement('pre');output.id='qa-result';document.body.append(output);
try{
 await sleep(200);
 assert(document.querySelector('#timelineFilters').hidden,'filters initially folded');
 const input=document.querySelector('#timelineSearchInput');
 assert(input.getBoundingClientRect().height>0,'search visible with folded filters');
 input.value='木鱼花';input.dispatchEvent(new Event('input',{bubbles:true}));
 const bubble=document.querySelector('.event-group:not(.hidden) .bubble');assert(bubble,'matching event');
 bubble.focus();bubble.click();await sleep(150);
 const overlay=document.querySelector('#tlModalOverlay');
 assert(overlay.classList.contains('open'),'modal opened');
 assert(document.querySelectorAll('.tl-search-hit').length>0,'search highlighted');
 const close=document.querySelector('#tlModalClose');
 assert(document.activeElement.id==='tlModalClose','modal receives focus: '+JSON.stringify({active:document.activeElement.tagName,visibility:getComputedStyle(close).visibility,display:getComputedStyle(close).display,inert:!!close.closest('[inert]'),parent:close.parentElement.parentElement.className,rect:close.getBoundingClientRect().toJSON()}));
 assert(document.querySelector('.timeline-page').inert,'background inert');
 assert(document.querySelector('.tl-share-link'),'share button exists');
 document.querySelector('.tl-share-link').click();await sleep(80);
 assert(document.querySelector('.tl-share-link').textContent!=='复制链接 ↗','copy feedback');
 const hash=location.hash;
 history.back();await sleep(300);
 assert(!overlay.classList.contains('open'),'browser back closes modal');
 assert(!document.querySelector('.timeline-page').inert,'background restored');
 assert(document.activeElement===bubble,'opener focus restored');
 history.forward();await sleep(300);
 assert(overlay.classList.contains('open')&&location.hash===hash,'forward restores event');
 document.querySelector('#tlModalClose').click();await sleep(300);
 assert(!overlay.classList.contains('open'),'close button unwinds history');
 input.value='天象馆';input.dispatchEvent(new Event('input',{bubbles:true}));
 document.querySelector('.event-group:not(.hidden) .bubble').click();await sleep(100);
 const media=document.querySelector('.tl-detail-media');
 const panel=document.querySelector('.tl-modal-container').getBoundingClientRect();
 assert(panel.width<=innerWidth && panel.left>=0,'dialog fits viewport');
 if(media) assert(getComputedStyle(media).position===(innerWidth>760?'sticky':'static'),'responsive media position');
 const visible=[...overlay.querySelectorAll('button:not(:disabled),a[href]')].filter(e=>e.getClientRects().length);
 visible.at(-1).focus();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true}));
 assert(document.activeElement===visible[0],'focus wraps inside dialog');
 output.textContent='PASS: visible search, highlight, history back/forward, close, focus, inert, share control';
}catch(e){output.textContent='FAIL: '+e.stack;}
});</script>'''
Path('timeline/.qa-browser-check.html').write_text(source.replace('</body>',test+'</body>'),encoding='utf-8')
