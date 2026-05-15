/* ===== FIREBASE CONFIG ===== */
const fbConf={apiKey:"AIzaSyBEiKDARJMM8VPbFrLJBzEC7c2paw2HGUQ",authDomain:"timebomb3-572e0.firebaseapp.com",databaseURL:"https://timebomb3-572e0-default-rtdb.europe-west1.firebasedatabase.app",projectId:"timebomb3-572e0",storageBucket: "timebomb3-572e0.firebasestorage.app", messagingSenderId: "57545585120", appId: "1:57545585120:web:a13c7c67f4da27f0fefb85" };
if(!firebase.apps.length)firebase.initializeApp(fbConf);
const db=firebase.database();const auth=firebase.auth();const storage=firebase.storage();

const GAME_CATS=["Ambiance","Cartes","Bluff","Stratégie","Duo","Coop","Dessin","Mimes","Mots","Rapidité","Enfants","Plateau","Réflexion"];
const QUIZ_CATS=["Culture","Jeux Vidéo","Cinéma","Musique","Anime/Manga","Sport","Histoire","Géographie","Sciences"];

const BADGES=[
  {id:'b1',name:'Novice',desc:'Jouer 1 partie ou quiz',check:s=>((s.gamesPlayed||0)+(s.quizzesPlayed||0))>=1,icon:'🌱'},
  {id:'b2',name:'Habitué',desc:'Jouer 10 parties ou quiz',check:s=>((s.gamesPlayed||0)+(s.quizzesPlayed||0))>=10,icon:'🎮'},
  {id:'b3',name:'Vétéran',desc:'Jouer 100 parties au total',check:s=>((s.gamesPlayed||0)+(s.quizzesPlayed||0))>=100,icon:'⚔️'},
  {id:'b4',name:'Curieux',desc:'Faire 10 quiz',check:s=>(s.quizzesPlayed||0)>=10,icon:'🧠'},
  {id:'b5',name:'Sociable',desc:'Avoir 10 amis',check:s=>(s.friendsCount||0)>=10,icon:'🤝'},
  {id:'b6',name:'Critique',desc:'Mettre 10 notes',check:s=>(s.ratingsCount||0)>=10,icon:'⭐'},
  {id:'b7',name:'Bavard',desc:'Écrire 10 commentaires',check:s=>(s.commentsCount||0)>=10,icon:'💬'},
  {id:'b8',name:'Inventif',desc:'Faire une suggestion',check:s=>(s.suggestionsCount||0)>=1,icon:'💡'},
  {id:'b9',name:'Apprenti',desc:'Atteindre le niveau 10',check:(s,lvl)=>lvl>=10,icon:'🎖️'},
  {id:'b10',name:'Maître',desc:'Atteindre le niveau 20',check:(s,lvl)=>lvl>=20,icon:'👑'}
];

/* ===== DAILY QUESTS LOGIC ===== */
function getQuestRewardBase(type) {
    let bases = portalState.config.questRewards || {play: 10, win: 30, chat: 2};
    return bases[type] || 10;
}

const ALL_QUESTS = (function(){
   let q = []; let id=1;
   let types = ['play', 'win', 'chat'];
   let diffs = [{d:'easy', m:1}, {d:'medium', m:2}, {d:'hard', m:4}];
   for(let t of types) {
       for(let diff of diffs) {
           for(let i=1; i<=6; i++) {
               let tgt = (t==='play'?3:t==='win'?1:5) * diff.m * i;
               let desc = t==='play'?`Jouer ${tgt} parties`:t==='win'?`Gagner ${tgt} parties`:`Envoyer ${tgt} messages`;
               q.push({id: 'q'+id++, type: t, target: tgt, desc: desc, diff: diff.d, rewardMult: tgt});
           }
       }
   }
   return q;
})();

function checkDailyQuestsInit(uD) {
    let today = new Date().toISOString().split('T')[0];
    let userRef = db.ref('portal_users/' + portalState.currentUser.uid + '/quests');
    if (!uD.quests || uD.quests.date !== today) {
        let easy = ALL_QUESTS.filter(q=>q.diff==='easy');
        let med = ALL_QUESTS.filter(q=>q.diff==='medium');
        let hard = ALL_QUESTS.filter(q=>q.diff==='hard');
        let selected = [
            easy[Math.floor(Math.random()*easy.length)],
            med[Math.floor(Math.random()*med.length)],
            hard[Math.floor(Math.random()*hard.length)]
        ].map(q => ({...q, progress: 0, claimed: false}));

        userRef.set({ date: today, list: selected });
        return selected;
    }
    return uD.quests.list;
}

function updateQuestProgress(actionType, amount=1) {
    if(!portalState.currentUser) return;
    let uD = portalState.usersList[portalState.currentUser.uid];
    if(!uD || !uD.quests || !uD.quests.list) return;
    let updated = false;
    let list = uD.quests.list;
    list.forEach((q) => {
        if (q.type === actionType && q.progress < q.target) {
            q.progress = Math.min(q.target, q.progress + amount);
            updated = true;
            if (q.progress >= q.target && !q.claimed) {
                q.claimed = true;
                let actualReward = q.rewardMult * getQuestRewardBase(q.type);
                addBZ(actualReward, `Quête accomplie : ${q.desc} !`);
            }
        }
    });
    if (updated) {
        db.ref('portal_users/' + portalState.currentUser.uid + '/quests/list').set(list);
        renderQuests(list);
    }
}

function renderQuests(list) {
    let qBox = document.getElementById('daily-quests-list');
    if(!qBox) return;
    if(!list || list.length === 0) { qBox.innerHTML = '<div style="opacity:0.5;font-size:0.8rem;">Aucune quête en cours.</div>'; return; }
    qBox.innerHTML = list.map(q => {
        let pct = Math.min(100, (q.progress / q.target) * 100);
        let color = q.claimed ? 'var(--green)' : 'var(--accent)';
        let actualReward = q.rewardMult * getQuestRewardBase(q.type);
        return `<div style="background:var(--panel-bg); border:1px solid var(--panel-border); border-radius:6px; padding:8px; font-size:0.8rem;">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="font-weight:700; color:${q.claimed?'var(--green)':'var(--text-main)'}">${q.desc}</span>
                <span style="color:var(--amber); font-weight:800;">🪙 ${actualReward}</span>
            </div>
            <div style="width:100%; height:6px; background:var(--input-bg); border-radius:3px; overflow:hidden;">
                <div style="width:${pct}%; height:100%; background:${color}; transition:width 0.3s;"></div>
            </div>
            <div style="text-align:right; font-size:0.65rem; color:var(--text-muted); margin-top:2px;">${q.progress} / ${q.target}</div>
        </div>`;
    }).join('');
}

let portalState={currentUser:null,role:'guest',games:[],quiz:[],presence:{},ratings:{},comments:{},usersList:{},mutedUsers:{},customAvatars:{},shopTitles:{},shopBonuses:{},config:{questRewards:{play:10,win:30,chat:2}},currentTab:'games',addingType:'games',editingItemId:null,currentLobbyId:null,lobbyChatRef:null,unreadLobbyCount:0,lastRematchToken:null,activeLobbies:{portal:{},quiz:{}},settings:{theme:'dark',sound:true,notifs:false,favs:{}},unreadGlobal:false,lastChatViewTime:Date.now()};
let currentProfileUid=null,currentPmId=null,currentLobbyRef=null;
window.currentLbScope='global';window.currentLbMetric='games';window.currentLbGameId=null;window.portalState=portalState;

if(localStorage.getItem('portal_favs'))portalState.settings.favs=JSON.parse(localStorage.getItem('portal_favs'));
if(localStorage.getItem('portal_theme')==='light'){toggleTheme();}
if(localStorage.getItem('portal_offline_games'))portalState.games=JSON.parse(localStorage.getItem('portal_offline_games'));

/* ===== TOAST SYSTEM ===== */
function showToast(msg, type='info', duration=2500) {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = {success:'✅', error:'❌', info:'ℹ️'};
  t.innerHTML = `${icons[type]||'ℹ️'} ${msg}`;
  c.appendChild(t);
  setTimeout(() => {
    t.style.animation = 'toastOut 0.3s forwards';
    setTimeout(() => t.remove(), 300);
  }, duration);
}

/* ===== PRESENCE & ACTIVITY ===== */
let lastAct=Date.now(),isOnlineStatus=true;
['click','touchstart','mousemove','keydown'].forEach(e=>window.addEventListener(e,()=>{lastAct=Date.now();if(portalState.currentUser&&!isOnlineStatus){isOnlineStatus=true;db.ref('portal_users/'+portalState.currentUser.uid).update({online:true});}}));
setInterval(()=>{if(portalState.currentUser&&isOnlineStatus&&(Date.now()-lastAct>300000)){isOnlineStatus=false;db.ref('portal_users/'+portalState.currentUser.uid).update({online:false});}},30000);

/* ===== AVATAR RENDER (HD ET TAILLE AJUSTABLE) ===== */
function renderAva(a, size='24px') {
  let isUrl = a && (a.startsWith('http') || a.startsWith('data:image'));
  if (isUrl) {
    return `<img src="${a}" loading="lazy" style="width:${size}; height:${size}; min-width:${size}; min-height:${size}; border-radius:50%; object-fit:cover; vertical-align:middle; display:inline-block; box-shadow:0 2px 5px rgba(0,0,0,0.3); border:1px solid var(--panel-border); transform: translateZ(0); image-rendering: crisp-edges; -webkit-font-smoothing: subpixel-antialiased;">`;
  } else {
    return a || '👤';
  }
}

