(() => {
'use strict';
const $=id=>document.getElementById(id);
const KEY='ravenswood_solo_v1', GUIDE_KEY='ravenswood_pages_guide_v1';
const steps=[
  {title:'Welcome, Storyteller',body:'This is your private host Grimoire. The public website only serves the app files; your game stays in this browser on this device. Keep this screen away from players.'},
  {title:'Prepare the circle',body:'Set your host PIN. Add players or import an Excel/CSV roster, then check every name, actual role, shown role, and clockwise seat. The Drunk receives the shown Townsfolk token.'},
  {title:'Distribute characters',body:'Tap Distribute characters and pass the phone around. Each player chooses only their own name, taps Reveal my character, then Hide and pass to next player. Viewed names leave the list. The host enters the PIN to return to the Grimoire.'},
  {title:'Finish setup',body:'Enter three distinct, out-of-play Demon bluffs. If a real Fortune Teller is in play, choose a good red herring. Use the setup checklist, then start the first night.'},
  {title:'Run each night',body:'Tonight’s wake order lists the characters in play. Record Poisoner, Imp, and gesture responses on your phone. Only character tokens use the private Reveal handoff. Record the final death yourself.'},
  {title:'Pass the phone safely',body:'Tap Show role or Show character token, then hand over the covered screen. The player reveals, reads, and hides it. Unlock with your PIN after the phone comes back. You can lock the whole Grimoire from the top bar.'},
  {title:'Keep the record',body:'Tap a roundtable seat or tag for its explanation. Mark executions, deaths, dead votes, and effects. Add freeform Storyteller notes for rulings. Download a JSON backup after setup and between sessions. The Resources section links to official rules and advice.'}
];
let index=0,returnFocus=null,initialLock=!!state().pin&&!localStorage.getItem('ravenswood_handoff_v1')&&!localStorage.getItem('ravenswood_distribution_v1');
function state(){try{return JSON.parse(localStorage.getItem(KEY))||{players:[],markers:{},phase:'setup',pin:''}}catch(_){return {players:[],markers:{},phase:'setup',pin:''}}}
function renderGuide(){const s=steps[index];$('guideProgress').textContent=`Step ${index+1} of ${steps.length}`;$('guideTitle').textContent=s.title;$('guideBody').textContent=s.body;$('guideBack').hidden=index===0;$('guideNext').textContent=index===steps.length-1?'Finish':'Next';$('guideNext').focus()}
function openGuide(){if(!$('hostScreenLock').hidden||!$('distribution').hidden)return;returnFocus=document.activeElement;index=0;$('firstUseGuide').hidden=false;renderGuide()}
function closeGuide(){localStorage.setItem(GUIDE_KEY,$('guideOptOut').checked?'done':'repeat');$('firstUseGuide').hidden=true;returnFocus?.focus?.()}
function lock(){const pin=state().pin;if(!pin){$('setupArea').scrollIntoView({behavior:'smooth'});$('pin').focus();alert('Set a host PIN in Setup before locking the Grimoire.');return} $('firstUseGuide').hidden=true;$('lockInput').value='';$('lockError').textContent='';$('hostScreenLock').hidden=false;$('lockInput').focus()}
function unlock(){if($('lockInput').value!==state().pin){$('lockError').textContent='Incorrect PIN';$('lockInput').select();return}$('lockInput').value='';$('lockError').textContent='';$('hostScreenLock').hidden=true;$('lockButton').focus();if(initialLock&&localStorage.getItem(GUIDE_KEY)!=='done')openGuide();initialLock=false}
function flow(g,players,bluffs,inPlay){
 const named=players.length>=5&&players.every(p=>p.name&&!/^Player \d+$/.test(p.name))&&new Set(players.map(p=>p.name.trim().toLowerCase())).size===players.length;
 const assigned=named&&players.every(p=>window.ClocktowerRules.TYPES[p.actualRole]&&(p.actualRole!=='Drunk'||window.ClocktowerRules.TYPES[p.shownRole]==='Townsfolk'))&&players.filter(p=>window.ClocktowerRules.TYPES[p.actualRole]==='Demon').length===1;
 const realFortune=players.some(p=>p.actualRole==='Fortune Teller');
 const ready=assigned&&/^\d{4,12}$/.test(g.pin||'')&&bluffs.length===3&&new Set(bluffs).size===3&&bluffs.every(x=>window.ClocktowerRules.TYPES[x]&&!inPlay.has(x))&&(!realFortune||!!g.markers?.redHerring);
 const seen=players.length>0&&players.every(p=>(g.shownHistory||[]).some(x=>x.playerId===p.id&&x.kind==='role'));
 const steps=[
  {title:'Players',done:named,detail:players.length<5?'Add at least five named players, or import an Excel/CSV roster.':'Check each name and clockwise seat.',target:'newName',action:'Add players'},
  {title:'Characters',done:assigned,detail:'Assign a real role to each player. A Drunk needs a shown Townsfolk role; include exactly one Demon.',target:'roster',action:'Review assignments'},
  {title:'Setup',done:ready,detail:'Save a host PIN, choose three out-of-play bluffs, and select a red herring if the Fortune Teller plays.',target:'setupArea',action:'Finish setup'},
  {title:'Reveal',done:seen,detail:'Pass the phone around. Each player selects their own name, reveals their token, hides it, and passes it on.',target:'distribute',action:'Distribute characters'},
  {title:'Play',done:g.phase!=='setup',detail:'When your players are ready, start the first night and follow the wake order.',target:'start',action:'Start first night'}
 ];
 const active=g.phase==='setup'?steps.findIndex(s=>!s.done):4;
 const current=steps[Math.max(0,active)];
 $('pagesFlow').replaceChildren(...steps.map((s,i)=>{const button=document.createElement('button');button.type='button';button.className='pages-flow-step '+(s.done?'complete':i===active?'active':'');button.textContent=`${s.done?'✓':i+1}  ${s.title}`;button.setAttribute('aria-label',`${s.title}: ${s.done?'complete':'pending'}`);button.onclick=()=>focusStep(s);return button}));
 $('pagesNextLabel').textContent=g.phase==='setup'?`Step ${Math.max(0,active)+1} of ${steps.length}`:'Game in progress';
 $('pagesNextTitle').textContent=g.phase==='setup'?current.title:g.phase==='ended'?'Game finished':'Run the game';
 $('pagesNextDetail').textContent=g.phase==='setup'?current.detail:g.phase==='ended'?'Review the roundtable and game log, then download a backup if you want to keep the record.':'Follow the wake order, record gestures and deaths, and check the roundtable and history as you play.';
 $('pagesNextAction').textContent=g.phase==='setup'?current.action:g.phase==='ended'?'Open roundtable':g.phase==='night'?'Open night order':'Open game controls';
 $('pagesNextAction').onclick=()=>g.phase==='setup'?focusStep(current):focusStep({target:g.phase==='ended'?'roundtableArea':g.phase==='night'?'nightArea':'game'});
}
function focusStep(s){const el=$(s.target);if(!el)return;el.scrollIntoView({behavior:'smooth',block:'center'});if(s.target==='distribute'||s.target==='start')el.click();else if(['newName','setup'].includes(s.target))el.focus?.()}
function checklist(){const g=state(),players=g.players||[],realFortune=players.some(p=>p.actualRole==='Fortune Teller');
 const currentBluffs=$('bluffs').value.split(',').map(s=>s.trim()).filter(Boolean),inPlay=new Set(players.flatMap(p=>[p.actualRole,p.shownRole].filter(Boolean)));
 const checks=[
  ['Host PIN saved',/^\d{4,12}$/.test(g.pin||'')],
  ['At least five players with real names',players.length>=5&&!players.some(p=>/^Player \d+$/.test(p.name))],
  ['Players have viewed their characters',players.length>0&&players.every(p=>(g.shownHistory||[]).some(x=>x.playerId===p.id&&x.kind==='role'))],
  ['Three out-of-play Demon bluffs',currentBluffs.length===3&&new Set(currentBluffs).size===3&&currentBluffs.every(x=>window.ClocktowerRules.TYPES[x]&&!inPlay.has(x))],
  ['Red herring selected if a real Fortune Teller plays',!realFortune||!!$('red').value]
 ];
 const list=$('pagesChecklist');list.replaceChildren();for(const [label,done] of checks){const li=document.createElement('li');li.textContent=label;if(done)li.className='complete';list.append(li)}
 $('pagesChecklistHeading').textContent=g.phase==='setup'?'Ready to start?':'Game in progress';
 $('pagesChecklistNote').textContent=g.phase==='setup'?'Finish these steps before Start first night. Check the seating order and roles yourself.':`Your game is on ${g.phase}${g.phase==='night'?` ${g.night}`:g.phase==='day'?` ${g.day}`:''}. Keep a backup; the browser holds the only copy.`;
 flow(g,players,currentBluffs,inPlay);
}
function safeRefresh(){setTimeout(checklist,0)}
$('openGuide').onclick=openGuide;$('guideSkip').onclick=closeGuide;$('guideBack').onclick=()=>{index=Math.max(0,index-1);renderGuide()};$('guideNext').onclick=()=>{if(index<steps.length-1){index++;renderGuide()}else closeGuide()};
$('lockButton').onclick=lock;$('lockSubmit').onclick=unlock;$('lockInput').onkeydown=e=>{if(e.key==='Enter')unlock()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('firstUseGuide').hidden)closeGuide()});
document.addEventListener('click',safeRefresh);document.addEventListener('change',safeRefresh);$('bluffs').addEventListener('input',safeRefresh);
checklist();$('guideOptOut').checked=true;
if(initialLock){$('hostScreenLock').hidden=false;$('lockInput').focus()}
else if(localStorage.getItem(GUIDE_KEY)!=='done'&&!localStorage.getItem('ravenswood_distribution_v1')&&!localStorage.getItem('ravenswood_handoff_v1'))openGuide();
document.documentElement.classList.remove('pages-pending');
})();
