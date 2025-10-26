// Ancestor Kit — Seraphine Emberwright (lean / OG look)
(function(){
  'use strict';

  // ---------- tiny util ----------
  function A(id,n){return (findObjs({_type:'attribute',_characterid:id,name:n})||[])[0]||null;}
  function get(id,n){var a=A(id,n); return a ? a.get('current') : null;}
  function set(id,n,v){var a=A(id,n); return a ? (a.set('current',v),a) : createObj('attribute',{_characterid:id,name:n,current:v});}
  function geti(id,n){var a=A(id,n); var v=a?parseInt(a.get('current'),10):NaN; return isNaN(v)?null:v;}
  function abil(id,name,action,token){var q=findObjs({_type:'ability',_characterid:id,name:name})[0];
    return q?(q.set({action:action,istokenaction:!!token}),q):createObj('ability',{_characterid:id,name:name,action:action,istokenaction:!!token});}
  function who(msg){return (msg&&msg.who)?String(msg.who).replace(/\s*\(GM\)\s*$/,''):'GM';}
  function selectedCharId(msg){try{var s=msg.selected&&msg.selected[0]; if(!s) return null; var t=getObj('graphic',s._id); return t?t.get('represents'):null;}catch(_){return null;}}

  // ---------- constants ----------
  var KIT='Seraphine', NAME='Seraphine Emberwright', SRC='Ancestor — Seraphine Emberwright';
  var HEAT='hr_seraphine_heat', CAP='hr_seraphine_heat_cap', OH='hr_seraphine_overheat_active';

  // ---------- sheet reads ----------
  function spellMod(id){
    var raw=(get(id,'spellcasting_ability')||'').toString();
    var key=null, m=/@{([^}]+)}/.exec(raw);
    if(m) key=m[1]; else {
      var t=raw.toLowerCase().replace(/[^a-z]/g,'');
      key=/^(int|intelligence)$/.test(t)?'intelligence_mod':
          /^(wis|wisdom)$/.test(t)?'wisdom_mod':
          /^(cha|charisma)$/.test(t)?'charisma_mod':null;
    }
    if(key){ var v=geti(id,key); if(v!=null) return v; }
    var dc=geti(id,'spell_save_dc'), pb=geti(id,'pb')||0;
    return dc!=null ? (dc-8-pb) : 0;
  }
  function spellAtkBonus(id){
    var fromSheet=parseInt(getAttrByName(id,'spell_attack_bonus')||'0',10)||0;
    if(fromSheet) return fromSheet;
    return (geti(id,'pb')||0)+spellMod(id);
  }

  // ---------- heat / overheat ----------
  function heat(id){var v=parseInt(get(id,HEAT)||'0',10); return isNaN(v)?0:Math.max(0,v);}
  function cap(id){var v=parseInt(get(id,CAP)||'100',10); return (!v||isNaN(v))?100:v;}
  function setHeat(id,v){set(id,HEAT,Math.max(0,Math.floor(v||0))); }
  function addHeat(id,d){setHeat(id,heat(id)+Math.floor(d||0)); }
  function setOH(id,on){set(id,OH,on?1:0);}
  function isOH(id){var v=String(get(id,OH)||'0').toLowerCase(); return (v!=='0'&&v!=='false'&&v!=='off'&&v!=='');}

  // Temp HP = max(current, value)
  function tempHpMax(id,val){
    var a=A(id,'hp_temp'), cur=parseInt(a?a.get('current'):0,10); if(isNaN(cur)) cur=0;
    var nxt=Math.max(cur,Math.max(0,Math.floor(val||0)));
    a? a.set('current',nxt) : createObj('attribute',{_characterid:id,name:'hp_temp',current:nxt});
    return nxt;
  }

  function triggerOH(id,wh){
    var thp=(geti(id,'pb')||0)+spellMod(id);
    setHeat(id,0); setOH(id,1); var after=tempHpMax(id,thp);
    sendChat('Seraphine','/w "'+(wh||'GM')+'" &{template:default} {{name=🔥 Overheat}} {{Effects=Staff +2d8 fire; reach 15 ft until your next turn. Spells +1d8 to one target. Speed −10 ft.}} {{Temp HP=**'+thp+'** (now **'+after+'**)}}');
  }
  function checkOH(id,wh){ if(heat(id)>=cap(id)){ triggerOH(id,wh); return true; } return false; }

  // ---------- cards ----------
  function attackCard(id){
    var toHit=spellAtkBonus(id), reach=isOH(id)?'melee — reach 15 ft':'melee';
    return [
      '&{template:atk}',
      '{{attack=1}}',
      '{{rname=[Emberwright’s Staff](~selected|Seraphine_Staff_Damage)}} {{rnamec=Emberwright’s Staff}}',
      '{{mod='+toHit+'}}',
      '{{r1=[[1d20 + '+toHit+']]}}',
      '{{r2=[[1d20 + '+toHit+']]}}',
      '{{range='+reach+'}}'
    ].join(' ');
  }

  function damageCard(id,isCrit){
    var sm=spellMod(id), oh=isOH(id), baseDice=isCrit?2:1;
    var out=['&{template:dmg}','{{rname=Emberwright’s Staff}}','{{range=melee}}','{{damage=1}}','{{dmg1flag=1}}','{{dmg1=[[ '+baseDice+'d8 + ('+sm+') ]]}}','{{dmg1type=bludgeoning (magical)}}'];
    if(oh){
      var fDice=isCrit?4:2;
      out.push('{{dmg2flag=1}}','{{dmg2=[[ '+fDice+'d8 ]]}}','{{dmg2type=fire (Overheat)}}');
    } else out.push('{{dmg2flag=0}}');
    return out.join(' ');
  }

  // ---------- commands ----------
  function heatCmd(msg,args){
    var w=who(msg), id=selectedCharId(msg); if(!id){sendChat('Seraphine','/w "'+w+'" Select a token.');return;}
    var v=(args[0]||'').toLowerCase(); if(!v){sendChat('Seraphine','/w "'+w+'" Heat: **'+heat(id)+'** / '+cap(id));return;}
    if(v==='show'){/*noop*/} 
    else if(v==='reset'){ setHeat(id,0); setOH(id,0); sendChat('Seraphine','/w "'+w+'" Heat reset.'); return; }
    else if(v==='+25'||v==='25'){ addHeat(id,25); checkOH(id,w); }
    else if(v==='+10'||v==='10'){ addHeat(id,10); checkOH(id,w); }
    else if(v==='add'){ var n=parseInt(args[1]||'0',10)||0; addHeat(id,n); checkOH(id,w); }
    else if(v==='set'){ var s=parseInt(args[1]||'0',10)||0; setHeat(id,s); checkOH(id,w); }
    else { sendChat('Seraphine','/w "'+w+'" Usage: !seraphine-heat [+25|+10|add N|set N|reset|show]'); return; }
    sendChat('Seraphine','/w "'+w+'" Heat: **'+heat(id)+'** / '+cap(id));
  }

  function ventCmd(msg){
    var w=who(msg), id=selectedCharId(msg); if(!id){sendChat('Seraphine','/w "'+w+'" Select a token.');return;}
    var h=heat(id), steps=Math.floor(h/25), pb=geti(id,'pb')||0, sm=spellMod(id), dc=8+pb+sm;
    setHeat(id,0);
    sendChat('Seraphine','/w "'+w+'" &{template:default} {{name=🌬️ Vent (Bonus)}} {{Save=DEX DC '+dc+' (half on success)}} {{Damage='+(steps>0?'[['+steps+'d10]] fire':'—')}}');
  }

  function ohClearCmd(msg){
    var w=who(msg), id=selectedCharId(msg); if(!id){sendChat('Seraphine','/w "'+w+'" Select a token.');return;}
    setOH(id,0); sendChat('Seraphine','/w "'+w+'" Overheat cleared.');
  }

  function staffDmgCmd(msg,args){
    var w=who(msg), id=selectedCharId(msg); if(!id){sendChat('Seraphine','/w "'+w+'" Select a token.');return;}
    var crit=0; for(var i=0;i<args.length;i++){ if(/^--?crit(=|$)/i.test(args[i])){ var n=args[i].split('=')[1]||args[i+1]; crit=parseInt(n||'0',10)||0; } }
    sendChat('Seraphine', damageCard(id, !!crit));
  }

  function staffAtkCmd(msg){
    var w=who(msg), id=selectedCharId(msg); if(!id){sendChat('Seraphine','/w "'+w+'" Select a token.');return;}
    sendChat('Seraphine', attackCard(id));
  }

  // ---------- watchers ----------
  if(typeof on==='function'){
    on('chat:message',function(msg){
      if(msg.type!=='api'||!msg.content) return;
      var p=msg.content.trim().split(/\s+/), cmd=p[0].toLowerCase(), a=p.slice(1);
      if(cmd==='!seraphine-heat') heatCmd(msg,a);
      else if(cmd==='!seraphine-vent') ventCmd(msg,a);
      else if(cmd==='!seraphine-overheat-clear') ohClearCmd(msg,a);
      else if(cmd==='!seraphine-staff-dmg') staffDmgCmd(msg,a);
      else if(cmd==='!seraphine-staff-attack') staffAtkCmd(msg,a);
    });

    // auto-clear Overheat at owner's next turn
    on('change:campaign:turnorder',function(c,prev){
      try{
        var now=c.get('turnorder'); if(!now) return;
        var cur=(JSON.parse(now)||[])[0]; if(!cur||!cur.id||cur.id==='-1') return;
        var t=getObj('graphic',cur.id); if(!t) return;
        var id=t.get('represents'); if(!id) return;
        if(!A(id,OH) || !isOH(id)) return;
        setOH(id,0);
        var label=(getObj('character',id)||t).get('name')||'';
        sendChat('Seraphine','/w GM <b>'+_.escape(label)+'</b>: Overheat ended. Reach returns to 10 ft.');
      }catch(_){}
    });

    // if Heat is hand-edited above cap, fire OH
    on('change:attribute',function(a){
      try{
        if(a.get('name')!==HEAT) return;
        var id=a.get('_characterid'); if(!id) return;
        var v=parseInt(a.get('current')||'0',10)||0;
        if(v>=cap(id) && !isOH(id)) triggerOH(id,'GM');
      }catch(_){}
    });
  }

  // ---------- token actions / handout ----------
  function overheatDetails(){
    return '&{template:default} {{name=Overheat}} {{Until next turn=Staff +2d8 fire; reach 15 ft. Spells +1d8 (one target). Speed −10 ft.}} {{Temp HP=PB + spell mod}}';
  }

  function install(char,opts){
    var id=char.id||char.get('_id');
    set(id,HEAT,0); set(id,CAP,100); set(id,OH,0);
    // damage button the attack card links to
    abil(id,'Seraphine_Staff_Damage','!seraphine-staff-dmg --char @{selected|character_id} --crit ?{Critical hit?|No,0|Yes,1}',false);

    // keep the token bar clean: only core flows
    abil(id,'Emberwright’s Staff (Attack)','!seraphine-staff-attack --char @{selected|character_id}',true);
    abil(id,'Stoke +25 (Hit/Leveled)','!seraphine-heat +25 --char @{selected|character_id}',true);
    abil(id,'Stoke +10 (Cantrip)','!seraphine-heat +10 --char @{selected|character_id}',true);
    abil(id,'Vent (Bonus)','!seraphine-vent --char @{selected|character_id}',true);

    // helpers (not token actions)
    abil(id,'Heat: Show','!seraphine-heat show --char @{selected|character_id}',false);
    abil(id,'Overheat — Clear','!seraphine-overheat-clear --char @{selected|character_id}',false);
    abil(id,'Overheat — Details', overheatDetails(), false);

    // short handout per controller (optional, concise)
    var bullet = [
      '<div style="font:13px/1.25 inherit">',
      '<h3 style="margin:0 0 6px 0">'+NAME+' — Kit</h3>',
      '<b>Staff.</b> Melee reach 10 ft (15 ft while Overheated). Use spell attack & mod.',
      '<br><b>Stoke.</b> Hit/leveled +25 Heat; cantrip +10.',
      '<br><b>Overheat 100.</b> Staff +2d8 fire & reach 15 ft; spells +1d8 (one target); speed −10; temp HP = PB + mod; Heat resets.',
      '<br><b>Vent (Bonus).</b> Drop Heat; DEX save DC (8+PB+mod): (Heat÷25)d10 fire.',
      '</div>'
    ].join('');
    var ids={}, ctrl=(char.get('controlledby')||'').split(',');
    ctrl.forEach(function(v){ v=v.trim(); if(v&&v!=='all') ids[v]=1; });
    Object.keys(ids).forEach(function(pid){
      var p=getObj('player',pid), title=NAME+' — Kit ('+(p?p.get('_displayname'):'Player')+')';
      var h=findObjs({_type:'handout',name:title})[0];
      h = h || createObj('handout',{name:title,inplayerjournals:pid,controlledby:pid});
      h.set({inplayerjournals:pid,controlledby:pid,archived:false});
      h.set('notes', bullet);
    });
  }

  function uninstall(char){ if(!char) return; set(char.id||char.get('_id'),OH,0); }

  // ---------- register with AncestorKits ----------
  var registered=false;
  function register(){
    if(registered) return true;
    if(typeof AncestorKits==='undefined'||!AncestorKits||typeof AncestorKits.register!=='function') return false;
    AncestorKits.register(KIT,{
      ancestor:NAME, prefix:KIT, sourceCharName:SRC, sourceCharacterName:SRC,
      abilities:[
        {name:'Emberwright’s Staff (Attack)', action:'!seraphine-staff-attack --char @{selected|character_id}', tokenAction:true},
        {name:'Stoke +25 (Hit/Leveled)',      action:'!seraphine-heat +25 --char @{selected|character_id}', tokenAction:true},
        {name:'Stoke +10 (Cantrip)',          action:'!seraphine-heat +10 --char @{selected|character_id}', tokenAction:true},
        {name:'Vent (Bonus)',                  action:'!seraphine-vent --char @{selected|character_id}', tokenAction:true},

        {name:'Heat: Show',                    action:'!seraphine-heat show --char @{selected|character_id}', tokenAction:false},
        {name:'Overheat — Clear',              action:'!seraphine-overheat-clear --char @{selected|character_id}', tokenAction:false},
        {name:'Overheat — Details',            action:overheatDetails(), tokenAction:false}
      ],
      onInstall:install,
      onUninstall:uninstall
    });
    registered=true; return true;
  }
  if(!register() && typeof on==='function'){
    on('ready',function(){ register() || sendChat('Seraphine','/w GM Seraphine kit: AncestorKits.register unavailable.'); });
  }
})();