/* ===== ON LOAD ===== */
window.onload=()=>{
  if(!navigator.onLine&&portalState.games.length>0){showToast('Mode hors-ligne','info');document.getElementById('bottom-nav').classList.add('active');switchTab('games');}
  else{switchScreen('login-container');}
  updateCategoryCheckboxes('games');
  updateSettingsToggles();

  db.ref('portal_games_list').on('value',s=>{let v=s.val();portalState.games=v?(Array.isArray(v)?v:Object.values(v)).filter(x=>x!==null&&typeof x==='object'):[];localStorage.setItem('portal_offline_games',JSON.stringify(portalState.games));if(portalState.currentTab==='games')renderGrid('games');});
  db.ref('portal_quiz_list').on('value',s=>{let v=s.val();portalState.quiz=v?(Array.isArray(v)?v:Object.values(v)).filter(x=>x!==null&&typeof x==='object'):[];if(portalState.currentTab==='quiz')renderGrid('quiz');});
  db.ref('portal_presence').on('value',s=>{portalState.presence=s.exists()?s.val():{};if(portalState.currentTab==='games')renderGrid('games');});
  db.ref('portal_ratings').on('value',s=>{portalState.ratings=s.exists()?s.val():{};if(portalState.currentTab==='games'||portalState.currentTab==='quiz')renderGrid(portalState.currentTab);});
  db.ref('portal_comments').on('value',s=>{portalState.comments=s.exists()?s.val():{};});
  db.ref('portal_muted_users').on('value',s=>{portalState.mutedUsers=s.exists()?s.val():{};});
  db.ref('portal_users').on('value',s=>{if(s.exists()){portalState.usersList=s.val();renderFriendsList();renderInboxAndHistory();updateProfileUI();updateOnlineFriendsCount();}});

  db.ref('portal_config').on('value', s => { 
      portalState.config = Object.assign({questRewards:{play:10,win:30,chat:2}}, s.val() || {}); 
      if(portalState.currentUser) {
          let uD = portalState.usersList[portalState.currentUser.uid];
          if(uD && uD.quests) renderQuests(uD.quests.list);
      }
      if(document.getElementById('admin-quests-modal').style.display==='flex') {
          document.getElementById('admin-q-play').value = portalState.config.questRewards.play || 10;
          document.getElementById('admin-q-win').value = portalState.config.questRewards.win || 30;
          document.getElementById('admin-q-chat').value = portalState.config.questRewards.chat || 2;
      }
  });
  
  db.ref('portal_custom_avatars').on('value', s => { portalState.customAvatars = s.val() || {}; if(document.getElementById('shop-modal').style.display==='flex') renderShop(); if(document.getElementById('admin-shop-modal').style.display==='flex') renderAdminAvatars(); });
  db.ref('portal_shop_titles').on('value', s => { portalState.shopTitles = s.val() || {}; if(document.getElementById('shop-modal').style.display==='flex') renderShop(); if(document.getElementById('admin-shop-modal').style.display==='flex') renderAdminTitles(); });
  db.ref('portal_shop_bonuses').on('value', s => {
      let b = s.val();
      if(!b) { 
          b = {
              'doubxp_2h': { id:'doubxp_2h', name:'Double XP 2h', desc:'×2 XP pendant 2 heures', icon:'⚡', type:'doubxp', duration:7200000, price:150, color:'#f59e0b' },
              'doubxp_24h': { id:'doubxp_24h', name:'Double XP 24h', desc:'×2 XP pendant 24 heures', icon:'🌟', type:'doubxp', duration:86400000, price:500, color:'#a855f7' }
          };
          db.ref('portal_shop_bonuses').set(b);
      }
      portalState.shopBonuses = b;
      if(document.getElementById('shop-modal').style.display==='flex') renderShop();
      if(document.getElementById('admin-shop-modal').style.display==='flex') renderAdminBonuses();
  });

  db.ref('global_chat').on('value',s=>{
    let b=document.getElementById('global-chat-messages');b.innerHTML='';if(!s.exists())return;
    let now=Date.now();
    s.forEach(c=>{
      let m=c.val();if(now-m.time>86400000){db.ref('global_chat/'+c.key).remove();return;}
      let isMe=(portalState.currentUser&&m.uid===portalState.currentUser.uid);
      let delBtn=(isMe||portalState.role==='admin')?`<span style="cursor:pointer;margin-left:8px;opacity:0.5;font-size:0.8rem;" onclick="deleteMsg('${c.key}')">✕</span>`:'';
      let muteBtn=(portalState.role==='admin'&&!isMe)?`<span style="cursor:pointer;margin-left:6px;font-size:0.8rem;opacity:0.5;" title="Mute" onclick="muteUser('${m.uid}','${m.name}')">🔇</span>`:'';
      let uD=portalState.usersList[m.uid]||{};let dot=uD.online?'🟢':'🔴';let uLvl=uD.level||1;
      let el=document.createElement('div');el.className=`chat-msg ${isMe?'me':''}`;
      el.innerHTML=`<div class="chat-header"><span class="chat-avatar-link" onclick="openProfile('${m.uid}')">${renderAva(m.avatar,'16px')} ${m.name} <span style="opacity:0.6;font-size:0.6rem;">Niv.${uLvl}</span> ${dot}</span><div>${muteBtn}${delBtn}</div></div><div>${m.text}</div>`;
      b.appendChild(el);
      if(!isMe&&m.time>portalState.lastChatViewTime&&portalState.currentTab!=='chat'){portalState.unreadGlobal=true;updateNavBadges();}
    });
    b.scrollTop=b.scrollHeight;
  });

  db.ref('portal_lobbies').on('value',s=>{portalState.activeLobbies.portal=s.val()||{};renderLobbiesUI();});
  db.ref('quiz_emoji_rooms').on('value',s=>{
    let q=s.val()||{};let mapped={};
    Object.keys(q).forEach(k=>{let gId=q[k].gameId||(portalState.quiz.length>0?portalState.quiz[0].id:'quiz_emoji');mapped[k]={host:q[k].host,hostName:q[k].players&&q[k].players[q[k].host]?q[k].players[q[k].host].name:"Hôte",gameId:gId,gameTitle:'Quiz Emojis',players:q[k].players||{},status:q[k].status,createdAt:q[k].createdAt||Date.now(),rematchToken:q[k].rematchToken||null,isQuiz:true};});
    portalState.activeLobbies.quiz=mapped;renderLobbiesUI();
  });

  auth.onAuthStateChanged(u=>{
    if(u){let adm=(u.email==="nassim57132@gmail.com");setupUserSession({uid:u.uid,name:adm?'Nassim':(u.displayName||'Joueur'),avatar:adm?'👑':'👽',role:adm?'admin':'guest'});}
  });

    window.addEventListener('message', (e) => { 
        if(!e.data || !portalState.currentUser) return;
        let uidMatch = !e.data.uid || e.data.uid === portalState.currentUser.uid;

        if(e.data.type === 'game_win' && uidMatch) { 
            addXP(50); 
            updateQuestProgress('win', 1);
            let gId = portalState.pendingLaunchId || portalState.activeItemId;
            if(gId) {
                db.ref(`portal_users/${portalState.currentUser.uid}/stats/wins`).transaction(c=>(c||0)+1).catch(err=>{});
                db.ref(`portal_users/${portalState.currentUser.uid}/gameWins/${gId}`).transaction(c=>(c||0)+1).catch(err=>{});
            }
            if(portalState.currentLobbyId && !portalState.arenaMode && portalState.arenaStake===0){
              addBZ(15,'Victoire en salon normal ! 🏆');
            }
        }

        if((e.data.type === 'game_win' || e.data.type === 'game_end') && uidMatch) {
            if(portalState.currentLobbyId && !window.rematchOverlayTimer) {
                window.rematchOverlayTimer = setTimeout(() => {
                    if(!portalState.currentLobbyId) return; 
                    let lData = portalState.activeLobbies.portal[portalState.currentLobbyId] || portalState.activeLobbies.quiz[portalState.currentLobbyId];
                    if(lData && lData.arenaStake && lData.arenaStake > 0){
                      resolveArena(lData, e.data.type === 'game_win');
                    }
                    window.rematchOverlayTimer = null;
                }, 2000); 
            }
        } 
    });

    initFloatingChatDraggable();
};

/* ===== AGORA VOCAL ===== */
const AGORA_APP_ID = "538dbd1e58934df0af52144de0c6ccbc";
let rtcClient = null;
let localAudioTrack = null;
let isVoiceConnected = false;

try {
    rtcClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    rtcClient.on("user-published", async (user, mediaType) => {
        await rtcClient.subscribe(user, mediaType);
        if (mediaType === "audio") {
            user.audioTrack.play();
        }
    });
    rtcClient.on("user-unpublished", (user, mediaType) => {
        if(mediaType === "audio" && user.audioTrack) user.audioTrack.stop();
    });
} catch(e){ console.log("Agora SDK error", e); }

async function toggleVoice() {
    let btn = document.getElementById('btn-voice');
    if (!isVoiceConnected) {
        try {
            btn.innerText = "⏳ Connexion...";
            let channelName = portalState.currentLobbyId; 
            if(!channelName) {
                btn.innerText = "🎙️ VOCAL";
                showToast("Vous n'êtes pas dans un salon !", "error");
                return;
            }
            
            // Passer null comme UID permet à Agora de générer un ID numérique correct
            await rtcClient.join(AGORA_APP_ID, channelName, null, null);
            localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
            await rtcClient.publish([localAudioTrack]);
            
            isVoiceConnected = true;
            btn.innerText = "🔊 QUITTER VOCAL";
            btn.style.borderColor = "var(--green)";
            btn.style.color = "white";
            btn.style.background = "rgba(16,185,129,0.85)";
            showToast("Vocal activé !", "success");
        } catch (error) {
            console.error("Agora Error:", error);
            btn.innerText = "🎙️ VOCAL";
            btn.style.background = "rgba(245,158,11,0.85)";
            showToast("Erreur micro", "error");
            
            if (localAudioTrack) { localAudioTrack.close(); localAudioTrack = null; }
            rtcClient.leave();
            isVoiceConnected = false;
        }
    } else {
        if (localAudioTrack) {
            localAudioTrack.close();
            localAudioTrack = null;
        }
        await rtcClient.leave();
        isVoiceConnected = false;
        btn.innerText = "🎙️ VOCAL";
        btn.style.borderColor = "rgba(255,255,255,0.2)";
        btn.style.background = "rgba(245,158,11,0.85)";
        btn.style.color = "white";
        showToast("Vocal désactivé", "info");
    }
}

/* ===== DRAGGABLE CHAT LOGIC ===== */
function initFloatingChatDraggable() {
  const toggle = document.getElementById('chat-lobby-toggle');
  if(!toggle) return;
  let isDragging = false, startX, startY, startLeft, startTop;

  const onStart = (e) => {
    isDragging = true;
    const ev = e.type === 'touchstart' ? e.touches[0] : e;
    startX = ev.clientX; startY = ev.clientY;
    startLeft = toggle.offsetLeft; startTop = toggle.offsetTop;
    toggle.style.transition = 'none';
  };

  const onMove = (e) => {
    if (!isDragging) return;
    const ev = e.type === 'touchmove' ? e.touches[0] : e;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    toggle.style.left = `${startLeft + dx}px`;
    toggle.style.top = `${startTop + dy}px`;
    toggle.style.right = 'auto'; toggle.style.bottom = 'auto';
  };

  const onEnd = () => {
    if(!isDragging) return;
    isDragging = false;
    toggle.style.transition = 'all 0.3s';
    const rect = toggle.getBoundingClientRect();
    if (rect.left < 0) toggle.style.left = '10px';
    if (rect.right > window.innerWidth) toggle.style.left = `${window.innerWidth - 66}px`;
    if (rect.top < 0) toggle.style.top = '10px';
    if (rect.bottom > window.innerHeight) toggle.style.top = `${window.innerHeight - 80}px`;
  };

  toggle.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);
  toggle.addEventListener('touchstart', onStart, {passive:false});
  window.addEventListener('touchmove', onMove, {passive:false});
  window.addEventListener('touchend', onEnd);

  toggle.onclick = () => {
    if (Math.abs(toggle.offsetLeft - startLeft) < 5 && Math.abs(toggle.offsetTop - startTop) < 5) {
      toggleLobbyChat();
    }
  };
}

/* ===== LOBBY CHAT LOGIC ===== */
function toggleLobbyChat() {
  const win = document.getElementById('chat-lobby-window');
  const isHidden = win.style.display === 'none' || win.style.display === '';
  win.style.display = isHidden ? 'flex' : 'none';
  if (isHidden) {
    portalState.unreadLobbyCount = 0;
    updateLobbyChatBadge();
    const box = document.getElementById('chat-lobby-messages');
    box.scrollTop = box.scrollHeight;
  }
}

function toggleLobbyChatFull() {
  const win = document.getElementById('chat-lobby-window');
  win.classList.toggle('fullscreen');
}

function listenToLobbyChat(lId) {
  if (portalState.lobbyChatRef) portalState.lobbyChatRef.off();
  document.getElementById('chat-lobby-toggle').style.display = 'flex';
  const box = document.getElementById('chat-lobby-messages');
  box.innerHTML = '';
  
  portalState.lobbyChatRef = db.ref('lobby_chats/' + lId);
  portalState.lobbyChatRef.on('child_added', s => {
    const m = s.val();
    const isMe = m.uid === portalState.currentUser.uid;
    const el = document.createElement('div');
    el.className = `chat-msg ${isMe ? 'me' : ''}`;
    el.style.fontSize = '0.75rem';
    el.style.maxWidth = '90%';
    el.innerHTML = `<div style="font-size:0.6rem; opacity:0.7; margin-bottom:2px;">${renderAva(m.avatar, '12px')} ${m.name}</div>${m.text}`;
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;

    if (!isMe && document.getElementById('chat-lobby-window').style.display !== 'flex') {
      portalState.unreadLobbyCount++;
      updateLobbyChatBadge();
    }
  });
}

function updateLobbyChatBadge() {
  const b = document.getElementById('chat-lobby-badge');
  if (portalState.unreadLobbyCount > 0) {
    b.innerText = portalState.unreadLobbyCount;
    b.style.display = 'flex';
  } else {
    b.style.display = 'none';
  }
}

