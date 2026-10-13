(() => {
'use strict';
const $=id=>document.getElementById(id), R=ClocktowerRules, I=ClocktowerImport;
const KEY='ravenswood_solo_v1', HAND='ravenswood_handoff_v1', DIST='ravenswood_distribution_v1';
const hosted=document.documentElement?.dataset?.soloHosted==='true';
const roles=Object.keys(R.TYPES), template=['Investigator','Baron','Monk','Recluse','Undertaker','Imp','Librarian','Poisoner','Drunk','Empath'];
const uid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;
const fresh=()=>({version:1,phase:'setup',night:0,day:0,players:[],markers:{poisoned:null,protected:null,redHerring:null,executedToday:null,nightDeaths:[]},bluffs:['Washerwoman','Virgin','Soldier'],nightRecords:[],shownHistory:[],log:[],pin:''});
let game,selectedSeatId=null,handoffState=null,revision=0,pendingWrites=0,writeQueue=Promise.resolve(),writeGeneration=0,activeRevealId=null;
try{game=hosted?fresh():JSON.parse(localStorage.getItem(KEY))||fresh()}catch(_){game=fresh()}
const readHandoff=()=>hosted?handoffState:JSON.parse(localStorage.getItem(HAND)||'null');
function storeHandoff(h){if(hosted)handoffState=h;else if(h)localStorage.setItem(HAND,JSON.stringify(h));else localStorage.removeItem(HAND)}
function syncLabel(message){if(hosted)$('syncStatus').textContent=message}
function applyHosted(remote){revision=remote.revision;game=remote.game||fresh();handoffState=remote.handoff||null;render();if(handoffState){const h=handoffState.stage==='open'&&activeRevealId!==handoffState.id?{...handoffState,stage:'lock'}:handoffState;showHandoff(h)}else $('handoff').hidden=true;syncLabel('Shared game · synced')}
function enqueueHosted(){
 const snapshot={revision:null,game:JSON.parse(JSON.stringify(game)),handoff:handoffState?JSON.parse(JSON.stringify(handoffState)):null},generation=writeGeneration;
 pendingWrites++;syncLabel('Shared game · saving…');
 writeQueue=writeQueue.then(async()=>{
  if(generation!==writeGeneration)return;
  for(;;){
   try{
    snapshot.revision=revision;
    const response=await fetch('/api/solo/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot)});
    const data=await response.json();
    if(response.status===409){writeGeneration++;applyHosted(data.state);notice('Another device changed the game. Your unsaved change was discarded; review the latest state.');return}
    if(response.status===401){$('connectionGate').hidden=false;syncLabel('Sign in again to save changes');await new Promise(resolve=>setTimeout(resolve,2000));continue}
    if(!response.ok)throw Error(data.error||'Save failed');
    revision=data.revision;syncLabel('Shared game · synced');return;
   }catch(_){syncLabel('Connection lost · changes waiting to save');await new Promise(resolve=>setTimeout(resolve,2000))}
  }
 }).finally(()=>{pendingWrites--});
}
function save(){if(hosted)enqueueHosted();else localStorage.setItem(KEY,JSON.stringify(game));render()}
async function loadHosted(){
 try{
  const response=await fetch('/api/solo/state',{cache:'no-store'});
  if(response.status===401){$('connectionGate').hidden=false;syncLabel('Enter host code');return}
  if(!response.ok)throw Error('Could not load the shared game');
  const remote=await response.json();if(!pendingWrites)applyHosted(remote);$('connectionGate').hidden=true;
 }catch(e){$('connectionGate').hidden=false;$('hostLoginError').textContent=e.message;syncLabel('Server unavailable')}
}
async function pollHosted(){if(pendingWrites||!$('connectionGate').hidden)return;try{const response=await fetch('/api/solo/state',{cache:'no-store'});if(response.status===401){$('connectionGate').hidden=false;syncLabel('Sign in again');return}if(!response.ok)throw Error('Disconnected');const remote=await response.json();if(!pendingWrites&&remote.revision!==revision)applyHosted(remote)}catch(_){syncLabel('Connection lost · retrying')}}
function event(action,detail){game.log.push({id:uid(),at:new Date().toISOString(),action,detail});save()}
function notice(s){$('notice').textContent=s;setTimeout(()=>$('notice').textContent='',4500)}
function fail(e){notice(e.message||String(e))}
function player(id){return game.players.find(x=>x.id===id)}
function selected(id,players=game.players,empty='None',value){const el=$(id),old=value??el.value;el.replaceChildren(new Option(empty,''),...players.map(p=>new Option(`${p.seat}. ${p.name}`,p.id)));el.value=old||'';return el}
function choose(id,items,selectedValue){const el=$(id);el.replaceChildren(...items.map(x=>new Option(x,x)));el.value=selectedValue||items[0]||'';return el}
function addRow(row){const name=String(row.name||'').trim(),role=row.actualRole;if(!name||!R.TYPES[role])throw Error('Each player needs a name and Trouble Brewing role');if(game.players.some(x=>x.name.toLowerCase()===name.toLowerCase()))throw Error(`Duplicate name: ${name}`);
 const team=row.alignment||(['Minion','Demon'].includes(R.TYPES[role])?'Evil':'Good');if(!['Good','Evil'].includes(team))throw Error('Team must be Good or Evil');
 game.players.push({id:uid(),seat:game.players.length+1,name,actualRole:role,shownRole:row.shownRole||(role==='Drunk'?'Investigator':''),alignment:team,alive:true,deadVote:true})}
const shortRole={'Washerwoman':'WW','Librarian':'LIB','Investigator':'INV','Fortune Teller':'FT','Ravenkeeper':'RK','Poisoner':'PZN','Empath':'EMP','Undertaker':'UT','Minion information':'MIN','Demon information':'DEM'};
const glyph={'Washerwoman':'✿','Librarian':'▤','Investigator':'⌕','Chef':'♨','Empath':'♥','Fortune Teller':'✧','Undertaker':'✝','Monk':'✛','Ravenkeeper':'❖','Virgin':'✾','Slayer':'⚔','Soldier':'♜','Mayor':'⚜','Butler':'♙','Drunk':'◌','Recluse':'☾','Saint':'✞','Poisoner':'☠','Spy':'◉','Scarlet Woman':'♦','Baron':'♛','Imp':'♠'};
function deliveryOf(record){return record.delivery||(['Poisoner','Imp'].includes(record.role)?'gesture':'previous')}
function targetExplanation(r,p){
 const actor=player(r.actorId)?.name||'Another player',when=`night ${r.night}`;
 if(r.role==='Poisoner')return `${actor}, the Poisoner, selected ${p.name} on ${when}. This is the poisoning choice for that night; check the POISONED marker for current status.`;
 if(r.role==='Imp')return `${actor}, the Imp, selected ${p.name} for an attack on ${when}. An attack target is not automatically a death; mark the outcome separately.`;
 if(r.role==='Monk')return `${actor}, the Monk, chose to protect ${p.name} on ${when} from the Demon. Check the PROTECTED marker for current status.`;
 if(['Washerwoman','Librarian','Investigator'].includes(r.role))return `${p.name} was one of the players included in ${actor}'s ${r.role} clue on ${when}. The character token in that clue identifies one of the selected players, not necessarily ${p.name}.`;
 if(r.role==='Fortune Teller')return `${actor}, the Fortune Teller, selected ${p.name} as one of two players on ${when}. The Yes/No answer belongs to the pair and does not identify which player caused it.`;
 return `${actor} selected ${p.name} for the ${r.role} action on ${when}. This is a historical selection, not a current status effect.`;
}
function actorExplanation(r,p){
 const when=`night ${r.night}`,targets=(r.targets||[]).map(id=>player(id)?.name||'a removed player').join(' and '),delivery=deliveryOf(r);
 if(delivery==='token')return `${p.name} received a ${r.role} character-token clue on ${when}.${r.tokens?.length?` Token shown: ${r.tokens.join(', ')}.`:''}${targets?` Players selected: ${targets}.`:''} This is a record of a token shown, not another role assigned to ${p.name}.`;
 if(delivery==='gesture')return `${p.name}'s ${r.role} step was recorded on ${when}.${targets?` Selected: ${targets}.`:''}${r.text?` Recorded answer or choice: ${r.text}.`:''} “GEST” means the result or choice was handled without a character token shown on the phone.`;
 return `${p.name}'s ${r.role} information step was recorded on ${when}.${r.text?` Record: ${r.text}.`:''} “INFO” is an older record with no delivery method saved; it does not mean a separate ability.`;
}
function seatTags(p){
 const tags=[];const push=(label,detail,style='')=>tags.push({label,detail,style});
 if(!p.alive)push('DEAD',`${p.name} is dead. This remains true until you change their status in the Grimoire.`,'dead-tag');
 if(p.actualRole==='Drunk')push('DRUNK',`${p.name} is actually the Drunk (${p.alive?'alive':'dead'}), but was shown ${p.shownRole||'a Townsfolk role'}. They have no ability; their apparent role is a Storyteller illusion.`,'danger');
 if(game.markers.redHerring===p.id)push('RED HERRING',`${p.name} is the Fortune Teller's fixed red herring. A sober Fortune Teller choosing ${p.name} gets a Yes even though ${p.name} is good. This does not affect other abilities.`,'danger');
 if(game.markers.poisoned===p.id)push('POISONED',`${p.name} is currently marked poisoned. Their ability does not work while poisoned; information given to them may be unreliable.`,'danger');
 if(game.markers.protected===p.id)push('PROTECTED',`${p.name} is currently protected from the Demon's attack by the Monk for this night.`);
 if(game.markers.executedToday===p.id)push('EXECUTED',`${p.name} was the most recently executed player. The Undertaker may learn their actual character during the following night.`,'dead-tag');
 if(!p.alive)push(p.deadVote?'VOTE READY':'VOTE USED',p.deadVote?`${p.name} is dead and still has one vote available. Spending it changes this tag to VOTE USED.`:`${p.name} has already spent their one dead vote.`,'dead-tag');
 for(const r of game.nightRecords||[]){if(r.skipped)continue;const code=shortRole[r.role]||r.role.toUpperCase().slice(0,4),night=`N${r.night}`;
   if(r.actorId===p.id)push(`${code} ${{gesture:'GEST',token:'TOKEN',previous:'INFO'}[deliveryOf(r)]} ${night}`,actorExplanation(r,p),'clue');
   if(r.targets?.includes(p.id))push(`${code} TARGET ${night}`,targetExplanation(r,p),'clue');
 }
 const extra=(game.shownHistory||[]).filter(x=>x.playerId===p.id&&x.kind==='token').length;
 if(extra)push(`TOKEN ×${extra}`,`${extra} additional character token${extra===1?' was':'s were'} shown to ${p.name} outside the automatic night steps. See Information and gesture history for the exact tokens.`,'clue');
 return tags;
}
function showTagHelp(p,t,scroll=false){const help=$('tagHelp');help.hidden=false;help.replaceChildren();const title=document.createElement('strong'),detail=document.createElement('p');title.textContent=`${p.name} · ${t.label}`;detail.textContent=t.detail;help.append(title,detail);if(scroll)help.scrollIntoView?.({behavior:'smooth',block:'nearest'})}
function roundtable(){
 const table=$('roundtable'),detail=$('seatDetail'),players=game.players,n=players.length;
 table.replaceChildren();table.classList.toggle('empty',!n);table.classList.toggle('crowded',n>10);
 $('aliveCount').textContent=n?`${players.filter(p=>p.alive).length}/${n} alive`:'0 players';
 if(!n){detail.textContent='Add players or import a roster to begin.';$('tagHelp').hidden=true;return}
 if(!player(selectedSeatId))selectedSeatId=players[0].id;
 for(let i=0;i<n;i++){
  const p=players[i],angle=-Math.PI/2+2*Math.PI*i/n,seat=document.createElement('button');seat.type='button';
  seat.className='round-seat'+(p.alignment==='Evil'?' evil':'')+(p.alive?'':' dead')+(selectedSeatId===p.id?' selected':'');
  seat.style.left=`${50+36*Math.cos(angle)}%`;seat.style.top=`${50+36*Math.sin(angle)}%`;
  const number=document.createElement('span');number.className='seat-number';number.textContent=p.seat;
  const token=document.createElement('span');token.className='token';token.textContent=glyph[p.actualRole]||'✦';
  const name=document.createElement('span');name.className='seat-name';name.textContent=p.name;
  const role=document.createElement('span');role.className='seat-role';role.textContent=p.actualRole;
  const tagBox=document.createElement('span');tagBox.className='round-tags';const tags=seatTags(p);
  for(const t of tags.slice(0,3)){const badge=document.createElement('span');badge.className='round-tag '+t.style;badge.textContent=t.label;badge.title=t.detail;badge.onmouseenter=()=>showTagHelp(p,t);badge.onclick=e=>{e.stopPropagation();selectedSeatId=p.id;roundtable();showTagHelp(p,t,true)};tagBox.append(badge)}
  if(tags.length>3){const more=document.createElement('span');more.className='round-tag';more.textContent=`+${tags.length-3}`;more.title=`${tags.length-3} more tags. Tap to see all of them below.`;more.onclick=e=>{e.stopPropagation();selectedSeatId=p.id;roundtable();showTagHelp(p,{label:'MORE TAGS',detail:`${tags.length-3} more tags are listed for ${p.name} in the seat details below. Tap any tag there for its full meaning.`},true)};tagBox.append(more)}
  seat.append(number,token,name,role,tagBox);seat.title=`Seat ${p.seat}: ${p.name} · ${p.actualRole}${tags.length?' · '+tags.map(t=>t.label).join(', '):''}`;
  seat.setAttribute('aria-label',seat.title);seat.onclick=()=>{selectedSeatId=p.id;roundtable();$('tagHelp').hidden=true};table.append(seat);
 }
 const p=player(selectedSeatId),tags=seatTags(p);detail.replaceChildren();
 const title=document.createElement('h3');title.textContent=`Seat ${p.seat} · ${p.name}`;const info=document.createElement('p');info.className='fine';info.textContent=`${p.actualRole}${p.shownRole?` · shown ${p.shownRole}`:''} · ${p.alignment} · ${p.alive?'Alive':'Dead'}`;detail.append(title,info);
 const tagBox=document.createElement('div');tagBox.className='marker-tags';for(const t of tags){const badge=document.createElement('button');badge.type='button';badge.className='marker-tag '+(t.style==='danger'?'red':t.style==='clue'?'blue':'');badge.setAttribute('data-tag-help','');badge.textContent=t.label;badge.title=t.detail;badge.onmouseenter=badge.onfocus=()=>showTagHelp(p,t);badge.onclick=()=>showTagHelp(p,t,true);tagBox.append(badge)}if(!tags.length)tagBox.textContent='No markers yet.';detail.append(tagBox);
 const records=(game.nightRecords||[]).filter(r=>r.actorId===p.id||r.targets?.includes(p.id)).slice().reverse();
 const shown=(game.shownHistory||[]).filter(x=>x.playerId===p.id).slice().reverse();
 const heading=document.createElement('h3');heading.textContent='Night selections and information';detail.append(heading);
 const list=document.createElement('div');list.className='compact-list';
 for(const r of records){const entry=document.createElement('div');entry.className='compact-item';const targets=r.targets?.map(id=>player(id)?.name||'?').join(', ')||'none';entry.textContent=`Night ${r.night} · ${r.role}${r.actorId===p.id?' (acting)':' (selected)'} · ${{gesture:'gesture / choice',token:'character token',previous:'earlier record'}[deliveryOf(r)]}\n${r.skipped?'Skipped':`Targets: ${targets}${r.text?` · Recorded: ${r.text}`:''}${r.tokens?.length?` · Token: ${r.tokens.join(', ')}`:''}`}`;list.append(entry)}
 for(const x of shown){const entry=document.createElement('div');entry.className='compact-item';entry.textContent=`${new Date(x.at).toLocaleString()} · Shown to ${p.name}\n${x.text}`;list.append(entry)}
 if(!records.length&&!shown.length){const empty=document.createElement('p');empty.className='fine';empty.textContent='No night selections or information shown yet.';list.append(empty)}detail.append(list);
}
function renderTokenGallery(){
 const grid=$('tokenGrid');grid.replaceChildren();const current=$('privateToken').value;
 for(const role of roles){const button=document.createElement('button');button.type='button';button.className='token-choice'+(['Minion','Demon'].includes(R.TYPES[role])?' evil':'')+(current===role?' selected':'');
  const emblem=document.createElement('span');emblem.className='mini-glyph';emblem.textContent=glyph[role];const caption=document.createElement('span');const title=document.createElement('strong');title.textContent=role;const type=document.createElement('small');type.textContent=R.TYPES[role];caption.append(title,type);button.append(emblem,caption);
  button.onclick=()=>{$('privateToken').value=role;renderTokenGallery()};grid.append(button)}
}
function editPlayer(p,box){
 if(box.querySelector?.('.player-edit'))return;
 const editor=document.createElement('div');editor.className='player-edit';
 const field=(title,control)=>{const label=document.createElement('label');label.textContent=title;label.append(control);editor.append(label);return control};
 const name=field('Player name',document.createElement('input'));name.value=p.name;
 const role=field('Actual role',document.createElement('select'));role.append(...roles.map(x=>new Option(x,x)));role.value=p.actualRole;
 const shown=field('Role shown to player (optional)',document.createElement('select'));shown.append(new Option('Same as actual role',''),...roles.map(x=>new Option(x,x)));shown.value=p.shownRole||'';
 const hint=document.createElement('p');hint.className='fine';hint.textContent='For the Drunk, select the Townsfolk token they believe they have. Seat and alignment update automatically.';editor.append(hint);
 const actions=document.createElement('div');actions.className='actions';
 const saveButton=document.createElement('button');saveButton.className='button small';saveButton.textContent='Save player';saveButton.onclick=()=>{const nextName=name.value.trim();if(!nextName||game.players.some(x=>x!==p&&x.name.toLowerCase()===nextName.toLowerCase()))return fail(Error('Use a unique player name'));if(role.value==='Drunk'&&R.TYPES[shown.value]!=='Townsfolk')return fail(Error('Choose a Townsfolk shown role for the Drunk'));p.name=nextName;p.actualRole=role.value;p.shownRole=shown.value;p.alignment=['Minion','Demon'].includes(R.TYPES[p.actualRole])?'Evil':'Good';if(!game.players.some(x=>x.actualRole==='Fortune Teller'))game.markers.redHerring=null;event('edit',p.name)};
 const cancel=document.createElement('button');cancel.className='button small ghost';cancel.textContent='Cancel';cancel.onclick=()=>editor.remove();actions.append(saveButton,cancel);editor.append(actions);box.append(editor);name.focus();
}
function roster(){const list=$('roster');list.replaceChildren();for(const p of game.players){const box=document.createElement('div');box.className='player-row';const head=document.createElement('div');head.className='row-head';const strong=document.createElement('strong');strong.textContent=`${p.seat}. ${p.name}`;const status=document.createElement('span');status.className='status'+(p.alive?'':' dead');status.textContent=p.alive?'Alive':'Dead';head.append(strong,status);box.append(head);
  const details=document.createElement('p');details.className='fine';details.textContent=`${p.actualRole}${p.shownRole?` → shown ${p.shownRole}`:''} · ${p.alignment}`;box.append(details);
  const tags=document.createElement('div');tags.className='marker-tags';for(const t of seatTags(p).filter(t=>['DRUNK','RED HERRING','POISONED','PROTECTED','DEAD','VOTE READY','VOTE USED'].includes(t.label))){const tag=document.createElement('button');tag.type='button';tag.className='marker-tag '+(t.style==='danger'?'red':'');tag.setAttribute('data-tag-help','');tag.textContent=t.label;tag.title=t.detail;tag.onmouseenter=tag.onfocus=()=>showTagHelp(p,t);tag.onclick=()=>{selectedSeatId=p.id;roundtable();showTagHelp(p,t,true)};tags.append(tag)}box.append(tags);
  const controls=document.createElement('div');controls.className='row-actions';function button(label,fn){const b=document.createElement('button');b.className='button small ghost';b.textContent=label;b.onclick=fn;controls.append(b)}
  if(game.phase==='setup'){
    button('Edit',()=>editPlayer(p,box));
    button('↑',()=>move(p,-1));button('↓',()=>move(p,1));button('Remove',()=>{if(confirm(`Remove ${p.name}?`)){game.players=game.players.filter(x=>x!==p);reseat();event('remove',p.name)}});
  }else if(game.phase!=='ended'){
    button('Show role',()=>handoff(p,'Your character',[R.displayRole(p)],{kind:'role'}));
    if(p.alive)button(game.phase==='day'?'Execute':'Mark night death',()=>{if(!confirm(`Mark ${p.name} dead by ${game.phase==='day'?'execution':'night'}?`))return;p.alive=false;if(game.phase==='day')game.markers.executedToday=p.id;else game.markers.nightDeaths.push(p.id);event('death',`${p.name}: ${game.phase==='day'?'execution':'night'}`)});
    else button(p.deadVote?'Spend dead vote':'Restore dead vote',()=>{p.deadVote=!p.deadVote;event('deadVote',`${p.name}: ${p.deadVote?'available':'used'}`)});
  }box.append(controls);list.append(box)} }
function reseat(){game.players.forEach((x,i)=>x.seat=i+1)}
function move(p,n){const i=game.players.indexOf(p),j=i+n;if(j<0||j>=game.players.length)return;[game.players[i],game.players[j]]=[game.players[j],game.players[i]];reseat();event('seat',`${p.name}: ${j+1}`)}
function handoff(p,title,tokens,meta){if(!game.pin)throw Error('Set a host PIN before handing over the phone');if(!tokens.length||tokens.some(x=>!R.TYPES[x]))throw Error('Choose valid character tokens');const pending={id:uid(),playerId:p.id,title,tokens,meta,at:new Date().toISOString(),stage:'closed'};storeHandoff(pending);showHandoff(pending);if(hosted)save()}
function showHandoff(h){$('handoff').hidden=false;$('handoffClosed').hidden=h.stage!=='closed';$('handoffOpen').hidden=h.stage!=='open';$('handoffLock').hidden=h.stage!=='lock';$('handoffTo').textContent=player(h.playerId)?.name||'Player';$('handoffTitle').textContent=h.title;const box=$('handoffTokens');box.replaceChildren();for(const role of h.tokens||[]){const card=document.createElement('div');card.className='character-token'+(['Minion','Demon'].includes(R.TYPES[role])?' evil':'');const symbol=document.createElement('span');symbol.className='glyph';symbol.textContent=glyph[role]||'✦';const label=document.createElement('span');label.className='title';label.textContent=role;const type=document.createElement('span');type.className='type';type.textContent=R.TYPES[role];card.append(symbol,label,type);box.append(card)}}
function reveal(){const h=readHandoff();if(!h||h.stage!=='closed')return;h.stage='open';activeRevealId=h.id;storeHandoff(h);const tokens=h.tokens||[];game.shownHistory.push({id:uid(),at:new Date().toISOString(),playerId:h.playerId,kind:h.meta.kind,tokens,text:`Character token${tokens.length===1?'':'s'}: ${tokens.join(', ')}`,night:game.night,day:game.day});if(h.meta.step){const step=h.meta.step;game.nightRecords.push({id:uid(),key:step.key,actorId:h.playerId,role:step.role,night:game.night,targets:step.targets,text:step.text,tokens,delivery:'token',skipped:false,at:new Date().toISOString()})}
 event('shown',`${player(h.playerId)?.name}: ${tokens.join(', ')} token${tokens.length===1?'':'s'}`);showHandoff(h)}
function finish(){const h=readHandoff();if(!h)return;h.stage='lock';activeRevealId=null;storeHandoff(h);showHandoff(h);if(hosted)save()}
function unlock(){if($('unlockPin').value!==game.pin){$('unlockError').textContent='Incorrect PIN';return}$('unlockPin').value='';$('unlockError').textContent='';activeRevealId=null;storeHandoff(null);$('handoff').hidden=true;if(hosted)save()}
function readDistribution(){try{return JSON.parse(localStorage.getItem(DIST)||'null')}catch(_){return null}}
function storeDistribution(d){if(d)localStorage.setItem(DIST,JSON.stringify(d));else localStorage.removeItem(DIST)}
function showDistribution(d){
 $('distribution').hidden=false;
 for(const [id,stage] of [['distributionList','list'],['distributionClosed','closed'],['distributionOpen','open'],['distributionLock','lock']])$(id).hidden=d.stage!==stage;
 if(d.stage!=='open')$('distributionToken').replaceChildren();
 $('distributionProgress').textContent=`${d.seen.length} of ${game.players.length} characters viewed`;
 if(d.stage==='lock')$('distributionLockMessage').textContent=d.resume?'The page reloaded. Enter the host PIN to continue distributing characters.':'Return the phone to the Storyteller to finish distribution.';
 if(d.stage==='list'){
  const choices=$('distributionChoices');choices.replaceChildren();
  for(const p of game.players.filter(x=>!d.seen.includes(x.id))){const b=document.createElement('button');b.type='button';b.className='button ghost';b.textContent=p.name;b.onclick=()=>{d.current=p.id;d.stage='closed';storeDistribution(d);showDistribution(d)};choices.append(b)}
  if(!choices.childNodes.length){const done=document.createElement('p');done.textContent='Everyone has viewed a character. Pass the phone back to the Storyteller.';choices.append(done)}
 }
 if(d.stage==='closed')$('distributionName').textContent=player(d.current)?.name||'Player';
 if(d.stage==='open'){
  const p=player(d.current),role=p&&R.displayRole(p),box=$('distributionToken');box.replaceChildren();
  if(role){const card=document.createElement('div');card.className='character-token'+(['Minion','Demon'].includes(R.TYPES[role])?' evil':'');const symbol=document.createElement('span');symbol.className='glyph';symbol.textContent=glyph[role]||'✦';const label=document.createElement('span');label.className='title';label.textContent=role;const type=document.createElement('span');type.className='type';type.textContent=R.TYPES[role];card.append(symbol,label,type);box.append(card)}
 }
}
function beginDistribution(){
 if(hosted)throw Error('Use the one-device edition for pass-the-phone distribution');
 if(!game.pin)throw Error('Save a host PIN first');
 if(!game.players.length||game.players.some(p=>/^Player \d+$/.test(p.name)))throw Error('Add the real player names before distributing characters');
 if(readHandoff())throw Error('Finish the current private handoff first');
 const d={stage:'list',seen:[],current:null};storeDistribution(d);showDistribution(d);
}
function revealDistributed(){const d=readDistribution(),p=player(d?.current);if(!d||d.stage!=='closed'||!p||d.seen.includes(p.id))return;
 const role=R.displayRole(p);d.stage='open';d.seen.push(p.id);storeDistribution(d);
 game.shownHistory.push({id:uid(),at:new Date().toISOString(),playerId:p.id,kind:'role',tokens:[role],text:`Character token: ${role}`,night:game.night,day:game.day});
 event('shown',`${p.name}: ${role} token (distribution)`);showDistribution(d);
}
function hideDistributed(){const d=readDistribution();if(!d||d.stage!=='open')return;d.stage='list';d.current=null;storeDistribution(d);showDistribution(d)}
function unlockDistribution(){const d=readDistribution();if(!d||d.stage!=='lock')return;if($('distributionPin').value!==game.pin){$('distributionError').textContent='Incorrect PIN';return}
 $('distributionPin').value='';$('distributionError').textContent='';if(d.resume){d.resume=false;d.stage='list';d.current=null;storeDistribution(d);showDistribution(d);return}storeDistribution(null);$('distribution').hidden=true;event('distribution',`${d.seen.length} of ${game.players.length} characters viewed`);
}
function nightInfo(step){const p=player(step.actorId),evil=game.players.filter(x=>x.alignment==='Evil'&&x.id!==p.id);
 if(step.role==='Minion information')return `Demon: ${game.players.find(x=>R.TYPES[x.actualRole]==='Demon')?.name||'Unknown'}\nOther Minions: ${evil.filter(x=>R.TYPES[x.actualRole]==='Minion').map(x=>x.name).join(', ')||'None'}`;
 if(step.role==='Demon information')return `Pointed out Minions: ${evil.filter(x=>R.TYPES[x.actualRole]==='Minion').map(x=>x.name).join(', ')||'None'}`;
 return ''}
function recordGesture(step,actor,targets,text){
 if(targets.some(x=>!player(x))||new Set(targets).size!==targets.length)throw Error('Select distinct targets');
 game.nightRecords.push({id:uid(),key:step.key,actorId:actor.id,role:step.role,night:game.night,targets,text,delivery:'gesture',skipped:false,at:new Date().toISOString()});
 if(step.role==='Poisoner')game.markers.poisoned=targets[0];
 if(step.role==='Monk')game.markers.protected=targets[0];
 event('nightStep',`${actor.name}: ${step.role} · ${text||targets.map(x=>player(x).name).join(', ')||'gesture recorded'}`);
}
function nightSteps(){
 const list=$('steps');list.replaceChildren();const steps=R.steps(game);
 if(!steps.length){list.textContent='No wake-ups for this night yet.';return}
 for(const s of steps){
  const p=player(s.actorId),box=document.createElement('div');box.className='night-step'+(s.resolved?' done':'');
  const heading=document.createElement('h3');heading.textContent=`${p.name} · ${s.role}${s.apparentDrunk?' (actually Drunk)':''}${s.resolved?' ✓':''}`;
  const help=document.createElement('p');help.className='fine';help.textContent=s.help;box.append(heading,help);
  if(s.resolved){const r=game.nightRecords.find(x=>x.key===s.key),done=document.createElement('p');done.textContent=r.skipped?'Skipped':`${{gesture:'Gesture recorded',token:'Token shown',previous:'Recorded'}[deliveryOf(r)]}: ${r.tokens?.join(', ')||r.text||r.targets?.map(x=>player(x)?.name).join(', ')||'done'}`;box.append(done);list.append(box);continue}
  const count=['one','one-role'].includes(s.kind)?1:['two','two-yesno'].includes(s.kind)?2:0,selects=[];
  for(let i=0;i<count;i++){const label=document.createElement('label');label.textContent=`Target ${i+1}`;const select=document.createElement('select');select.append(new Option('Choose a player',''),...game.players.map(x=>new Option(x.name,x.id)));label.append(select);box.append(label);selects.push(select)}
  const tokenStep=s.kind==='two'||s.kind==='one-role'||s.kind==='role'||s.role==='Demon information';
  const unreliable=game.markers.poisoned===p.id||s.apparentDrunk;
  let value=null,token=null;
  if(s.role==='Minion information'||s.role==='Demon information'){
   const note=document.createElement('p');note.className='fine';note.textContent=nightInfo(s)+(s.role==='Demon information'?' · Only bluff character tokens appear on the phone.':' · Point out these players by gesture.');box.append(note);
  }
  if(tokenStep&&s.role!=='Demon information'){
   const label=document.createElement('label');label.className='top-gap';label.textContent='Character token to show';
   token=document.createElement('select');token.append(new Option('Choose a character',''),...roles.map(x=>new Option(x,x)));label.append(token);box.append(label);
   const note=document.createElement('p');note.className=unreliable?'warning-note':'fine';box.append(note);
   const suggested=()=>{
    let role='';
    if(s.role==='Undertaker')role=player(game.markers.executedToday)?.actualRole||'';
    else if(s.role==='Ravenkeeper')role=player(selects[0].value)?.actualRole||'';
    else{const type={Washerwoman:'Townsfolk',Librarian:'Outsider',Investigator:'Minion'}[s.role];role=selects.map(x=>player(x.value)?.actualRole).find(x=>R.TYPES[x]===type)||''}
    note.textContent=role?`${unreliable?'POISONED / DRUNK · ':''}Sober token suggestion: ${role}. ${unreliable?'Choose a possibly false token.':'Check registration effects before showing.'}`:'Choose the target player(s) and character token to show.';
    if(role&&!unreliable)token.value=role;
   };
   selects.forEach(select=>select.onchange=suggested);suggested();
  }
  if(s.kind==='number'||s.kind==='two-yesno'){
   const label=document.createElement('label');label.className='top-gap';label.textContent=s.kind==='number'?'Number communicated by gesture':'Yes/No communicated by gesture';
   value=s.kind==='number'?document.createElement('input'):document.createElement('select');
   if(s.kind==='number'){value.type='number';value.min='0';value.step='1';value.placeholder='Enter the number you gestured'}
   else value.append(new Option('Choose Yes or No',''),new Option('Yes','Yes'),new Option('No','No'));
   label.append(value);box.append(label);
   const note=document.createElement('p');note.className=unreliable?'warning-note':'fine';box.append(note);
   const suggested=answer=>{note.textContent=unreliable?`POISONED / DRUNK · Sober result would be ${answer}. Record the unreliable answer you gesture.`:`Sober result: ${answer}. Check registrations and other effects.`;if(!unreliable)value.value=String(answer)};
   if(s.role==='Chef')suggested(R.chefCount(game.players));
   if(s.role==='Empath')suggested(R.empathCount(game.players,p.id)??'');
   if(s.role==='Fortune Teller'){note.textContent=unreliable?'POISONED / DRUNK · Choose two players, then record your unreliable yes/no gesture.':'Choose two players to see the sober answer.';selects.forEach(select=>select.onchange=()=>{if(selects.every(x=>x.value))suggested(R.fortuneAnswer(game,selects.map(x=>x.value))?'Yes':'No')})}
  }
  const actions=document.createElement('div');actions.className='actions';
  const done=document.createElement('button');done.className='button small';done.textContent=tokenStep?'Show character token'+(s.role==='Demon information'?'s':''):'Record gesture / choice';
  done.onclick=()=>{try{
    const targets=selects.map(x=>x.value);if(targets.some(x=>!player(x))||new Set(targets).size!==targets.length)throw Error('Select distinct targets');
    if(s.role==='Minion information'||s.role==='Demon information'){const allies=game.players.filter(x=>x.alignment==='Evil'&&x.id!==p.id);targets.push(...allies.filter(x=>s.role==='Minion information'||R.TYPES[x.actualRole]==='Minion').map(x=>x.id))}
    if(tokenStep){const tokens=s.role==='Demon information'?game.bluffs:[token.value];if(tokens.some(x=>!R.TYPES[x]))throw Error('Choose a character token');const text=s.role==='Demon information'?nightInfo(s):targets.length?`Selected: ${targets.map(id=>player(id).name).join(', ')}`:'Executed player character';
      handoff(p,s.role,tokens,{kind:'night-token',step:{key:s.key,role:s.role,targets,text}})}
    else{const text=s.role==='Minion information'?nightInfo(s):value?.value?.trim()||'';if((s.kind==='number'||s.kind==='two-yesno')&&!text)throw Error('Enter the answer you communicated by gesture');recordGesture(s,p,targets,text)}
   }catch(e){fail(e)}};
  const skip=document.createElement('button');skip.className='button small ghost';skip.textContent='Skip';
  skip.onclick=()=>{if(!confirm(`Skip ${p.name}'s ${s.role} step?`))return;game.nightRecords.push({id:uid(),key:s.key,actorId:p.id,role:s.role,night:game.night,targets:[],text:'',skipped:true,at:new Date().toISOString()});event('nightStep',`${p.name}: ${s.role} skipped`)};
  actions.append(done,skip);box.append(actions);list.append(box);
 }
}
function history(){const filter=$('historyPlayer').value,list=$('history');list.replaceChildren();const items=[...game.shownHistory.map(x=>({...x,source:'token'})),...game.nightRecords.filter(x=>deliveryOf(x)==='gesture').map(x=>({...x,playerId:x.actorId,source:'gesture'}))].filter(x=>!filter||x.playerId===filter).sort((a,b)=>b.at.localeCompare(a.at));for(const x of items){const item=document.createElement('div');item.className='compact-item';const targets=x.targets?.map(id=>player(id)?.name||'?').join(', ');item.textContent=`${new Date(x.at).toLocaleString()} · ${player(x.playerId)?.name||'Removed player'} · ${x.source==='gesture'?`Gesture / choice · ${x.role}: ${x.text||targets||'recorded'}${targets&&x.text?` · Targets: ${targets}`:''}`:x.text}`;list.append(item)}if(!list.childNodes.length)list.textContent='Nothing recorded yet.'}
function render(){ $('phase').textContent=game.phase==='ended'?`${game.winner} wins`:game.phase==='setup'?'Setup':`${game.phase} ${game.phase==='night'?game.night:game.day}`;$('setup').hidden=game.phase!=='setup';$('game').hidden=['setup','ended'].includes(game.phase);$('night').hidden=game.phase!=='night';$('private').hidden=game.phase==='setup'||game.phase==='ended';$('template').disabled=game.phase!=='setup'||game.players.length>0;$('distribute').disabled=hosted||game.phase!=='setup'||!game.players.length;$('newName').disabled=$('newRole').disabled=$('add').disabled=$('file').disabled=$('import').disabled=game.phase!=='setup';$('pin').value=game.pin;$('bluffs').value=game.bluffs.join(', ');selected('red',game.players.filter(x=>x.alignment==='Good'),'Choose a good player',game.markers.redHerring);$('red').disabled=!game.players.some(x=>x.actualRole==='Fortune Teller');selected('poison',game.players,'None',game.markers.poisoned);selected('protect',game.players,'None',game.markers.protected);selected('privatePlayer',game.players,'Choose a player');selected('changePlayer',game.players.filter(x=>x.alive),'Choose a living player');selected('historyPlayer',game.players,'All players');$('phaseNext').textContent=game.phase==='night'?`Begin day ${game.day+1}`:`Begin night ${game.night+1}`;roundtable();roster();nightSteps();history();$('log').replaceChildren(...game.log.slice(-60).reverse().map(x=>{const e=document.createElement('div');e.className='compact-item';e.textContent=`${new Date(x.at).toLocaleString()} · ${x.action}: ${x.detail}`;return e}))}
for(const role of roles){$('newRole').append(new Option(role,role));$('changeRole').append(new Option(role,role));$('privateToken').append(new Option(role,role))}
$('privateToken').onchange=renderTokenGallery;renderTokenGallery();
$('savePin').onclick=()=>{const pin=$('pin').value.trim();if(!/^\d{4,12}$/.test(pin))return fail(Error('Use 4–12 digits'));game.pin=pin;event('pin','Host PIN saved')};
$('bluffs').onchange=()=>{if(game.phase!=='setup')return;game.bluffs=$('bluffs').value.split(',').map(x=>x.trim()).filter(Boolean);event('bluffs','Setup bluffs edited')};
$('red').onchange=()=>{if(game.phase!=='setup')return;game.markers.redHerring=$('red').value||null;event('redHerring',`Setup red herring: ${player(game.markers.redHerring)?.name||'none'}`)};
$('template').onclick=()=>{if(game.players.length)return;template.forEach((role,i)=>addRow({name:`Player ${i+1}`,actualRole:role,shownRole:role==='Drunk'?'Fortune Teller':''}));event('template','Ten-player example loaded')};
$('distribute').onclick=()=>{try{beginDistribution()}catch(e){fail(e)}};
$('distributionBack').onclick=()=>{const d=readDistribution();if(!d||d.stage!=='closed')return;d.stage='list';d.current=null;storeDistribution(d);showDistribution(d)};
$('distributionReveal').onclick=revealDistributed;
$('distributionNext').onclick=hideDistributed;
$('distributionEnd').onclick=()=>{const d=readDistribution();if(!d||d.stage!=='list')return;d.stage='lock';d.resume=false;storeDistribution(d);showDistribution(d);$('distributionPin').focus()};
$('distributionUnlock').onclick=unlockDistribution;
$('distributionPin').onkeydown=e=>{if(e.key==='Enter')unlockDistribution()};
$('add').onclick=()=>{try{if(game.phase!=='setup')return;addRow({name:$('newName').value,actualRole:$('newRole').value});$('newName').value='';event('add','Player added')}catch(e){fail(e)}};
$('import').onclick=async()=>{try{const file=$('file').files[0];if(!file)throw Error('Choose an .xlsx or .csv file');const rows=await I.parseFile(file);if(!confirm(`Replace setup roster with ${rows.length} players?`))return;const old=game.players;game.players=[];try{rows.forEach(addRow)}catch(e){game.players=old;throw e}game.markers.redHerring=null;event('import',`${rows.length} players from ${file.name}`);$('file').value=''}catch(e){fail(e)}};
$('start').onclick=()=>{try{if(game.players.length<5)throw Error('At least five players required');if(game.players.some(x=>/^Player \d+$/.test(x.name)))throw Error('Replace placeholder names');if(game.players.filter(x=>R.TYPES[x.actualRole]==='Demon').length!==1)throw Error('Exactly one Demon required');const bluffs=$('bluffs').value.split(',').map(x=>x.trim()).filter(Boolean);if(bluffs.length!==3||new Set(bluffs).size!==3||bluffs.some(x=>!R.TYPES[x]||game.players.some(p=>p.actualRole===x||p.shownRole===x)))throw Error('Choose three distinct out-of-play bluffs');if(game.players.some(x=>x.actualRole==='Fortune Teller')&&!player($('red').value))throw Error('Choose a Fortune Teller red herring');if(!game.pin)throw Error('Set host PIN first');if(!confirm('Start the first night with these assignments?'))return;game.bluffs=bluffs;game.markers.redHerring=game.players.some(x=>x.actualRole==='Fortune Teller')?$('red').value||null:null;game.phase='night';game.night=1;event('start','First night began')}catch(e){fail(e)}};
$('phaseNext').onclick=()=>{if(game.phase==='night'){game.phase='day';game.day++;game.markers.executedToday=null}else{game.phase='night';game.night++;game.markers.poisoned=null;game.markers.protected=null;game.markers.nightDeaths=[]}event('phase',`${game.phase} ${game.phase==='night'?game.night:game.day}`)};
$('saveMarkers').onclick=()=>{game.markers.poisoned=$('poison').value||null;game.markers.protected=$('protect').value||null;event('markers',`Poisoned: ${player(game.markers.poisoned)?.name||'none'}; protected: ${player(game.markers.protected)?.name||'none'}`)};
$('recordNote').onclick=()=>{const detail=$('hostNote').value.trim();if(!detail)return fail(Error('Write a note first'));$('hostNote').value='';event('note',detail)};
$('change').onclick=()=>{const p=player($('changePlayer').value),role=$('changeRole').value;if(!p)return fail(Error('Choose a living player'));if(!confirm(`Change ${p.name} to ${role}?`))return;p.actualRole=role;p.shownRole=role;p.alignment=['Minion','Demon'].includes(R.TYPES[role])?'Evil':'Good';event('change',`${p.name}: ${role}`);try{handoff(p,'Your character has changed',[role],{kind:'change'})}catch(e){fail(e)}};
for(const [id,team] of [['winGood','Good'],['winEvil','Evil']])$(id).onclick=()=>{if(confirm(`Declare ${team} victorious?`)){game.phase='ended';game.winner=team;event('end',`${team} wins`)}};
$('privateShow').onclick=()=>{try{const p=player($('privatePlayer').value),role=$('privateToken').value;if(!p||!role)throw Error('Choose a player and character token');handoff(p,'Character token',[role],{kind:'token'})}catch(e){fail(e)}};
$('historyPlayer').onchange=history;$('reveal').onclick=reveal;$('finish').onclick=finish;$('unlock').onclick=unlock;$('unlockPin').onkeydown=e=>{if(e.key==='Enter')unlock()};
$('backup').onclick=()=>{const blob=new Blob([JSON.stringify(game,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ravenswood-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)};
$('restore').onchange=async e=>{try{const v=JSON.parse(await e.target.files[0].text());if(v.version!==1||!Array.isArray(v.players)||!Array.isArray(v.shownHistory)||!Array.isArray(v.log)||!v.markers)throw Error('Invalid backup');if(!confirm('Replace the current game with this backup?'))return;game=v;event('restore','Backup restored')}catch(err){fail(err)}e.target.value=''};
$('reset').onclick=()=>{if(!confirm('Clear the entire game, including all information shown and the log? Download a backup first if needed.'))return;game=fresh();storeHandoff(null);storeDistribution(null);$('distribution').hidden=true;event('reset','Fresh game')};
$('hostLogin').onsubmit=async e=>{e.preventDefault();$('hostLoginError').textContent='';try{const response=await fetch('/api/solo/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:$('hostCode').value})});const data=await response.json();if(!response.ok)throw Error(data.error||'Sign in failed');$('hostCode').value='';await loadHosted()}catch(err){$('hostLoginError').textContent=err.message}};
if(hosted){$('storageNote').textContent='This game is saved on your laptop and shared with your phone over the local network. Keep the host code private and download backups.';$('connectionGate').hidden=false;loadHosted();setInterval(pollHosted,2000)}
else{render();const pending=localStorage.getItem(HAND);if(pending){try{const h=JSON.parse(pending);h.stage='lock';localStorage.setItem(HAND,JSON.stringify(h));showHandoff(h)}catch(_){localStorage.removeItem(HAND)}}const d=readDistribution();if(d){d.stage='lock';d.resume=true;d.current=null;storeDistribution(d);showDistribution(d)}}
})();
