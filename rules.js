/* Shared Trouble Brewing guide metadata. Storyteller judgment remains authoritative. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;root.ClocktowerRules=value})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const TYPES={
    Washerwoman:'Townsfolk',Librarian:'Townsfolk',Investigator:'Townsfolk',Chef:'Townsfolk',Empath:'Townsfolk','Fortune Teller':'Townsfolk',Undertaker:'Townsfolk',Monk:'Townsfolk',Ravenkeeper:'Townsfolk',Virgin:'Townsfolk',Slayer:'Townsfolk',Soldier:'Townsfolk',Mayor:'Townsfolk',
    Butler:'Outsider',Drunk:'Outsider',Recluse:'Outsider',Saint:'Outsider',
    Poisoner:'Minion',Spy:'Minion',Baron:'Minion','Scarlet Woman':'Minion',Imp:'Demon'
  };
  const FIRST=[
    ['Poisoner','one','Choose a player to poison tonight and during the following day.'],
    ['Washerwoman','two','Choose two players, one of whom is the Townsfolk token you show.'],
    ['Librarian','two','Choose two players, one of whom is the Outsider token you show.'],
    ['Investigator','two','Choose two players, one of whom is the Minion token you show.'],
    ['Chef','number','Show the number of adjacent pairs of evil players.'],
    ['Empath','number','Show how many of the two nearest living neighbours are evil.'],
    ['Fortune Teller','two-yesno','They choose two players; show yes if either is the Demon or red herring.']
  ];
  const OTHER=[
    ['Poisoner','one','Choose a player to poison tonight and during the following day.'],
    ['Monk','one','Choose another player to protect from the Demon tonight.'],
    ['Imp','one','Choose a player. Resolve the attack and possible self-kill.'],
    ['Ravenkeeper','one-role','If killed at night, choose a player and learn their character.'],
    ['Empath','number','Show how many of the two nearest living neighbours are evil.'],
    ['Fortune Teller','two-yesno','They choose two players; show yes if either is the Demon or red herring.'],
    ['Undertaker','role','Show the character of the player who died by execution today.']
  ];
  function displayRole(p){return p.shownRole||p.actualRole}
  function isDrunk(p){return p.actualRole==='Drunk'}
  function steps(game){
    if(game.phase!=='night')return [];
    const first=game.night===1,order=first?FIRST:OTHER,players=game.players||[],nightDeaths=game.markers?.nightDeaths||[];
    const result=[];
    if(first){
      for(const p of players.filter(x=>x.alive&&TYPES[x.actualRole]==='Minion'))result.push({key:`${game.night}:${p.id}:minion-info`,actorId:p.id,role:'Minion information',kind:'info',help:'Show the Demon and other Minions.',automatic:true});
      for(const p of players.filter(x=>x.alive&&TYPES[x.actualRole]==='Demon'))result.push({key:`${game.night}:${p.id}:demon-info`,actorId:p.id,role:'Demon information',kind:'info',help:'Show the Minions and three out-of-play bluffs.',automatic:true});
    }
    for(const [role,kind,help] of order){
      for(const p of players){
        if(displayRole(p)!==role)continue;
        if(!p.alive && !(role==='Ravenkeeper'&&nightDeaths.includes(p.id)))continue;
        if(role==='Ravenkeeper'&&!nightDeaths.includes(p.id))continue;
        if(role==='Undertaker'&&!game.markers?.executedToday)continue;
        const actual=p.actualRole===role;
        result.push({key:`${game.night}:${p.id}:${role}`,actorId:p.id,role,kind,help,apparentDrunk:!actual&&isDrunk(p)});
      }
    }
    return result.map(s=>({...s,resolved:(game.nightRecords||[]).some(r=>r.key===s.key)}));
  }
  function chefCount(players){let n=0;for(let i=0;i<players.length;i++)if(players[i].alignment==='Evil'&&players[(i+1)%players.length].alignment==='Evil')n++;return n}
  function empathCount(players,id){const alive=players.filter(p=>p.alive);const index=alive.findIndex(p=>p.id===id);if(index<0||alive.length<3)return null;return Number(alive[(index+1)%alive.length].alignment==='Evil')+Number(alive[(index+alive.length-1)%alive.length].alignment==='Evil')}
  function fortuneAnswer(game,ids){return ids.some(x=>game.players.some(p=>p.id===x&&p.actualRole==='Imp'&&p.alive)||x===game.markers?.redHerring)}
  return {TYPES,FIRST,OTHER,steps,displayRole,chefCount,empathCount,fortuneAnswer};
});