function sendLobbyChatMessage() {
  const inp = document.getElementById('chat-lobby-input');
  const val = inp.value.trim();
  if (val && portalState.currentLobbyId) {
    db.ref('lobby_chats/' + portalState.currentLobbyId).push({
      uid: portalState.currentUser.uid,
      name: portalState.currentUser.name,
      avatar: portalState.currentUser.avatar,
      text: val,
      time: Date.now()
    });
    inp.value = '';
    updateQuestProgress('chat', 1);
  }
}


/* ===== SETTINGS TOGGLES ===== */
function updateSettingsToggles() {
  const isDark = !document.body.classList.contains('light-mode');
  const sw = document.getElementById('theme-toggle-sw');
  if(sw) { sw.classList.toggle('on', isDark); }
}

/* ===== ADMIN ===== */
window.muteUser=function(uid,name){
  if(confirm(`Bloquer ${name} du tchat ?`)){db.ref('portal_muted_users/'+uid).set(true);showToast(name+' est maintenant muté','success');}
};

window.openDashboard=function(){
  let tot=0,onl=0,d24=0,d7=0,gamesCount={};let now=Date.now();
  Object.values(portalState.usersList).forEach(u=>{tot++;if(u.online)onl++;if(u.lastLogin){let diff=now-u.lastLogin;if(diff<86400000)d24++;if(diff<86400000*7)d7++;}if(u.playedGames)Object.keys(u.playedGames).forEach(g=>{gamesCount[g]=(gamesCount[g]||0)+u.playedGames[g];});});
  document.getElementById('dash-tot').innerText=tot;document.getElementById('dash-onl').innerText=onl;document.getElementById('dash-24h').innerText=d24;document.getElementById('dash-7d').innerText=d7;
  let topHtml=Object.keys(gamesCount).sort((a,b)=>gamesCount[b]-gamesCount[a]).slice(0,5).map(k=>{let g=[...(portalState.games||[]),...(portalState.quiz||[])].find(x=>x.id===k);return`<div class="leader-item"><span>🎮 ${g?g.title:'Inconnu'}</span><b style="color:var(--accent);">${gamesCount[k]} parties</b></div>`;}).join('');
  document.getElementById('dash-top-games').innerHTML=topHtml||"<div style='opacity:0.5;font-size:0.8rem;'>Pas assez de données.</div>";
  document.getElementById('admin-dash-modal').style.display='flex';
};

/* ===== NOUVELLES FONCTIONS ADMIN BOUTIQUE ===== */
window.openAdminShop = function() {
    switchAdmShopTab('avatars');
    document.getElementById('admin-shop-modal').style.display='flex';
};

window.switchAdmShopTab = function(tab) {
    document.getElementById('adm-tab-avatars').classList.toggle('active', tab === 'avatars');
    document.getElementById('adm-tab-titles').classList.toggle('active', tab === 'titles');
    document.getElementById('adm-tab-bonuses').classList.toggle('active', tab === 'bonuses');
    
    document.getElementById('adm-sec-avatars').style.display = tab === 'avatars' ? 'block' : 'none';
    document.getElementById('adm-sec-titles').style.display = tab === 'titles' ? 'block' : 'none';
    document.getElementById('adm-sec-bonuses').style.display = tab === 'bonuses' ? 'block' : 'none';
    
    if(tab==='avatars') renderAdminAvatars();
    if(tab==='titles') renderAdminTitles();
    if(tab==='bonuses') renderAdminBonuses();
};

window.addCustomAvatar = function() {
    let n = document.getElementById('admin-ava-name').value.trim();
    let u = document.getElementById('admin-ava-url').value.trim();
    let p = parseInt(document.getElementById('admin-ava-price').value);
    
    if(!n || !u || isNaN(p)) return showToast('Veuillez remplir le nom, l\'URL et le prix !', 'error');
    
    db.ref('portal_custom_avatars').push({
        name: n,
        url: u,
        price: p,
        type: 'custom_avatar'
    });

    document.getElementById('admin-ava-name').value='';
    document.getElementById('admin-ava-url').value='';
    document.getElementById('admin-ava-price').value='100';
    showToast('Avatar ajouté avec succès !', 'success');
};

window.addCustomTitle = function() {
    let n = document.getElementById('admin-title-name').value.trim();
    let c = document.getElementById('admin-title-color').value.trim();
    let p = parseInt(document.getElementById('admin-title-price').value);
    
    if(!n || isNaN(p)) return showToast('Remplissez tous les champs !', 'error');
    
    db.ref('portal_shop_titles').push({
        name: n, value: n, desc: 'Titre sous le pseudo', icon: '🏷️', type: 'title', price: p, color: c
    });
    
    document.getElementById('admin-title-name').value='';
    document.getElementById('admin-title-price').value='400';
    showToast('Titre ajouté !', 'success');
};

function renderAdminAvatars() {
    let list = document.getElementById('admin-avatars-list');
    let keys = Object.keys(portalState.customAvatars || {});
    if(keys.length === 0) return list.innerHTML = '<div style="opacity:0.5; font-size:0.8rem;">Aucun avatar créé.</div>';
    list.innerHTML = keys.map(k => {
        let a = portalState.customAvatars[k];
        return `<div class="quest-box" style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:10px;">${renderAva(a.url, '40px')}
                <div><div style="font-weight:800; font-size:0.85rem;">${a.name}</div><div style="font-size:0.7rem; color:var(--amber);">🪙 ${a.price} BZ</div></div>
            </div>
            <button class="portal-btn btn-cancel" style="width:auto; padding:5px 10px; margin:0; font-size:0.7rem;" onclick="deleteShopItem('portal_custom_avatars','${k}')">🗑️</button>
        </div>`;
    }).join('');
}

function renderAdminTitles() {
    let list = document.getElementById('admin-titles-list');
    let keys = Object.keys(portalState.shopTitles || {});
    if(keys.length === 0) return list.innerHTML = '<div style="opacity:0.5; font-size:0.8rem;">Aucun titre créé.</div>';
    list.innerHTML = keys.map(k => {
        let t = portalState.shopTitles[k];
        return `<div class="quest-box" style="display:flex; justify-content:space-between; align-items:center;">
            <div><div style="font-weight:800; font-size:0.85rem; color:${t.color};">${t.name}</div><div style="font-size:0.7rem; color:var(--amber);">🪙 ${t.price} BZ</div></div>
            <button class="portal-btn btn-cancel" style="width:auto; padding:5px 10px; margin:0; font-size:0.7rem;" onclick="deleteShopItem('portal_shop_titles','${k}')">🗑️</button>
        </div>`;
    }).join('');
}

function renderAdminBonuses() {
    let list = document.getElementById('admin-bonuses-list');
    let keys = Object.keys(portalState.shopBonuses || {});
    list.innerHTML = keys.map(k => {
        let b = portalState.shopBonuses[k];
        return `<div class="quest-box" style="display:flex; justify-content:space-between; align-items:center;">
            <div><div style="font-weight:800; font-size:0.85rem; color:${b.color};">${b.icon} ${b.name}</div><div style="font-size:0.7rem; color:var(--amber);">🪙 ${b.price} BZ</div></div>
            <button class="portal-btn btn-admin" style="width:auto; padding:5px 10px; margin:0; font-size:0.7rem;" onclick="updateBonusPrice('${k}')">✏️ PRIX</button>
        </div>`;
    }).join('');
}

window.deleteShopItem = function(node, id) {
    if(confirm('Supprimer cet élément de la boutique ? (Les joueurs le possédant le garderont)')) {
        db.ref(node + '/' + id).remove();
        showToast('Élément supprimé', 'success');
    }
};

window.updateBonusPrice = function(id) {
    let newPrice = prompt("Nouveau prix (BZ) :");
    if(newPrice && !isNaN(newPrice)) {
        db.ref('portal_shop_bonuses/' + id + '/price').set(parseInt(newPrice));
        showToast('Prix mis à jour !', 'success');
    }
};

/* ===== NOUVELLES FONCTIONS ADMIN QUÊTES ===== */
window.openAdminQuests = function() {
    document.getElementById('admin-q-play').value = portalState.config.questRewards?.play || 10;
    document.getElementById('admin-q-win').value = portalState.config.questRewards?.win || 30;
    document.getElementById('admin-q-chat').value = portalState.config.questRewards?.chat || 2;
    document.getElementById('admin-quests-modal').style.display='flex';
};

window.saveQuestRewards = function() {
    let p = parseInt(document.getElementById('admin-q-play').value);
    let w = parseInt(document.getElementById('admin-q-win').value);
    let c = parseInt(document.getElementById('admin-q-chat').value);
    
    if(isNaN(p) || isNaN(w) || isNaN(c)) return showToast('Veuillez entrer des nombres valides', 'error');
    
    db.ref('portal_config/questRewards').set({ play: p, win: w, chat: c });
    showToast('Gains sauvegardés !', 'success');
};


/* ===== XP ===== */
function addXP(amount){
  if(!portalState.currentUser)return;
  let uRef=db.ref('portal_users/'+portalState.currentUser.uid);
  uRef.once('value',s=>{
    let d=s.val()||{};let xp=(d.xp||0)+amount;let lvl=d.level||1;let next=lvl*100;
    let levelsGained=0;
    while(xp>=next){lvl++;levelsGained++;next=lvl*100;}
    uRef.update({xp,level:lvl});
    if(levelsGained>0){
      showToast(`🎉 Niveau ${lvl} atteint !`,'success',3000);
      let bzBonus=Math.min(200+((lvl-2)*50),1000);
      addBZ(bzBonus,`Passage au niveau ${lvl} !`);
    }
  });
}

/* ===== BZ CURRENCY ===== */
function addBZ(amount, reason){
  if(!portalState.currentUser||amount<=0)return;
  let uRef=db.ref('portal_users/'+portalState.currentUser.uid+'/bz');
  uRef.transaction(cur=>(cur||0)+amount).then(()=>{
    showToast(`🪙 +${amount} BZ (${reason})`,'success',3500);
    updateBZDisplay();
  }).catch(()=>{});
}
function removeBZ(amount, callback){
  if(!portalState.currentUser)return;
  if(portalState.role === 'admin') { if(callback)callback(true); return; }
  let uRef=db.ref('portal_users/'+portalState.currentUser.uid+'/bz');
  uRef.transaction(cur=>{
    if((cur||0)<amount)return;
    return (cur||0)-amount;
  }).then(res=>{
    if(res.committed){updateBZDisplay();if(callback)callback(true);}
    else{if(callback)callback(false);}
  }).catch(()=>{if(callback)callback(false);});
}
function getBZ(callback){
  if(!portalState.currentUser){callback(0);return;}
  if(portalState.role === 'admin'){callback(999999);return;}
  db.ref('portal_users/'+portalState.currentUser.uid+'/bz').once('value',s=>callback(s.val()||0));
}
function updateBZDisplay(){
  if(!portalState.currentUser)return;
  if(portalState.role === 'admin') {
    let disp=document.getElementById('prof-bz-display'); if(disp)disp.innerHTML=`🪙 ∞ BZ`;
    let shopDisp=document.getElementById('shop-balance-display'); if(shopDisp)shopDisp.innerHTML=`🪙 ∞ BZ`;
    let arenaDisp=document.getElementById('arena-my-balance'); if(arenaDisp)arenaDisp.innerHTML=`🪙 ∞ BZ`;
    return;
  }
  getBZ(bz=>{
    let disp=document.getElementById('prof-bz-display');
    if(disp)disp.innerHTML=`🪙 ${bz} BZ`;
    let shopDisp=document.getElementById('shop-balance-display');
    if(shopDisp)shopDisp.innerHTML=`🪙 ${bz} BZ`;
    let arenaDisp=document.getElementById('arena-my-balance');
    if(arenaDisp)arenaDisp.innerHTML=`🪙 ${bz} BZ`;
  });
}

