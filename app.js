const SKILLS=['Palletizer','Packer','AP','WT','W1','W2','SC','NEW','Stacker trained','Urinal lines'];
const SHIFTS={morning:{name:'Morning',start:6},afternoon:{name:'Afternoon',start:14},night:{name:'Night',start:22}};
const TEAMS={red:'RED',blue:'BLUE',green:'GREEN',weekendMorning:'Weekend Morning',weekendNight:'Weekend Night'};
const ROTATIONS=[60,90,120,150,180,240,270,300,330,360,420];
const PRODUCT_LINES=['Line 4 · Packer','Line 7 · Packer','Line 8 · Packer'];
const HOT_LINE_AREAS=['1','6'];
const WORK_AREAS=[...Array.from({length:8},(_,i)=>({id:String(i+1),label:`Line ${i+1}`})),{id:'AP',label:'AP'},{id:'MP',label:'MP'}];
const FLEX_LINE=(n)=>[[`Line ${n} · Packer 1`,'Packer'],[`Line ${n} · Packer 2`,'Packer',true],[`Line ${n} · Packer 3`,'Packer',true],[`Line ${n} · Palletiser`,'Palletizer']];
const POSITIONS=[
 {line:'F1',items:[...FLEX_LINE(1),...FLEX_LINE(2),...FLEX_LINE(3),['Line 4 · Packer','Urinal lines'],['AP','AP'],['MP','Palletizer'],['W1','W1']]},
 {line:'F2',items:[...FLEX_LINE(5),...FLEX_LINE(6),['Line 7 · Packer','Urinal lines'],['Line 8 · Packer','Urinal lines'],['W2 · palletiser','W2']]},
 {line:'Support',items:[['Shift coordinator','SC'],['Extra 1','Any',true],['Extra 2','Any',true]]}
];
const defaultPeople=[
 ['Anna',['Packer','AP']],['Marek',['Palletizer','WT','W2']],['Sofia',['Packer','W1','Stacker trained']],['Dmitri',['AP','WT']],['Karol',['Palletizer','Packer','W2']],['Olga',['WT','W1','Stacker trained']],['Victor',['Palletizer','AP']],['Elena',['Packer','WT']],['Jan',['Palletizer','W1','W2','Stacker trained']],['Irina',['AP','Packer']],['Nikolai',['WT','Palletizer']],['Maria',['Packer','AP']],['Alex',['Palletizer','Packer','AP','WT','W1','W2','SC','Stacker trained']]
].map((p,i)=>({id:'p'+i,name:p[0],skills:p[1]}));
const LOCAL_KEY='lineflow-v1';
function freshState(){return {shift:'morning',team:'red',started:false,people:JSON.parse(JSON.stringify(defaultPeople)),assignments:{},breaks:{},productCooldowns:{},hotCooldowns:{},notRequiredPositions:[],disabledLines:[]}}
function emptyTeamData(){return {people:[],assignments:{},breaks:{},productCooldowns:{},hotCooldowns:{},notRequiredPositions:[],started:false}}
function normalizeState(input){
 const next=input&&typeof input==='object'?input:freshState();
 next.shift=SHIFTS[next.shift]?next.shift:'morning';next.team=TEAMS[next.team]?next.team:'red';
 next.people=Array.isArray(next.people)?next.people:[];next.assignments=next.assignments||{};next.breaks=next.breaks||{};next.productCooldowns=next.productCooldowns||{};next.hotCooldowns=next.hotCooldowns||{};next.notRequiredPositions=next.notRequiredPositions||[];
 if(!next.teamData){next.teamData={};next.teamData[next.team]={people:next.people,assignments:next.assignments,breaks:next.breaks,productCooldowns:next.productCooldowns,hotCooldowns:next.hotCooldowns,notRequiredPositions:next.notRequiredPositions,started:!!next.started}}
 const active=next.teamData[next.team]||emptyTeamData();next.people=active.people||[];next.assignments=active.assignments||{};next.breaks=active.breaks||{};next.productCooldowns=active.productCooldowns||{};next.hotCooldowns=active.hotCooldowns||{};next.notRequiredPositions=active.notRequiredPositions||[];next.started=!!active.started;
 next.disabledLines=(next.disabledLines||[]).map(String);return next;
}
let state=normalizeState(JSON.parse(localStorage.getItem(LOCAL_KEY)||'null'));
function captureTeamData(){return {people:state.people,assignments:state.assignments,breaks:state.breaks,productCooldowns:state.productCooldowns,hotCooldowns:state.hotCooldowns,notRequiredPositions:state.notRequiredPositions,started:!!state.started}}
function applyTeamData(data){const next=data||emptyTeamData();state.people=next.people||[];state.assignments=next.assignments||{};state.breaks=next.breaks||{};state.productCooldowns=next.productCooldowns||{};state.hotCooldowns=next.hotCooldowns||{};state.notRequiredPositions=next.notRequiredPositions||[];state.started=!!next.started}
function syncActiveTeam(){state.teamData=state.teamData||{};state.teamData[state.team]=captureTeamData()}
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const cloud={active:false,version:0,applying:false,dirty:false,timer:null,pollTimer:null,connecting:false};
function cloudStatus(mode,label){const el=$('#cloudStatus');if(!el)return;el.className='cloud-status '+mode;el.querySelector('b').textContent=label;el.title=mode==='connected'?'Shared data is synced with Render':'Storage status: '+label}
function save(){syncActiveTeam();localStorage.setItem(LOCAL_KEY,JSON.stringify(state));if(cloud.active&&!cloud.applying)scheduleCloudSave()}
function scheduleCloudSave(){cloud.dirty=true;cloudStatus('saving','Saving…');clearTimeout(cloud.timer);cloud.timer=setTimeout(pushCloudState,700)}
async function pushCloudState(){
 clearTimeout(cloud.timer);cloud.timer=null;if(!cloud.active)return;syncActiveTeam();
 try{
  const response=await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:cloud.version,data:state})});
  const payload=await response.json();
  if(response.status===409&&payload.data){applyCloudState(payload,true);toast('A newer cloud change was loaded');return}
  if(!response.ok)throw new Error(payload.error||'Cloud save failed');
  cloud.version=payload.version;cloud.dirty=false;cloudStatus('connected','Cloud saved');
 }catch(error){cloud.dirty=true;cloudStatus('error','Cloud offline');console.warn(error)}
}
function applyCloudState(payload,force=false){
 if(!payload?.data||(!force&&(cloud.dirty||cloud.timer)))return;
 cloud.applying=true;state=normalizeState(payload.data);cloud.version=Number(payload.version||0);localStorage.setItem(LOCAL_KEY,JSON.stringify(state));render();cloud.applying=false;cloud.dirty=false;cloudStatus('connected','Cloud connected');
}
async function pullCloudState(initial=false){
 const response=await fetch('/api/state',{cache:'no-store'});if(!response.ok)throw new Error('Cloud state unavailable');const payload=await response.json();
 if(payload.data){if(initial||Number(payload.version)>cloud.version)applyCloudState(payload,initial)}else if(initial){cloud.version=0;await pushCloudState()}cloudStatus('connected','Cloud connected');
}
async function initCloud(){
 if(cloud.connecting||cloud.active)return;cloud.connecting=true;cloudStatus('saving','Connecting…');
 try{const health=await fetch('/api/health',{cache:'no-store'});if(!health.ok)throw new Error('Cloud is not configured');cloud.active=true;await pullCloudState(true);cloudStatus('connected','Cloud connected');cloud.pollTimer=setInterval(()=>{const task=cloud.dirty&&!cloud.timer?pushCloudState():pullCloudState(false);Promise.resolve(task).catch(()=>cloudStatus('error','Cloud offline'))},8000)}
 catch(error){cloud.active=false;cloudStatus(location.hostname.endsWith('github.io')?'local':'error',location.hostname.endsWith('github.io')?'Local only':'Cloud offline');console.info(error.message)}finally{cloud.connecting=false}
}
function minsToTime(mins){mins=(mins+1440)%1440;return String(Math.floor(mins/60)).padStart(2,'0')+':'+String(mins%60).padStart(2,'0')}
function shiftMinute(offset=0){return SHIFTS[state.shift].start*60+offset}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function initials(name){return name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()}
function lineNumber(pos){return Number(pos.match(/^Line (\d+)/)?.[1]||0)}
function positionArea(pos){const n=lineNumber(pos);return n?String(n):['AP','MP'].includes(pos)?pos:null}
function isHotPosition(pos){return HOT_LINE_AREAS.includes(positionArea(pos))}
function hotTransitionBlocked(sourcePos,targetPos){const source=positionArea(sourcePos),target=positionArea(targetPos);return HOT_LINE_AREAS.includes(source)&&HOT_LINE_AREAS.includes(target)&&source!==target}
function isDisabled(pos){const area=positionArea(pos);return area&&state.disabledLines.includes(area)}
function isPresent(person){return person?.present!==false}
function presentPeople(people=state.people){return (people||[]).filter(isPresent)}
function personById(id){return state.people.find(p=>p.id===id)}
function positionItem(pos){return POSITIONS.flatMap(group=>group.items).find(item=>item[0]===pos)}
function positionFloor(pos){return POSITIONS.find(group=>group.items.some(item=>item[0]===pos))?.line||null}
function isProductionFloor(floor){return floor==='F1'||floor==='F2'}
function getWTPool(){return presentPeople().filter(person=>person.skills.includes('WT')).sort((a,b)=>a.name.localeCompare(b.name))}
function normalizeWTAssignments(){const wtIds=new Set(getWTPool().map(person=>person.id));Object.keys(state.assignments).forEach(pos=>{if(wtIds.has(state.assignments[pos]))delete state.assignments[pos]})}
function getExtraPool(assignments=state.assignments){
 const linePeople=new Set(Object.entries(assignments).filter(([pos,id])=>id&&positionArea(pos)).map(([,id])=>id));
 const assignedPosition=new Map(Object.entries(assignments).filter(([,id])=>id).map(([pos,id])=>[id,pos]));
 return presentPeople().filter(person=>!person.skills.includes('WT')&&!linePeople.has(person.id)).map(person=>({person,position:assignedPosition.get(person.id)||'Available'})).sort((a,b)=>{
   const rank=x=>x.position==='Available'?0:x.position.startsWith('Extra')?1:/^W[12]/.test(x.position)?2:x.position==='Shift coordinator'?3:4;
   return rank(a)-rank(b)||a.person.name.localeCompare(b.person.name);
 });
}
function getRawRotatingExtras(assignments=state.assignments){return getExtraPool(assignments).filter(item=>(item.position==='Available'||item.position.startsWith('Extra'))&&!item.person.skills.includes('SC'))}
function getSafetyExtras(assignments=state.assignments){return getRawRotatingExtras(assignments).filter(item=>!item.person.skills.includes('NEW'))}
function getNewPairings(assignments=state.assignments){
 const extras=getSafetyExtras(assignments),used=new Set(),pairs=new Map();
 PRODUCT_LINES.forEach(pos=>{const id=assignments[pos],person=personById(id);if(!person?.skills.includes('NEW'))return;const extra=extras.find(item=>item.person.id!==id&&!used.has(item.person.id))||null;if(extra)used.add(extra.person.id);pairs.set(pos,extra)});
 return pairs;
}
function getNewCompanionIds(assignments=state.assignments){return new Set([...getNewPairings(assignments).values()].filter(Boolean).map(item=>item.person.id))}
function getRotatingExtras(assignments=state.assignments){const companions=getNewCompanionIds(assignments);return getRawRotatingExtras(assignments).filter(item=>!companions.has(item.person.id))}
function removeUncoveredNew(assignments){
 const pairs=getNewPairings(assignments);PRODUCT_LINES.forEach(pos=>{const person=personById(assignments[pos]);if(person?.skills.includes('NEW')&&!pairs.get(pos))delete assignments[pos]});return assignments;
}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}
function assignInitial(){
 const people=presentPeople(),used=new Set(); state.assignments={};
 const slots=POSITIONS.flatMap(x=>x.items).filter(([pos])=>!isDisabled(pos)&&!state.notRequiredPositions.includes(pos)).sort((a,b)=>Number(!!a[2])-Number(!!b[2]));
 slots.forEach(([pos,skill])=>{const scPosition=pos==='Shift coordinator';let p=people.find(p=>!p.skills.includes('WT')&&!used.has(p.id)&&(scPosition?p.skills.includes('SC'):!p.skills.includes('SC'))&&(skill==='Any'||p.skills.includes(skill)));if(!p&&!scPosition)p=people.find(p=>!p.skills.includes('WT')&&!p.skills.includes('SC')&&!used.has(p.id));if(p){state.assignments[pos]=p.id;used.add(p.id)}});
 removeUncoveredNew(state.assignments);
}
function render(){
 normalizeWTAssignments();
 Object.keys(state.assignments).forEach(pos=>{if(!isPresent(personById(state.assignments[pos])))delete state.assignments[pos]});
 Object.keys(state.assignments).forEach(pos=>{const person=personById(state.assignments[pos]);if(person?.skills.includes('SC')&&pos!=='Shift coordinator')delete state.assignments[pos]});
 Object.keys(state.assignments).forEach(pos=>{const person=personById(state.assignments[pos]);if(PRODUCT_LINES.includes(pos)&&person&&!person.skills.includes('Urinal lines')&&!person.skills.includes('NEW'))delete state.assignments[pos]});
 const cfg=SHIFTS[state.shift];
 $$('.shift').forEach(b=>b.classList.toggle('active',b.dataset.shift===state.shift));
 $$('[data-team]').forEach(b=>{const active=b.dataset.team===state.team;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});
 $$('[data-team-count]').forEach(el=>{const team=el.dataset.teamCount,people=team===state.team?state.people:(state.teamData?.[team]?.people||[]);el.textContent=presentPeople(people).length+' / '+people.length+' Present'});
 $('#teamDialogTeam').textContent=TEAMS[state.team];
 $('#peopleCount').textContent=presentPeople().length;
 $('#trainedCount').textContent=presentPeople().filter(p=>p.skills.length>=3).length+' multi-skilled';
 $('#firstBreak').textContent=minsToTime(shiftMinute(90));
 $('#nextRotation').textContent=minsToTime(shiftMinute(ROTATIONS[0]));
 $('#shiftStatus').textContent=state.started?'In progress':'Preparation';
 $('#startBtn').innerHTML=state.started?'Rebuild plan <span>↻</span>':'Start shift <span>→</span>';
 $('#progressText').textContent=state.started?'Automatic rotation enabled':'Initial placement at '+minsToTime(shiftMinute(-5));
 $('#progressBar').style.width=state.started?'18%':'0';
 renderLineSwitches();renderExtraPool();renderWTPool();renderLines();renderMovementPlan();renderScheduleGrid();renderTimeline();renderTeam();renderAttendance();save();
}
function renderLineSwitches(){
 $('#lineSwitches').innerHTML=WORK_AREAS.map(area=>`<button data-area-toggle="${area.id}" class="${state.disabledLines.includes(area.id)?'off':'on'}"><i></i>${area.label}<small>${state.disabledLines.includes(area.id)?'Not operating':'Operating'}</small></button>`).join('');
 $$('[data-area-toggle]').forEach(b=>b.onclick=()=>{const id=b.dataset.areaToggle;const label=WORK_AREAS.find(area=>area.id===id)?.label||id;if(state.disabledLines.includes(id)){state.disabledLines=state.disabledLines.filter(x=>x!==id)}else{state.disabledLines.push(id);Object.keys(state.assignments).forEach(pos=>{if(positionArea(pos)===id)delete state.assignments[pos]})}render();toast(`${label}: ${state.disabledLines.includes(id)?'not operating':'enabled'}`)});
}
function renderExtraPool(){
 const pairs=getNewPairings(),companions=getNewCompanionIds(),extras=getExtraPool().filter(item=>!companions.has(item.person.id));
 const pairRows=[...pairs.entries()].map(([pos,extra])=>{const person=personById(state.assignments[pos]);return `<span class="new-pair ${extra?'':'missing'}"><b>${esc(person?.name||'NEW')}</b> · ${esc(pos.replace(' · Packer',''))} ${extra?`+ Extra ${esc(extra.person.name)}`:'· EXTRA REQUIRED'}</span>`}).join('');
 $('#extraPool').innerHTML=`<div class="extra-head"><div><p class="eyebrow">EXTRA</p><h3>Available for cover</h3></div><strong>${extras.length}</strong></div><div class="extra-chips">${extras.length?extras.map(({person,position})=>`<span><b>${esc(person.name)}</b><small>${esc(position)}</small></span>`).join(''):'<em>No available employees outside the lines</em>'}</div>${pairs.size?`<div class="new-safety"><b>NEW employees on Line 4/7/8 must always work with Extra, including during breaks</b>${pairRows}</div>`:''}`;
}
function renderWTPool(){
 const people=getWTPool();$('#wtPool').innerHTML=`<div class="wt-icon">WT</div><div><p class="eyebrow">SEPARATE RESERVE</p><h3>WT — break cover only</h3><p>WT does not join normal rotation and is not counted as Extra.</p><div class="wt-chips">${people.length?people.map(person=>`<span>${esc(person.name)}</span>`).join(''):'<em>No employee has the WT skill</em>'}</div></div><strong>${people.length}</strong>`;
}
function shortPositionName(pos){return pos.replace(/^Line \d+ · /,'')}
function lineRequirement(id){if(id==='AP')return '1 AP';if(id==='MP')return '1 Palletizer';return ['1','2','3','5','6'].includes(id)?'1–3 Packer · 1 Palletizer':'1 Packer · Urinal lines'}
function renderLines(){
 const pairings=getNewPairings();
 const peopleOptions=(selected,skill,pos)=>'<option value="">— Not required —</option>'+presentPeople().map(p=>{const scRestricted=p.skills.includes('SC')&&pos!=='Shift coordinator',scRequired=pos==='Shift coordinator'&&!p.skills.includes('SC'),urinalRestricted=PRODUCT_LINES.includes(pos)&&!p.skills.includes('Urinal lines')&&!p.skills.includes('NEW'),disabled=p.skills.includes('WT')||scRestricted||scRequired||urinalRestricted;const note=p.skills.includes('WT')?' · WT breaks only':scRestricted?' · SC: F1 breaks only':scRequired?' · SC skill required':urinalRestricted?' · Urinal lines skill required':skill!=='Any'&&!p.skills.includes(skill)?' · missing skill':'';return `<option value="${p.id}" ${p.id===selected?'selected':''} ${disabled?'disabled':''}>${esc(p.name)}${note}</option>`}).join('');
 const positionRow=([pos,skill,optional],i)=>{const assigned=personById(state.assignments[pos]),isNew=assigned?.skills.includes('NEW'),pair=pairings.get(pos);const notRequired=!assigned&&state.notRequiredPositions.includes(pos);const tag=isDisabled(pos)?'Not operating':notRequired?'Not required':PRODUCT_LINES.includes(pos)&&isNew?(pair?`NEW + ${esc(pair.person.name)}`:'NEW · Extra required'):PRODUCT_LINES.includes(pos)?'Urinal lines · ↔ 60 min':skill;return `<div class="position ${PRODUCT_LINES.includes(pos)?'product-line':''} ${isDisabled(pos)?'disabled-position':''} ${PRODUCT_LINES.includes(pos)&&isNew?'new-product-position':''}"><span class="position-icon">${i+1}</span><div><label>${esc(shortPositionName(pos))}${optional?' · optional':''}${isNew?'<mark>NEW</mark>':''}</label><select data-position="${esc(pos)}" ${isDisabled(pos)?'disabled':''}>${peopleOptions(state.assignments[pos],skill,pos)}</select></div><span class="skill-tag ${PRODUCT_LINES.includes(pos)&&isNew?(pair?'paired':'missing'):''}">${tag}</span></div>`};
 const groupedPositions=group=>{
   const lineGroups=WORK_AREAS.map(area=>({...area,items:group.items.filter(item=>positionArea(item[0])===area.id)})).filter(x=>x.items.length);
   const other=group.items.filter(item=>!positionArea(item[0]));
   const lineHtml=lineGroups.map(({id,label,items})=>{const assigned=items.filter(item=>state.assignments[item[0]]).length;const off=state.disabledLines.includes(id),hot=HOT_LINE_AREAS.includes(id);return `<section class="production-group ${off?'production-group-off':''} ${hot?'hot-production-group':''}"><header class="production-group-head"><div><b>${label}${hot?' <em class="hot-badge">HOT</em>':''}</b><small>${lineRequirement(id)}</small></div><span>${off?'Not operating':assigned+' / '+items.length}</span></header><div class="group-positions">${items.map(positionRow).join('')}</div></section>`}).join('');
   const otherHtml=other.length?`<section class="production-group auxiliary-group"><header class="production-group-head"><div><b>${group.line==='Support'?'Support positions':'Other positions'}</b><small>${group.line==='Support'?'Coordination and cover':'W1 / W2'}</small></div><span>${other.filter(item=>state.assignments[item[0]]).length} / ${other.length}</span></header><div class="group-positions">${other.map(positionRow).join('')}</div></section>`:'';
   return lineHtml+otherHtml;
 };
 $('#lines').innerHTML=POSITIONS.map(group=>`<article class="line-card"><div class="line-title"><h3>${group.line}</h3><span>${group.items.filter(x=>state.assignments[x[0]]).length} people</span></div><div class="positions grouped">${groupedPositions(group)}</div></article>`).join('');
 $$('[data-position]').forEach(s=>s.onchange=e=>{
   const target=e.target.dataset.position,nextId=e.target.value,previousId=state.assignments[target]||'';
   const occupied=Object.keys(state.assignments).find(pos=>state.assignments[pos]===nextId&&pos!==target);
   if(nextId&&personById(nextId)?.skills.includes('SC')&&target!=='Shift coordinator'){e.target.value=previousId;toast('SC remains in F1 and is used only for break cover');return}
   if(nextId&&target==='Shift coordinator'&&!personById(nextId)?.skills.includes('SC')){e.target.value=previousId;toast('Shift coordinator requires the SC skill');return}
   if(nextId&&PRODUCT_LINES.includes(target)&&!personById(nextId)?.skills.includes('Urinal lines')&&!personById(nextId)?.skills.includes('NEW')){e.target.value=previousId;toast('Line 4, 7 and 8 require the Urinal lines skill');return}
   if(nextId&&occupied&&hotTransitionBlocked(occupied,target)){e.target.value=previousId;toast('Direct moves between Line 1 and Line 6 are not allowed');return}
   const hotPause=state.hotCooldowns[nextId];
   if(nextId&&isHotPosition(target)&&hotPause?.until>Date.now()&&hotPause.fromArea!==positionArea(target)){const left=Math.ceil((hotPause.until-Date.now())/60000);e.target.value=previousId;toast(left+' more minutes on a cold position before the other hot line');return}
   if(nextId&&PRODUCT_LINES.includes(target)&&occupied&&PRODUCT_LINES.includes(occupied)){e.target.value=previousId;toast('A 60-minute gap is required between Line 4, 7 and 8');return}
   if(nextId&&PRODUCT_LINES.includes(target)&&(state.productCooldowns[nextId]||0)>Date.now()){const left=Math.ceil((state.productCooldowns[nextId]-Date.now())/60000);e.target.value=previousId;toast(left+' more minutes before returning to this product group');return}
   if(nextId&&PRODUCT_LINES.includes(target)&&personById(nextId)?.skills.includes('NEW')){const candidate={...state.assignments,[target]:nextId};if(occupied)delete candidate[occupied];if(!getNewPairings(candidate).get(target)){e.target.value=previousId;toast('A NEW employee cannot work on Line 4, 7 or 8 without Extra support');return}}
   if(previousId&&PRODUCT_LINES.includes(target)&&previousId!==nextId)state.productCooldowns[previousId]=Date.now()+60*60000;
   if(previousId&&isHotPosition(target)&&previousId!==nextId)state.hotCooldowns[previousId]={fromArea:positionArea(target),until:Date.now()+30*60000};
   if(occupied){if(PRODUCT_LINES.includes(occupied)&&!PRODUCT_LINES.includes(target))state.productCooldowns[nextId]=Date.now()+60*60000;if(isHotPosition(occupied)&&!isHotPosition(target))state.hotCooldowns[nextId]={fromArea:positionArea(occupied),until:Date.now()+30*60000};delete state.assignments[occupied]}
   if(nextId){state.assignments[target]=nextId;state.notRequiredPositions=state.notRequiredPositions.filter(pos=>pos!==target)}else{delete state.assignments[target];if(!state.notRequiredPositions.includes(target))state.notRequiredPositions.push(target)}render();
 });
}
function buildMovementPlan(assignments=state.assignments,context=null){
 const extras=getSafetyExtras(assignments),usedExtras=new Set(),plans=[];
 const rotateExtras=!!context&&context.offset>0;
 const rotatingExtras=getRotatingExtras(assignments),usedExtraPositions=new Set(rotatingExtras.filter(item=>item.position.startsWith('Extra')).map(item=>item.position));let extraIndex=1;
 const extraItems=rotatingExtras.map(item=>{let pos=item.position;if(!pos.startsWith('Extra')){while(usedExtraPositions.has(`Extra ${extraIndex}`))extraIndex++;pos=`Extra ${extraIndex++}`;usedExtraPositions.add(pos)}return [pos,'Any',true,item.person.id]});
 const rotatableItems=group=>group.items.filter(item=>!['AP','W1','W2 · palletiser'].includes(item[0]));
 let planGroups;
 if(rotateExtras&&context.crossFloors){planGroups=[{line:'F1 ↔ F2 ↔ EXTRA',items:[...POSITIONS.filter(group=>isProductionFloor(group.line)).flatMap(rotatableItems),...extraItems]}]}
 else if(rotateExtras){const floors=POSITIONS.filter(group=>isProductionFloor(group.line));planGroups=floors.map((group,floorIndex)=>({line:`${group.line} ↔ EXTRA`,items:[...rotatableItems(group),...extraItems.filter((_,index)=>index%floors.length===floorIndex)]}))}
 else planGroups=context?.crossFloors?[{line:'F1 ↔ F2',items:POSITIONS.filter(group=>isProductionFloor(group.line)).flatMap(group=>group.items)},...POSITIONS.filter(group=>!isProductionFloor(group.line))]:POSITIONS;
 planGroups.forEach(group=>{
   const entries=group.items.map(item=>({pos:item[0],skill:item[1],id:item[3]||assignments[item[0]]})).filter(entry=>entry.id&&!isDisabled(entry.pos));
   if(!entries.length)return;
   const targetMatch=Array(entries.length).fill(-1);
   const canMove=(person,source,target)=>{
     if(source.pos===target.pos)return true;
     if(source.pos==='AP'||target.pos==='AP')return false;
     if(target.skill!=='Any'&&!person.skills.includes(target.skill))return false;
     if(context&&PRODUCT_LINES.includes(target.pos)&&(context.productReady[person.id]||0)>context.offset)return false;
     if(context&&isHotPosition(target.pos)&&(context.hotReady[person.id]||0)>context.offset&&context.hotFrom[person.id]!==positionArea(target.pos))return false;
     if(hotTransitionBlocked(source.pos,target.pos))return false;
     if(PRODUCT_LINES.includes(source.pos)&&PRODUCT_LINES.includes(target.pos))return false;
     if(person.skills.includes('NEW')&&PRODUCT_LINES.includes(target.pos)&&!extras.length)return false;
     return true;
   };
   const tryMatch=(personIndex,seen)=>{
     const source=entries[personIndex],person=personById(source.id);if(!person)return false;
     let order=[...Array(entries.length-1)].map((_,i)=>(personIndex+i+1)%entries.length).concat(personIndex);
     const sourceFloor=positionFloor(source.pos),sourceIsExtra=source.pos.startsWith('Extra');
     if(rotateExtras||context?.crossFloors)order=order.sort((a,b)=>{
       const targetRank=index=>{
         const target=entries[index],targetIsExtra=target.pos.startsWith('Extra');
         if(rotateExtras&&sourceIsExtra!==targetIsExtra)return 0;
         const floor=positionFloor(target.pos);
         if(context?.crossFloors&&isProductionFloor(sourceFloor)&&isProductionFloor(floor)&&floor!==sourceFloor)return 1;
         if(source.pos===target.pos)return 4;
         if(rotateExtras&&sourceIsExtra===targetIsExtra)return 3;
         return 2;
       };
       return targetRank(a)-targetRank(b);
     });
     for(const targetIndex of order){if(seen.has(targetIndex)||!canMove(person,source,entries[targetIndex]))continue;seen.add(targetIndex);if(targetMatch[targetIndex]<0||tryMatch(targetMatch[targetIndex],seen)){targetMatch[targetIndex]=personIndex;return true}}
     return false;
   };
   const sourceOrder=entries.map((_,i)=>i).sort((a,b)=>rotateExtras?Number(!entries[a].pos.startsWith('Extra'))-Number(!entries[b].pos.startsWith('Extra')):a-b);
   sourceOrder.forEach(i=>tryMatch(i,new Set()));
   const targetByPerson=new Map();targetMatch.forEach((personIndex,targetIndex)=>{if(personIndex>=0)targetByPerson.set(entries[personIndex].id,entries[targetIndex].pos)});
   const rows=entries.map(source=>{const person=personById(source.id),target=targetByPerson.get(source.id)||source.pos,targetOccupantId=assignments[target],targetOccupant=personById(targetOccupantId),replacedNext=targetByPerson.get(targetOccupantId)||target;let companion=null;if(person?.skills.includes('NEW')&&PRODUCT_LINES.includes(target)){companion=extras.find(item=>!usedExtras.has(item.person.id))||null;if(companion)usedExtras.add(companion.person.id)}return {person,source:source.pos,target,targetOccupant,replacedNext,companion}}).sort((a,b)=>rotateExtras?Number(!a.source.startsWith('Extra'))-Number(!b.source.startsWith('Extra')):0);
   plans.push({group:group.line,rows});
 });
 return plans;
}
function renderMovementPlan(){
 const context={productReady:{},hotReady:{},hotFrom:{},offset:ROTATIONS[0],crossFloors:false};const plans=buildMovementPlan(state.assignments,context);$('#movementTime').textContent=minsToTime(shiftMinute(ROTATIONS[0]));
 $('#movementPlan').innerHTML=plans.map(plan=>`<article class="movement-card"><h3>${esc(plan.group)}</h3><div>${plan.rows.map(move=>{const stays=move.source===move.target;const replaced=move.targetOccupant&&move.targetOccupant.id!==move.person?.id?`Replaces ${esc(move.targetOccupant.name)} · then → ${esc(move.replacedNext)}`:'Stays on the same position';return `<div class="movement-row ${stays?'stays':''}"><span class="movement-avatar">${initials(move.person?.name||'?')}</span><div><b>${esc(move.person?.name||'Not required')}</b><p>${esc(move.source)} <i>→</i> ${esc(move.target)}</p><small>${replaced}</small>${move.companion?`<em>NEW + Extra ${esc(move.companion.person.name)}</em>`:move.person?.skills.includes('NEW')&&PRODUCT_LINES.includes(move.target)?'<em class="warning">NEW: Extra required</em>':''}</div></div>`}).join('')}</div></article>`).join('')||'<p class="empty-plan">Assign employees to positions first.</p>';
}
function sheetPositionLabel(pos){return String(pos||'EXTRA').replace(/^Line /,'L').replace(' · Packer ',' P').replace(' · Packer',' P').replace(' · Palletiser',' PAL').replace(' · palletiser',' PAL').replace('Shift coordinator','SC')}
function applyMovementPlans(assignments,plans,context,offset){
 const next={...assignments};
 plans.forEach(plan=>plan.rows.forEach(move=>delete next[move.source]));
 plans.forEach(plan=>plan.rows.forEach(move=>{
   if(!move.person)return;
   if(PRODUCT_LINES.includes(move.source)&&!PRODUCT_LINES.includes(move.target))context.productReady[move.person.id]=offset+60;
   if(isHotPosition(move.source)&&!isHotPosition(move.target)){context.hotReady[move.person.id]=offset+30;context.hotFrom[move.person.id]=positionArea(move.source)}
   next[move.target]=move.person.id;
 }));
 return removeUncoveredNew(next);
}
function scheduleSnapshots(){
 let assignments={...state.assignments};
 const context={productReady:{},hotReady:{},hotFrom:{},offset:0,crossFloors:false};
 const columns=[{offset:-5,assignments:{...assignments}}];
 ROTATIONS.forEach(offset=>{context.offset=offset;context.crossFloors=offset>0&&offset%120===0;const plans=buildMovementPlan(assignments,context);assignments=applyMovementPlans(assignments,plans,context,offset);columns.push({offset,assignments:{...assignments}})});
 return columns;
}
function renderScheduleGrid(){
 const columns=scheduleSnapshots();
 const firstBreaks=breakNames(columns),secondBreaks=firstBreaks,breakByPerson=new Map();
 const addBreaks=(sets,start)=>sets.forEach((names,i)=>names.forEach(name=>{if(!breakByPerson.has(name))breakByPerson.set(name,new Set());breakByPerson.get(name).add(start+i*30)}));
 addBreaks(firstBreaks,90);addBreaks(secondBreaks,270);
 const breakOffsets=new Set([90,120,150,270,300,330]);
 const personName=id=>personById(id)?.name||'';
 const wtPeople=getWTPool(),wtNames=wtPeople.map(person=>person.name);
 const buildBreakCoverage=column=>{
   const displayAssignments={...column.assignments},entries=[],companionOverrides=new Map();
   if(!breakOffsets.has(column.offset))return {assignments:displayAssignments,entries,companionOverrides};
   const breakPeople=presentPeople().filter(person=>breakByPerson.get(person.name)?.has(column.offset));
   const breakIds=new Set(breakPeople.map(person=>person.id));
   const positionById=new Map(Object.entries(column.assignments).filter(([,id])=>id).map(([pos,id])=>[id,pos]));
   const companionPositionById=new Map([...getNewPairings(column.assignments).entries()].filter(([,extra])=>extra).map(([pos,extra])=>[extra.person.id,pos]));
   Object.keys(displayAssignments).filter(pos=>pos.startsWith('Extra')).forEach(pos=>delete displayAssignments[pos]);
   const extras=getRotatingExtras(column.assignments).filter(item=>!breakIds.has(item.person.id));
   const usedCoverIds=new Set();
   const palletiserSources=['Line 1 · Palletiser','Line 2 · Palletiser'].map(pos=>({pos,person:personById(column.assignments[pos])})).filter(item=>item.person&&!breakIds.has(item.person.id));
   const coordinator=personById(column.assignments['Shift coordinator']);let coordinatorUses=0;
   const takeExtra=target=>{
     const skill=positionItem(target)?.[1]||'Any';
     return extras.find(item=>!usedCoverIds.has(item.person.id)&&(skill==='Any'||item.person.skills.includes(skill))&&(!PRODUCT_LINES.includes(target)||!item.person.skills.includes('NEW')))||null;
   };
   const takePalletiser=target=>palletiserSources.find(item=>!usedCoverIds.has(item.person.id)&&(!PRODUCT_LINES.includes(target)||item.person.skills.includes('Urinal lines')))||null;
   breakPeople.forEach(person=>{
     const companionTarget=companionPositionById.get(person.id)||'';
     const target=positionById.get(person.id)||companionTarget;
     if(!target||target.startsWith('Extra')||target==='Shift coordinator'||/^W[12]/.test(target)){entries.push({breaker:person,target:target||'EXTRA',cover:null,noCoverNeeded:true});delete displayAssignments[target];return}
     let cover=null,coverType='';
     if(companionTarget){
       const extra=extras.find(item=>!usedCoverIds.has(item.person.id)&&!item.person.skills.includes('NEW'))||null;
       if(extra)cover={person:extra.person,pos:extra.position},coverType='Extra · NEW support';
     }else if(target==='AP'){
       const wt=wtPeople.find(candidate=>!breakIds.has(candidate.id));
       if(wt)cover={person:wt,pos:'WT'},coverType='WT';
     }else{
       const extra=takeExtra(target);
       if(extra)cover={person:extra.person,pos:extra.position},coverType='Extra';
       if(!cover){const palletiser=takePalletiser(target);if(palletiser)cover=palletiser,coverType=palletiser.pos.startsWith('Line 1')?'Palletiser L1':'Palletiser L2'}
       if(!cover&&positionFloor(target)==='F1'&&coordinator&&!breakIds.has(coordinator.id)&&coordinatorUses<2&&(!PRODUCT_LINES.includes(target)||coordinator.skills.includes('Urinal lines'))){coordinatorUses++;cover={person:coordinator,pos:'Shift coordinator'},coverType=`SC F1 ${coordinatorUses}/2`}
     }
     if(companionTarget)companionOverrides.set(target,cover?.person||null);
     if(cover){usedCoverIds.add(cover.person.id);if(cover.pos&&cover.pos!==target&&!cover.pos.startsWith('Extra')&&cover.pos!=='WT'&&cover.pos!=='Shift coordinator')delete displayAssignments[cover.pos];if(!companionTarget)displayAssignments[target]=cover.person.id}
     else if(!companionTarget)delete displayAssignments[target];
     entries.push({breaker:person,target,cover,coverType,noCoverNeeded:false,companionTarget:!!companionTarget});
   });
   return {assignments:displayAssignments,entries,companionOverrides};
 };
 const displayColumns=columns.map(column=>{const coverage=buildBreakCoverage(column);return {...column,originalAssignments:column.assignments,assignments:coverage.assignments,coverage}});
 const lineCell=(line,column)=>{
   if(state.disabledLines.includes(String(line)))return '<span class="sheet-off">Not operating</span>';
   const prefix=`Line ${line} · `,entries=Object.entries(column.assignments).filter(([pos])=>pos.startsWith(prefix));
   const packers=entries.filter(([pos])=>pos.includes('Packer')).map(([,id])=>personName(id)).filter(Boolean);
   const palletiser=entries.find(([pos])=>/Palletiser/i.test(pos));
   const productPos=`Line ${line} · Packer`,productPerson=personById(column.assignments[productPos]),source=column.originalAssignments||column.assignments,originalPair=productPerson?.skills.includes('NEW')?getNewPairings(source).get(productPos):null,hasOverride=column.coverage?.companionOverrides?.has(productPos),pairPerson=hasOverride?column.coverage.companionOverrides.get(productPos):originalPair?.person;
   return [packers.length?`<span class="sheet-packers">${packers.map(esc).join(' + ')}</span>`:'',productPerson?.skills.includes('NEW')?`<span class="sheet-role">${pairPerson?`NEW + Extra ${esc(pairPerson.name)}`:'NEW · NO EXTRA'}</span>`:'',palletiser?`<span class="sheet-palletiser">${esc(personName(palletiser[1]))} (Palletiser)</span>`:''].filter(Boolean).join('<br>')||(POSITIONS.flatMap(group=>group.items).filter(item=>positionArea(item[0])===String(line)).every(item=>state.notRequiredPositions.includes(item[0]))?'Not required':'—');
 };
 const positionCell=(pos,column,suffix='')=>{const name=personName(column.assignments[pos]);return name?`${esc(name)}${suffix?` <span class="sheet-role">(${esc(suffix)})</span>`:''}`:'—'};
 const apCell=column=>{
   const id=column.assignments.AP,name=personName(id),person=personById(id);return name?`${esc(name)} <span class="sheet-role">(${person?.skills.includes('WT')?'WT cover':'AP'})</span>`:'—';
 };
 const extraCell=column=>{if(breakOffsets.has(column.offset))return '<span class="sheet-on-break">All Extra staff → covering breaks</span>';const source=column.originalAssignments||column.assignments,companions=getNewCompanionIds(source),extras=getExtraPool(source).filter(item=>!companions.has(item.person.id));return extras.length?extras.map(item=>`${esc(item.person.name)} <span class="sheet-role">(${esc(item.position)})</span>`).join(' + '):'—'};
 const coverageCell=column=>column.coverage?.entries.length?column.coverage.entries.map(entry=>entry.noCoverNeeded?`${esc(entry.breaker.name)} <span class="sheet-role">(BREAK · ${entry.target==='EXTRA'?'from Extra':'position left open'})</span>`:entry.cover?`<b>${esc(entry.cover.person.name)}</b> <span class="sheet-role">(${esc(entry.coverType)})</span> → ${esc(entry.breaker.name)} · ${esc(sheetPositionLabel(entry.target))}${entry.companionTarget?' · NEW support':''}`:`<b>NO COVER</b> → ${esc(entry.breaker.name)} · ${esc(sheetPositionLabel(entry.target))}${entry.companionTarget?' · NEW support':''}`).join('<br>'):'—';
 const breakCell=column=>{const source=column.originalAssignments||column.assignments,companionPositions=new Map([...getNewPairings(source).entries()].filter(([,extra])=>extra).map(([pos,extra])=>[extra.person.id,pos]));const names=presentPeople().filter(person=>breakByPerson.get(person.name)?.has(column.offset)).map(person=>{const assignedPos=Object.keys(source).find(key=>source[key]===person.id),companionPos=companionPositions.get(person.id),pos=assignedPos||companionPos;return `${esc(person.name)}${pos?` <span class="sheet-role">(${esc(sheetPositionLabel(pos))}${companionPos&&!assignedPos?' · NEW support':''})</span>`:''}`});return names.length?names.join(' + '):'—'};
 const rowsByGroup=[
   {group:'F1',rows:[...['1','2','3','4'].map(line=>({label:`Line ${line}`,cell:column=>lineCell(line,column)})),{label:'AP',cell:column=>state.disabledLines.includes('AP')?'<span class="sheet-off">Not operating</span>':apCell(column)},{label:'MP',cell:column=>state.disabledLines.includes('MP')?'<span class="sheet-off">Not operating</span>':positionCell('MP',column,'MP')},{label:'W1',cell:column=>positionCell('W1',column,'W1')}]},
   {group:'F2',rows:[...['5','6','7','8'].map(line=>({label:`Line ${line}`,cell:column=>lineCell(line,column)})),{label:'W2',cell:column=>positionCell('W2 · palletiser',column,'W2')}]},
   {group:'Support and breaks',rows:[{label:'Shift coordinator',cell:column=>positionCell('Shift coordinator',column,'SC')},{label:'EXTRA',cell:extraCell},{label:'WHO COVERS WHOM',cell:coverageCell,breakRow:true},{label:'WT',cell:column=>wtNames.length?wtNames.map(name=>`${esc(name)}${breakOffsets.has(column.offset)?' <span class="sheet-role">(cover)</span>':''}`).join(' + '):'—'},{label:'WHO IS ON BREAK',cell:breakCell,breakRow:true}]}
 ];
 const rows=rowsByGroup.map(section=>`<tr class="sheet-group"><th colspan="${displayColumns.length+1}">${esc(section.group)}</th></tr>`+section.rows.map(row=>`<tr class="${row.breakRow?'sheet-break-row':''}"><th>${esc(row.label)}</th>${displayColumns.map(column=>{const value=row.cell(column),cross=column.offset>0&&column.offset%120===0;return `<td class="${row.breakRow&&value!=='—'?'sheet-break':cross?'sheet-cross':''}">${value}</td>`}).join('')}</tr>`).join('')).join('');
 const date=new Date().toLocaleDateString('en-GB');
 $('#planSheet').innerHTML=`<div class="sheet-meta"><div><small>SHIFT PLAN</small><b>${esc(TEAMS[state.team])}</b></div><div><small>SHIFT</small><b>${esc(SHIFTS[state.shift].name)}</b></div><div><small>DATE</small><b>${esc(date)}</b></div></div><div class="sheet-scroll"><table><thead><tr><th>Line / position</th>${columns.map(column=>`<th class="${column.offset>0&&column.offset%120===0?'sheet-cross':''}">${esc(minsToTime(shiftMinute(column.offset<0?0:column.offset)))}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
function breakNames(columns=scheduleSnapshots()){
 const people=presentPeople().filter(person=>!person.skills.includes('WT'));
 const coordinatorId=state.assignments['Shift coordinator'];
 const groupSizes=[Math.floor(people.length/3),Math.floor(people.length/3),Math.floor(people.length/3)];
 for(let i=0;i<people.length%3;i++)groupSizes[2-i]++;
 const remaining=new Set(people.map(person=>person.id)),groups=[];
 [90,120,150].forEach((offset,index)=>{
   const assignments=columns.find(column=>column.offset===offset)?.assignments||state.assignments;
   const positionById=new Map(Object.entries(assignments).filter(([,id])=>id).map(([pos,id])=>[id,pos]));
   getNewPairings(assignments).forEach((extra,pos)=>{if(extra)positionById.set(extra.person.id,pos)});
   const ranked=people.filter(person=>remaining.has(person.id)).sort((a,b)=>{
     const rank=person=>{
       if(person.id===coordinatorId)return 6;
       const pos=positionById.get(person.id)||'';
       if(pos==='Line 1 · Palletiser'||pos==='Line 2 · Palletiser')return 4;
       if(positionArea(pos)||pos==='AP'||pos==='MP')return 0;
       if(pos.startsWith('Extra')||!pos)return 3;
       if(/^W[12]/.test(pos))return 5;
       return 2;
     };
     return rank(a)-rank(b)||a.name.localeCompare(b.name);
   });
   const selected=ranked.slice(0,groupSizes[index]);selected.forEach(person=>remaining.delete(person.id));groups.push(selected.map(person=>person.name));
 });
 return groups;
}
function renderTimeline(){
 const safety=[...getNewPairings().entries()].map(([pos,extra])=>{const person=personById(state.assignments[pos]);return `${person?.name||'NEW'} + ${extra?`Extra ${extra.person.name}`:'NO EXTRA'} on ${pos.replace(' · Packer','')}`}).join('; ');
 const wtCover=getWTPool().map(person=>person.name).join(', ');
 let events=[{m:-5,type:'start',title:'Manual initial placement',sub:'Check every position before starting'}];
 ROTATIONS.forEach((m,i)=>events.push({m,type:'rotation',title:'Rotation '+(i+1),sub:'Extra staff take suitable line positions first · '+(m>0&&m%120===0?'Then prioritise movement between F1 ↔ F2 · ':'Then rotate the remaining employees by skill · ')+'AP stays in place · SC remains in F1 and covers breaks only · Line 1↔6 only through a cold position for 30–60 minutes · Line 4/7/8 require a 60-minute gap · NEW only with Extra'}));
 const breakSets=breakNames();[1,2].forEach((round)=>{const start=round===1?90:270;breakSets.forEach((names,i)=>events.push({m:start+i*30,type:'break',title:`Break ${round} · group ${i+1}`,sub:(names.join(', ')||'Assigned after placement')+` · WT cover: ${wtCover||'not assigned'}`+(safety?` · NEW support: ${safety}`:'')}))});
 events.sort((a,b)=>a.m-b.m);
 $('#timeline').innerHTML=events.map(e=>`<div class="event ${e.type}-event"><time>${minsToTime(shiftMinute(e.m))}</time><i class="event-dot"></i><p>${e.title}<br><small>${esc(e.sub)}</small></p><small>${e.type==='break'?'30 minutes':e.type==='rotation'?'by skills':'manual'}</small></div>`).join('');
}
function renderTeam(){
 $('#skillPicks').innerHTML=SKILLS.map(s=>`<label><input type="checkbox" value="${s}">${s}</label>`).join('');
 $('#teamList').innerHTML=state.people.map(p=>`<div class="team-person ${isPresent(p)?'':'person-absent'}"><span class="avatar">${initials(p.name)}</span><div><b>${esc(p.name)}</b><small class="attendance-mini">${isPresent(p)?'Present':'Absent'}</small><div class="person-skill-grid">${SKILLS.map(skill=>`<button type="button" data-person-skill="${p.id}" data-skill="${skill}" class="${p.skills.includes(skill)?'active':''}">${skill}</button>`).join('')}</div></div><button class="delete" data-delete="${p.id}">Delete</button></div>`).join('');
 $$('[data-person-skill]').forEach(b=>b.onclick=()=>{const p=state.people.find(p=>p.id===b.dataset.personSkill);const skill=b.dataset.skill;p.skills=p.skills.includes(skill)?p.skills.filter(s=>s!==skill):[...p.skills,skill];render()});
 $$('[data-delete]').forEach(b=>b.onclick=()=>{const id=b.dataset.delete;state.people=state.people.filter(p=>p.id!==id);Object.keys(state.assignments).forEach(k=>{if(state.assignments[k]===id)delete state.assignments[k]});render()});
}
function renderAttendance(){
 syncActiveTeam();
 const entries=Object.keys(TEAMS).map(team=>({team,label:TEAMS[team],people:state.teamData?.[team]?.people||[]}));
 const all=entries.flatMap(entry=>entry.people),present=all.filter(isPresent).length,absent=all.length-present;
 $('#attendanceSummary').innerHTML=`<article><small>TOTAL WORKERS</small><strong>${all.length}</strong></article><article class="present"><small>PRESENT</small><strong>${present}</strong></article><article class="absent"><small>ABSENT</small><strong>${absent}</strong></article>`;
 $('#attendanceTeams').innerHTML=entries.map(({team,label,people})=>{
  const here=people.filter(isPresent).length;
  return `<article class="attendance-team"><header><div><i class="team-dot ${team}"></i><div><h2>${esc(label)}</h2><p>${here} Present · ${people.length-here} Absent · ${people.length} total</p></div></div><div><button class="ghost small" data-mark-team="${team}" type="button">Mark all Present</button><button class="ghost small" data-add-team="${team}" type="button">+ Add</button></div></header><div class="attendance-list">${people.length?people.map(person=>`<div class="attendance-person ${isPresent(person)?'is-present':'is-absent'}"><span class="avatar">${initials(person.name)}</span><div class="attendance-person-info"><b>${esc(person.name)}</b><small>${person.skills.length?person.skills.map(esc).join(' · '):'No skills selected'}</small></div><div class="attendance-toggle" role="group" aria-label="Status for ${esc(person.name)}"><button type="button" data-attendance-team="${team}" data-attendance-person="${person.id}" data-attendance-status="present" class="${isPresent(person)?'active':''}">Present</button><button type="button" data-attendance-team="${team}" data-attendance-person="${person.id}" data-attendance-status="absent" class="${isPresent(person)?'':'active'}">Absent</button></div></div>`).join(''):'<p class="attendance-empty">No workers have been added to this team yet.</p>'}</div></article>`;
 }).join('');
 $$('[data-attendance-person]').forEach(button=>button.onclick=()=>{
  syncActiveTeam();const team=button.dataset.attendanceTeam,data=state.teamData[team]||emptyTeamData(),person=data.people.find(item=>item.id===button.dataset.attendancePerson);if(!person)return;
  person.present=button.dataset.attendanceStatus==='present';
  if(!person.present)Object.keys(data.assignments||{}).forEach(pos=>{if(data.assignments[pos]===person.id)delete data.assignments[pos]});
  if(team===state.team)applyTeamData(data);render();toast(`${person.name}: ${person.present?'Present':'Absent'}`);
 });
 $$('[data-mark-team]').forEach(button=>button.onclick=()=>{syncActiveTeam();const data=state.teamData[button.dataset.markTeam]||emptyTeamData();data.people.forEach(person=>person.present=true);if(button.dataset.markTeam===state.team)applyTeamData(data);render();toast(TEAMS[button.dataset.markTeam]+': all Present')});
 $$('[data-add-team]').forEach(button=>button.onclick=()=>{const next=button.dataset.addTeam;if(next!==state.team){syncActiveTeam();state.team=next;applyTeamData(state.teamData[next]||emptyTeamData())}render();$('#teamDialog').showModal()});
}
function skillFromText(value){
 const v=String(value||'').trim().toLowerCase().replace(/[-_]/g,' ');
 const aliases={'palletizer':'Palletizer','palletiser':'Palletizer','packer':'Packer','ap':'AP','wt':'WT','w1':'W1','w2':'W2','sc':'SC','shift coordinator':'SC','new':'NEW','stacker':'Stacker trained','stacker trained':'Stacker trained','urinal line':'Urinal lines','urinal lines':'Urinal lines'};
 return aliases[v]||null;
}
function parseExcelPeople(text){
 const rows=String(text||'').split(/\r?\n/).map(line=>line.split('\t').map(c=>c.trim())).filter(row=>row.some(Boolean));
 if(!rows.length)return [];
 if(rows.length===1&&rows[0].length>1&&rows[0].slice(1).every(c=>!skillFromText(c)))return rows[0].filter(Boolean).map(name=>({name,skills:[]}));
 const header=rows[0].map(c=>c.toLowerCase());
 const nameWords=['name','employee','worker'];
 const nameIndex=header.findIndex(c=>nameWords.includes(c));
 const skillColumns=header.map((c,i)=>({skill:skillFromText(c),i})).filter(x=>x.skill);
 const hasHeader=nameIndex>=0||skillColumns.length>0;
 const truthy=v=>['1','yes','y','x','+','✓','true','trained'].includes(String(v||'').trim().toLowerCase());
 return rows.slice(hasHeader?1:0).map(cells=>{
   const name=(cells[nameIndex>=0?nameIndex:0]||'').trim(); const skills=[];
   if(hasHeader)skillColumns.forEach(({skill,i})=>{if(truthy(cells[i]))skills.push(skill)});
   else cells.slice(1).flatMap(c=>c.split(/[,;]+/)).forEach(c=>{const skill=skillFromText(c);if(skill)skills.push(skill)});
   return {name,skills:[...new Set(skills)]};
 }).filter(p=>p.name);
}
function updateExcelPreview(){const people=parseExcelPeople($('#excelPaste').value);$('#importExcelBtn').disabled=!people.length;$('#excelHint').textContent=people.length?`Employees recognised: ${people.length}`:'Supported columns: Palletizer, Packer, AP, WT, W1, W2, SC, NEW, Stacker trained, Urinal lines'}
function updateClock(){const n=new Date();$('#clock').textContent=n.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});$('#todayLabel').textContent=n.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}).toUpperCase()}
function showView(view){const attendance=view==='workers';$('#dashboardView').classList.toggle('hidden',attendance);$('#attendanceView').classList.toggle('hidden',!attendance);$('#todayBtn').classList.toggle('nav-active',!attendance);$('#workersBtn').classList.toggle('nav-active',attendance);document.body.classList.toggle('attendance-open',attendance);if(attendance)renderAttendance();window.scrollTo({top:0,behavior:'smooth'})}
$$('.shift').forEach(b=>b.onclick=()=>{state.shift=b.dataset.shift;state.started=false;render()});
$$('[data-team]').forEach(b=>b.onclick=()=>{const next=b.dataset.team;if(next===state.team)return;syncActiveTeam();state.team=next;applyTeamData(state.teamData[next]||emptyTeamData());render();toast('Team: '+TEAMS[state.team])});
$('#startBtn').onclick=()=>{assignInitial();state.started=true;render();toast('Shift plan is ready')};
$('#addPersonBtn').onclick=()=>$('#teamDialog').showModal();
$('#todayBtn').onclick=$('#backToPlanBtn').onclick=()=>showView('today');
$('#workersBtn').onclick=()=>showView('workers');
$('#scheduleBtn').onclick=()=>{showView('today');setTimeout(()=>$('#timelineSection').scrollIntoView({behavior:'smooth'}),220)};
$$('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('#personForm').onsubmit=e=>{e.preventDefault();const name=$('#personName').value.trim();const skills=$$('#skillPicks input:checked').map(x=>x.value);state.people.push({id:'p'+Date.now(),name,skills,present:true});e.target.reset();render();toast(name+' added')};
$('#excelPaste').oninput=updateExcelPreview;
$('#importExcelBtn').onclick=()=>{const incoming=parseExcelPeople($('#excelPaste').value);let added=0,updated=0;incoming.forEach((person,i)=>{const existing=state.people.find(p=>p.name.trim().toLowerCase()===person.name.toLowerCase());if(existing){const merged=[...new Set([...existing.skills,...person.skills])];if(merged.length!==existing.skills.length){existing.skills=merged;updated++}}else{state.people.push({id:'p'+Date.now()+'-'+i,name:person.name,skills:person.skills,present:true});added++}});$('#excelPaste').value='';updateExcelPreview();render();toast(`Imported: ${added} new${updated?', '+updated+' updated':''}`)};
$('#resetBtn').onclick=()=>{const warning=cloud.active?'Reset the shared employee list and plan for ALL users?':'Reset employees and the plan to the demo version?';if(confirm(warning)){localStorage.removeItem(LOCAL_KEY);state=normalizeState(freshState());render();if(cloud.active)pushCloudState();else location.reload()}};
$('#exportBtn').onclick=async()=>{const text=$$('.event').map(e=>e.innerText.replace(/\n/g,' — ')).join('\n');await navigator.clipboard.writeText(text);toast('Plan copied')};
function printPlan(){document.body.classList.add('printing-plan');window.print()}
window.addEventListener('afterprint',()=>document.body.classList.remove('printing-plan'));
$('#printPlanBtn').onclick=printPlan;
$('#printPlanTopBtn').onclick=printPlan;
updateClock();setInterval(updateClock,15000);
const currentPositions=POSITIONS.flatMap(group=>group.items.map(item=>item[0]));
if(!Object.keys(state.assignments).length||Object.keys(state.assignments).some(pos=>!currentPositions.includes(pos)))assignInitial();
render();
initCloud();window.addEventListener('online',()=>{if(!cloud.active)initCloud()});