/* ===== DAILY BONUS ===== */
const DAILY_REWARDS=[10,20,30,40,50,50,50];
function checkDailyBonus(forceOpen=false){
  if(!portalState.currentUser)return;
  db.ref('portal_users/'+portalState.currentUser.uid+'/daily').once('value',s=>{
    let d=s.val()||{};
    let now=Date.now();
    let lastClaim=d.lastClaim||0;
    let streak=d.streak||0;
    let msDay=86400000;
    let diff=now-lastClaim;
    let canClaim=(diff>=msDay);
    let missed=(diff>=msDay*2)&&lastClaim>0;
    if(missed)streak=0;
    if(canClaim||forceOpen){
      let dayIdx=Math.min(streak,6);
      let reward=DAILY_REWARDS[dayIdx];
      let barHtml='';
      for(let i=0;i<7;i++){
        let done=i<streak;let today=(i===dayIdx&&canClaim);
        barHtml+=`<div class="streak-day ${done?'done':''}${today?' today':''}">
          <span style="font-size:1rem;">${done?'✅':'🪙'}</span>
          <span>${DAILY_REWARDS[i]}</span>
        </div>`;
      }
      document.getElementById('daily-streak-bar').innerHTML=barHtml;
      document.getElementById('daily-reward-display').innerHTML=`🪙 ${reward} BZ`;
      document.getElementById('daily-streak-text').innerText=canClaim
        ?`Jour ${dayIdx+1} — Connecte-toi demain pour continuer la série !`
        :`Déjà réclamé aujourd'hui. Reviens demain ! (Série: ${streak} jours)`;
      let claimBtn=document.querySelector('#daily-modal .portal-btn.btn-admin');
      if(claimBtn)claimBtn.style.display=canClaim?'flex':'none';
      document.getElementById('daily-modal').style.display='flex';
    }
  });
}
function claimDailyBonus(){
  if(!portalState.currentUser)return;
  let now=Date.now();
  let uDailyRef=db.ref('portal_users/'+portalState.currentUser.uid+'/daily');
  uDailyRef.once('value',s=>{
    let d=s.val()||{};
    let streak=d.streak||0;
    let lastClaim=d.lastClaim||0;
    let diff=now-lastClaim;
    if(diff<86400000){showToast('Déjà réclamé aujourd\'hui !','error');return;}
    if(diff>=86400000*2&&lastClaim>0)streak=0;
    let dayIdx=Math.min(streak,6);
    let reward=DAILY_REWARDS[dayIdx];
    uDailyRef.set({lastClaim:now,streak:streak+1});
    addBZ(reward,`Bonus jour ${dayIdx+1} 🎁`);
    document.getElementById('daily-modal').style.display='none';
  });
}

/* ===== ARENA / MODE SELECTION ===== */
portalState.arenaMode=false;
portalState.arenaStake=0;
function selectMode(mode){
  portalState.arenaMode=(mode==='arena');
  let nc=document.getElementById('mode-card-normal');
  let ac=document.getElementById('mode-card-arena');
  let cfg=document.getElementById('arena-config');
  if(nc)nc.className='mode-card'+(mode==='normal'?' selected':'');
  if(ac)ac.className='mode-card'+(mode==='arena'?' selected-arena':'');
  if(cfg)cfg.style.display=mode==='arena'?'block':'none';
  if(mode==='arena'){updateBZDisplay();updateArenaPreview();}
}
function setStake(v){
  let inp=document.getElementById('arena-stake-input');
  if(inp)inp.value=v;
  updateArenaPreview();
}
function updateArenaPreview(){
  let v=parseInt(document.getElementById('arena-stake-input')?.value)||50;
  v=Math.max(1,Math.min(1000,v));
  portalState.arenaStake=v;
  let jp=document.getElementById('arena-jackpot-val');
  if(jp)jp.innerHTML=`🪙 ${v*2} BZ`;
}
function setupArenaLobby(roomCode){
  if(!portalState.arenaMode||portalState.arenaStake<=0)return;
  removeBZ(portalState.arenaStake, ok=>{
    if(!ok){showToast('Solde insuffisant !','error');return;}
    db.ref('portal_lobbies/'+roomCode).update({arenaStake:portalState.arenaStake,arenaPool:portalState.arenaStake,arenaPlayers:{[portalState.currentUser.uid]:portalState.currentUser.name}});
  });
}
function joinArenaLobby(lobbyId, stake){
  if(!stake||stake<=0)return;
  getBZ(bz=>{
    if(bz<stake){showToast(`Il faut ${stake} BZ pour rejoindre !`,'error');return;}
    removeBZ(stake,ok=>{
      if(!ok){showToast('Solde insuffisant !','error');return;}
      db.ref('portal_lobbies/'+lobbyId).transaction(l=>{
        if(!l)return l;
        l.arenaPool=(l.arenaPool||0)+stake;
        if(!l.arenaPlayers)l.arenaPlayers={};
        l.arenaPlayers[portalState.currentUser.uid]=portalState.currentUser.name;
        return l;
      });
    });
  });
}
function resolveArena(lData, isWinner){
  if(!lData||!lData.arenaStake||lData.arenaStake<=0)return;
  let pool=lData.arenaPool||0;
  let res=document.getElementById('arena-result-overlay');
  if(!res)return;
  if(isWinner){
    document.getElementById('arena-res-icon').innerText='🏆';
    document.getElementById('arena-res-title').innerText='VICTOIRE !';
    document.getElementById('arena-res-subtitle').innerText=`Tu remportes le jackpot !`;
    document.getElementById('arena-res-prize').innerHTML=`🪙 +${pool} BZ`;
    addBZ(pool,'Victoire en Arène ! ⚔️');
  } else {
    document.getElementById('arena-res-icon').innerText='💀';
    document.getElementById('arena-res-title').innerText='DÉFAITE';
    document.getElementById('arena-res-title').style.color='var(--red)';
    document.getElementById('arena-res-subtitle').innerText='Ta mise est perdue.';
    document.getElementById('arena-res-prize').innerHTML=`🪙 0 BZ`;
  }
  res.style.display='flex';
  if(lData.isQuiz)db.ref('quiz_emoji_rooms/'+portalState.currentLobbyId).update({arenaStake:0,arenaPool:0});
  else db.ref('portal_lobbies/'+portalState.currentLobbyId).update({arenaStake:0,arenaPool:0});
}

/* ===== SHOP ===== */
let currentShopTab = 'avatars';

function switchShopTab(tab) {
    currentShopTab = tab;
    document.getElementById('shop-tab-avatars').classList.toggle('active', tab === 'avatars');
    document.getElementById('shop-tab-titles').classList.toggle('active', tab === 'titles');
    renderShop();
}

function openShop(){
  updateBZDisplay();
  switchShopTab('avatars');
  document.getElementById('shop-modal').style.display='flex';
}

function renderShop(){
  if(!portalState.currentUser)return;
  db.ref('portal_users/'+portalState.currentUser.uid+'/purchases').once('value',s=>{
    let owned=s.val()||{};
    let now=Date.now();
    let grid=document.getElementById('shop-items-grid');
    
    let toShow = [];
    if(currentShopTab === 'avatars') {
        let keys = Object.keys(portalState.customAvatars || {});
        toShow = keys.map(k => {
            let a = portalState.customAvatars[k];
            return {
                id: k, name: a.name, desc: "Avatar customisé", icon: renderAva(a.url, '64px'), 
                type: 'custom_avatar', value: a.url, price: a.price, color: '#10b981'
            };
        });
    } else {
        let titleKeys = Object.keys(portalState.shopTitles || {});
        let bonusKeys = Object.keys(portalState.shopBonuses || {});
        
        titleKeys.forEach(k => {
            let t = portalState.shopTitles[k];
            toShow.push({id: k, ...t});
        });
        bonusKeys.forEach(k => {
            let b = portalState.shopBonuses[k];
            toShow.push({id: k, ...b});
        });
    }

    if(toShow.length === 0) {
        grid.innerHTML = "<div style='grid-column: span 2; opacity:0.5; text-align:center; padding:20px;'>Aucun article dans cette catégorie.</div>";
        return;
    }

    grid.innerHTML = toShow.map(item=>{
      let isOwned=owned[item.id]&&(item.type!=='doubxp'||owned[item.id]>=now);
      let active=item.type==='doubxp'&&owned[item.id]&&owned[item.id]>=now;
      let timeLeft=active?Math.ceil((owned[item.id]-now)/60000)+'min':'';
      return`<div class="shop-item ${isOwned?'owned':''}" onclick="buyItem('${item.id}', '${item.type}', '${item.value}', ${item.price}, '${item.name}')">
        ${isOwned?`<div class="shop-owned-tag">${active?'ACTIF '+timeLeft:'POSSÉDÉ'}</div>`:''}
        <div class="shop-item-icon">${item.icon}</div>
        <div class="shop-item-name" style="color:${item.color||'var(--text-main)'};">${item.name}</div>
        <div style="font-size:0.62rem;color:var(--text-muted);margin-bottom:5px;">${item.desc}</div>
        <div class="shop-item-price">🪙 ${item.price} BZ</div>
      </div>`;
    }).join('');
  });
}

function buyItem(itemId, type, value, price, name){
  if(!portalState.currentUser)return;
  let now=Date.now();
  
  db.ref('portal_users/'+portalState.currentUser.uid+'/purchases').once('value',s=>{
    let owned=s.val()||{};
    if(type!=='doubxp'&&owned[itemId]){showToast('Déjà possédé ! Regardez dans votre inventaire','info');return;}
    if(type==='doubxp'&&owned[itemId]&&owned[itemId]>=now){showToast('Bonus déjà actif !','error');return;}
    if(!confirm(`Acheter "${name}" pour 🪙 ${price} BZ ?`))return;
    removeBZ(price,ok=>{
      if(!ok){showToast('Solde insuffisant !','error');return;}
      let val=type==='doubxp'?(now+(type==='doubxp'&&itemId.includes('24h')?86400000:7200000)):true;
      if(type==='custom_avatar') val = value; // save the URL directly for easy access
      
      db.ref('portal_users/'+portalState.currentUser.uid+'/purchases/'+itemId).set(val);
      
      if(type==='doubxp'){
        showToast(`Double XP actif !`,'success',3000);
      } else {
          showToast(`"${name}" ajouté à l'inventaire !`, 'success');
      }
      renderShop();
      updateBZDisplay();
    });
  });
}

/* ===== INVENTORY ===== */
let currentInvTab = 'avatars';

function switchInvTab(tab) {
    currentInvTab = tab;
    document.getElementById('inv-tab-avatars').classList.toggle('active', tab === 'avatars');
    document.getElementById('inv-tab-titles').classList.toggle('active', tab === 'titles');
    renderInventory();
}

window.openInventory = function() {
    if(!portalState.currentUser) return;
    switchInvTab('avatars');
    document.getElementById('inventory-modal').style.display='flex';
}

function renderInventory() {
    let grid = document.getElementById('inv-items-grid');
    let uD = portalState.usersList[portalState.currentUser.uid] || {};
    let purchases = uD.purchases || {};
    let currentAva = uD.avatar || '👽';
    let currentTitle = uD.title || '';

    let toShow = [];

    if(currentInvTab === 'avatars') {
        // Emojis de base
        let baseEmojis = ['👽', '👻', '🤖', '🤡', '🤠'];
        let unlockedEmojis = uD.unlockedAvatars || baseEmojis;
        unlockedEmojis.forEach(e => {
            toShow.push({ id: 'emo_'+e, type: 'avatar', value: e, label: 'Emoji', icon: renderAva(e, '64px') });
        });

        // Avatars custom achetés
        Object.keys(purchases).forEach(k => {
            if(portalState.customAvatars[k]) {
                let a = portalState.customAvatars[k];
                toShow.push({ id: k, type: 'avatar', value: a.url, label: a.name, icon: renderAva(a.url, '64px') });
            }
        });

        grid.innerHTML = toShow.map(item => {
            let isEquipped = currentAva === item.value;
            return `<div class="inv-item ${isEquipped?'equipped':''}" onclick="equipItem('avatar', '${item.value}')">
                <div style="margin-bottom:6px;">${item.icon}</div>
                <div style="font-size:0.6rem; font-weight:800; color:var(--text-muted);">${item.label}</div>
                ${isEquipped?`<div style="font-size:0.55rem; color:var(--green); font-weight:800; margin-top:4px;">ÉQUIPÉ</div>`:''}
            </div>`;
        }).join('');

    } else if(currentInvTab === 'titles') {
        // Titre par défaut (Aucun)
        toShow.push({ id: 'none', type: 'title', value: '', label: 'Aucun Titre' });

        // Titres achetés
        Object.keys(portalState.shopTitles || {}).forEach(k => {
            let t = portalState.shopTitles[k];
            if(purchases[t.id || k]) {
                toShow.push({ id: k, type: 'title', value: t.value, label: t.name });
            }
        });

        grid.innerHTML = toShow.map(item => {
            let isEquipped = currentTitle === item.value || (item.value === '' && !currentTitle);
            return `<div class="inv-item ${isEquipped?'equipped':''}" style="padding:16px 10px;" onclick="equipItem('title', '${item.value}')">
                <div style="font-family:'Bungee'; font-size:0.75rem; color:var(--accent);">${item.label}</div>
                ${isEquipped?`<div style="font-size:0.55rem; color:var(--green); font-weight:800; margin-top:8px;">ÉQUIPÉ</div>`:''}
            </div>`;
        }).join('');
    }
}

window.equipItem = function(type, value) {
    if(!portalState.currentUser) return;
    
    if(type === 'avatar') {
        portalState.currentUser.avatar = value;
        db.ref('portal_users/'+portalState.currentUser.uid).update({avatar: value});
        showToast('Avatar équipé !', 'success');
    } else if (type === 'title') {
        portalState.currentUser.title = value;
        db.ref('portal_users/'+portalState.currentUser.uid).update({title: value});
        showToast('Titre équipé !', 'success');
    }
    
    updateProfileUI();
    renderInventory();
};


/* ===== NAV BADGES ===== */
function updateNavBadges(){
  if(!portalState.currentUser)return;
  let uD=portalState.usersList[portalState.currentUser.uid]||{};let inbox=uD.inbox||{};
  let hasUnreadPM=Object.keys(inbox).some(k=>(inbox[k].unreadCount>0||inbox[k].unread));
  let cBadge=document.getElementById('nav-chat-badge');let pBadge=document.getElementById('nav-profile-badge');
  if(pBadge){pBadge.style.display=hasUnreadPM?'flex':'none';}
  if(cBadge){cBadge.style.display=(hasUnreadPM||portalState.unreadGlobal)?'flex':'none';}
}

function updateOnlineFriendsCount(){
  if(!portalState.currentUser)return;
  let fKs=Object.keys(portalState.usersList[portalState.currentUser.uid]?.friends||{});
  let onlineCount=0;
  fKs.forEach(k=>{if(portalState.usersList[k]&&portalState.usersList[k].online)onlineCount++;});
  let cEl=document.getElementById('online-friends-count');if(cEl)cEl.innerText=onlineCount;
}

/* ===== LOBBY INVITE ===== */
window.openLobbyInviteModal=function(){
  if(!portalState.currentUser)return;
  if(!portalState.currentLobbyId&&portalState.pendingLaunchId){
    let rc=Math.random().toString(36).substr(2,6).toUpperCase();
    portalCreateLobby(rc);
    portalState.pendingInviteAction = true;
  } else {
    _doOpenLobbyInviteModal();
  }
};
function _doOpenLobbyInviteModal(){
  if(!portalState.currentUser)return;
  let fKs=Object.keys(portalState.usersList[portalState.currentUser.uid]?.friends||{});
  let html='';
  fKs.forEach(k=>{let u=portalState.usersList[k];if(u&&u.online){html+=`<div class="friend-item"><div>${renderAva(u.avatar,'20px')} ${u.name} 🟢</div><button class="portal-btn btn-admin" style="padding:5px 10px;font-size:0.65rem;width:auto;margin:0;" onclick="sendInvite('${k}',event);this.textContent='ENVOYÉ ✓';this.disabled=true;">INVITER</button></div>`;}});
  document.getElementById('lobby-online-friends-list').innerHTML=html||"<div class='empty-state'><div class='empty-state-icon'>😴</div><div class='empty-state-text'>Aucun ami en ligne.</div></div>";
  document.getElementById('lobby-invite-modal').style.display='flex';
}

/* ===== PROFILE UI ===== */
function updateProfileUI(){
  if(!portalState.currentUser)return;
  let uD=portalState.usersList[portalState.currentUser.uid]||{};
  let lvl=uD.level||1;let xp=uD.xp||0;let xpNext=lvl*100;let xpPrev=(lvl-1)*100;
  let progress=((xp-xpPrev)/(xpNext-xpPrev))*100;
  
  // Utilisation de 110px pour remplir correctement le conteneur du profil
  document.getElementById('prof-avatar').innerHTML=renderAva(uD.avatar,'110px');
  
  let pl=document.getElementById('prof-level');if(pl)pl.innerText=lvl;
  let pb=document.getElementById('prof-xp-bar');if(pb)pb.style.width=`${Math.min(100,Math.max(0,progress))}%`;
  let pn=document.getElementById('prof-name');
  if(pn&&uD.title){
    let titleId='prof-title-tag';
    let old=document.getElementById(titleId);if(old)old.remove();
    let tag=document.createElement('div');
    tag.id=titleId;tag.style.cssText='text-align:center;font-size:0.72rem;color:var(--accent-2);font-weight:800;margin-bottom:4px;letter-spacing:0.5px;';
    tag.innerText='✦ '+uD.title+' ✦';
    pn.insertAdjacentElement('afterend',tag);
  } else if (pn) {
     let old=document.getElementById('prof-title-tag');if(old)old.remove();
  }
  let stats=uD.stats||{};stats.friendsCount=Object.keys(uD.friends||{}).length;
  stats.gamesPlayed=0;stats.quizzesPlayed=0;
  if(uD.playedGames)Object.keys(uD.playedGames).forEach(k=>{let isQ=Array.isArray(portalState.quiz)?portalState.quiz.some(q=>q.id===k):false;if(isQ)stats.quizzesPlayed+=uD.playedGames[k];else stats.gamesPlayed+=uD.playedGames[k];});
  let badgesHtml='';
  BADGES.forEach(b=>{
    let isUnlocked=b.check(stats,lvl);
    let clickAction=`openBadgeModal('${b.name.replace(/'/g,"\\'")}','${b.desc.replace(/'/g,"\\'")}','${b.icon}',${isUnlocked})`;
    badgesHtml+=`<div onclick="${clickAction}" class="badge-chip ${isUnlocked?'unlocked':''}" style="filter:${isUnlocked?'grayscale(0) opacity(1)':'grayscale(1) opacity(0.3)'}; border-color:${isUnlocked?'var(--accent)':'var(--panel-border)'};" title="${b.name}">${b.icon}</div>`;
  });
  let bl=document.getElementById('badges-list');if(bl)bl.innerHTML=badgesHtml;
  
  renderQuests(uD.quests ? uD.quests.list : []);
  updateBZDisplay();
}

/* ===== BADGE MODAL ===== */
window.openBadgeModal=function(name,desc,icon,unlocked){
  document.getElementById('badge-modal-icon').innerText=icon;
  document.getElementById('badge-modal-title').innerText=name;
  document.getElementById('badge-modal-desc').innerText=desc;
  document.getElementById('badge-modal-status').innerHTML=unlocked?`<span style="color:var(--green);">✅ Débloqué !</span>`:`<span style="color:var(--text-muted);">🔒 Non débloqué</span>`;
  document.getElementById('badge-modal').style.display='flex';
};

/* ===== LEADERBOARD ===== */
window.openLeaderboardModal=function(gameId,event){if(event)event.stopPropagation();currentLbGameId=gameId||null;currentLbScope=gameId?'game':'global';currentLbMetric='games';renderLeaderboard(currentLbScope,currentLbMetric);document.getElementById('leaderboard-modal').style.display='flex';};
window.renderLeaderboard=function(scope,metric){
  currentLbScope=scope;currentLbMetric=metric;
  ['game','global'].forEach(s=>{let b=document.getElementById('lb-btn-'+s);if(b){b.classList.toggle('btn-admin',s===scope);b.classList.toggle('btn-secondary',s!==scope);}});
  ['wins','games'].forEach(m=>{let b=document.getElementById('lb-btn-'+m);if(b){b.classList.toggle('btn-admin',m===metric);b.classList.toggle('btn-secondary',m!==metric);}});
  let users=Object.values(portalState.usersList);
  users.sort((a,b)=>{let vA=0,vB=0;if(scope==='global'){if(metric==='wins'){vA=a.stats?.wins||0;vB=b.stats?.wins||0;}else{vA=(a.stats?.gamesPlayed||0)+(a.stats?.quizzesPlayed||0);vB=(b.stats?.gamesPlayed||0)+(b.stats?.quizzesPlayed||0);}}else{if(metric==='wins'){vA=a.gameWins?(a.gameWins[currentLbGameId]||0):0;vB=b.gameWins?(b.gameWins[currentLbGameId]||0):0;}else{vA=a.playedGames?(a.playedGames[currentLbGameId]||0):0;vB=b.playedGames?(b.playedGames[currentLbGameId]||0):0;}}return vB-vA;});
  let top10=users.slice(0,10).filter(u=>{if(scope==='global'&&metric==='wins')return(u.stats?.wins||0)>0;return true;});
  let html=top10.map((u,i)=>{
    let val=0;if(scope==='global'){val=metric==='wins'?(u.stats?.wins||0):((u.stats?.gamesPlayed||0)+(u.stats?.quizzesPlayed||0));}else{val=metric==='wins'?(u.gameWins?.[currentLbGameId]||0):(u.playedGames?.[currentLbGameId]||0);}
    let lbl=metric==='wins'?'victoires':'parties';let medal=i===0?'🥇':(i===1?'🥈':(i===2?'🥉':`${i+1}.`));
    return`<div class="leader-item"><span style="font-family:'Bungee';font-size:1rem;display:flex;align-items:center;gap:6px;">${medal} ${renderAva(u.avatar,'22px')} ${u.name}</span><b style="color:var(--accent);">${val} ${lbl}</b></div>`;
  }).join('');
  document.getElementById('leaderboard-list').innerHTML=html||'<div class="empty-state"><div class="empty-state-text">Aucune donnée.</div></div>';
};

/* ===== LOBBY ===== */
window.portalCreateLobby=function(roomCode){
  portalState.pendingRoomCode = roomCode;
  let gId = portalState.pendingLaunchId;
  let l = [...(portalState.games||[]), ...(portalState.quiz||[])];
  let item = l.find(x => x.id === gId);
  if(item) {
      let el = document.getElementById('mode-select-game-title');
      if(el) el.innerText = item.title;
      
      if(item.isCoop) {
          portalState.arenaStake = 0;
          portalState.arenaMode = false;
          finalizeLobbyCreation(roomCode);
          return;
      }
  }
  selectMode('normal');
  document.getElementById('mode-select-modal').style.display = 'flex';
};

window.finalizeLobbyCreation=function(roomCode){
  try{
    if(!portalState.currentUser||!portalState.pendingLaunchId)return;
    let gId=portalState.pendingLaunchId;let isQuiz=false;let g=null;
    if(Array.isArray(portalState.games)&&portalState.games.some(x=>x.id===gId))g=portalState.games.find(x=>x.id===gId);
    else if(Array.isArray(portalState.quiz)&&portalState.quiz.some(x=>x.id===gId)){g=portalState.quiz.find(x=>x.id===gId);isQuiz=true;}
    let title=g?g.title:"Jeu en ligne";portalState.currentLobbyId=roomCode;portalState.lastRematchToken=null;
    db.ref(`portal_users/${portalState.currentUser.uid}/activity`).update({lobbyId:roomCode}).catch(()=>{});
    let btn=document.getElementById('global-home-btn');if(btn)btn.innerHTML='⬅ QUITTER';
    
    // Activer le tchat de salon
    listenToLobbyChat(roomCode);
    
    // AFFICHER LE BOUTON VOCAL POUR L'HOTE
    let btnVoice = document.getElementById('btn-voice');
    if(btnVoice) btnVoice.style.display = 'flex';

    if(isQuiz){listenToCurrentLobby(roomCode,true);return;}
    let lRef=db.ref('portal_lobbies/'+roomCode);
    let lobbyData={host:portalState.currentUser.uid,hostName:portalState.currentUser.name,gameId:gId,gameTitle:title,players:{[portalState.currentUser.uid]:portalState.currentUser.name},status:'waiting',createdAt:Date.now(),isQuiz:false,rematchToken:null,arenaStake:portalState.arenaStake||0,arenaPool:0,arenaPlayers:{}};
    lRef.set(lobbyData).then(()=>{
      if(portalState.arenaMode&&portalState.arenaStake>0)setupArenaLobby(roomCode);
      if(portalState.pendingInviteAction){
          portalState.pendingInviteAction = false;
          _doOpenLobbyInviteModal();
      }
    }).catch(()=>{});
    lRef.onDisconnect().remove();
    db.ref('lobby_chats/'+roomCode).onDisconnect().remove();
    listenToCurrentLobby(roomCode,false);
  }catch(e){}
};

function listenToCurrentLobby(lId,isQuiz){
  if(currentLobbyRef)currentLobbyRef.off();
  let path=isQuiz?`quiz_emoji_rooms/${lId}`:`portal_lobbies/${lId}`;
  currentLobbyRef=db.ref(path);
  currentLobbyRef.on('value',s=>{
    let d=s.val();if(!d){document.getElementById('global-invite-btn').style.display='none';return;}
    let isHost=d.host===portalState.currentUser?.uid;
    if(document.getElementById('game-player-container').style.display!=='none'){
        document.getElementById('global-invite-btn').style.display=isHost?'flex':'none';
        
        // AFFICHER LE BOUTON VOCAL POUR TOUS LES INVITÉS
        let btnVoice = document.getElementById('btn-voice');
        if(btnVoice) btnVoice.style.display = 'flex';
    }
    if(d.rematchToken&&d.rematchToken!==portalState.lastRematchToken){portalState.lastRematchToken=d.rematchToken;let iframe=document.getElementById('game-iframe');if(iframe)iframe.srcdoc=iframe.srcdoc;}
  });
}

/* ===== LAUNCH ===== */
function prepLaunch(id,t){
  portalState.pendingLaunchId=id;
  portalState.pendingLaunchType=t;
  portalState.currentLobbyId=null;
  portalState.arenaMode=false;
  portalState.arenaStake=0;
  _checkAndGiveFirstPlayBonus(id);
  confirmLaunch();
}

function _checkAndGiveFirstPlayBonus(gId){
  if(!portalState.currentUser||!gId) return;
  db.ref('portal_users/'+portalState.currentUser.uid+'/playedGames/'+gId).once('value', s=>{
    let count = s.val()||0;
    if(count===0) addBZ(10,'1ère partie sur ce jeu ! ⭐');
  });
}
function confirmModeAndCreateLobby(){
  document.getElementById('mode-select-modal').style.display='none';
  if(portalState.arenaMode){
    let stake=parseInt(document.getElementById('arena-stake-input')?.value)||10;
    portalState.arenaStake=Math.max(1,Math.min(1000,stake));
    getBZ(bz=>{
      if(bz<portalState.arenaStake){showToast(`Solde insuffisant ! (${bz} BZ)`,'error');return;}
      finalizeLobbyCreation(portalState.pendingRoomCode);
    });
  } else {
    portalState.arenaStake=0;
    finalizeLobbyCreation(portalState.pendingRoomCode);
  }
}
function directJoinLobby(gId,lId){
  let allL={...portalState.activeLobbies.portal,...portalState.activeLobbies.quiz};
  let lData=allL[lId];
  if(lData&&lData.arenaStake&&lData.arenaStake>0&&lData.host!==portalState.currentUser?.uid){
    let stake=lData.arenaStake;
    let pool=lData.arenaPool||0;
    let players=Object.keys(lData.arenaPlayers||{}).length;
    if(!confirm(`Ce salon est en mode ARÈNE ⚔️\nMise : 🪙 ${stake} BZ\nJackpot actuel : 🪙 ${pool} BZ (${players} joueur${players>1?'s':''})\nVoulez-vous rejoindre ?`))return;
    joinArenaLobby(lId, stake);
  }
  portalState.currentLobbyId=lId;portalState.pendingLaunchId=gId;portalState.lastRematchToken=null;
  confirmLaunch();
}

function confirmLaunch(){
  let l=[...(portalState.games||[]),...(portalState.quiz||[])];const i=l.find(x=>x.id===portalState.pendingLaunchId);
  if(!i){showToast('Jeu introuvable !','error');return;}
  let btn=document.getElementById('global-home-btn');
  if(btn){btn.innerHTML=portalState.currentLobbyId?'⬅ QUITTER':'⬅ RETOUR';btn.style.display='flex';}
  
  if (portalState.currentLobbyId) listenToLobbyChat(portalState.currentLobbyId);

  let invBtn=document.getElementById('global-invite-btn');
  if(invBtn)invBtn.style.display='none';
  
  let btnVoice = document.getElementById('btn-voice');
  if(btnVoice) {
      btnVoice.style.display = portalState.currentLobbyId ? 'flex' : 'none';
  }

  document.querySelectorAll('.screen-container').forEach(s=>s.classList.remove('active'));
  let bn=document.getElementById('bottom-nav');if(bn)bn.style.display='none';
  document.getElementById('game-player-container').style.display='block';
  let iframe=document.getElementById('game-iframe');if(iframe)iframe.srcdoc=i.code||'<h1>Erreur</h1>';
  setTimeout(()=>{
    try{if(portalState.currentUser){
      let isQuiz=Array.isArray(portalState.quiz)?portalState.quiz.some(x=>x.id===i.id):false;
      let statKey=isQuiz?'quizzesPlayed':'gamesPlayed';
      db.ref(`portal_users/${portalState.currentUser.uid}/stats/${statKey}`).transaction(c=>(c||0)+1).catch(()=>{});
      db.ref('portal_users/'+portalState.currentUser.uid+'/playedGames/'+i.id).transaction(c=>(c||0)+1).catch(()=>{});
      db.ref(`portal_users/${portalState.currentUser.uid}/recentGames/${Date.now()}`).set(i.id).catch(()=>{});
      addXP(10);
      updateQuestProgress('play', 1);
      let pR=db.ref(`portal_presence/${i.id}/${portalState.currentUser.uid}`);pR.set(true);pR.onDisconnect().remove();
      let actRef=db.ref(`portal_users/${portalState.currentUser.uid}/activity`);actRef.set({gameId:i.id,lobbyId:portalState.currentLobbyId||null}).catch(()=>{});actRef.onDisconnect().remove();
      if(portalState.currentLobbyId)listenToCurrentLobby(portalState.currentLobbyId,isQuiz);
    }}catch(err){}
  },50);
}

function closeGame(){
  try{
    let btn=document.getElementById('global-home-btn');
    let needsConfirm=btn&&btn.textContent.includes('QUITTER');
    if(needsConfirm&&!confirm("Quitter la partie ?"))return;
    if(portalState.currentUser && portalState.pendingLaunchId) addBZ(5,'Partie terminée ! 🎮');
    if(portalState.currentLobbyId && portalState.currentUser){
      let lId=portalState.currentLobbyId;
      let allL={...portalState.activeLobbies.portal,...portalState.activeLobbies.quiz};
      let lData=allL[lId];
      if(lData && lData.host===portalState.currentUser.uid){
        if(lData.arenaStake&&lData.arenaStake>0&&lData.arenaPlayers){
          let stake=lData.arenaStake;
          Object.keys(lData.arenaPlayers).forEach(uid=>{ db.ref('portal_users/'+uid+'/bz').transaction(cur=>(cur||0)+stake).catch(()=>{}); });
          showToast(`Salon supprimé — 🪙 ${stake} BZ remboursés à tous`,'info',3500);
        }
        db.ref('lobby_chats/'+lId).remove();
        if(lData.isQuiz)db.ref('quiz_emoji_rooms/'+lId).remove().catch(()=>{});
        else db.ref('portal_lobbies/'+lId).remove().catch(()=>{});
      }
    }
    
    if (portalState.lobbyChatRef) { portalState.lobbyChatRef.off(); portalState.lobbyChatRef = null; }
    let chatToggle = document.getElementById('chat-lobby-toggle');
    if(chatToggle) chatToggle.style.display = 'none';
    let chatWin = document.getElementById('chat-lobby-window');
    if(chatWin) {
        chatWin.style.display = 'none';
        chatWin.classList.remove('fullscreen');
    }

    let btnVoice = document.getElementById('btn-voice');
    if(btnVoice) btnVoice.style.display = 'none';
    
    // Déconnexion vocale stricte
    if(isVoiceConnected) {
        if (localAudioTrack) { localAudioTrack.close(); localAudioTrack = null; }
        if(rtcClient) rtcClient.leave();
        isVoiceConnected = false;
        if(btnVoice) {
            btnVoice.innerText = "🎙️ VOCAL";
            btnVoice.style.borderColor = "rgba(255,255,255,0.2)";
            btnVoice.style.background = "rgba(245,158,11,0.85)";
            btnVoice.style.color = "white";
        }
    }

    document.getElementById('game-player-container').style.display='none';
    if(btn)btn.style.display='none';
    document.getElementById('global-invite-btn').style.display='none';
    let iframe=document.getElementById('game-iframe');if(iframe)iframe.srcdoc='';
    if(portalState.currentUser){db.ref(`portal_users/${portalState.currentUser.uid}/activity`).remove().catch(()=>{});if(portalState.pendingLaunchId)db.ref(`portal_presence/${portalState.pendingLaunchId}/${portalState.currentUser.uid}`).remove().catch(()=>{});}
    if(currentLobbyRef){currentLobbyRef.off();currentLobbyRef=null;}
    portalState.currentLobbyId=null;portalState.pendingLaunchId=null;
    let bn=document.getElementById('bottom-nav');if(bn)bn.style.display='flex';
    switchTab(portalState.currentTab||'games');
  }catch(e){document.getElementById('game-player-container').style.display='none';let bn=document.getElementById('bottom-nav');if(bn)bn.style.display='flex';switchTab('games');}
}

/* ===== CHAT ===== */
function sendChatMessage(){
  let i=document.getElementById('chat-input');let v=i.value.trim();
  if(portalState.mutedUsers[portalState.currentUser.uid])return showToast("Vous êtes muté du tchat global",'error');
  if(v&&portalState.currentUser){
      db.ref('global_chat').push({uid:portalState.currentUser.uid,name:portalState.currentUser.name,avatar:portalState.currentUser.avatar,text:v,time:Date.now()});
      i.value='';
      updateQuestProgress('chat', 1);
  }
}

/* ===== SESSION ===== */
async function setupUserSession(uD){
  portalState.currentUser=uD;portalState.role=uD.role;
  let at=document.getElementById('admin-tools');if(at)at.style.display=uD.role==='admin'?'block':'none';
  let bag=document.getElementById('btn-add-game');if(bag)bag.style.display=uD.role==='admin'?'block':'none';
  let baq=document.getElementById('btn-add-quiz');if(baq)baq.style.display=uD.role==='admin'?'block':'none';
  try{await updateUsernameMap(null,uD.name,uD.uid);}catch(e){}
  
  let uRef=db.ref('portal_users/'+uD.uid);
  
  uRef.once('value', async s=>{
    let d=s.val()||{};
    
    if(d.avatar) portalState.currentUser.avatar = d.avatar;
    if(d.title) portalState.currentUser.title = d.title;
    if(d.name) portalState.currentUser.name = d.name;
    
    let fC=d.friendCode;
    if(!fC){fC=generateFriendCode();try{await db.ref('portal_friend_codes/'+fC).set(uD.uid);}catch(e){}try{await uRef.update({friendCode:fC});}catch(e){}}
    portalState.currentUser.friendCode=fC;
    
    if(!portalState.currentUser.avatar && d.avatar) portalState.currentUser.avatar = d.avatar;
    
    uRef.update({
        name: portalState.currentUser.name,
        avatar: portalState.currentUser.avatar,
        online: true, 
        lastLogin: Date.now()
    }).then(()=>uRef.onDisconnect().update({online:false})).catch(()=>{});
    
    let pn=document.getElementById('prof-name');if(pn)pn.innerText=portalState.currentUser.name+" #"+fC;
    localStorage.setItem('portal_uid',uD.uid);localStorage.setItem('portal_name',portalState.currentUser.name);
    let savedTab=localStorage.getItem('saved_tab');if(!['games','quiz','lobbies','chat','profile'].includes(savedTab))savedTab='games';
    let lc=document.getElementById('login-container');if(lc)lc.classList.remove('active');
    let bn=document.getElementById('bottom-nav');if(bn)bn.classList.add('active');
    
    checkDailyQuestsInit(d);
    
    switchTab(savedTab);renderGrid('games');renderGrid('quiz');
    updateBZDisplay();
    updateProfileUI(); 
    showToast(`Bienvenue ${portalState.currentUser.name} !`,'success');
    setTimeout(()=>checkDailyBonus(false),1500);
  });

  if(window.friendReqListenerRef) window.friendReqListenerRef.off();
  window.friendReqListenerRef=db.ref(`portal_users/${uD.uid}/friendRequests`);
  window.friendReqListenerRef.on('child_added',snap=>{
      let req=snap.val(); let fUid=snap.key;
      if(Date.now()-req.time<60000){ 
          document.getElementById('invite-msg').innerText=`${req.name} vous a envoyé une demande d'ami !`;
          document.getElementById('invite-accept-btn').innerText='✅ ACCEPTER';
          document.getElementById('invite-accept-btn').onclick=()=>{acceptFriend(fUid);document.getElementById('invite-modal').style.display='none';};
          document.getElementById('invite-modal').style.display='flex';
      }
  });
  if(window.inviteListenerRef)window.inviteListenerRef.off();
  window.inviteListenerRef=db.ref(`portal_users/${uD.uid}/invites`);
  window.inviteListenerRef.on('child_added',snap=>{
    let inv=snap.val();if(Date.now()-inv.time>60000){snap.ref.remove();return;}
    document.getElementById('invite-msg').innerText=`${inv.fromName} vous invite à jouer à ${inv.gameTitle} !`;
    document.getElementById('invite-accept-btn').innerText='✅ REJOINDRE';
    document.getElementById('invite-accept-btn').onclick=()=>{document.getElementById('invite-modal').style.display='none';snap.ref.remove();directJoinLobby(inv.gameId,inv.lobbyId);};
    document.getElementById('invite-modal').style.display='flex';snap.ref.remove();
  });
}

/* ===== GRIDS ET AUTRES ===== */
function renderGrid(t){
  let l=t==='games'?[...(portalState.games||[])]: [...(portalState.quiz||[])];
  const grid=document.getElementById(t+'-grid');grid.innerHTML='';
  let sV=document.getElementById('search-'+t).value.trim().toLowerCase();
  let sNode=document.getElementById('sort-'+t);let sVal=sNode?sNode.value:'date-desc';
  let fCat=document.getElementById('category-'+t).value;let fP=parseInt(document.getElementById('filter-players-'+t).value);
  let filtered=l.filter(i=>{
    if(!i||!i.title)return false;
    let tM=i.title.toLowerCase().includes(sV)||(i.desc&&i.desc.toLowerCase().includes(sV));
    let mF=sVal==='fav'?portalState.settings.favs[i.id]:true;
    let cS=(i.categories?i.categories.join(' '):(i.tags||'')).toLowerCase();
    let mC=fCat==='all'?true:cS.includes(fCat.toLowerCase());
    let mP=fP===0?true:(fP>=(i.minP||1)&&fP<=(i.maxP||99));
    return tM&&mF&&mC&&mP;
  });
  filtered.sort((a,b)=>{let tA=a.timestamp||0;let tB=b.timestamp||0;let nA=(a.title||'').toLowerCase();let nB=(b.title||'').toLowerCase();if(sVal==='date-desc'||sVal==='fav')return tB-tA;if(sVal==='name-asc')return nA.localeCompare(nB);return 0;});
  if(filtered.length===0){grid.innerHTML="<div class='empty-state' style='width:100%;'><div class='empty-state-icon'>🎲</div><div class='empty-state-text'>Aucun résultat.</div></div>";return;}
  filtered.forEach(i=>{
    let lC=portalState.presence[i.id]?Object.keys(portalState.presence[i.id]).length:0;
    let lH=lC>0?`<div class=\"live-counter\"><span class=\"live-dot\"></span>🔥 ${lC} en ligne</div>`:'';
    let c=document.createElement('div');c.className='item-card';c.style.borderColor=`${i.color}33`;
    let isF=portalState.settings.favs[i.id];
    let iR=portalState.ratings[i.id]||{};let s=Object.values(iR);let avg=s.length?(s.reduce((a,b)=>a+b,0)/s.length).toFixed(1):'-';
    c.innerHTML=`<div style=\"position:absolute;top:-15px;left:10px;display:flex;gap:5px;z-index:10;\"><div class=\"rating-pill\" onclick=\"openRatingModal('${i.id}',event)\">⭐ ${avg}</div><div class=\"rating-pill trophy-pill\" onclick=\"openLeaderboardModal('${i.id}',event)\">🏆</div></div><div class=\"card-actions-right\"><div class=\"action-btn btn-i\" onclick=\"openInfo('${i.id}','${t}',event)\">i</div>${navigator.share?`<div class=\"action-btn btn-sh\" onclick=\"shareGame('${i.id}',event)\">🔗</div>`:''}${portalState.role==='admin'?`<div class=\"action-btn btn-ed\" onclick=\"editItem('${i.id}','${t}',event)\">✏️</div><div class=\"action-btn btn-del\" onclick=\"deleteItem('${i.id}','${t}',event)\">✕</div>`:''}</div><div><div class=\"item-title\" style=\"color:${i.color};\">${i.title} <span class=\"fav-icon ${isF?'active':''}\" onclick=\"toggleFav('${i.id}',event)\">❤️</span></div><div class=\"item-categories\">${i.categories?i.categories.join(' • '):(i.tags||'')}</div>${lH}<div class=\"item-players\">👥 ${i.minP}–${i.maxP} joueurs</div><div class=\"item-desc\">${i.desc||''}</div></div><button class=\"play-btn\" style=\"background:linear-gradient(135deg,${i.color},${i.color}cc);\" onclick=\"prepLaunch('${i.id}','${t}')\">▶ JOUER</button>`;
    grid.appendChild(c);
  });
}

function toggleFav(id,e){e.stopPropagation();if(portalState.settings.favs[id])delete portalState.settings.favs[id];else portalState.settings.favs[id]=true;localStorage.setItem('portal_favs',JSON.stringify(portalState.settings.favs));renderGrid(portalState.currentTab);}
function shareGame(id,e){e.stopPropagation();let i=(portalState.games||[]).find(x=>x.id===id)||(portalState.quiz||[]).find(x=>x.id===id);if(navigator.share&&i)navigator.share({title:i.title,url:window.location.href}).catch(()=>{});}
function updateCategoryCheckboxes(t){let c=t==='games'?GAME_CATS:QUIZ_CATS;document.getElementById('add-categories').innerHTML=c.map(x=>`<label><input type=\"checkbox\" class=\"cat-checkbox\" value=\"${x}\"> ${x}</label>`).join('');}
function deleteItem(id,t,e){e.stopPropagation();if(confirm(`Supprimer ce jeu ?`)){if(t==='games'){portalState.games=portalState.games.filter(g=>g.id!==id);db.ref('portal_games_list').set(portalState.games);}else{portalState.quiz=portalState.quiz.filter(q=>q.id!==id);db.ref('portal_quiz_list').set(portalState.quiz);}showToast('Jeu supprimé','success');}}
function editItem(id,t,e){e.stopPropagation();portalState.addingType=t;portalState.editingItemId=id;updateCategoryCheckboxes(t);let l=t==='games'?portalState.games:portalState.quiz;let i=l.find(x=>x.id===id);if(!i)return;document.getElementById('add-title-main').innerText="MODIFIER";document.getElementById('add-title').value=i.title||'';document.getElementById('add-desc').value=i.desc||'';document.getElementById('add-min-p').value=i.minP||1;document.getElementById('add-max-p').value=i.maxP||99;document.getElementById('add-rules').value=i.rules||'';document.getElementById('add-color').value=i.color||'#6366f1';document.getElementById('add-code').value=i.code||'';document.getElementById('add-is-coop').checked=i.isCoop||false;let iC=i.categories||[];document.querySelectorAll('.cat-checkbox').forEach(chk=>{chk.checked=iC.includes(chk.value);});document.getElementById('bottom-nav').style.display='none';switchScreen('add-item-container');}
function showAddScreen(t){portalState.addingType=t;portalState.editingItemId=null;updateCategoryCheckboxes(t);document.getElementById('add-title-main').innerText="NOUVEAU";document.getElementById('add-title').value='';document.getElementById('add-desc').value='';document.getElementById('add-rules').value='';document.getElementById('add-min-p').value='2';document.getElementById('add-max-p').value='8';document.getElementById('add-color').value='#6366f1';document.getElementById('add-code').value='';document.getElementById('add-is-coop').checked=false;document.getElementById('bottom-nav').style.display='none';switchScreen('add-item-container');}
function cancelAdd(){document.getElementById('bottom-nav').style.display='flex';switchTab(portalState.addingType);}
function handleFileUpload(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=function(ev){document.getElementById('add-code').value=ev.target.result;showToast('Fichier chargé !','success');};r.readAsText(f);}
function saveNewItem(){try{const t=document.getElementById('add-title').value.trim();const d=document.getElementById('add-desc').value.trim();const r=document.getElementById('add-rules').value.trim();const mp=parseInt(document.getElementById('add-min-p').value)||1;const mxp=parseInt(document.getElementById('add-max-p').value)||99;const c=document.getElementById('add-color').value.trim();const cd=document.getElementById('add-code').value.trim();const isCoop=document.getElementById('add-is-coop').checked;let sC=Array.from(document.querySelectorAll('.cat-checkbox:checked')).map(chk=>chk.value);if(!t||!cd)return showToast('Titre et Code requis','error');let nI={id:portalState.editingItemId||(portalState.addingType+'_'+Math.random().toString(36).substr(2,9)),title:t,desc:d,categories:sC,rules:r,minP:mp,maxP:mxp,color:c,code:cd,isCoop:isCoop};let l=portalState.addingType==='games'?(portalState.games||[]):(portalState.quiz||[]);if(portalState.editingItemId){let idx=l.findIndex(x=>x.id===portalState.editingItemId);if(idx>-1){nI.timestamp=l[idx].timestamp||Date.now();l[idx]=nI;}}else{nI.timestamp=Date.now();l.push(nI);}if(portalState.addingType==='games')db.ref('portal_games_list').set(l);else db.ref('portal_quiz_list').set(l);document.getElementById('bottom-nav').style.display='flex';switchTab(portalState.addingType);showToast('Enregistré !','success');}catch(e){showToast('Erreur : '+e.message,'error');}}
function exportData(){const b=new Blob([JSON.stringify({games:portalState.games,quiz:portalState.quiz},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='boardiz_backup.json';a.click();showToast('Export téléchargé','success');}

/* ===== RATING/COMMENTS ===== */
function openRatingModal(id,event){if(event)event.stopPropagation();portalState.activeItemId=id;let l=[...(portalState.games||[]),...(portalState.quiz||[])];const i=l.find(x=>x.id===id);if(!i)return;document.getElementById('rating-title').innerText=i.title;let iR=portalState.ratings[id]||{};let s=Object.values(iR);document.getElementById('modal-avg-rating').innerText=s.length?(s.reduce((a,b)=>a+b,0)/s.length).toFixed(1):0;renderStars(portalState.currentUser?(iR[portalState.currentUser.uid]||0):0);let iC=portalState.comments[id]||{};document.getElementById('modal-comments-box').innerHTML=Object.values(iC).map(c=>`<div class=\"comment-item\"><b>${c.author}</b> : ${c.text}</div>`).join('')||"<div style='opacity:0.5;font-size:0.82rem;'>Aucun avis.</div>";document.getElementById('rating-modal').style.display='flex';}
function renderStars(v){document.querySelectorAll('#modal-my-rating-ui span').forEach((s,i)=>{s.className=i<v?'active':''});}
function rateGame(v){if(!portalState.currentUser)return;db.ref(`portal_users/${portalState.currentUser.uid}/stats/ratingsCount`).transaction(c=>(c||0)+1);addXP(5);db.ref(`portal_ratings/${portalState.activeItemId}/${portalState.currentUser.uid}`).set(v);renderStars(v);showToast('Note enregistrée !','success',1500);}
function postComment(){let input=document.getElementById('modal-comment-input');let text=input.value.trim();if(!text||!portalState.currentUser)return;db.ref(`portal_users/${portalState.currentUser.uid}/stats/commentsCount`).transaction(c=>(c||0)+1);addXP(5);db.ref(`portal_comments/${portalState.activeItemId}`).push({author:portalState.currentUser.name,text:text,time:Date.now()});input.value='';showToast('Commentaire publié !','success',1500);}
function openInfo(id,t,e){e.stopPropagation();portalState.activeItemId=id;let l=t==='games'?portalState.games:portalState.quiz;const i=l.find(x=>x.id===id);if(!i)return;document.getElementById('global-rules-title').innerText=i.title;document.getElementById('global-rules-title').style.color=i.color;document.getElementById('global-rules-content').innerHTML=i.rules?i.rules.replace(/\n/g,'<br>'):"Aucune règle renseignée.";document.getElementById('global-rules-modal').style.display='flex';}

/* ===== AUTH ===== */
function generateFriendCode(){let c="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",r="";for(let i=0;i<5;i++)r+=c.charAt(Math.floor(Math.random()*c.length));return r;}
async function checkUniqueUsername(n){try{let s=await db.ref('portal_usernames/'+n.toLowerCase()).once('value');return!s.exists();}catch(e){return true;}}
async function updateUsernameMap(o,n,uid){try{if(o)await db.ref('portal_usernames/'+o.toLowerCase()).remove();await db.ref('portal_usernames/'+n.toLowerCase()).set(uid);}catch(e){}}
function loginGoogle(){auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e=>{showToast('Erreur de connexion','error');});}
function tryLocalLogin(){let uI=document.getElementById('login-user');let pI=document.getElementById('login-pass');let u=uI?uI.value.trim():'';let p=pI?pI.value.trim():'';if(u==='nassim'&&p==='nassim'){setupUserSession({uid:'admin_local',name:'Nassim',avatar:'👑',role:'admin'});}else if(u){setupUserSession({uid:'local_'+u.replace(/\W/g,''),name:u,avatar:'👽',role:'guest'});}else showToast('Identifiant requis !','error');}
async function loginAsGuest(){let b="Joueur"+Math.floor(Math.random()*1000);let u=true;try{u=await checkUniqueUsername(b);}catch(e){}let n=u?b:b+"x";setupUserSession({uid:'guest_'+Date.now(),name:n,avatar:'👻',role:'guest'});}
async function editProfileName(){let n=prompt("Nouveau pseudo :",portalState.currentUser.name);if(n&&n.trim()!==""){n=n.trim();let u=await checkUniqueUsername(n);if(!u)return showToast('Déjà pris !','error');await updateUsernameMap(portalState.currentUser.name,n,portalState.currentUser.uid);portalState.currentUser.name=n;document.getElementById('prof-name').innerText=n+" #"+portalState.currentUser.friendCode;db.ref('portal_users/'+portalState.currentUser.uid).update({name:n});showToast('Pseudo mis à jour !','success');}}
function logout(){if(portalState.currentUser)db.ref('portal_users/'+portalState.currentUser.uid).update({online:false});portalState.currentUser=null;portalState.role='guest';document.getElementById('bottom-nav').classList.remove('active');switchScreen('login-container');}

/* ===== NAV & SCREENS ===== */
function switchScreen(id){document.querySelectorAll('.screen-container').forEach(s=>s.classList.remove('active'));let sc=document.getElementById(id);if(sc)sc.classList.add('active');else{let g=document.getElementById('games-container');if(g)g.classList.add('active');}}
function switchTab(t){if(!t||!document.getElementById('nav-'+t))t='games';portalState.currentTab=t;localStorage.setItem('saved_tab',t);document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));let btn=document.getElementById('nav-'+t);if(btn)btn.classList.add('active');if(t==='chat'){portalState.lastChatViewTime=Date.now();portalState.unreadGlobal=false;updateNavBadges();}if(t!=='lobbies'){clearInterval(window._lobbyTimerInterval);window._lobbyTimerInterval=null;}switchScreen(t+'-container');}
function updateGaugeLabel(t,v){document.getElementById(`lbl-players-${t}`).innerText=v==0?"👥 Joueurs : Tous":`👥 Joueurs : ${v}`;}
function toggleTheme(){document.body.classList.toggle('light-mode');portalState.settings.theme=document.body.classList.contains('light-mode')?'light':'dark';localStorage.setItem('portal_theme',portalState.settings.theme);updateSettingsToggles();}
function toggleSound(){portalState.settings.sound=!portalState.settings.sound;document.getElementById('sound-icon').textContent=portalState.settings.sound?'🔊':'🔇';let sw=document.getElementById('sound-toggle-sw');if(sw)sw.classList.toggle('on',portalState.settings.sound);}
function toggleNotifs(){if(Notification.permission!=="granted")Notification.requestPermission().then(p=>{if(p==="granted"){portalState.settings.notifs=true;document.getElementById('notif-toggle-sw').classList.add('on');}});else{portalState.settings.notifs=!portalState.settings.notifs;document.getElementById('notif-toggle-sw').classList.toggle('on',portalState.settings.notifs);}}

/* ===== ADMIN LOBBY CONTROLS ===== */
function deleteAllLobbies(){if(portalState.role==='admin'&&confirm("⚠️ Supprimer TOUS les salons ?")){db.ref('portal_lobbies').remove();db.ref('quiz_emoji_rooms').remove();showToast('Tous les salons supprimés','success');}}
function deleteLobbyManual(lId,isQuiz,e){if(e)e.stopPropagation();if(confirm("Supprimer ce salon ?")){if(isQuiz)db.ref('quiz_emoji_rooms/'+lId).remove();else db.ref('portal_lobbies/'+lId).remove();}}
function deleteMsg(id){if(confirm("Supprimer ?"))db.ref('global_chat/'+id).remove();}
function deleteConv(uid,e){e.stopPropagation();if(confirm("Supprimer cette conversation ?"))db.ref(`portal_users/${portalState.currentUser.uid}/inbox/${uid}`).remove();}

/* ===== FRIENDS ===== */
async function addFriendByCode(){
  let c=document.getElementById('add-friend-input').value.trim().toUpperCase();if(!c)return;
  let snap=await db.ref('portal_friend_codes/'+c).once('value');
  if(snap.exists()){
    let fUid=snap.val();if(fUid===portalState.currentUser.uid)return showToast("C'est votre code !",'error');
    db.ref(`portal_users/${fUid}/friendRequests/${portalState.currentUser.uid}`).set({name:portalState.currentUser.name,avatar:portalState.currentUser.avatar,time:Date.now()});
    showToast('Demande envoyée !','success');document.getElementById('add-friend-input').value='';
  }else showToast('Code introuvable','error');
}
function addFriendByUid(uid){if(uid&&portalState.currentUser&&uid!==portalState.currentUser.uid){db.ref(`portal_users/${uid}/friendRequests/${portalState.currentUser.uid}`).set({name:portalState.currentUser.name,avatar:portalState.currentUser.avatar,time:Date.now()});showToast('Demande envoyée !','success');}}
function shareFriendCode(){let c=portalState.currentUser.friendCode;let txt=`Rejoins-moi sur Boardiz ! Code : ${c}`;if(navigator.share)navigator.share({title:'Code Ami Boardiz',text:txt}).catch(()=>{});else{navigator.clipboard.writeText(c);showToast('Code copié : '+c,'success');}}

/* ===== SUGGESTIONS ===== */
function openSuggestModal(){document.getElementById('suggest-modal').style.display='flex';}
function openBugModal(){document.getElementById('bug-modal').style.display='flex';}
function sendBugReport(){let v=document.getElementById('bug-input').value.trim();if(!v)return;addXP(5);db.ref('portal_bugs').push({author:portalState.currentUser?portalState.currentUser.name:'Anonyme',text:v,time:Date.now()});document.getElementById('bug-input').value='';document.getElementById('bug-modal').style.display='none';showToast('Bug signalé ! Merci 🙏','success');}
function sendSuggestion(){let v=document.getElementById('suggest-input').value.trim();if(!v)return;db.ref(`portal_users/${portalState.currentUser.uid}/stats/suggestionsCount`).transaction(c=>(c||0)+1);addXP(10);db.ref('portal_suggestions').push({author:portalState.currentUser?portalState.currentUser.name:'Anonyme',text:v,time:Date.now()});document.getElementById('suggest-input').value='';document.getElementById('suggest-modal').style.display='none';showToast('Suggestion envoyée ! Merci 🙏','success');}
function viewSuggestions(){document.getElementById('admin-sugg-modal').style.display='flex';db.ref('portal_suggestions').on('value',s=>{let b=document.getElementById('sugg-list');b.innerHTML='';if(s.exists()){s.forEach(c=>{let d=c.val();b.innerHTML+=`<div class=\"quest-box\" style=\"font-size:0.82rem;\"><b>${d.author}</b> : ${d.text}</div>`;});}else b.innerHTML='<div style=\"opacity:0.5;\">Aucune suggestion.</div>';});}
function viewBugs(){document.getElementById('admin-bugs-modal').style.display='flex';db.ref('portal_bugs').on('value',s=>{let b=document.getElementById('bugs-list');b.innerHTML='';if(s.exists()){s.forEach(c=>{let d=c.val();let date=new Date(d.time);let ds=`${date.getDate()}/${date.getMonth()+1} ${date.getHours()}:${date.getMinutes().toString().padStart(2,'0')}`;b.innerHTML+=`<div class=\"quest-box\" style=\"font-size:0.82rem; border-color:rgba(244,63,94,0.3);\"><div style=\"display:flex;justify-content:space-between;margin-bottom:4px;\"><b style=\"color:var(--red);\">${d.author}</b><span style=\"font-size:0.7rem;color:var(--text-muted);\">${ds}</span></div>${d.text}</div>`;});}else b.innerHTML='<div style=\"opacity:0.5;\">Aucun bug signalé.</div>';});}
function clearBugs(){if(confirm('Effacer tous les bugs ?')){db.ref('portal_bugs').remove();showToast('Bugs effacés','success');}}
function sendInvite(uid,e){if(e)e.stopPropagation();if(!portalState.currentLobbyId||!portalState.pendingLaunchId)return;let g=[...(portalState.games||[]),...(portalState.quiz||[])].find(x=>x.id===portalState.pendingLaunchId);db.ref(`portal_users/${uid}/invites`).push({fromName:portalState.currentUser.name,gameId:portalState.pendingLaunchId,gameTitle:g?g.title:'Un jeu',lobbyId:portalState.currentLobbyId,time:Date.now()});showToast('Invitation envoyée !','success');}