/* ==========================================================================
   Little Knife (v2.0) — Complete Unified Game Engine, 16-Role State Machine,
   3D Map Controller, PeerJS Authority Netcode & Tactical Comms (Audited Final)
   Global Namespace: window.LK
   ========================================================================== */
(() => {
  'use strict';

  const Engine = {};
  const AI = {};
  const Map3D = {};
  const UI = {};

  // ========================================================================
  // 1. Static Configuration Tables (AI Names, Weather, Artifacts, Contracts, 16 Roles)
  // ========================================================================
  const AI_NAMES = [
    '御坂美琴', '五条悟', '夜神月', '椎名真白',
    '雪之下雪乃', '阿良良木历', '槙岛圣护', 'L·Lawliet',
    '鲁路修', '晓美焰', '坂田银时', '一方通行',
    '卫宫切嗣', '两仪式', '折木奉太郎', '雨宫莲'
  ];

  const HAND_META = {
    rock: { id: 'rock', label: '石头', icon: '✊' },
    paper: { id: 'paper', label: '布', icon: '✋' },
    scissors: { id: 'scissors', label: '剪刀', icon: '✌️' }
  };

  const WEATHERS = {
    clear: { id: 'clear', name: '晴朗', desc: '无特殊天象效果', mood: 'p3r' },
    bloodmoon: { id: 'bloodmoon', name: '血月', desc: '全局所有伤害 +0.5', mood: 'p5r' },
    fog: { id: 'fog', name: '迷雾', desc: '3D 地图坐标遮蔽（???）', mood: 'p3r' },
    storm: { id: 'storm', name: '雷暴', desc: '陆地层禁止穿裤', mood: 'p3r' }
  };

  const ARTIFACTS = {
    SQ1: { id: 'SQ1', name: 'SQ1 大刀', short: '大刀', stepsNeed: 2, desc: '攻击伤害与扒裤效果翻倍' },
    SQ2: { id: 'SQ2', name: 'SQ2 利刃', short: '利刃', stepsNeed: 1, desc: '1步突进移动到任意可达点并免费攻击1次' },
    SQ3: { id: 'SQ3', name: 'SQ3 猪脸', short: '猪脸', stepsNeed: 3, desc: '任何玩家对你互动（含远程）前须先贴脸花1步捏脸（按每张猪脸实例独立记录）' },
    SQ4: { id: 'SQ4', name: 'SQ4 云梯', short: '云梯', stepsNeed: 2, desc: '随时1步登天（天二），或在天空1步无伤降落任意非狱内地点' }
  };

  const WISH_OPTIONS = [
    { id: 'revive', name: '冥界召回', desc: '复活1名阵亡玩家（1裤1命，位于地府）' },
    { id: 'swap', name: '空间置换', desc: '互换任意2名存活玩家的位置' },
    { id: 'drain_oxy', name: '抽干氧源', desc: '削减所有海/空玩家呼吸额度（缺氧计数 +1）' },
    { id: 'jail', name: '天降法槌', desc: '强制送任意1名存活玩家入狱' },
    { id: 'disarm', name: '全图缴械', desc: '清空全场所有玩家手中的刀' }
  ];

  const CONTRACTS = [
    { id: 'bm_overcharge', name: '① 过载充能', gain: '主动技次数 +1（无主动技者得 1 层黑市护盾）', cost: '炸 1 裤（不足 1 裤则扣 0.5 命）' },
    { id: 'bm_bomb', name: '② 人体炸弹', gain: '主动技回满（无主动技者直接拿 2 刀）', cost: '绑定 2 回合炸弹，须贴脸过继否则自爆扣 1 命' },
    { id: 'bm_sacrifice', name: '③ 血肉献祭', gain: '+2 刀，并随机推进 1 件未产出龙宫神器 +1 格', cost: '扣除自身 0.5 命' },
    { id: 'bm_elixir', name: '④ 禁药续命', gain: '生命值 +1 命', cost: '当前裤子清零' },
    { id: 'bm_overdraft', name: '⑤ 透支未来', gain: '本回合立刻 +1 步', cost: '下回合陷入麻痹（无法行动）' },
    { id: 'bm_swap_pants', name: '⑥ 强制换裤', gain: '远程与 1 名存活玩家互换当前裤子', cost: '清空自身所有刀' },
    { id: 'bm_bounty_strip', name: '⑦ 黑市通缉', gain: '远程扒除任意 1 名存活玩家 1 裤', cost: '强制进入警察局且自身 -0.5 裤' },
    { id: 'bm_smuggle_dive', name: '⑧ 走私潜航', gain: '修好氧气瓶（若完好则得 1 次防窒息保险）并 +1 裤', cost: '随机强制冲入海洋层某一地点' }
  ];

  const ROLES = [
    { id: 'normal', num: '01', name: '普通人', arch: 'survival', archName: '生存', hp: 1, pants: 1.5, maxPants: 2, knives: 0, atkMult: 1, activeMax: 0, activeCost: 0, activeName: '无主动技', activeDesc: '扎实的初始面板与黑市特权，契约过载时改为获取黑市护盾。', passiveName: '精明淘货', passiveDesc: '每次进入黑市抽契约可免费刷新 1 次（每回合限 1 次）。', brief: '稳健面板 + 黑市免费重抽' },
    { id: 'raider', num: '02', name: '突袭者', arch: 'assassin', archName: '刺客', hp: 1, pants: 0.5, maxPants: 1, knives: 1, atkMult: 1.5, activeMax: 1, activeCost: 1, activeName: '量子隐身', activeDesc: '耗1步进入隐身且不立刻行动；下回合他人可在自身位置宣告预判攻击；全员走完后你从白名单（单人移动/穿裤/拔刀/呼吸）揭晓暗步，结算预判命中或扑空，若本回合获步再立刻行动。', passiveName: '处决刃锋', passiveDesc: '开局自带 1 把刀，常规「咔」与突进伤害为 1.5 倍。', brief: '1.5x 伤害 + 量子隐身心理博弈' },
    { id: 'storm', num: '03', name: '风暴者', arch: 'control', archName: '控场', hp: 1, pants: 0.5, maxPants: 1.5, knives: 0, atkMult: 1, activeMax: 2, activeCost: 0, activeName: '乱流风暴', activeDesc: '远程将同层级的单人（免费，不耗步）或整个地点所有存活单位（耗 1 步）强制吹至同层其他非狱内地点，不触发带人。', passiveName: '气压掌控', passiveDesc: '吹飞单人不消耗常规步数，可无缝衔接击杀或拆伙。', brief: '免费吹单人 / 1步吹全地点' },
    { id: 'tough', num: '04', name: '坚韧者', arch: 'survival', archName: '生存', hp: 4, pants: 1, maxPants: 2, knives: 0, atkMult: 1, activeMax: 0, activeCost: 0, activeName: '无主动技', activeDesc: '以绝对血量压制全场，无主动技（黑市过载改为获得护盾）。', passiveName: '钢铁躯体', passiveDesc: '初始拥有高达 4 命，容错率冠绝全场。', brief: '4 命肉盾，硬抗致命斩杀' },
    { id: 'chili', num: '05', name: '辛红辣椒', arch: 'control', archName: '控场', hp: 1, pants: 1, maxPants: 1.5, knives: 0, atkMult: 1, activeMax: 2, activeCost: 1, activeName: '电击麻痹', activeDesc: '耗1步远程电击任意1名存活玩家，使其下回合无论获得多少步都无法行动。', passiveName: '高压电弧', passiveDesc: '远程强硬封锁关键目标节奏，打断神器与复活推进。', brief: '远程电击，下回合强制麻痹' },
    { id: 'watcher', num: '06', name: '监视者', arch: 'control', archName: '控场', hp: 1, pants: 1, maxPants: 2, knives: 0, atkMult: 1, activeMax: 2, activeCost: 1, activeName: '远程抓捕', activeDesc: '耗1步随时随地（含狱内）对任意存活玩家发起三局两胜逮捕猜拳，败者入狱。', passiveName: '全境法眼', passiveDesc: '不受警局位置限制，狱内亦可反手拉人陪葬。', brief: '全图远程三局两胜逮捕入狱' },
    { id: 'aquaman', num: '07', name: '海王', arch: 'survival', archName: '生存', hp: 1, pants: 1, maxPants: 2, knives: 0, atkMult: 1, activeMax: 0, activeCost: 0, activeName: '无主动技', activeDesc: '依靠被动水遁掌控海洋龙宫资源与无解越狱能力。', passiveName: '深海潜行', passiveDesc: '随时随地（含狱内，无代价，被结界封锁时除外）可耗1步直接下海；从海洋上岸时固定回到码头。', brief: '任意点/狱内 1 步自由下海' },
    { id: 'piggy', num: '08', name: '小猪', arch: 'trick', archName: '诡计', hp: 1, pants: 0, maxPants: 0, knives: 0, atkMult: 1, activeMax: 1, activeCost: 0, activeName: '顺手牵刀', activeDesc: '开启后，在你攻击（「咔」/利刃突进）同地点目标时免费抢走对方 1 把刀。', passiveName: '天生猪脸', passiveDesc: '开局自带独立 SQ3 猪脸（不占龙宫且死亡不掉落，地府重生生成全新猪脸实例需重捏）。', brief: '自带独立猪脸 + 攻击免费抢刀' },
    { id: 'ninja', num: '09', name: '忍者', arch: 'assassin', archName: '刺客', hp: 1, pants: 0, maxPants: 0, knives: 0, atkMult: 1, activeMax: 2, activeCost: 0, activeName: '瞬身连撞', activeDesc: '斩杀任意单位后，可消耗1次技能免费向距离1（1步可达）的另1单位突进撞击，造成1伤（先扣裤，0裤扣命）；若撞死可再次消耗次数连撞！', passiveName: '自带利刃', passiveDesc: '开局自带独立 SQ2 利刃（不占龙宫且死亡不掉落），高机动无裤刺客。', brief: '自带 SQ2 利刃 + 斩杀瞬身连撞' },
    { id: 'puppeteer', num: '10', name: '操偶师', arch: 'control', archName: '控场', hp: 1, pants: 0.5, maxPants: 1, knives: 0, atkMult: 1, activeMax: 2, activeCost: 1, activeName: '提线木偶', activeDesc: '耗1步强控同层级1名存活玩家，令其立刻执行1次基础动作（单人移动 / 穿裤 / 拔刀 / 同地点扒裤）。', passiveName: '丝线操纵', passiveDesc: '可借敌之手扒裤、把敌人拉出掩体或送进绝境。', brief: '远程强控同层目标执行动作' },
    { id: 'parasite', num: '11', name: '寄生者', arch: 'assassin', archName: '刺客', hp: 1, pants: 0.5, maxPants: 1, knives: 0, atkMult: 1, activeMax: 2, activeCost: 1, activeName: '寄生', activeDesc: '同地点耗1步附身目标，免费随行并共享氧气/青蛙面罩；宿主花1步扒裤可甩开；宿主掉血/死亡则震出并清裤，入狱连坐；附身态可花1步破体而出并免费扒/咔宿主。', passiveName: '破体奇袭', passiveDesc: '借壳蹭车蹭氧，择机破体斩杀宿主。', brief: '贴脸附身蹭车 + 破体免费扒/咔' },
    { id: 'mirror', num: '12', name: '镜像师', arch: 'trick', archName: '诡计', hp: 1, pants: 1, maxPants: 1.5, knives: 0, atkMult: 1, activeMax: 2, activeCost: 1, activeName: '盗版', activeDesc: '耗1步复刻并立刻释放本局上一个被使用的主动技（若尚无人使用主动技，则直接 +1 刀 +0.5 裤）。', passiveName: '无限反射', passiveDesc: '以彼之道还施彼身，根据战局动态复制最强控制或爆发。', brief: '复制本局上一个主动技即时释放' },
    { id: 'reverser', num: '13', name: '逆转者', arch: 'trick', archName: '诡计', hp: 1, pants: 0.5, maxPants: 1.5, knives: 0, atkMult: 1, activeMax: 0, activeCost: 0, activeName: '无主动技', activeDesc: '越输越强，一朝翻盘打出多步连击终结战场。', passiveName: '蓄势逆转', passiveDesc: '每输 1 轮猜拳存储 1 层「势」（上限 2 层）；赢拳时自动引爆全部势，本回合额外多走对应步数。', brief: '输拳攒势，赢拳爆发最高 3 连步' },
    { id: 'barrier', num: '14', name: '结界师', arch: 'control', archName: '控场', hp: 1, pants: 0.5, maxPants: 1.5, knives: 0, atkMult: 1, activeMax: 2, activeCost: 1, activeName: '绝对领域', activeDesc: '耗1步远程封锁任意非狱内地点直至下回合末，内外彻底隔绝（无视水遁、云梯、风暴与进出移动）。', passiveName: '空间锁死', passiveDesc: '可将关键地点变作孤岛，瓮中捉鳖或锁死海空缺氧者。', brief: '远程绝对封锁地点至下回合末' },
    { id: 'curser', num: '15', name: '诅咒师', arch: 'trick', archName: '诡计', hp: 1, pants: 1, maxPants: 1.5, knives: 0, atkMult: 1, activeMax: 2, activeCost: 1, activeName: '命运链接', activeDesc: '耗1步远程绑定任意 2 名存活玩家持续 2 回合，期间一方扣裤或扣血时另一方同步承受同等代价。', passiveName: '血咒共振', passiveDesc: '强行制造双人共死困局，令肉盾与通缉犯无处可逃。', brief: '绑定 2 人共担扣裤与伤害 2 回合' },
    { id: 'undertaker', num: '16', name: '收尸人', arch: 'survival', archName: '生存', hp: 1, pants: 1, maxPants: 1.5, knives: 0, atkMult: 1, activeMax: 2, activeCost: 1, activeName: '封魂', activeDesc: '耗1步远程销毁 1 名处于待地府复活状态玩家的复活资格（令其直接死透），并回复自身 +0.5 命。', passiveName: '敛尸成刃', passiveDesc: '场上每有 1 名玩家阵亡，自身自动获得 +1 刀。', brief: '死人自动加刀 + 远程掐灭地府复活' }
  ];

  const ROLE_MAP = Object.fromEntries(ROLES.map((r) => [r.id, r]));

  const STATIC_NODES = [
    { id: 'sky_one', name: '天一·云阶', layer: 'sky', x: 20, y: 52, kind: 'sky_step1', collapsible: true, desc: '升天过渡点。回合末滞留此地将强制坠落（落陆 -2 命；落海无伤但摔坏氧气瓶）。' },
    { id: 'sky_stable', name: '马厩', layer: 'sky', x: 48, y: 26, kind: 'stable', collapsible: true, desc: '天二地点：耗 1 步安全降落至陆地任意非狱内地点。' },
    { id: 'sky_wish', name: '许愿池', layer: 'sky', x: 78, y: 44, kind: 'wish', collapsible: true, desc: '天二地点：个人累计投入 3 步发动终极许愿（复活/换位/削氧/入狱/全图缴械）。' },
    { id: 'sky_observatory', name: '天象台', layer: 'sky', x: 52, y: 76, kind: 'observatory', collapsible: true, desc: '天二地点：耗 1 步改写下回合全图天象（血月 / 迷雾 / 雷暴）。' },

    { id: 'land_police', name: '警察局', layer: 'land', x: 24, y: 24, kind: 'police', collapsible: true, desc: '1步远程三局两胜逮捕；1步搬尸回 +0.5 HP；1步自首入狱。' },
    { id: 'land_prison_out', name: '监狱外', layer: 'land', x: 50, y: 20, kind: 'prison_out', collapsible: true, desc: '常驻无限刷新 NPC 典狱长（3裤1命），击杀后狱内全员立刻释放！' },
    { id: 'land_prison_in', name: '监狱内', layer: 'land', x: 74, y: 20, kind: 'prison_in', collapsible: false, desc: '与外界物理隔离。可直接扒/咔典狱长自行越狱，或等待外界劫狱、海王水遁逃生。' },
    { id: 'land_dock', name: '码头', layer: 'land', x: 22, y: 76, kind: 'dock', collapsible: true, desc: '耗 1 步下海前往水族馆、遗迹或龙宫。' },
    { id: 'land_blackmarket', name: '黑市', layer: 'land', x: 52, y: 78, kind: 'blackmarket', collapsible: true, desc: '耗 1 步不猜拳，随机抽取 3 份恶魔契约择一签下（或放弃）。' },
    { id: 'land_underworld', name: '地府', layer: 'land', x: 80, y: 74, kind: 'underworld', collapsible: true, desc: '普通陆地地点（活人可堵门），也是阵亡者赢拳复活后的出生之地。' },

    { id: 'ocean_aquarium', name: '水族馆', layer: 'ocean', x: 24, y: 48, kind: 'aquarium', collapsible: true, desc: '耗 1 步佩戴青蛙面罩（永久水下呼吸，代价：裤清零且上限永久 0，HP 变为 0.5）。' },
    { id: 'ocean_ruins', name: '遗迹', layer: 'ocean', x: 54, y: 66, kind: 'ruins', collapsible: true, desc: '受击享 50% 闪避；耗 1 步挖掘（25% 成功令裤上限暴增至 10）。' },
    { id: 'ocean_palace', name: '龙宫', layer: 'ocean', x: 78, y: 38, kind: 'palace', collapsible: true, desc: '全服共享进度锻造 4 件唯一神器（SQ1大刀 / SQ2利刃 / SQ3猪脸 / SQ4云梯）。' }
  ];

  const HOME_SLOTS = [
    { x: 14, y: 48 }, { x: 34, y: 46 }, { x: 54, y: 48 }, { x: 74, y: 48 },
    { x: 88, y: 46 }, { x: 36, y: 60 }, { x: 64, y: 60 }, { x: 46, y: 36 }
  ];

  const DEFAULT_CONFIG = {
    collapseEnabled: true,
    collapseStartTurn: 10,
    bountyEnabled: true,
    bountyArtifacts: 2,
    bountyKills: 2,
    oxygenMax: 5,
    aiDelayMs: 1600,
    vfxEnabled: true
  };

  function createEmptyLobbyState() {
    return {
      mode: 'solo',
      roomCode: '',
      selfId: 'p_local_0',
      hostId: 'p_local_0',
      started: false,
      phase: 'lobby',
      turn: 0,
      weather: 'clear',
      nextWeather: null,
      config: { ...DEFAULT_CONFIG },
      lobbyPlayers: [],
      players: [],
      nodes: {},
      warden: { hp: 1, pants: 3, maxPants: 3, respawnCount: 0 },
      artifacts: {
        SQ1: { id: 'SQ1', progress: 0, ownerId: null, droppedAt: null },
        SQ2: { id: 'SQ2', progress: 0, ownerId: null, droppedAt: null },
        SQ3: { id: 'SQ3', progress: 0, ownerId: null, droppedAt: null, instanceId: 1 },
        SQ4: { id: 'SQ4', progress: 0, ownerId: null, droppedAt: null }
      },
      lastActiveSkill: null,
      links: [],
      rps: null,
      initiative: null,
      subRps: null,
      turnQueue: [],
      activePlayerId: null,
      stealthRevealQueue: [],
      pendingAction: null,
      logs: [],
      chat: [],
      winnerId: null,
      winnerReason: '',
      fxSeq: 0,
      recentFx: []
    };
  }

  let state = createEmptyLobbyState();

  const localUI = {
    selectedRoleFilter: 'all',
    selectedRoleId: 'normal',
    showEmptyNodes: false,
    commsOpen: false,
    commsUnread: 0,
    lastFxSeqPlayed: 0,
    activeModal: null,
    guideStep: 0,
    subPanelState: null,
    mobileTab: 'map',
    unreadLogCount: 0,
    lastLogCount: 0,
    pendingTimers: []
  };

  // ========================================================================
  // 2. Shared Utilities & VFX Synchronizer
  // ========================================================================
  function uid(prefix = 'id') {
    return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
  }
  function roundHalf(val) { return Math.round(Number(val || 0) * 2) / 2; }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function randomRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 4; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  function pickUniqueAiName(existingList) {
    const used = new Set(existingList.map((p) => p.name));
    const pool = AI_NAMES.filter((n) => !used.has(n));
    return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : `特工AI-${Math.floor(10 + Math.random() * 89)}`;
  }

  function getSelfLobby() { return state.lobbyPlayers.find((p) => p.id === state.selfId) || null; }
  function getSelfPlayer() { return state.players.find((p) => p.id === state.selfId) || null; }
  function getPlayer(id) { return state.players.find((p) => p.id === id) || null; }
  function isHostAuthority() { return state.mode === 'solo' || state.mode === 'host'; }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatLogHtml(rawText) {
    let s = escapeHtml(rawText);
    s = s.replace(/(【[^】]+】)/g, '<span class="hl-loc">$1</span>');
    s = s.replace(/([+-]?\d+(?:\.\d+)?(?:❤️|命))/g, (m) =>
      m.startsWith('+') ? `<span class="hl-heal">${m}</span>` : `<span class="hl-dmg">${m}</span>`
    );
    s = s.replace(/([+-]?\d+(?:\.\d+)?(?:👖|裤))/g, '<span class="hl-pants">$1</span>');
    s = s.replace(/((?:各)?\+\d+(?:步|🔪|刀))/g, '<span class="hl-step">$1</span>');
    s = s.replace(/(阵亡|死透|通缉|坍塌|自爆|入狱|复活|麻痹|绝杀|闪避|MISS|越狱)/g, '<span class="hl-alert">$1</span>');
    return s;
  }

  function addLog(text, kind = 'normal') {
    state.logs.push({ id: uid('log'), turn: state.turn, text, kind });
    if (state.logs.length > 140) state.logs.splice(0, state.logs.length - 140);
  }

  function scheduleHostTask(fn, ms) {
    const t = window.setTimeout(() => {
      localUI.pendingTimers = localUI.pendingTimers.filter((x) => x !== t);
      fn();
    }, ms);
    localUI.pendingTimers.push(t);
  }

  function clearHostTasks() {
    localUI.pendingTimers.forEach((t) => window.clearTimeout(t));
    localUI.pendingTimers = [];
  }

  function emitFx(type, payload = {}) {
    state.fxSeq += 1;
    const ev = { seq: state.fxSeq, type, payload };
    state.recentFx.push(ev);
    if (state.recentFx.length > 32) state.recentFx.splice(0, state.recentFx.length - 32);
    playFxEvent(ev);
    localUI.lastFxSeqPlayed = Math.max(localUI.lastFxSeqPlayed, ev.seq);
  }

  function playFxEvent(ev) {
    const vfx = window.VFX;
    if (!vfx || !ev) return;
    const p = ev.payload || {};
    switch (ev.type) {
      case 'banner': vfx.banner(p.kicker, p.title, p.sub, p.mood, p.durationMs); break;
      case 'bannerAction': vfx.bannerAction(p); break;
      case 'slash': vfx.slash(p); break;
      case 'electricArc': vfx.electricArc(p); break;
      case 'float': vfx.floatOnNode(p.nodeId, p.text, p.kind); break;
      case 'ripple': vfx.rippleOnNode(p.nodeId, p.color, p.rings); break;
      case 'rpsClash': vfx.rpsClash(p); break;
      case 'sfx': vfx.sfx(p.name); break;
      case 'mood': vfx.setMood(p.mood); break;
      case 'weather': vfx.setWeather(p.weather); break;
      case 'toast': vfx.toast(p.msg, p.level); break;
      default: break;
    }
  }

  function replayNewFxFromSnapshot() {
    if (!Array.isArray(state.recentFx)) return;
    for (const ev of state.recentFx) {
      if (ev.seq > localUI.lastFxSeqPlayed) {
        playFxEvent(ev);
        localUI.lastFxSeqPlayed = ev.seq;
      }
    }
  }

  function readLobbyConfigFromDOM() {
    const g = (id) => document.getElementById(id);
    return {
      collapseEnabled: g('opt-collapse') ? g('opt-collapse').checked : true,
      collapseStartTurn: clamp(Number(g('cfg-collapse-turn')?.value) || 10, 3, 30),
      bountyEnabled: g('opt-bounty') ? g('opt-bounty').checked : true,
      bountyArtifacts: clamp(Number(g('cfg-bounty-artifacts')?.value) || 2, 1, 4),
      bountyKills: clamp(Number(g('cfg-bounty-kills')?.value) || 2, 1, 6),
      oxygenMax: clamp(Number(g('cfg-oxygen-max')?.value) || 5, 3, 10),
      aiDelayMs: clamp(Number(g('cfg-ai-delay')?.value) || 1600, 400, 3500),
      vfxEnabled: g('opt-vfx') ? g('opt-vfx').checked : true
    };
  }

  function syncLobbyRuleCheckboxes() {
    const setCheck = (id, v) => { const el = document.getElementById(id); if (el) el.checked = Boolean(v); };
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = String(v); };
    setCheck('opt-collapse', state.config.collapseEnabled);
    setCheck('opt-bounty', state.config.bountyEnabled);
    setCheck('opt-vfx', state.config.vfxEnabled);
    setCheck('cfg-opt-collapse', state.config.collapseEnabled);
    setCheck('cfg-opt-bounty', state.config.bountyEnabled);
    setCheck('cfg-opt-vfx', state.config.vfxEnabled);
    setVal('cfg-collapse-turn', state.config.collapseStartTurn);
    setVal('cfg-oxygen-max', state.config.oxygenMax);
    setVal('cfg-bounty-artifacts', state.config.bountyArtifacts);
    setVal('cfg-bounty-kills', state.config.bountyKills);
    setVal('cfg-ai-delay', state.config.aiDelayMs);
  }

  function syncMoodFromState() {
    if (!state.started) { window.VFX?.setMood('p3r'); return; }
    const anyWanted = state.players.some((p) => p.status === 'alive' && p.wanted);
    const collapseActive = state.config.collapseEnabled && state.turn >= state.config.collapseStartTurn;
    const isClimax = state.weather === 'bloodmoon' || anyWanted || collapseActive || state.phase === 'sub_rps';
    window.VFX?.setMood(isClimax ? 'p5r' : 'p3r');
  }

  // ========================================================================
  // 3. PeerJS Authority Netcode + Disconnect AI Takeover + Solo Fallback
  // ========================================================================
  const PEER_PREFIX = 'LK20-ROOM-';

  const Net = (() => {
    let peer = null;
    let hostConn = null;
    const clientConns = new Map();
    let joinTimeoutTimer = 0;

    function setConnBadge(text, level = 'ok') {
      const badge = document.getElementById('conn-status-badge');
      if (!badge) return;
      badge.textContent = text;
      badge.classList.remove('is-warn', 'is-err');
      if (level === 'warn') badge.classList.add('is-warn');
      if (level === 'err') badge.classList.add('is-err');
    }

    function teardownPeer() {
      window.clearTimeout(joinTimeoutTimer);
      clientConns.forEach((conn) => { try { conn.close(); } catch (_) {} });
      clientConns.clear();
      if (hostConn) { try { hostConn.close(); } catch (_) {} hostConn = null; }
      if (peer) { try { peer.destroy(); } catch (_) {} peer = null; }
    }

    function getNicknameInput() {
      const el = document.getElementById('input-nickname');
      const raw = (el ? el.value : '').trim();
      return raw || `特工${Math.floor(100 + Math.random() * 899)}`;
    }

    function ensurePeerJsLoaded() {
      if (typeof window.Peer !== 'function') {
        window.VFX?.toast('PeerJS CDN 未加载，将自动切换本地单机 AI 模式', 'warn');
        return false;
      }
      return true;
    }

    function showRoomBar(code, statusText, level) {
      const bar = document.getElementById('room-code-bar');
      const val = document.getElementById('display-room-code');
      if (bar) bar.classList.remove('is-hidden');
      if (val) val.textContent = code || '----';
      setConnBadge(statusText, level);
    }

    function createRoom() {
      teardownPeer();
      clearHostTasks();
      const nick = getNicknameInput();

      if (!ensurePeerJsLoaded()) {
        fallbackToSolo('PeerJS 不可用，已切换为本地单机试玩');
        return;
      }

      const code = randomRoomCode();
      const peerId = `${PEER_PREFIX}${code}`;

      state = createEmptyLobbyState();
      localUI.lastFxSeqPlayed = 0;
      state.mode = 'host';
      state.roomCode = code;
      state.selfId = uid('p');
      state.hostId = state.selfId;
      state.lobbyPlayers = [{
        id: state.selfId,
        name: nick,
        roleId: localUI.selectedRoleId || 'normal',
        isHost: true,
        isAI: false,
        connected: true,
        peerId
      }];

      showRoomBar(code, 'CONNECTING...', 'warn');
      UI.renderLobby?.();

      try {
        peer = new window.Peer(peerId, { debug: 1 });
      } catch (err) {
        fallbackToSolo(`建房异常（${err.message}），已切回本地单机`);
        return;
      }

      const openTimer = window.setTimeout(() => {
        if (!peer || !peer.open) fallbackToSolo('信令服务器连接超时，已自动切回本地单机 AI 模式');
      }, 9000);

      peer.on('open', () => {
        window.clearTimeout(openTimer);
        setConnBadge('HOST ONLINE', 'ok');
        window.VFX?.toast(`房间 ${code} 已创建，可复制链接邀请好友`, 'success');
        UI.renderLobby?.();
      });

      peer.on('connection', (conn) => {
        conn.on('open', () => clientConns.set(conn.peer, conn));
        conn.on('data', (msg) => handleHostReceive(conn, msg));
        conn.on('close', () => { clientConns.delete(conn.peer); handleClientDisconnect(conn.peer); });
        conn.on('error', () => { clientConns.delete(conn.peer); handleClientDisconnect(conn.peer); });
      });

      peer.on('error', (err) => {
        window.clearTimeout(openTimer);
        if (err && err.type === 'unavailable-id') {
          window.VFX?.toast('房间码冲突，正在重新生成...', 'warn');
          createRoom();
          return;
        }
        setConnBadge('NET ERR', 'err');
        window.VFX?.toast(`联机信令异常(${err?.type || 'error'})，可使用单机 AI 试玩`, 'danger');
      });
    }

    function handleClientDisconnect(peerId) {
      if (!isHostAuthority()) return;

      const lobbySeat = state.lobbyPlayers.find((p) => p.peerId === peerId);
      if (lobbySeat) {
        if (!state.started) {
          state.lobbyPlayers = state.lobbyPlayers.filter((p) => p.peerId !== peerId);
          window.VFX?.toast(`${lobbySeat.name} 已离开房间`, 'warn');
          broadcastState();
          UI.renderLobby?.();
          return;
        }
        lobbySeat.connected = false;
        lobbySeat.isAI = true;
      }

      const inGame = state.players.find((p) => p.peerId === peerId);
      if (inGame && !inGame.isAI) {
        inGame.connected = false;
        inGame.isAI = true;
        addLog(`⚡ ${inGame.name} 断开连接，已由 AI 自动接管托管！`, 'system');
        emitFx('toast', { msg: `${inGame.name} 掉线，AI 自动接管！`, level: 'warn' });
        broadcastState();
        UI.renderAll?.();
        AI.scheduleTick?.();
      }
    }

    function joinRoom(rawCode) {
      const code = String(rawCode || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{4}$/.test(code)) {
        window.VFX?.toast('请输入 4 位字母/数字房间码', 'warn');
        return;
      }

      if (!ensurePeerJsLoaded()) {
        fallbackToSolo('PeerJS 不可用，已切换本地单机试玩');
        return;
      }

      teardownPeer();
      clearHostTasks();
      const nick = getNicknameInput();
      const clientPeerId = `LK20-CLI-${Math.random().toString(36).slice(2, 9)}`;

      state = createEmptyLobbyState();
      localUI.lastFxSeqPlayed = 0;
      state.mode = 'client';
      state.roomCode = code;
      state.selfId = uid('p');

      showRoomBar(code, 'JOINING...', 'warn');

      try {
        peer = new window.Peer(clientPeerId, { debug: 1 });
      } catch (err) {
        fallbackToSolo(`连接初始化失败（${err.message}），已切回本地单机`);
        return;
      }

      joinTimeoutTimer = window.setTimeout(() => {
        if (!hostConn || !hostConn.open) {
          teardownPeer();
          setConnBadge('TIMEOUT', 'err');
          window.VFX?.toast(`加入房间 ${code} 超时，请核对房间码或点击「单机 AI 试玩」`, 'danger');
          state.mode = 'solo';
        }
      }, 9500);

      peer.on('open', () => {
        const conn = peer.connect(`${PEER_PREFIX}${code}`, { reliable: true });
        hostConn = conn;

        conn.on('open', () => {
          window.clearTimeout(joinTimeoutTimer);
          setConnBadge('CONNECTED', 'ok');
          conn.send({ type: 'HELLO', playerId: state.selfId, name: nick, roleId: localUI.selectedRoleId || 'normal' });
          window.VFX?.toast(`已成功加入房间 ${code}`, 'success');
        });

        conn.on('data', (msg) => handleClientReceive(msg));
        conn.on('close', () => {
          setConnBadge('HOST LOST', 'err');
          window.VFX?.toast('与房主断开连接，已转为本地单机接管剩余战局', 'danger');
          promoteClientToLocalSolo();
        });
        conn.on('error', () => {
          window.clearTimeout(joinTimeoutTimer);
          setConnBadge('CONN ERR', 'err');
          window.VFX?.toast('连接房主失败，请检查房间码或改用单机试玩', 'danger');
        });
      });

      peer.on('error', (err) => {
        window.clearTimeout(joinTimeoutTimer);
        setConnBadge('JOIN FAIL', 'err');
        window.VFX?.toast(`无法连接到房间 ${code} (${err?.type || 'offline'})，可使用单机 AI 试玩`, 'danger');
      });
    }

    function promoteClientToLocalSolo() {
      teardownPeer();
      state.mode = 'solo';
      state.hostId = state.selfId;
      state.lobbyPlayers.forEach((p) => {
        if (p.id !== state.selfId) p.isAI = true;
        else p.isHost = true;
      });
      state.players.forEach((p) => { if (p.id !== state.selfId) p.isAI = true; });
      if (state.started) {
        addLog('⚠ 房主离线，本机已接管权威状态机并由 AI 托管其余席位。', 'system');
        UI.renderAll?.();
        AI.scheduleTick?.();
      } else {
        UI.renderLobby?.();
      }
    }

    function startSolo(totalCount) {
      teardownPeer();
      clearHostTasks();
      const count = clamp(Number(totalCount) || 4, 2, 8);
      const nick = getNicknameInput();

      state = createEmptyLobbyState();
      localUI.lastFxSeqPlayed = 0;
      state.mode = 'solo';
      state.roomCode = '';
      state.selfId = uid('p');
      state.hostId = state.selfId;
      state.config = readLobbyConfigFromDOM();

      state.lobbyPlayers = [{
        id: state.selfId,
        name: nick,
        roleId: localUI.selectedRoleId || 'normal',
        isHost: true,
        isAI: false,
        connected: true,
        peerId: 'local'
      }];

      while (state.lobbyPlayers.length < count) {
        const randRole = ROLES[Math.floor(Math.random() * ROLES.length)].id;
        state.lobbyPlayers.push({
          id: uid('ai'),
          name: pickUniqueAiName(state.lobbyPlayers),
          roleId: randRole,
          isHost: false,
          isAI: true,
          connected: true,
          peerId: 'ai'
        });
      }

      document.getElementById('room-code-bar')?.classList.add('is-hidden');
      Engine.startMatch?.();
    }

    function fallbackToSolo(reason) {
      teardownPeer();
      state.mode = 'solo';
      state.hostId = state.selfId;
      setConnBadge('SOLO MODE', 'warn');
      window.VFX?.toast(reason, 'warn');
      const sel = document.getElementById('select-ai-count');
      startSolo(sel ? Number(sel.value) : 4);
    }

    function handleHostReceive(conn, msg) {
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'HELLO') {
        if (state.started) {
          const reclaim = state.players.find((p) => p.name === msg.name && p.isAI && !p.connected);
          if (reclaim) {
            reclaim.isAI = false;
            reclaim.connected = true;
            reclaim.peerId = conn.peer;
            conn.send({ type: 'WELCOME', assignedId: reclaim.id });
            addLog(`🔌 ${reclaim.name} 重新连回战场，恢复人类操控！`, 'system');
            broadcastState();
            UI.renderAll?.();
            return;
          }
          conn.send({ type: 'ERROR', message: '该房间对局已开始且满员' });
          return;
        }
        if (state.lobbyPlayers.length >= 8) {
          conn.send({ type: 'ERROR', message: '房间已满（最多 8 人）' });
          return;
        }
        const seat = {
          id: msg.playerId || uid('p'),
          name: String(msg.name || '特工').slice(0, 12),
          roleId: ROLE_MAP[msg.roleId] ? msg.roleId : 'normal',
          isHost: false,
          isAI: false,
          connected: true,
          peerId: conn.peer
        };
        state.lobbyPlayers.push(seat);
        conn.send({ type: 'WELCOME', assignedId: seat.id });
        window.VFX?.toast(`${seat.name} 加入了房间`, 'info');
        broadcastState();
        UI.renderLobby?.();
        return;
      }
      if (msg.type === 'SELECT_ROLE') {
        const seat = state.lobbyPlayers.find((p) => p.id === msg.playerId);
        if (seat && ROLE_MAP[msg.roleId] && !state.started) {
          seat.roleId = msg.roleId;
          broadcastState();
          UI.renderLobby?.();
        }
        return;
      }
      if (msg.type === 'INTENT') { Engine.handleIntent?.(msg.playerId, msg.intent); return; }
      if (msg.type === 'CHAT') { Comms.hostReceiveChat(msg.playerId, msg.toId, msg.text); return; }
      if (msg.type === 'EMOJI') { Comms.hostReceiveEmoji(msg.playerId, msg.emoji); }
    }

    function handleClientReceive(msg) {
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'WELCOME' && msg.assignedId) { state.selfId = msg.assignedId; return; }
      if (msg.type === 'ERROR') { window.VFX?.toast(msg.message || '连接被拒绝', 'danger'); return; }
      if (msg.type === 'STATE' && msg.snapshot) {
        const prevSelfId = state.selfId;
        const prevMode = state.mode;
        const prevCode = state.roomCode;
        const prevChatLen = state.chat.length;
        const prevPhase = state.phase;
        const prevStarted = state.started;
        const prevActive = state.activePlayerId;

        state = msg.snapshot;
        state.selfId = prevSelfId;
        state.mode = prevMode;
        state.roomCode = prevCode;

        if (state.fxSeq < localUI.lastFxSeqPlayed) localUI.lastFxSeqPlayed = 0;
        if (state.activePlayerId !== prevActive || state.phase !== prevPhase) {
          localUI.subPanelState = null;
        }

        if (state.chat.length > prevChatLen && !localUI.commsOpen) {
          const added = state.chat.slice(prevChatLen).filter((c) => Comms.canSeeMessage(c));
          if (added.length > 0) {
            localUI.commsUnread += added.length;
            window.VFX?.sfx('chat');
          }
        }

        if (state.started) {
          window.VFX?.setWeather(state.weather);
          syncMoodFromState();
        } else if (prevStarted && !state.started) {
          UI.closeModal?.();
          window.VFX?.setWeather('clear');
          window.VFX?.setMood('p3r');
        }

        replayNewFxFromSnapshot();
        UI.renderAll?.();

        if (state.phase === 'gameover' && prevPhase !== 'gameover') {
          UI.openModal?.('gameover');
        }
      }
    }

    function broadcastState() {
      if (state.mode !== 'host') return;
      clientConns.forEach((conn, peerId) => {
        if (!conn || !conn.open) return;
        const targetSeat = state.lobbyPlayers.find((p) => p.peerId === peerId);
        const targetId = targetSeat ? targetSeat.id : null;
        try { conn.send({ type: 'STATE', snapshot: buildSanitizedSnapshot(targetId) }); } catch (_) {}
      });
    }

    function buildSanitizedSnapshot(viewerId) {
      const snap = JSON.parse(JSON.stringify(state));
      snap.chat = snap.chat.filter((m) => !m.isWhisper || m.fromId === viewerId || m.toId === viewerId);
      const maskMap = (choices) => {
        const out = {};
        Object.keys(choices || {}).forEach((pid) => { out[pid] = pid === viewerId ? choices[pid] : 'hidden'; });
        return out;
      };
      if (snap.rps && !snap.rps.revealed) snap.rps.choices = maskMap(snap.rps.choices);
      if (snap.subRps && !snap.subRps.revealed) snap.subRps.choices = maskMap(snap.subRps.choices);
      if (snap.initiative && snap.initiative.mode === 'rps' && !snap.initiative.revealed) {
        snap.initiative.choices = maskMap(snap.initiative.choices);
      }
      return snap;
    }

    function sendRoleSelect(roleId) {
      localUI.selectedRoleId = roleId;
      if (isHostAuthority()) {
        const me = getSelfLobby();
        if (me) me.roleId = roleId;
        broadcastState();
        UI.renderLobby?.();
      } else if (hostConn && hostConn.open) {
        hostConn.send({ type: 'SELECT_ROLE', playerId: state.selfId, roleId });
      }
    }

    function sendIntent(intent) {
      if (isHostAuthority()) Engine.handleIntent?.(state.selfId, intent);
      else if (hostConn && hostConn.open) hostConn.send({ type: 'INTENT', playerId: state.selfId, intent });
      else window.VFX?.toast('当前未连接房主，无法发送指令', 'danger');
    }

    function sendChat(toId, text) {
      const clean = String(text || '').trim().slice(0, 120);
      if (!clean) return;
      if (isHostAuthority()) Comms.hostReceiveChat(state.selfId, toId, clean);
      else if (hostConn && hostConn.open) hostConn.send({ type: 'CHAT', playerId: state.selfId, toId, text: clean });
    }

    function sendEmoji(emoji) {
      if (!emoji) return;
      if (isHostAuthority()) Comms.hostReceiveEmoji(state.selfId, emoji);
      else if (hostConn && hostConn.open) hostConn.send({ type: 'EMOJI', playerId: state.selfId, emoji });
    }

    function applyHostConfig(newCfg) {
      if (!isHostAuthority()) {
        state.config.vfxEnabled = Boolean(newCfg.vfxEnabled);
        window.VFX?.setEnabled(state.config.vfxEnabled);
        window.VFX?.toast('非房主仅更新了本地特效开关', 'info');
        return;
      }
      state.config = { ...state.config, ...newCfg };
      window.VFX?.setEnabled(state.config.vfxEnabled);
      syncLobbyRuleCheckboxes();
      addLog(`⚙ 房主热更新参数：坍塌T${state.config.collapseStartTurn} / 缺氧上限${state.config.oxygenMax} / 通缉(${state.config.bountyArtifacts}神器或${state.config.bountyKills}杀)`, 'system');
      emitFx('toast', { msg: '房主已热更新全局对局参数', level: 'success' });
      broadcastState();
      UI.renderAll?.();
    }

    function copyInviteLink() {
      if (!state.roomCode) { window.VFX?.toast('请先创建联机房间', 'warn'); return; }
      const url = new URL(window.location.href);
      url.searchParams.set('room', state.roomCode);
      const link = url.toString();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(
          () => window.VFX?.toast(`已复制邀请链接（房间码 ${state.roomCode}）`, 'success'),
          () => window.prompt('复制以下链接发送给好友：', link)
        );
      } else {
        window.prompt('复制以下链接发送给好友：', link);
      }
    }

    function addLobbyAi() {
      if (!isHostAuthority()) { window.VFX?.toast('仅房主可添加 AI 席位', 'warn'); return; }
      if (state.lobbyPlayers.length >= 8) { window.VFX?.toast('房间人数已达上限（8人）', 'warn'); return; }
      const randRole = ROLES[Math.floor(Math.random() * ROLES.length)].id;
      state.lobbyPlayers.push({
        id: uid('ai'),
        name: pickUniqueAiName(state.lobbyPlayers),
        roleId: randRole,
        isHost: false,
        isAI: true,
        connected: true,
        peerId: 'ai'
      });
      broadcastState();
      UI.renderLobby?.();
    }

    function removeLobbySeat(seatId) {
      if (!isHostAuthority() || seatId === state.selfId) return;
      state.lobbyPlayers = state.lobbyPlayers.filter((p) => p.id !== seatId);
      broadcastState();
      UI.renderLobby?.();
    }

    return { createRoom, joinRoom, startSolo, teardownPeer, broadcastState, sendRoleSelect, sendIntent, sendChat, sendEmoji, applyHostConfig, copyInviteLink, addLobbyAi, removeLobbySeat };
  })();

  // ========================================================================
  // 4. Tactical Comms (Public / 1v1 Whisper / Quick Phrases / 3D Head Emoji)
  // ========================================================================
  const Comms = (() => {
    function canSeeMessage(msg) {
      if (!msg) return false;
      if (!msg.isWhisper) return true;
      return msg.fromId === state.selfId || msg.toId === state.selfId;
    }

    function hostReceiveChat(fromId, toId, text) {
      const sender = getPlayer(fromId) || state.lobbyPlayers.find((p) => p.id === fromId);
      if (!sender) return;
      const isWhisper = Boolean(toId && toId !== 'all');
      const receiver = isWhisper ? (getPlayer(toId) || state.lobbyPlayers.find((p) => p.id === toId)) : null;

      const entry = {
        id: uid('chat'),
        ts: Date.now(),
        fromId: sender.id,
        fromName: sender.name,
        toId: receiver ? receiver.id : 'all',
        toName: receiver ? receiver.name : '全员公屏',
        text,
        isWhisper: Boolean(receiver)
      };

      state.chat.push(entry);
      if (state.chat.length > 80) state.chat.splice(0, state.chat.length - 80);

      if (canSeeMessage(entry)) {
        if (!localUI.commsOpen && entry.fromId !== state.selfId) localUI.commsUnread += 1;
        window.VFX?.sfx('chat');
      }
      Net.broadcastState();
      UI.renderComms?.();
    }

    function hostReceiveEmoji(fromId, emoji) {
      const sender = getPlayer(fromId);
      if (!sender) return;
      const allowed = ['❤️', '💩', '🤡', '🔪', '🤝', '🆘'];
      if (!allowed.includes(emoji)) return;

      emitFx('float', { nodeId: sender.location, text: `${sender.name} ${emoji}`, kind: 'emoji' });
      emitFx('sfx', { name: 'emoji' });

      state.chat.push({
        id: uid('chat'),
        ts: Date.now(),
        fromId: sender.id,
        fromName: sender.name,
        toId: 'all',
        toName: '地图表情',
        text: `在头顶亮出了 ${emoji}`,
        isWhisper: false
      });
      if (state.chat.length > 80) state.chat.shift();
      Net.broadcastState();
      UI.renderComms?.();
    }

    function toggleDrawer(forceOpen) {
      localUI.commsOpen = typeof forceOpen === 'boolean' ? forceOpen : !localUI.commsOpen;
      if (localUI.commsOpen) localUI.commsUnread = 0;
      UI.renderComms?.();
    }

    return { canSeeMessage, hostReceiveChat, hostReceiveEmoji, toggleDrawer };
  })();

  // ========================================================================
  // 5. Map Topology, Reachability, Pig Face, Oxygen & Combat Helpers
  // ========================================================================
  function buildMatchNodes(players) {
    const nodes = {};
    STATIC_NODES.forEach((n) => {
      nodes[n.id] = { ...n, collapsed: false, barrierUntilTurn: 0, droppedArtifacts: [], corpses: [] };
    });
    players.forEach((p, idx) => {
      const slot = HOME_SLOTS[idx % HOME_SLOTS.length];
      const homeId = `home_${p.id}`;
      nodes[homeId] = {
        id: homeId, name: `${p.name}的家`, layer: 'land', x: slot.x, y: slot.y,
        kind: 'home', ownerId: p.id, collapsible: false, collapsed: false,
        barrierUntilTurn: 0, droppedArtifacts: [], corpses: [],
        desc: `${p.name} 的陆地出生点（不受残局坍塌影响）。`
      };
      p.homeId = homeId;
      p.location = homeId;
    });
    return nodes;
  }

  function isBarrierActive(nodeId) {
    const n = state.nodes[nodeId];
    return Boolean(n && n.barrierUntilTurn >= state.turn);
  }
  function getNode(nodeId) { return state.nodes[nodeId] || null; }

  function canAttackWardenFrom(node) {
    return Boolean(node && (node.kind === 'prison_out' || node.kind === 'prison_in') && !state.nodes.land_prison_out?.collapsed);
  }

  function hasSQ(player, sqId) {
    if (!player) return false;
    if (sqId === 'SQ2' && player.roleId === 'ninja') return true;
    if (sqId === 'SQ3' && player.roleId === 'piggy') return true;
    return state.artifacts[sqId]?.ownerId === player.id;
  }

  function countPalaceArtifacts(player) {
    return ['SQ1', 'SQ2', 'SQ3', 'SQ4'].filter((id) => state.artifacts[id].ownerId === player.id).length;
  }

  function getPigFaceInstances(target) {
    const list = [];
    if (!target) return list;
    if (target.roleId === 'piggy') list.push(`innate_${target.id}_${target.pigFaceGen}`);
    if (state.artifacts.SQ3.ownerId === target.id) list.push(`palace_sq3_${state.artifacts.SQ3.instanceId}`);
    return list;
  }

  function needsPinchPigFace(actor, target) {
    if (!actor || !target || actor.id === target.id) return false;
    return getPigFaceInstances(target).some((k) => !actor.pinchedFaces.includes(k));
  }

  function hasEffectiveFrogMask(player) {
    if (!player) return false;
    if (player.frogMask) return true;
    if (player.parasiteHostId) {
      const host = getPlayer(player.parasiteHostId);
      if (host && host.status === 'alive' && host.frogMask) return true;
    }
    return false;
  }

  function hasEffectiveOxygenTank(player) {
    if (!player) return false;
    if (player.oxygenTank) return true;
    if (player.parasiteHostId) {
      const host = getPlayer(player.parasiteHostId);
      if (host && host.status === 'alive' && host.oxygenTank) return true;
    }
    return false;
  }

  function isHypoxic(player) {
    if (!player || player.status !== 'alive') return false;
    const node = getNode(player.location);
    if (!node || node.layer === 'land') return false;
    if (node.layer === 'ocean' && hasEffectiveFrogMask(player)) return false;
    return player.oxygenTurns >= Math.max(1, state.config.oxygenMax - 2);
  }

  function getReachableMoveNodes(player, opts = {}) {
    const cur = getNode(player.location);
    if (!cur || isBarrierActive(cur.id)) return [];

    const allNodes = Object.values(state.nodes).filter(
      (n) => n.id !== cur.id && !n.collapsed && n.kind !== 'prison_in' && !isBarrierActive(n.id)
    );

    if (cur.kind === 'prison_in') {
      if (player.roleId === 'aquaman' && !opts.ignoreAquaman) {
        return allNodes.filter((n) => n.layer === 'ocean');
      }
      return [];
    }

    const result = new Map();
    const add = (n) => result.set(n.id, n);

    if (cur.layer === 'land') {
      allNodes.filter((n) => n.layer === 'land').forEach(add);
      const skyOne = state.nodes.sky_one;
      if (skyOne && !skyOne.collapsed && !isBarrierActive(skyOne.id)) add(skyOne);
      if (cur.kind === 'dock' || (player.roleId === 'aquaman' && !opts.ignoreAquaman)) {
        allNodes.filter((n) => n.layer === 'ocean').forEach(add);
      }
      if (hasSQ(player, 'SQ4') && !opts.ignoreSQ4) {
        allNodes.filter((n) => n.layer === 'sky' && n.id !== 'sky_one').forEach(add);
      }
    } else if (cur.layer === 'ocean') {
      allNodes.filter((n) => n.layer === 'ocean').forEach(add);
      const dock = state.nodes.land_dock;
      if (dock && !dock.collapsed && !isBarrierActive(dock.id)) add(dock);
      else allNodes.filter((n) => n.layer === 'land').forEach(add);
      if (hasSQ(player, 'SQ4') && !opts.ignoreSQ4) {
        allNodes.filter((n) => n.layer === 'sky' && n.id !== 'sky_one').forEach(add);
      }
    } else if (cur.layer === 'sky') {
      allNodes.filter((n) => n.layer === 'sky' && n.id !== 'sky_one').forEach(add);
      if (cur.kind === 'stable' || (hasSQ(player, 'SQ4') && !opts.ignoreSQ4)) {
        const dropPool = hasSQ(player, 'SQ4') ? allNodes : allNodes.filter((n) => n.layer === 'land');
        dropPool.forEach(add);
      }
      if (player.roleId === 'aquaman' && !opts.ignoreAquaman) {
        allNodes.filter((n) => n.layer === 'ocean').forEach(add);
      }
    }

    return Array.from(result.values());
  }

  function getAlivePlayersAt(nodeId, excludeId = null) {
    return state.players.filter((p) => p.status === 'alive' && p.location === nodeId && p.id !== excludeId);
  }

  function syncParasites(host) {
    state.players.forEach((p) => {
      if (p.status === 'alive' && p.parasiteHostId === host.id) {
        p.location = host.location;
        const node = getNode(host.location);
        if (node && node.layer === 'land') {
          p.oxygenTurns = 0;
          p.enteredNonLandTurn = 0;
        }
      }
    });
  }

  function ejectParasitesFrom(host, reasonText) {
    state.players.forEach((p) => {
      if (p.status === 'alive' && p.parasiteHostId === host.id) {
        p.parasiteHostId = null;
        p.pants = 0;
        addLog(`🦠 ${p.name} 因宿主 ${host.name} ${reasonText}而被震出，裤子清零！`, 'skill');
        emitFx('float', { nodeId: p.location, text: '震出 清裤!', kind: 'pants' });
      }
    });
  }

  function movePlayerTo(player, destId, { carryIds = [], silent = false } = {}) {
    const prevNode = getNode(player.location);
    const destNode = getNode(destId);
    if (!destNode || destNode.collapsed) return false;

    const prevLayer = prevNode ? prevNode.layer : 'land';
    player.location = destId;

    if (destNode.layer === 'land') {
      player.oxygenTurns = 0;
      player.enteredNonLandTurn = 0;
    } else if (prevLayer === 'land') {
      player.oxygenTurns = 0;
      player.enteredNonLandTurn = state.turn;
    }
    syncParasites(player);

    const carriedNames = [];
    carryIds.forEach((cid) => {
      const t = getPlayer(cid);
      if (t && t.status === 'alive' && t.id !== player.id && t.location === prevNode?.id) {
        if (t.parasiteHostId === player.id) return;
        t.location = destId;
        if (destNode.layer === 'land') {
          t.oxygenTurns = 0;
          t.enteredNonLandTurn = 0;
        } else if (prevLayer === 'land') {
          t.oxygenTurns = 0;
          t.enteredNonLandTurn = state.turn;
        }
        syncParasites(t);
        carriedNames.push(t.name);
      }
    });

    if (!silent) {
      const carryStr = carriedNames.length ? `（强行带走 ${carriedNames.join('、')}）` : '';
      addLog(`➤ ${player.name} 移动至【${destNode.name}】${carryStr}`, 'normal');
      emitFx('ripple', { nodeId: destId, color: '#00d4ff', rings: 1 });
    }
    return true;
  }

  function sendPlayerToJail(target, reason) {
    if (!target || target.status !== 'alive') return;
    if (state.nodes.land_prison_out?.collapsed) {
      addLog(`⚠ 监狱外已坍塌，${target.name} 免于入狱！`, 'system');
      return;
    }
    target.location = 'land_prison_in';
    target.oxygenTurns = 0;
    target.enteredNonLandTurn = 0;
    addLog(`🚓 ${target.name} ${reason}，被关入【监狱内】！`, 'kill');
    emitFx('float', { nodeId: 'land_prison_in', text: `${target.name} 入狱!`, kind: 'dmg' });
    emitFx('sfx', { name: 'alarm' });

    state.players.forEach((p) => {
      if (p.status === 'alive' && p.parasiteHostId === target.id) {
        p.location = 'land_prison_in';
        p.oxygenTurns = 0;
        addLog(`⛓ 寄生者 ${p.name} 随宿主连坐入狱！`, 'skill');
      }
    });
  }

  function updateBountyStatus(player) {
    if (!state.config.bountyEnabled || !player || player.status !== 'alive') return;
    const meets = countPalaceArtifacts(player) >= state.config.bountyArtifacts || player.kills >= state.config.bountyKills;
    if (meets && !player.wanted) {
      player.wanted = true;
      addLog(`🚨 ${player.name} 触发通缉！（击杀回+1命+保底1步）`, 'system');
      emitFx('banner', { kicker: 'WANTED // 全服通缉', title: `${player.name} 悬赏生效`, sub: '击杀通缉犯回 +1 命并下回合保底 1 步', mood: 'p5r', durationMs: 2400 });
      emitFx('sfx', { name: 'alarm' });
      syncMoodFromState();
    }
  }

  function getLinkedPartners(playerId) {
    const out = [];
    state.links.forEach((lk) => {
      if (lk.expiresTurn >= state.turn) {
        if (lk.aId === playerId) out.push(lk.bId);
        else if (lk.bId === playerId) out.push(lk.aId);
      }
    });
    return out;
  }

  function applyPantsLoss(target, amount, reason = '', visited = new Set()) {
    if (!target || target.status !== 'alive' || amount <= 0) return 0;
    visited.add(target.id);
    const before = target.pants;
    target.pants = Math.max(0, roundHalf(target.pants - amount));
    const actual = roundHalf(before - target.pants);
    if (actual > 0) {
      emitFx('float', { nodeId: target.location, text: `-${actual}👖`, kind: 'pants' });
      emitFx('sfx', { name: 'pants' });
      getLinkedPartners(target.id).forEach((pid) => {
        if (visited.has(pid)) return;
        const partner = getPlayer(pid);
        if (partner && partner.status === 'alive') {
          addLog(`🩸 命运链接共振：${partner.name} 同步失去 ${actual} 裤！`, 'skill');
          applyPantsLoss(partner, actual, '命运链接', visited);
        }
      });
    }
    return actual;
  }

  function applyHpDamage(target, amount, attacker = null, opts = {}, visited = new Set()) {
    if (!target || target.status !== 'alive' || amount <= 0) return { hit: false, killed: false };
    visited.add(target.id);

    const tNode = getNode(target.location);
    if (opts.canDodge && tNode && tNode.kind === 'ruins' && Math.random() < 0.5) {
      addLog(`💨 ${target.name} 【遗迹】MISS 闪避！`, 'skill');
      emitFx('float', { nodeId: target.location, text: 'MISS!', kind: 'miss' });
      emitFx('sfx', { name: 'miss' });
      return { hit: false, killed: false, dodged: true };
    }

    if (target.shield > 0 && !opts.ignoreShield) {
      target.shield -= 1;
      addLog(`🛡 ${target.name} 护盾抵消伤害`, 'skill');
      emitFx('float', { nodeId: target.location, text: 'SHIELD!', kind: 'skill' });
      emitFx('sfx', { name: 'miss' });
      return { hit: false, killed: false, blocked: true };
    }

    const dmg = roundHalf(amount);
    target.hp = roundHalf(target.hp - dmg);
    emitFx('slash', { nodeId: target.location, color: '#e60023', intensity: Math.min(1.8, 0.9 + dmg * 0.4), count: dmg >= 1.5 ? 3 : 2 });
    emitFx('float', { nodeId: target.location, text: `-${dmg}❤️`, kind: 'dmg' });

    ejectParasitesFrom(target, '受伤掉血');

    getLinkedPartners(target.id).forEach((pid) => {
      if (visited.has(pid)) return;
      const partner = getPlayer(pid);
      if (partner && partner.status === 'alive') {
        addLog(`🩸 命运链接共振：${partner.name} 同步承受 -${dmg} 命！`, 'skill');
        applyHpDamage(partner, dmg, attacker, { canDodge: false }, visited);
      }
    });

    if (target.hp <= 0) {
      handlePlayerDeath(target, attacker, opts.reason || '被击杀');
      return { hit: true, killed: true };
    }
    return { hit: true, killed: false };
  }

  function getSafeReviveNodeId(player) {
    if (state.nodes.land_underworld && !state.nodes.land_underworld.collapsed) return 'land_underworld';
    if (player.homeId && state.nodes[player.homeId] && !state.nodes[player.homeId].collapsed) return player.homeId;
    const anyLand = Object.values(state.nodes).find((n) => n.layer === 'land' && !n.collapsed && n.kind !== 'prison_in');
    return anyLand ? anyLand.id : 'land_underworld';
  }

  function handlePlayerDeath(victim, killer, reason) {
    if (!victim || victim.status !== 'alive') return;
    victim.hp = 0;
    victim.pants = 0;
    victim.knives = 0;
    victim.bomb = null;
    victim.stealth = null;
    victim.paralyzed = false;

    const deathNodeId = victim.location;
    const deathNode = getNode(deathNodeId);

    ejectParasitesFrom(victim, '阵亡');
    victim.parasiteHostId = null;

    const dropped = [];
    ['SQ1', 'SQ2', 'SQ3', 'SQ4'].forEach((sqId) => {
      if (state.artifacts[sqId].ownerId === victim.id) {
        state.artifacts[sqId].ownerId = null;
        state.artifacts[sqId].droppedAt = deathNodeId;
        if (deathNode) deathNode.droppedArtifacts.push(sqId);
        dropped.push(ARTIFACTS[sqId].short);
      }
    });

    if (deathNode) deathNode.corpses.push({ id: uid('corpse'), name: victim.name, victimId: victim.id });

    if (killer && killer.id !== victim.id && killer.status === 'alive') {
      killer.kills += 1;
      if (victim.wanted && state.config.bountyEnabled) {
        killer.hp = roundHalf(killer.hp + 1);
        killer.guaranteedStepNextTurn = true;
        addLog(`🏆 ${killer.name} 终结通缉犯 ${victim.name}（+1命/保底+1步）`, 'system');
        emitFx('float', { nodeId: killer.location, text: '+1❤️ 保底1步', kind: 'heal' });
      }
      updateBountyStatus(killer);
    }
    victim.wanted = false;

    state.players.forEach((p) => {
      if (p.status === 'alive' && p.roleId === 'undertaker' && p.id !== victim.id) {
        p.knives += 1;
        addLog(`⚰ 收尸人 ${p.name} 敛尸成刃，自动 +1 刀！`, 'skill');
        emitFx('float', { nodeId: p.location, text: '+1🔪', kind: 'skill' });
      }
    });

    if (!victim.reviveUsed) {
      victim.status = 'pending_revive';
      victim.reviveEligibleTurn = state.turn + 1;
      victim.location = getSafeReviveNodeId(victim);
      addLog(`💀 ${victim.name} 阵亡（${reason}）${dropped.length ? ` 掉【${dropped.join('、')}】` : ''} · 下回地府复活`, 'kill');
    } else {
      victim.status = 'dead_final';
      addLog(`☠ ${victim.name} 死透（${reason}）${dropped.length ? ` 掉【${dropped.join('、')}】` : ''}`, 'kill');
    }

    emitFx('banner', {
      kicker: 'ELIMINATED // 击杀播报',
      title: `${victim.name} 阵亡`,
      sub: victim.status === 'pending_revive' ? '魂归地府 · 下回合可拼 1 次复活猜拳' : '已彻底死透出局',
      mood: 'p5r',
      durationMs: 2150
    });
    syncMoodFromState();
  }

  function revivePlayerAtUnderworld(p, { viaWish = false } = {}) {
    const role = ROLE_MAP[p.roleId];
    const spawnId = getSafeReviveNodeId(p);
    p.status = 'alive';
    p.location = spawnId;
    p.oxygenTurns = 0;
    p.enteredNonLandTurn = 0;
    p.frogMask = false;
    p.oxygenTank = true;
    p.antiSuffocate = 0;
    p.bomb = null;
    p.paralyzed = false;
    p.stealth = null;
    p.parasiteHostId = null;
    p.wanted = false;

    if (viaWish) {
      p.hp = 1;
      p.pants = 1;
      p.maxPants = Math.max(role.maxPants, 1);
      p.knives = 0;
    } else {
      p.hp = role.hp;
      p.pants = role.pants;
      p.maxPants = role.maxPants;
      p.knives = role.knives;
      p.activeCharges = role.activeMax;
      p.pigFaceGen += 1;
      p.pinchedFaces = [];
      p.reviveUsed = true;
    }

    addLog(`🔥 ${p.name} 在【${getNode(spawnId)?.name || '地府'}】重返人间！`, 'system');
    emitFx('banner', {
      kicker: 'RESURRECTION // 地府重生',
      title: `${p.name} 复活归来`,
      sub: viaWish ? '许愿池召回（1裤1命）' : '全状态重置 · 全场须重新捏猪脸',
      mood: 'p3r',
      durationMs: 2100
    });
    emitFx('float', { nodeId: spawnId, text: 'REVIVED!', kind: 'heal' });
    emitFx('sfx', { name: 'revive' });
  }

  // ========================================================================
  // 6. Core Authoritative State Machine (Engine)
  // ========================================================================
  Object.assign(Engine, {
    startMatch() {
      if (!isHostAuthority()) return;
      if (state.lobbyPlayers.length < 2) {
        window.VFX?.toast('至少需要 2 名玩家（可点击「+ 添加二次元 AI」）', 'warn');
        return;
      }

      clearHostTasks();
      state.config = readLobbyConfigFromDOM();
      window.VFX?.setEnabled(state.config.vfxEnabled);
      window.VFX?.clearBannerQueue();

      state.started = true;
      state.turn = 0;
      state.weather = 'clear';
      state.nextWeather = null;
      state.winnerId = null;
      state.winnerReason = '';
      state.lastActiveSkill = null;
      state.links = [];
      state.logs = [];
      state.pendingAction = null;
      state.stealthRevealQueue = [];
      state.subRps = null;
      state.initiative = null;
      state.fxSeq = 0;
      state.recentFx = [];
      localUI.lastFxSeqPlayed = 0;
      localUI.subPanelState = null;
      localUI.unreadLogCount = 0;
      localUI.lastLogCount = 0;

      state.warden = { hp: 1, pants: 3, maxPants: 3, respawnCount: 0 };
      state.artifacts = {
        SQ1: { id: 'SQ1', progress: 0, ownerId: null, droppedAt: null },
        SQ2: { id: 'SQ2', progress: 0, ownerId: null, droppedAt: null },
        SQ3: { id: 'SQ3', progress: 0, ownerId: null, droppedAt: null, instanceId: 1 },
        SQ4: { id: 'SQ4', progress: 0, ownerId: null, droppedAt: null }
      };

      state.players = state.lobbyPlayers.map((lp) => {
        const role = ROLE_MAP[lp.roleId] || ROLE_MAP.normal;
        return {
          id: lp.id, name: lp.name, roleId: role.id,
          isHost: lp.isHost, isAI: lp.isAI, connected: lp.connected, peerId: lp.peerId,
          status: 'alive',
          hp: role.hp, pants: role.pants, maxPants: role.maxPants, knives: role.knives,
          atkMult: role.atkMult, activeCharges: role.activeMax,
          steps: 0, deferredSteps: 0, momentum: 0, shield: 0,
          pigFaceGen: 1, pinchedFaces: [], wishSteps: 0,
          oxygenTurns: 0, enteredNonLandTurn: 0, breathedThisTurn: false,
          oxygenTank: true, antiSuffocate: 0, frogMask: false,
          paralyzed: false, paralyzedNextTurn: false, guaranteedStepNextTurn: false,
          blackMarketRerollTurn: 0, piggyStealArmed: false,
          parasiteHostId: null, stealth: null, bomb: null,
          kills: 0, wanted: false, reviveUsed: false, reviveEligibleTurn: 0,
          homeId: '', location: ''
        };
      });

      state.nodes = buildMatchNodes(state.players);
      addLog(`⚔ 对局开始 · ${state.players.length}人混战`, 'system');
      emitFx('weather', { weather: 'clear' });
      emitFx('mood', { mood: 'p3r' });
      emitFx('banner', { kicker: 'MISSION START', title: 'LITTLE KNIFE', sub: `${state.players.length} 人混战开幕 · 猜拳夺步`, mood: 'p3r', durationMs: 2150 });

      Engine.beginNextTurn();
    },

    beginNextTurn() {
      // 安全不变式：清理任何错过复活回合的僵尸 pending_revive
      state.players.forEach((p) => {
        if (p.status === 'pending_revive' && p.reviveEligibleTurn < state.turn) {
          p.reviveUsed = true;
          p.status = 'dead_final';
        }
      });
      if (Engine.checkVictory()) return;

      state.turn += 1;
      state.pendingAction = null;
      state.subRps = null;
      state.initiative = null;
      state.turnQueue = [];
      state.activePlayerId = null;

      state.weather = state.nextWeather || 'clear';
      state.nextWeather = null;
      emitFx('weather', { weather: state.weather });

      if (state.weather !== 'clear') {
        const wMeta = WEATHERS[state.weather];
        addLog(`🌌 天象【${wMeta.name}】：${wMeta.desc}`, 'system');
        emitFx('banner', { kicker: 'WEATHER SHIFT // 天象降临', title: wMeta.name, sub: wMeta.desc, mood: wMeta.mood, durationMs: 2200 });
      }

      state.links = state.links.filter((lk) => lk.expiresTurn >= state.turn);

      state.players.forEach((p) => {
        p.steps = 0;
        p.deferredSteps = 0;
        p.breathedThisTurn = false;
        p.paralyzed = Boolean(p.paralyzedNextTurn);
        p.paralyzedNextTurn = false;
        if (p.status === 'alive' && p.paralyzed) {
          addLog(`⚡ ${p.name} 麻痹，本回合跳过`, 'skill');
        }
      });

      syncMoodFromState();

      const participants = state.players
        .filter((p) => p.status === 'alive' || (p.status === 'pending_revive' && p.reviveEligibleTurn === state.turn))
        .map((p) => p.id);

      Engine.startMainRps(participants, 1);
    },

    startMainRps(participantIds, roundNum = 1) {
      state.phase = 'rps';
      state.rps = {
        round: roundNum,
        participants: participantIds,
        choices: {},
        revealed: false,
        title: roundNum === 1 ? `第 ${state.turn} 回合 · 全员猜拳` : `平局重猜（第 ${roundNum} 轮）`
      };
      Net.broadcastState();
      UI.renderAll();
      AI.scheduleTick();
    },

    handleIntent(playerId, intent) {
      if (!isHostAuthority() || !intent || typeof intent !== 'object') return;
      if (state.phase === 'gameover') return;
      switch (intent.type) {
        case 'RPS_CHOICE': Engine.submitMainRps(playerId, intent.hand); break;
        case 'INITIATIVE_RPS': Engine.submitInitiativeRps(playerId, intent.hand); break;
        case 'INITIATIVE_PICK_SLOT': Engine.pickInitiativeSlot(playerId, Number(intent.slotIndex)); break;
        case 'SUB_RPS_CHOICE': Engine.submitSubRps(playerId, intent.hand); break;
        case 'STEALTH_REVEAL': Engine.resolveStealthReveal(playerId, intent); break;
        case 'ACTION': Engine.executePlayerAction(playerId, intent); break;
        case 'PENDING_CHOICE': Engine.resolvePendingAction(playerId, intent); break;
        default: break;
      }
    },

    submitMainRps(playerId, hand) {
      if (state.phase !== 'rps' || !state.rps || state.rps.revealed) return;
      if (!state.rps.participants.includes(playerId) || !HAND_META[hand] || state.rps.choices[playerId]) return;

      state.rps.choices[playerId] = hand;
      if (playerId === state.selfId) window.VFX?.sfx('rps_lock');

      if (!state.rps.participants.every((pid) => Boolean(state.rps.choices[pid]))) {
        Net.broadcastState();
        UI.renderAll();
        return;
      }

      state.rps.revealed = true;
      const handsPresent = new Set(Object.values(state.rps.choices));
      let winners = [];
      let isDraw = false;

      if (handsPresent.size !== 2) {
        isDraw = true;
      } else {
        const winHand =
          handsPresent.has('rock') && handsPresent.has('scissors') ? 'rock' :
          handsPresent.has('scissors') && handsPresent.has('paper') ? 'scissors' : 'paper';
        winners = state.rps.participants.filter((pid) => state.rps.choices[pid] === winHand);
      }

      const losersCount = isDraw ? 0 : Math.max(1, state.rps.participants.length - winners.length);

      const entries = state.rps.participants.map((pid) => {
        const p = getPlayer(pid);
        const h = state.rps.choices[pid];
        const outcome = isDraw ? 'draw' : winners.includes(pid) ? 'win' : 'lose';
        let tag = outcome === 'draw' ? 'DRAW' : outcome === 'win' ? `WIN +${losersCount}步` : 'LOSE';
        if (p?.status === 'pending_revive') tag = outcome === 'win' ? '地府复活!' : outcome === 'lose' ? '彻底死透' : '重猜';
        return { name: p?.name || '特工', hand: h, outcome, tag };
      });

      if (!isDraw) {
        const winNames = winners.map((id) => getPlayer(id)?.name).join('、');
        addLog(`✊ 猜拳：${winNames} 胜（各+${losersCount}步）`, 'system');
      }

      emitFx('rpsClash', {
        kicker: `TURN ${state.turn} // SHOWDOWN`,
        title: isDraw ? '平局！重新出拳！' : `${winners.map((id) => getPlayer(id)?.name).join('、')} 胜出！`,
        subtitle: isDraw ? '未分胜负，立刻重猜' : `击败 ${losersCount} 人 · 胜者各获 +${losersCount}步`,
        entries,
        durationMs: 2200
      });

      Net.broadcastState();
      UI.renderAll();

      scheduleHostTask(() => {
        if (isDraw) Engine.startMainRps(state.rps.participants, state.rps.round + 1);
        else Engine.finalizeMainRps(winners, losersCount);
      }, 2350);
    },

    finalizeMainRps(winnerIds, baseSteps = 1) {
      const winnerSet = new Set(winnerIds);
      const actingWinners = [];

      state.rps.participants.forEach((pid) => {
        const p = getPlayer(pid);
        if (!p || p.status !== 'pending_revive') return;
        if (winnerSet.has(pid)) {
          revivePlayerAtUnderworld(p, { viaWish: false });
        } else {
          p.reviveUsed = true;
          p.status = 'dead_final';
          addLog(`☠ ${p.name} 复活失败，死透`, 'kill');
        }
      });

      if (Engine.checkVictory()) return;

      state.players.forEach((p) => {
        if (p.status !== 'alive') return;
        const participated = state.rps.participants.includes(p.id);
        const won = winnerSet.has(p.id);

        if (won && participated) {
          let steps = baseSteps;
          if (p.roleId === 'reverser' && p.momentum > 0) {
            steps += p.momentum;
            addLog(`🌀 ${p.name} 引爆${p.momentum}势 → +${steps}步`, 'skill');
            emitFx('float', { nodeId: p.location, text: `逆转 +${steps}步!`, kind: 'skill' });
            p.momentum = 0;
          }
          p.steps += steps;
        } else if (participated && !won) {
          if (p.roleId === 'reverser' && p.momentum < 2) {
            p.momentum += 1;
            addLog(`🌀 ${p.name} 蓄势 ${p.momentum}/2`, 'skill');
            emitFx('float', { nodeId: p.location, text: `蓄势 ${p.momentum}/2`, kind: 'skill' });
          }
        }

        if (p.guaranteedStepNextTurn) {
          p.guaranteedStepNextTurn = false;
          if (p.steps < 1) {
            p.steps = 1;
            addLog(`🏆 ${p.name} 触发通缉悬赏保底，获得 1 步！`, 'system');
          }
        }

        if (p.paralyzed && p.steps > 0) {
          addLog(`⚡ ${p.name} 麻痹，损失 ${p.steps} 步`, 'skill');
          p.steps = 0;
        }

        if (p.stealth && p.stealth.active && p.stealth.turnUsed < state.turn) {
          p.deferredSteps = p.steps;
          p.steps = 0;
        } else if (p.steps > 0) {
          actingWinners.push(p.id);
        }
      });

      if (actingWinners.length === 0) {
        addLog('⏭ 本回合无行动者', 'muted');
        Engine.proceedToStealthOrEndTurn();
        return;
      }

      if (actingWinners.length === 1) {
        Engine.beginActionQueue(actingWinners);
        return;
      }

      Engine.startInitiativeRps(actingWinners, actingWinners, 1);
    },

    startInitiativeRps(contenders, allWinners, roundNum = 1) {
      state.phase = 'initiative';
      state.initiative = { mode: 'rps', round: roundNum, contenders, allWinners, choices: {}, revealed: false, firstWinnerId: null };
      addLog(`🎲 解释权对决：${contenders.map((id) => getPlayer(id)?.name).join(' vs ')}`, 'system');
      Net.broadcastState();
      UI.renderAll();
      AI.scheduleTick();
    },

    submitInitiativeRps(playerId, hand) {
      if (state.phase !== 'initiative' || !state.initiative || state.initiative.mode !== 'rps') return;
      if (state.initiative.revealed || !state.initiative.contenders.includes(playerId) || !HAND_META[hand] || state.initiative.choices[playerId]) return;

      state.initiative.choices[playerId] = hand;
      if (playerId === state.selfId) window.VFX?.sfx('rps_lock');

      if (!state.initiative.contenders.every((id) => Boolean(state.initiative.choices[id]))) {
        Net.broadcastState();
        UI.renderAll();
        return;
      }

      state.initiative.revealed = true;
      const hands = new Set(Object.values(state.initiative.choices));
      let winners = [];
      let isDraw = false;
      if (hands.size !== 2) isDraw = true;
      else {
        const winHand =
          hands.has('rock') && hands.has('scissors') ? 'rock' :
          hands.has('scissors') && hands.has('paper') ? 'scissors' : 'paper';
        winners = state.initiative.contenders.filter((id) => state.initiative.choices[id] === winHand);
      }

      emitFx('rpsClash', {
        kicker: 'INITIATIVE // 解释权争夺',
        title: isDraw ? '解释权平局重猜！' : `${winners.map((id) => getPlayer(id)?.name).join('、')} 胜出！`,
        subtitle: winners.length === 1 ? '夺得第一解释权，即将自选行动顺位' : '胜者继续角逐唯一第一名',
        entries: state.initiative.contenders.map((id) => ({
          name: getPlayer(id)?.name || '特工',
          hand: state.initiative.choices[id],
          outcome: isDraw ? 'draw' : winners.includes(id) ? 'win' : 'lose',
          tag: isDraw ? 'DRAW' : winners.includes(id) ? '晋级' : '顺位递推'
        })),
        durationMs: 2000
      });

      Net.broadcastState();
      UI.renderAll();

      scheduleHostTask(() => {
        if (isDraw) Engine.startInitiativeRps(state.initiative.contenders, state.initiative.allWinners, state.initiative.round + 1);
        else if (winners.length > 1) Engine.startInitiativeRps(winners, state.initiative.allWinners, state.initiative.round + 1);
        else Engine.enterInitiativeSlotPick(winners[0], state.initiative.allWinners);
      }, 2150);
    },

    enterInitiativeSlotPick(firstWinnerId, allWinners) {
      state.phase = 'initiative';
      state.initiative = { mode: 'pick_slot', firstWinnerId, allWinners };
      Net.broadcastState();
      UI.renderAll();
      AI.scheduleTick();
    },

    pickInitiativeSlot(playerId, slotIndex) {
      if (state.phase !== 'initiative' || !state.initiative || state.initiative.mode !== 'pick_slot') return;
      if (playerId !== state.initiative.firstWinnerId) return;

      const others = state.initiative.allWinners.filter((id) => id !== playerId);
      const idx = clamp(slotIndex, 0, others.length);
      const finalOrder = [...others.slice(0, idx), playerId, ...others.slice(idx)];

      addLog(`📌 行动顺位：${finalOrder.map((id, i) => `${i + 1}.${getPlayer(id)?.name}`).join(' → ')}`, 'system');
      Engine.beginActionQueue(finalOrder);
    },

    beginActionQueue(orderIds) {
      state.initiative = null;
      state.turnQueue = orderIds.map((id) => ({ playerId: id, done: false }));
      Engine.advanceActionQueue();
    },

    advanceActionQueue() {
      if (Engine.checkVictory()) return;
      while (true) {
        const nextEntry = state.turnQueue.find((e) => !e.done);
        if (!nextEntry) {
          state.activePlayerId = null;
          Engine.proceedToStealthOrEndTurn();
          return;
        }
        const p = getPlayer(nextEntry.playerId);
        if (!p || p.status !== 'alive' || p.steps <= 0 || p.paralyzed) {
          nextEntry.done = true;
          continue;
        }
        state.phase = 'action';
        state.activePlayerId = p.id;
        state.pendingAction = null;
        Net.broadcastState();
        UI.renderAll();
        AI.scheduleTick();
        return;
      }
    },

    finishCurrentActorIfDone(actor) {
      if (Engine.checkVictory()) return;
      if (state.phase === 'sub_rps') return;
      if (state.pendingAction) {
        Net.broadcastState();
        UI.renderAll();
        AI.scheduleTick();
        return;
      }
      if (!actor || actor.status !== 'alive' || actor.steps <= 0) {
        const entry = state.turnQueue.find((e) => e.playerId === actor?.id && !e.done);
        if (entry) entry.done = true;
        Engine.advanceActionQueue();
      } else {
        Net.broadcastState();
        UI.renderAll();
        AI.scheduleTick();
      }
    },

    proceedToStealthOrEndTurn() {
      const hiddenRaiders = state.players.filter(
        (p) => p.status === 'alive' && p.stealth && p.stealth.active && p.stealth.turnUsed < state.turn
      );
      if (hiddenRaiders.length > 0) {
        state.stealthRevealQueue = hiddenRaiders.map((p) => p.id);
        Engine.nextStealthReveal();
        return;
      }
      Engine.endTurnCleanup();
    },

    nextStealthReveal() {
      if (Engine.checkVictory()) return;
      while (state.stealthRevealQueue.length > 0) {
        const rid = state.stealthRevealQueue.shift();
        const raider = getPlayer(rid);
        if (!raider || raider.status !== 'alive' || !raider.stealth?.active) continue;
        state.phase = 'stealth_reveal';
        state.activePlayerId = raider.id;
        addLog(`👁 量子隐身坍缩！突袭者【${raider.name}】即将揭晓上回合暗步！`, 'skill');
        emitFx('banner', { kicker: 'QUANTUM COLLAPSE // 隐身揭晓', title: `${raider.name} 现身判定`, sub: '揭晓白名单暗步并结算所有预判攻击', mood: 'p5r', durationMs: 2100 });
        Net.broadcastState();
        UI.renderAll();
        AI.scheduleTick();
        return;
      }
      Engine.endTurnCleanup();
    },

    resolveStealthReveal(playerId, intent) {
      if (state.phase !== 'stealth_reveal' || state.activePlayerId !== playerId) return;
      const raider = getPlayer(playerId);
      if (!raider || !raider.stealth?.active) return;

      const predictions = raider.stealth.predictions || [];
      const act = intent.subAction;
      let desc = '';

      if (act === 'move') {
        if (!getReachableMoveNodes(raider).some((n) => n.id === intent.destId)) return;
        movePlayerTo(raider, intent.destId, { carryIds: [], silent: true });
        desc = `暗中单人移动至【${getNode(intent.destId)?.name}】`;
      } else if (act === 'wear_pants') {
        const cur = getNode(raider.location);
        if (state.weather === 'storm' && cur?.layer === 'land') {
          window.VFX?.toast('雷暴天象下陆地禁穿裤！', 'warn');
          return;
        }
        raider.pants = Math.min(raider.maxPants, roundHalf(raider.pants + 1));
        desc = `暗中穿裤（当前 ${raider.pants}/${raider.maxPants}）`;
      } else if (act === 'draw_knife') {
        raider.knives += 1;
        desc = `暗中拔刀（当前 ${raider.knives} 刀）`;
      } else if (act === 'breathe') {
        const cur = getNode(raider.location);
        if (!cur || cur.layer === 'land') return;
        raider.oxygenTurns = 0;
        raider.breathedThisTurn = true;
        desc = '暗中呼吸换气';
      } else {
        return;
      }

      raider.stealth = null;
      addLog(`⚡ 突袭者 ${raider.name} 揭晓量子暗步：${desc}！`, 'skill');

      predictions.forEach((pred) => {
        const attacker = getPlayer(pred.predictorId);
        if (!attacker || raider.status !== 'alive') return;
        if (pred.loc === raider.location) {
          if (pred.mode === 'strip') {
            const lost = applyPantsLoss(raider, hasSQ(attacker, 'SQ1') ? 2 : 1, '预判扒裤');
            addLog(`🎯 预判命中！${attacker.name} 在【${getNode(pred.loc)?.name}】截胡扒掉 ${raider.name} ${lost} 裤！`, 'kill');
          } else if (raider.pants <= 0) {
            const dmg = Engine.calcStabDamage(attacker);
            addLog(`🎯 预判绝杀命中！${attacker.name} 在【${getNode(pred.loc)?.name}】斩中现身的 ${raider.name}（-${dmg} 命）！`, 'kill');
            applyHpDamage(raider, dmg, attacker, { canDodge: true, reason: `被 ${attacker.name} 预判斩杀` });
          } else {
            addLog(`🎯 ${attacker.name} 预判位置命中，但 ${raider.name} 有裤子护体未能「咔」中！`, 'skill');
            emitFx('float', { nodeId: raider.location, text: '有裤免疫!', kind: 'info' });
          }
        } else {
          addLog(`💨 预判扑空！${attacker.name} 在【${getNode(pred.loc)?.name}】挥空了！`, 'normal');
          emitFx('float', { nodeId: pred.loc, text: 'MISS!', kind: 'miss' });
          emitFx('sfx', { name: 'miss' });
        }
      });

      if (Engine.checkVictory()) return;

      if (raider.status === 'alive' && raider.deferredSteps > 0 && !raider.paralyzed) {
        raider.steps = raider.deferredSteps;
        raider.deferredSteps = 0;
        state.turnQueue.push({ playerId: raider.id, done: false });
        state.phase = 'action';
        state.activePlayerId = raider.id;
        addLog(`🗡 ${raider.name} 现身完毕，立刻执行本回合的 ${raider.steps} 步！`, 'skill');
        Net.broadcastState();
        UI.renderAll();
        AI.scheduleTick();
        return;
      }

      Engine.nextStealthReveal();
    },

    calcStabDamage(attacker) {
      let dmg = 1 * (attacker.atkMult || 1);
      if (hasSQ(attacker, 'SQ1')) dmg *= 2;
      if (state.weather === 'bloodmoon') dmg += 0.5;
      if (isHypoxic(attacker)) dmg *= 0.5;
      return Math.max(0.5, roundHalf(dmg));
    },

    executePlayerAction(playerId, intent) {
      if (state.phase !== 'action' || state.activePlayerId !== playerId) return;
      const actor = getPlayer(playerId);
      if (!actor || actor.status !== 'alive') return;

      const act = intent.action;
      const curNode = getNode(actor.location);
      const orderIdx = state.turnQueue.findIndex((e) => e.playerId === actor.id) + 1;
      const orderTag = orderIdx > 0 ? `#${orderIdx}` : '';

      const checkPigFaceBlock = (target) => {
        if (needsPinchPigFace(actor, target)) {
          window.VFX?.toast(`目标【${target.name}】戴着猪脸！必须先同地点花 1 步捏脸！`, 'warn');
          return true;
        }
        return false;
      };

      if (act === 'pass_bomb') {
        if (!actor.bomb) return;
        const target = getPlayer(intent.targetId);
        if (!target || target.status !== 'alive' || target.location !== actor.location || target.id === actor.id) return;
        if (checkPigFaceBlock(target)) return;
        target.bomb = { turnsLeft: actor.bomb.turnsLeft };
        actor.bomb = null;
        addLog(`💣 ${actor.name} 贴脸将人体炸弹（剩 ${target.bomb.turnsLeft} 回合）过继给了 ${target.name}！`, 'kill');
        emitFx('bannerAction', { order: orderTag, actor: actor.name, action: '炸弹过继', target: target.name, result: `剩余 ${target.bomb.turnsLeft} 回合`, mood: 'p5r' });
        emitFx('float', { nodeId: target.location, text: '💣 接雷!', kind: 'dmg' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'pass') {
        actor.steps = 0;
        addLog(`⏭ ${actor.name} 结束行动`, 'muted');
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'move') {
        if (actor.steps < 1) return;
        if (actor.parasiteHostId) { window.VFX?.toast('寄生附身态无法普通移动，请使用「破体而出」', 'warn'); return; }
        if (!getReachableMoveNodes(actor).some((n) => n.id === intent.destId)) { window.VFX?.toast('目标地点不可直达或被结界封锁', 'warn'); return; }
        const carryIds = Array.isArray(intent.carryIds) ? intent.carryIds : [];
        for (const cid of carryIds) {
          const ct = getPlayer(cid);
          if (ct && checkPigFaceBlock(ct)) return;
        }
        actor.steps -= 1;
        movePlayerTo(actor, intent.destId, { carryIds });
        emitFx('bannerAction', { order: orderTag, actor: actor.name, action: '移动', target: getNode(intent.destId)?.name || '', result: carryIds.length ? `强行携带 ${carryIds.length} 人` : '抵达目标地点' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'wear_pants') {
        if (actor.steps < 1) return;
        if (state.weather === 'storm' && curNode?.layer === 'land') { window.VFX?.toast('雷暴天象下陆地禁止穿裤！', 'warn'); return; }
        if (actor.pants >= actor.maxPants) { window.VFX?.toast('裤子已达上限', 'warn'); return; }
        actor.steps -= 1;
        const before = actor.pants;
        actor.pants = Math.min(actor.maxPants, roundHalf(actor.pants + 1));
        const gain = roundHalf(actor.pants - before);
        addLog(`👖 ${actor.name} 穿裤 +${gain}👖 (${actor.pants}/${actor.maxPants})`, 'normal');
        emitFx('float', { nodeId: actor.location, text: `+${gain}👖`, kind: 'heal' });
        emitFx('sfx', { name: 'click' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'draw_knife') {
        if (actor.steps < 1) return;
        actor.steps -= 1;
        actor.knives += 1;
        addLog(`🔪 ${actor.name} 拔刀 +1🔪 (共${actor.knives})`, 'normal');
        emitFx('float', { nodeId: actor.location, text: '+1🔪', kind: 'info' });
        emitFx('sfx', { name: 'knife' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'steal_knife') {
        if (actor.steps < 1) return;
        const target = getPlayer(intent.targetId);
        if (!target || target.status !== 'alive' || target.location !== actor.location || target.knives <= 0) return;
        if (checkPigFaceBlock(target)) return;
        actor.steps -= 1;
        target.knives -= 1;
        actor.knives += 1;
        addLog(`✋ ${actor.name} 贴脸抢走了 ${target.name} 的 1 把刀！`, 'normal');
        emitFx('bannerAction', { order: orderTag, actor: actor.name, action: '抢刀', target: target.name, result: '+1🔪' });
        emitFx('float', { nodeId: actor.location, text: '抢刀 +1🔪', kind: 'skill' });
        emitFx('sfx', { name: 'knife' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'steal_tank') {
        if (actor.steps < 1) return;
        const target = getPlayer(intent.targetId);
        if (!target || target.status !== 'alive' || target.location !== actor.location || !target.oxygenTank) return;
        if (checkPigFaceBlock(target)) return;
        actor.steps -= 1;
        target.oxygenTank = false;
        actor.oxygenTank = true;
        addLog(`🫧 ${actor.name} 贴脸抢走了 ${target.name} 的氧气瓶！`, 'skill');
        emitFx('float', { nodeId: actor.location, text: '抢走氧气瓶!', kind: 'pants' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'pinch_pigface') {
        if (actor.steps < 1) return;
        const target = getPlayer(intent.targetId);
        if (!target || target.status !== 'alive' || target.location !== actor.location) return;
        const keys = getPigFaceInstances(target);
        if (keys.length === 0) return;
        actor.steps -= 1;
        keys.forEach((k) => { if (!actor.pinchedFaces.includes(k)) actor.pinchedFaces.push(k); });
        addLog(`🐷 ${actor.name} 贴脸捏了 ${target.name} 的猪脸，解除互动限制！`, 'skill');
        emitFx('float', { nodeId: actor.location, text: '🐷 已捏脸!', kind: 'skill' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'strip_pants') {
        if (actor.steps < 1) return;
        const power = hasSQ(actor, 'SQ1') ? 2 : 1;
        if (intent.targetId === 'NPC_WARDEN') {
          if (!canAttackWardenFrom(curNode)) return;
          if (state.warden.pants <= 0) { window.VFX?.toast('典狱长已 0 裤，持刀直接「咔」！', 'warn'); return; }
          actor.steps -= 1;
          const before = state.warden.pants;
          state.warden.pants = Math.max(0, roundHalf(state.warden.pants - power));
          const lost = roundHalf(before - state.warden.pants);
          addLog(`👖 ${actor.name} 扒掉典狱长 ${lost} 裤（剩余 ${state.warden.pants}）`, 'normal');
          emitFx('float', { nodeId: actor.location, text: `典狱长 -${lost}👖`, kind: 'pants' });
          emitFx('sfx', { name: 'pants' });
          Engine.finishCurrentActorIfDone(actor);
          return;
        }
        const target = getPlayer(intent.targetId);
        if (!target || target.status !== 'alive' || target.location !== actor.location || target.id === actor.id) return;
        if (checkPigFaceBlock(target)) return;
        actor.steps -= 1;
        const lost = applyPantsLoss(target, power, '扒裤');
        addLog(`👖 ${actor.name} 扒 ${target.name} -${lost}👖 (剩${target.pants})`, 'normal');
        emitFx('bannerAction', { order: orderTag, actor: actor.name, action: hasSQ(actor, 'SQ1') ? '大刀重扒' : '扒裤', target: target.name, result: `-${lost}👖（剩 ${target.pants}）` });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'stab') {
        if (actor.steps < 1 || actor.knives < 1) return;
        const dmg = Engine.calcStabDamage(actor);
        if (intent.targetId === 'NPC_WARDEN') {
          if (!canAttackWardenFrom(curNode)) return;
          if (state.warden.pants > 0) { window.VFX?.toast('典狱长还有裤子，必须先扒至 0 裤才能「咔」！', 'warn'); return; }
          actor.steps -= 1;
          Engine.damageWarden(actor, dmg);
          Engine.finishCurrentActorIfDone(actor);
          return;
        }
        const target = getPlayer(intent.targetId);
        if (!target || target.status !== 'alive' || target.location !== actor.location || target.id === actor.id) return;
        if (target.pants > 0) { window.VFX?.toast('目标还有裤子，必须先扒至 0 裤才能「咔」！', 'warn'); return; }
        if (checkPigFaceBlock(target)) return;

        actor.steps -= 1;
        Engine.tryPiggyStealKnife(actor, target);
        const res = applyHpDamage(target, dmg, actor, { canDodge: true, reason: `被 ${actor.name} 持刀「咔」死` });
        addLog(res.dodged ? `🔪 ${actor.name} 咔 ${target.name} → MISS` : `🔪 ${actor.name} 绝杀咔 ${target.name} -${dmg}❤️`, 'kill');
        emitFx('bannerAction', { order: orderTag, actor: actor.name, action: '咔！绝杀斩击', target: target.name, result: res.dodged ? 'MISS!' : res.killed ? '目标阵亡！' : `-${dmg}❤️`, mood: 'p5r' });
        if (res.killed) Engine.maybeTriggerNinjaChain(actor);
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'sq2_dash') {
        if (actor.steps < 1 || !hasSQ(actor, 'SQ2') || actor.parasiteHostId) return;
        if (!getReachableMoveNodes(actor).some((n) => n.id === intent.destId)) return;

        let target = null;
        if (intent.targetId && intent.targetId !== 'NPC_WARDEN') {
          target = getPlayer(intent.targetId);
          if (!target || target.status !== 'alive' || target.location !== intent.destId || target.id === actor.id) return;
          if (checkPigFaceBlock(target)) return;
        }

        actor.steps -= 1;
        movePlayerTo(actor, intent.destId, { carryIds: [], silent: true });
        addLog(`⚡ ${actor.name} 发动【SQ2 利刃】突进至【${getNode(intent.destId)?.name}】！`, 'kill');

        const dmg = Engine.calcStabDamage(actor);
        if (intent.targetId === 'NPC_WARDEN' && intent.destId === 'land_prison_out') {
          if (state.warden.pants > 0) {
            const pLost = Math.min(state.warden.pants, hasSQ(actor, 'SQ1') ? 2 : 1);
            state.warden.pants = roundHalf(state.warden.pants - pLost);
            addLog(`⚔ 利刃顺势斩掉典狱长 ${pLost} 裤！`, 'normal');
          } else {
            Engine.damageWarden(actor, dmg);
          }
        } else if (target) {
          Engine.tryPiggyStealKnife(actor, target);
          if (target.pants > 0) {
            const lost = applyPantsLoss(target, hasSQ(actor, 'SQ1') ? 2 : 1, '利刃突进');
            addLog(`⚔ 利刃突进划破 ${target.name} 的裤子（-${lost}👖）！`, 'kill');
            emitFx('bannerAction', { order: orderTag, actor: actor.name, action: '利刃突进', target: target.name, result: `-${lost}👖`, mood: 'p5r' });
          } else {
            const res = applyHpDamage(target, dmg, actor, { canDodge: true, reason: `被 ${actor.name} 利刃突进斩杀` });
            emitFx('bannerAction', { order: orderTag, actor: actor.name, action: '利刃突进绝杀', target: target.name, result: res.dodged ? 'MISS!' : res.killed ? '瞬杀！' : `-${dmg}❤️`, mood: 'p5r' });
            if (res.killed) Engine.maybeTriggerNinjaChain(actor);
          }
        }
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'breathe') {
        if (actor.steps < 1 || !curNode || curNode.layer === 'land') return;
        if (!hasEffectiveOxygenTank(actor) && !(curNode.layer === 'ocean' && hasEffectiveFrogMask(actor))) {
          window.VFX?.toast('氧气瓶已损坏或被抢，无法在海空呼吸！', 'danger');
          return;
        }
        actor.steps -= 1;
        actor.oxygenTurns = 0;
        actor.breathedThisTurn = true;
        // 寄生者共享宿主呼吸
        state.players.forEach((p) => {
          if (p.status === 'alive' && p.parasiteHostId === actor.id) {
            p.oxygenTurns = 0;
            p.breathedThisTurn = true;
          }
        });
        addLog(`💨 ${actor.name} 呼吸重置`, 'muted');
        emitFx('float', { nodeId: actor.location, text: '呼吸重置!', kind: 'heal' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'pickup_artifact') {
        if (actor.steps < 1 || !curNode) return;
        const sqId = intent.sqId;
        const idx = curNode.droppedArtifacts.indexOf(sqId);
        if (idx === -1) return;
        actor.steps -= 1;
        curNode.droppedArtifacts.splice(idx, 1);
        state.artifacts[sqId].ownerId = actor.id;
        state.artifacts[sqId].droppedAt = null;
        if (sqId === 'SQ3') state.artifacts.SQ3.instanceId += 1;
        addLog(`✨ ${actor.name} 拾取了掉落的龙宫神器【${ARTIFACTS[sqId].name}】！`, 'system');
        emitFx('float', { nodeId: actor.location, text: `获得 ${ARTIFACTS[sqId].short}!`, kind: 'skill' });
        emitFx('sfx', { name: 'skill' });
        updateBountyStatus(actor);
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'shake_parasite') {
        if (actor.steps < 1) return;
        const paras = state.players.filter((p) => p.status === 'alive' && p.parasiteHostId === actor.id);
        if (paras.length === 0) return;
        actor.steps -= 1;
        paras.forEach((p) => {
          p.parasiteHostId = null;
          addLog(`💨 ${actor.name} 扒裤甩开了寄生者 ${p.name}！`, 'skill');
          emitFx('float', { nodeId: actor.location, text: '甩开寄生!', kind: 'skill' });
        });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'predict_raider') {
        if (actor.steps < 1) return;
        const raider = getPlayer(intent.targetId);
        if (!raider || raider.status !== 'alive' || !raider.stealth?.active || raider.stealth.turnUsed >= state.turn) return;
        if (checkPigFaceBlock(raider)) return;
        const mode = intent.mode === 'strip' ? 'strip' : 'stab';
        if (mode === 'stab' && actor.knives < 1) { window.VFX?.toast('预判「咔」需要持刀！', 'warn'); return; }
        actor.steps -= 1;
        raider.stealth.predictions.push({ predictorId: actor.id, loc: actor.location, mode });
        addLog(`🎯 ${actor.name} 在【${curNode?.name}】对隐身突袭者 ${raider.name} 宣告了预判${mode === 'stab' ? '斩击' : '扒裤'}！`, 'skill');
        emitFx('float', { nodeId: actor.location, text: '🎯 预判锁定', kind: 'skill' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'police_arrest') {
        if (actor.steps < 1 || curNode?.kind !== 'police') return;
        if (state.nodes.land_prison_out?.collapsed) { window.VFX?.toast('监狱已坍塌，无法逮捕入狱！', 'warn'); return; }
        const target = getPlayer(intent.targetId);
        if (!target || target.status !== 'alive' || target.id === actor.id || target.location === 'land_prison_in') return;
        if (checkPigFaceBlock(target)) return;
        actor.steps -= 1;
        Engine.startArrestBo3(actor, target, '警局远程逮捕');
        return;
      }

      if (act === 'police_corpse') {
        if (actor.steps < 1 || curNode?.kind !== 'police') return;
        const holder = Object.values(state.nodes).find((n) => n.corpses.length > 0);
        if (!holder) { window.VFX?.toast('场上目前没有可搬运的尸体', 'warn'); return; }
        actor.steps -= 1;
        const corpse = holder.corpses.shift();
        actor.hp = roundHalf(actor.hp + 0.5);
        addLog(`🚑 ${actor.name} 在警察局搬运了 ${corpse.name} 的尸体，回复 +0.5 命！`, 'normal');
        emitFx('float', { nodeId: actor.location, text: '+0.5❤️', kind: 'heal' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'police_surrender') {
        if (actor.steps < 1 || curNode?.kind !== 'police') return;
        if (state.nodes.land_prison_out?.collapsed) { window.VFX?.toast('监狱已坍塌，无法自首入狱！', 'warn'); return; }
        actor.steps -= 1;
        sendPlayerToJail(actor, '主动自首');
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'equip_frog_mask') {
        if (actor.steps < 1 || curNode?.kind !== 'aquarium' || actor.frogMask) return;
        actor.steps -= 1;
        actor.frogMask = true;
        actor.pants = 0;
        actor.maxPants = 0;
        actor.hp = 0.5;
        actor.oxygenTurns = 0;
        addLog(`🐸 ${actor.name} 戴上青蛙面罩！获得永久水下呼吸，代价：裤上限永久 0，HP 变为 0.5！`, 'skill');
        emitFx('float', { nodeId: actor.location, text: '🐸 青蛙面罩', kind: 'skill' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'ruins_dig') {
        if (actor.steps < 1 || curNode?.kind !== 'ruins') return;
        actor.steps -= 1;
        if (Math.random() < 0.25) {
          actor.maxPants = 10;
          addLog(`🏛 奇迹降临！${actor.name} 在遗迹挖出古代神裤，裤子上限暴增至 10！`, 'system');
          emitFx('float', { nodeId: actor.location, text: '裤上限→10!', kind: 'heal' });
          emitFx('sfx', { name: 'rps_win' });
        } else {
          addLog(`⛏ ${actor.name} 【遗迹】挖掘落空`, 'muted');
          emitFx('float', { nodeId: actor.location, text: '挖掘落空', kind: 'info' });
        }
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'forge_artifact') {
        if (actor.steps < 1 || curNode?.kind !== 'palace') return;
        const sqId = intent.sqId;
        const art = state.artifacts[sqId];
        const meta = ARTIFACTS[sqId];
        if (!art || !meta || art.ownerId || art.droppedAt) return;
        actor.steps -= 1;
        art.progress += 1;
        if (art.progress >= meta.stepsNeed) {
          art.ownerId = actor.id;
          if (sqId === 'SQ3') art.instanceId += 1;
          addLog(`👑 ${actor.name} 锻成【${meta.name}】`, 'system');
          emitFx('banner', { kicker: 'ARTIFACT FORGED // 龙宫神器出世', title: `${actor.name} 获得 ${meta.name}`, sub: meta.desc, mood: 'p5r', durationMs: 2150 });
          emitFx('sfx', { name: 'skill' });
          updateBountyStatus(actor);
        } else {
          addLog(`🔱 ${actor.name} 锻造【${meta.short}】${art.progress}/${meta.stepsNeed}`, 'normal');
          emitFx('float', { nodeId: actor.location, text: `${meta.short} ${art.progress}/${meta.stepsNeed}`, kind: 'skill' });
        }
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'wish_step') {
        if (actor.steps < 1 || curNode?.kind !== 'wish') return;
        actor.steps -= 1;
        actor.wishSteps += 1;
        if (actor.wishSteps >= 3) {
          actor.wishSteps = 0;
          state.pendingAction = { type: 'wish_pick', actorId: actor.id };
          addLog(`🌠 ${actor.name} 集齐 3 步许愿，正在向许愿池许下终极愿望！`, 'system');
          emitFx('sfx', { name: 'skill' });
        } else {
          addLog(`✨ ${actor.name} 向许愿池投币祈祷（个人进度 ${actor.wishSteps}/3）`, 'normal');
          emitFx('float', { nodeId: actor.location, text: `许愿 ${actor.wishSteps}/3`, kind: 'skill' });
        }
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'set_weather') {
        if (actor.steps < 1 || curNode?.kind !== 'observatory') return;
        const w = intent.weather;
        if (!['bloodmoon', 'fog', 'storm'].includes(w)) return;
        actor.steps -= 1;
        state.nextWeather = w;
        addLog(`🔭 ${actor.name} 在天象台改写星轨：下回合天象锁定为【${WEATHERS[w].name}】！`, 'system');
        emitFx('float', { nodeId: actor.location, text: `下回合:${WEATHERS[w].name}`, kind: 'skill' });
        emitFx('sfx', { name: 'skill' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'blackmarket_draw') {
        if (actor.steps < 1 || curNode?.kind !== 'blackmarket') return;
        actor.steps -= 1;
        state.pendingAction = {
          type: 'blackmarket',
          actorId: actor.id,
          contracts: Engine.rollBlackMarketContracts(),
          canFreeReroll: actor.roleId === 'normal' && actor.blackMarketRerollTurn !== state.turn
        };
        addLog(`🕶 ${actor.name} 踏入黑市，掀开了 3 份恶魔契约...`, 'skill');
        emitFx('sfx', { name: 'blackmarket' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'use_skill') {
        Engine.executeRoleSkill(actor, intent, orderTag, checkPigFaceBlock);
      }
    },

    executeRoleSkill(actor, intent, orderTag, checkPigFaceBlock, forcedRoleId = null) {
      // 破体而出快速通道（同时兼容寄生者本体与盗版附身的镜像师）
      if (actor.parasiteHostId && intent.burstMode) {
        if (actor.steps < 1) return;
        const host = getPlayer(actor.parasiteHostId);
        actor.parasiteHostId = null;
        actor.steps -= 1;
        if (host && host.status === 'alive') {
          if (intent.burstMode === 'stab' && actor.knives >= 1 && host.pants <= 0) {
            const dmg = Engine.calcStabDamage(actor);
            const res = applyHpDamage(host, dmg, actor, { canDodge: true, reason: `被 ${actor.name} 破体斩杀` });
            addLog(`💥 ${actor.name} 破体而出！免费「咔」了宿主 ${host.name}（-${dmg}❤️）！`, 'kill');
            emitFx('bannerAction', { order: orderTag, actor: actor.name, action: '破体绝杀', target: host.name, result: res.killed ? '宿主爆体阵亡！' : `-${dmg}❤️`, mood: 'p5r' });
          } else {
            const lost = applyPantsLoss(host, hasSQ(actor, 'SQ1') ? 2 : 1, '破体扒裤');
            addLog(`💥 ${actor.name} 破体而出！免费扒掉宿主 ${host.name} ${lost} 裤！`, 'skill');
            emitFx('bannerAction', { order: orderTag, actor: actor.name, action: '破体奇袭', target: host.name, result: `免费扒 -${lost}👖`, mood: 'p5r' });
          }
        }
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (isHypoxic(actor)) {
        window.VFX?.toast('缺氧状态下禁用角色主动技！', 'danger');
        return;
      }

      const skillRole = forcedRoleId || actor.roleId;
      const isMirrorCopy = Boolean(forcedRoleId);

      if (skillRole === 'mirror' && !isMirrorCopy) {
        if (actor.steps < 1 || actor.activeCharges < 1) return;
        if (!state.lastActiveSkill) {
          actor.steps -= 1;
          actor.activeCharges -= 1;
          actor.knives += 1;
          actor.pants = Math.min(actor.maxPants, roundHalf(actor.pants + 0.5));
          addLog(`🪞 镜像师 ${actor.name} 发动【盗版】（场上尚无先例），转化为 +1 刀 +0.5 裤！`, 'skill');
          emitFx('float', { nodeId: actor.location, text: '+1🔪 +0.5👖', kind: 'skill' });
          emitFx('sfx', { name: 'skill' });
          Engine.finishCurrentActorIfDone(actor);
          return;
        }
        Engine.executeRoleSkill(actor, intent, orderTag, checkPigFaceBlock, state.lastActiveSkill.roleId);
        return;
      }

      const recordLastActive = (roleId, skillName) => {
        if (roleId !== 'mirror') state.lastActiveSkill = { roleId, skillName, casterId: actor.id };
      };

      if (skillRole === 'raider') {
        if (actor.steps < 1 || actor.activeCharges < 1) return;
        actor.steps -= 1;
        actor.activeCharges -= 1;
        actor.stealth = { active: true, originLoc: actor.location, turnUsed: state.turn, predictions: [] };
        recordLastActive('raider', '量子隐身');
        addLog(`👤 ${actor.name} 发动【量子隐身】消失在观测之外！下回合全员走完后揭晓暗步！`, 'skill');
        emitFx('bannerAction', { order: orderTag, actor: actor.name, action: '量子隐身', result: '行踪加密 · 等待下回合揭晓', mood: 'p5r' });
        emitFx('sfx', { name: 'skill' });
        actor.steps = 0;
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (skillRole === 'storm') {
        if (actor.activeCharges < 1) return;
        const isWholeNode = intent.mode === 'node';
        const costStep = isMirrorCopy ? 1 : (isWholeNode ? 1 : 0);
        if (actor.steps < costStep) return;

        const destNode = getNode(intent.destId);
        if (!destNode || destNode.collapsed || destNode.kind === 'prison_in' || isBarrierActive(destNode.id)) return;

        let victims = [];
        if (isWholeNode) {
          const srcNode = getNode(intent.srcNodeId);
          if (!srcNode || srcNode.layer !== destNode.layer || srcNode.id === destNode.id || isBarrierActive(srcNode.id)) return;
          victims = getAlivePlayersAt(srcNode.id);
        } else {
          const target = getPlayer(intent.targetId);
          if (!target || target.status !== 'alive') return;
          const tNode = getNode(target.location);
          if (!tNode || tNode.layer !== destNode.layer || tNode.id === destNode.id || isBarrierActive(tNode.id)) return;
          if (checkPigFaceBlock(target)) return;
          victims = [target];
        }

        actor.steps -= costStep;
        actor.activeCharges -= 1;
        recordLastActive('storm', '乱流风暴');
        const blown = [];
        victims.forEach((v) => {
          if (isWholeNode && needsPinchPigFace(actor, v)) return;
          movePlayerTo(v, destNode.id, { carryIds: [], silent: true });
          blown.push(v.name);
        });
        addLog(`🌪 ${actor.name} 发动【乱流风暴】将 ${blown.join('、') || '无人'} 吹至【${destNode.name}】！`, 'skill');
        emitFx('bannerAction', { order: orderTag, actor: actor.name, action: '乱流风暴', target: destNode.name, result: `吹飞 ${blown.join('、') || '空地'}` });
        emitFx('ripple', { nodeId: destNode.id, color: '#00d4ff', rings: 3 });
        emitFx('sfx', { name: 'skill' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (skillRole === 'chili') {
        if (actor.steps < 1 || actor.activeCharges < 1) return;
        const target = getPlayer(intent.targetId);
        if (!target || target.status !== 'alive' || target.id === actor.id) return;
        if (checkPigFaceBlock(target)) return;

        actor.steps -= 1;
        actor.activeCharges -= 1;
        target.paralyzedNextTurn = true;
        recordLastActive('chili', '电击麻痹');
        addLog(`⚡ ${actor.name} 电击 ${target.name} → 下回麻痹`, 'skill');
        emitFx('electricArc', { fromNodeId: actor.location, toNodeId: target.location, durationMs: 520 });
        emitFx('float', { nodeId: target.location, text: '⚡ 下回合麻痹!', kind: 'skill' });
        emitFx('bannerAction', { order: orderTag, actor: actor.name, action: '电击麻痹', target: target.name, result: '下回合强制无法行动', mood: 'p5r' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (skillRole === 'watcher') {
        if (actor.steps < 1 || actor.activeCharges < 1) return;
        if (state.nodes.land_prison_out?.collapsed) { window.VFX?.toast('监狱已坍塌，无法抓捕入狱！', 'warn'); return; }
        const target = getPlayer(intent.targetId);
        if (!target || target.status !== 'alive' || target.id === actor.id || target.location === 'land_prison_in') return;
        if (checkPigFaceBlock(target)) return;

        actor.steps -= 1;
        actor.activeCharges -= 1;
        recordLastActive('watcher', '远程抓捕');
        Engine.startArrestBo3(actor, target, '监视者远程抓捕');
        return;
      }

      if (skillRole === 'piggy') {
        if (actor.activeCharges < 1) return;
        const costStep = isMirrorCopy ? 1 : 0;
        if (actor.steps < costStep) return;
        actor.steps -= costStep;
        actor.activeCharges -= 1;
        actor.piggyStealArmed = true;
        recordLastActive('piggy', '顺手牵刀');
        addLog(`🐷 ${actor.name} 蓄势【顺手牵刀】：下次攻击目标时将免费顺走对方 1 把刀！`, 'skill');
        emitFx('float', { nodeId: actor.location, text: '顺手牵刀就绪!', kind: 'skill' });
        emitFx('sfx', { name: 'knife' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (skillRole === 'ninja' && isMirrorCopy) {
        if (actor.steps < 1 || actor.activeCharges < 1) return;
        if (Engine.getNinjaChainTargets(actor).length === 0) {
          window.VFX?.toast('距离 1 内暂无可撞击目标！', 'warn');
          return;
        }
        actor.steps -= 1;
        actor.activeCharges -= 1;
        state.pendingAction = { type: 'ninja_chain', actorId: actor.id, freeMirror: true };
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (skillRole === 'puppeteer') {
        if (actor.steps < 1 || actor.activeCharges < 1) return;
        const target = getPlayer(intent.targetId);
        if (!target || target.status !== 'alive' || target.id === actor.id) return;
        const aNode = getNode(actor.location);
        const tNode = getNode(target.location);
        if (!aNode || !tNode || aNode.layer !== tNode.layer) { window.VFX?.toast('提线木偶只能操控同层级玩家！', 'warn'); return; }
        if (checkPigFaceBlock(target)) return;

        const cmd = intent.puppetAction;
        let resultText = '';
        if (cmd === 'move') {
          if (target.parasiteHostId) { window.VFX?.toast('目标正处于寄生附身态，无法强制移动！', 'warn'); return; }
          if (!getReachableMoveNodes(target).some((n) => n.id === intent.destId)) { window.VFX?.toast('木偶无法移动到该地点', 'warn'); return; }
          movePlayerTo(target, intent.destId, { carryIds: [], silent: true });
          resultText = `被迫移动至【${getNode(intent.destId)?.name}】`;
        } else if (cmd === 'wear_pants') {
          if (state.weather === 'storm' && tNode.layer === 'land') { window.VFX?.toast('雷暴陆地禁穿裤', 'warn'); return; }
          target.pants = Math.min(target.maxPants, roundHalf(target.pants + 1));
          resultText = `被迫穿裤（${target.pants}/${target.maxPants}）`;
        } else if (cmd === 'draw_knife') {
          target.knives += 1;
          resultText = `被迫拔刀（${target.knives}刀）`;
        } else if (cmd === 'strip_pants') {
          const subVictim = getPlayer(intent.stripVictimId);
          if (!subVictim || subVictim.status !== 'alive' || subVictim.location !== target.location || subVictim.id === target.id) return;
          if (needsPinchPigFace(target, subVictim)) { window.VFX?.toast(`木偶尚未捏过 ${subVictim.name} 的猪脸！`, 'warn'); return; }
          const lost = applyPantsLoss(subVictim, hasSQ(target, 'SQ1') ? 2 : 1, '提线扒裤');
          resultText = `被迫扒掉 ${subVictim.name} ${lost} 裤`;
        } else {
          return;
        }

        actor.steps -= 1;
        actor.activeCharges -= 1;
        recordLastActive('puppeteer', '提线木偶');
        addLog(`🧵 ${actor.name} 发动【提线木偶】强控 ${target.name}：${resultText}！`, 'skill');
        emitFx('bannerAction', { order: orderTag, actor: actor.name, action: '提线木偶', target: target.name, result: resultText, mood: 'p5r' });
        emitFx('sfx', { name: 'skill' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (skillRole === 'parasite') {
        if (actor.steps < 1 || actor.activeCharges < 1) return;
        const host = getPlayer(intent.targetId);
        if (!host || host.status !== 'alive' || host.location !== actor.location || host.id === actor.id) return;
        if (host.parasiteHostId === actor.id) { window.VFX?.toast('对方正寄生在你体内，不能互相嵌套寄生！', 'warn'); return; }
        if (checkPigFaceBlock(host)) return;

        actor.steps -= 1;
        actor.activeCharges -= 1;
        actor.parasiteHostId = host.id;
        recordLastActive('parasite', '寄生');
        addLog(`🦠 ${actor.name} 发动【寄生】钻入 ${host.name} 体内，免费随行并共享氧气/面罩！`, 'skill');
        emitFx('float', { nodeId: actor.location, text: `寄生→${host.name}`, kind: 'skill' });
        emitFx('sfx', { name: 'skill' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (skillRole === 'barrier') {
        if (actor.steps < 1 || actor.activeCharges < 1) return;
        const node = getNode(intent.nodeId);
        if (!node || node.collapsed || node.kind === 'prison_in') return;

        actor.steps -= 1;
        actor.activeCharges -= 1;
        node.barrierUntilTurn = state.turn + 1;
        recordLastActive('barrier', '绝对领域');
        addLog(`🔮 ${actor.name} 展开【绝对领域】彻底封锁【${node.name}】至第 ${state.turn + 1} 回合末！`, 'skill');
        emitFx('bannerAction', { order: orderTag, actor: actor.name, action: '绝对领域', target: node.name, result: `内外彻底隔绝至 T${state.turn + 1}`, mood: 'p5r' });
        emitFx('ripple', { nodeId: node.id, color: '#b666ff', rings: 3 });
        emitFx('sfx', { name: 'skill' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (skillRole === 'curser') {
        if (actor.steps < 1 || actor.activeCharges < 1) return;
        const a = getPlayer(intent.targetAId);
        const b = getPlayer(intent.targetBId);
        if (!a || !b || a.id === b.id || a.status !== 'alive' || b.status !== 'alive') return;
        if (checkPigFaceBlock(a) || checkPigFaceBlock(b)) return;

        actor.steps -= 1;
        actor.activeCharges -= 1;
        state.links.push({ id: uid('lnk'), aId: a.id, bId: b.id, expiresTurn: state.turn + 2 });
        recordLastActive('curser', '命运链接');
        addLog(`🩸 ${actor.name} 施放【命运链接】绑定 ${a.name} ⇄ ${b.name}（持续 2 回合，扣裤扣血同步承受）！`, 'skill');
        emitFx('bannerAction', { order: orderTag, actor: actor.name, action: '命运链接', target: `${a.name} ⇄ ${b.name}`, result: '扣裤扣血同步共振 2 回合', mood: 'p5r' });
        emitFx('sfx', { name: 'blackmarket' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (skillRole === 'undertaker') {
        if (actor.steps < 1 || actor.activeCharges < 1) return;
        const target = getPlayer(intent.targetId);
        if (!target || target.status !== 'pending_revive') return;

        actor.steps -= 1;
        actor.activeCharges -= 1;
        target.reviveUsed = true;
        target.status = 'dead_final';
        actor.hp = roundHalf(actor.hp + 0.5);
        recordLastActive('undertaker', '封魂');
        addLog(`⚰ ${actor.name} 发动【封魂】彻底捏碎 ${target.name} 的地府复活资格，并回复 +0.5 命！`, 'kill');
        emitFx('bannerAction', { order: orderTag, actor: actor.name, action: '封魂灭魄', target: target.name, result: '复活资格销毁 · 自身 +0.5❤️', mood: 'p5r' });
        emitFx('float', { nodeId: actor.location, text: '+0.5❤️', kind: 'heal' });
        emitFx('sfx', { name: 'blackmarket' });
        Engine.finishCurrentActorIfDone(actor);
      }
    },

    tryPiggyStealKnife(actor, target) {
      if (actor.piggyStealArmed && target.knives > 0) {
        actor.piggyStealArmed = false;
        target.knives -= 1;
        actor.knives += 1;
        addLog(`🐷 ${actor.name} 触发【顺手牵刀】免费抢走 ${target.name} 1 把刀！`, 'skill');
        emitFx('float', { nodeId: actor.location, text: '顺手牵刀 +1🔪', kind: 'skill' });
      }
    },

    damageWarden(actor, dmg) {
      state.warden.hp = roundHalf(state.warden.hp - dmg);
      emitFx('slash', { nodeId: 'land_prison_out', color: '#e60023', intensity: 1.3, count: 2 });
      emitFx('float', { nodeId: 'land_prison_out', text: `典狱长 -${dmg}❤️`, kind: 'dmg' });

      if (state.warden.hp <= 0) {
        const freed = [];
        state.players.forEach((p) => {
          if (p.status === 'alive' && p.location === 'land_prison_in') {
            p.location = 'land_prison_out';
            freed.push(p.name);
          }
        });
        state.warden.respawnCount += 1;
        state.warden.hp = 1;
        state.warden.pants = 3;
        addLog(`🔓 ${actor.name} 击杀典狱长！${freed.length ? `${freed.join('、')} 越狱` : '牢内无人'}`, 'system');
        emitFx('banner', { kicker: 'JAILBREAK // 越狱成功', title: '典狱长倒下！', sub: freed.length ? `${freed.join('、')} 全部出狱` : '新任典狱长已就位', mood: 'p5r', durationMs: 2150 });
        Engine.maybeTriggerNinjaChain(actor);
      }
    },

    maybeTriggerNinjaChain(actor) {
      if (!actor || actor.status !== 'alive' || actor.roleId !== 'ninja') return;
      if (actor.activeCharges <= 0 || isHypoxic(actor)) return;
      if (Engine.getNinjaChainTargets(actor).length > 0) {
        state.pendingAction = { type: 'ninja_chain', actorId: actor.id };
      }
    },

    getNinjaChainTargets(actor) {
      const reachableIds = new Set([actor.location, ...getReachableMoveNodes(actor).map((n) => n.id)]);
      const list = [];
      state.players.forEach((p) => {
        if (p.status === 'alive' && p.id !== actor.id && reachableIds.has(p.location) && !needsPinchPigFace(actor, p)) {
          list.push({ id: p.id, name: p.name, nodeId: p.location, isWarden: false });
        }
      });
      const actorNode = getNode(actor.location);
      if ((reachableIds.has('land_prison_out') || actorNode?.kind === 'prison_in') && !state.nodes.land_prison_out?.collapsed) {
        list.push({ id: 'NPC_WARDEN', name: 'NPC 典狱长', nodeId: actorNode?.kind === 'prison_in' ? 'land_prison_in' : 'land_prison_out', isWarden: true });
      }
      return list;
    },

    startArrestBo3(initiator, target, label) {
      state.phase = 'sub_rps';
      state.subRps = { kind: 'arrest', label, aId: initiator.id, bId: target.id, aScore: 0, bScore: 0, targetWins: 2, round: 1, choices: {}, revealed: false };
      addLog(`🚔 ${initiator.name} 对 ${target.name} 发起【${label}】三局两胜猜拳！`, 'skill');
      emitFx('sfx', { name: 'alarm' });
      syncMoodFromState();
      Net.broadcastState();
      UI.renderAll();
      AI.scheduleTick();
    },

    submitSubRps(playerId, hand) {
      if (state.phase !== 'sub_rps' || !state.subRps || state.subRps.revealed) return;
      const sr = state.subRps;
      if ((playerId !== sr.aId && playerId !== sr.bId) || !HAND_META[hand] || sr.choices[playerId]) return;

      sr.choices[playerId] = hand;
      if (playerId === state.selfId) window.VFX?.sfx('rps_lock');
      if (!sr.choices[sr.aId] || !sr.choices[sr.bId]) { Net.broadcastState(); UI.renderAll(); return; }

      sr.revealed = true;
      const ha = sr.choices[sr.aId];
      const hb = sr.choices[sr.bId];
      const pa = getPlayer(sr.aId);
      const pb = getPlayer(sr.bId);
      let roundWinner = null;

      if (ha !== hb) {
        const aWins = (ha === 'rock' && hb === 'scissors') || (ha === 'scissors' && hb === 'paper') || (ha === 'paper' && hb === 'rock');
        if (aWins) { sr.aScore += 1; roundWinner = sr.aId; }
        else { sr.bScore += 1; roundWinner = sr.bId; }
      }

      emitFx('rpsClash', {
        kicker: sr.label,
        title: roundWinner ? `${getPlayer(roundWinner)?.name} 拿下本小局！` : '小局平手！',
        subtitle: `当前比分 ${pa?.name} ${sr.aScore} : ${sr.bScore} ${pb?.name}`,
        entries: [
          { name: pa?.name, hand: ha, outcome: roundWinner === sr.aId ? 'win' : roundWinner ? 'lose' : 'draw', tag: `${sr.aScore} 胜` },
          { name: pb?.name, hand: hb, outcome: roundWinner === sr.bId ? 'win' : roundWinner ? 'lose' : 'draw', tag: `${sr.bScore} 胜` }
        ],
        durationMs: 2000
      });

      Net.broadcastState();
      UI.renderAll();

      scheduleHostTask(() => {
        if (sr.aScore < sr.targetWins && sr.bScore < sr.targetWins) {
          sr.round += 1;
          sr.choices = {};
          sr.revealed = false;
          Net.broadcastState();
          UI.renderAll();
          AI.scheduleTick();
          return;
        }

        const winner = sr.aScore >= sr.targetWins ? pa : pb;
        const loser = winner.id === pa.id ? pb : pa;
        const kind = sr.kind;
        state.subRps = null;
        state.phase = 'action';
        syncMoodFromState();

        if (kind === 'arrest') {
          sendPlayerToJail(loser, `${sr.label}落败`);
          Engine.finishCurrentActorIfDone(getPlayer(state.activePlayerId));
        }
      }, 2150);
    },

    rollBlackMarketContracts() {
      const pool = [...CONTRACTS];
      const out = [];
      for (let i = 0; i < 3 && pool.length > 0; i++) {
        out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id);
      }
      return out;
    },

    resolvePendingAction(playerId, intent) {
      const pa = state.pendingAction;
      if (!pa || pa.actorId !== playerId) return;
      const actor = getPlayer(playerId);
      if (!actor) return;

      if (pa.type === 'blackmarket') {
        if (intent.cancel) {
          state.pendingAction = null;
          addLog(`🕶 ${actor.name} 放弃了本轮黑市契约。`, 'normal');
          Engine.finishCurrentActorIfDone(getPlayer(state.activePlayerId));
          return;
        }
        if (intent.reroll && pa.canFreeReroll) {
          actor.blackMarketRerollTurn = state.turn;
          pa.canFreeReroll = false;
          pa.contracts = Engine.rollBlackMarketContracts();
          addLog(`🔄 普通人 ${actor.name} 免费刷新了黑市恶魔契约！`, 'skill');
          emitFx('sfx', { name: 'blackmarket' });
          Net.broadcastState();
          UI.renderAll();
          AI.scheduleTick();
          return;
        }
        const cid = intent.contractId;
        if (!pa.contracts.includes(cid)) return;
        const target = intent.targetId ? getPlayer(intent.targetId) : null;
        if ((cid === 'bm_swap_pants' || cid === 'bm_bounty_strip') && (!target || target.status !== 'alive' || target.id === actor.id)) {
          window.VFX?.toast('该契约需要指定 1 名存活目标', 'warn');
          return;
        }
        if (target && needsPinchPigFace(actor, target)) {
          window.VFX?.toast(`目标 ${target.name} 戴着猪脸，请先捏脸或改选其他契约！`, 'warn');
          return;
        }
        state.pendingAction = null;
        Engine.applyBlackMarketContract(actor, cid, target);
        Engine.finishCurrentActorIfDone(getPlayer(state.activePlayerId));
        return;
      }

      if (pa.type === 'wish_pick') {
        const w = intent.wishId;
        if (w === 'revive') {
          const dead = getPlayer(intent.targetId);
          if (!dead || dead.status === 'alive') return;
          revivePlayerAtUnderworld(dead, { viaWish: true });
        } else if (w === 'swap') {
          const p1 = getPlayer(intent.targetAId);
          const p2 = getPlayer(intent.targetBId);
          if (!p1 || !p2 || p1.id === p2.id || p1.status !== 'alive' || p2.status !== 'alive') return;
          const l1 = p1.location;
          const l2 = p2.location;
          movePlayerTo(p1, l2, { silent: true });
          movePlayerTo(p2, l1, { silent: true });
          addLog(`🌠 许愿池【空间置换】：${p1.name} 与 ${p2.name} 互换了位置！`, 'system');
        } else if (w === 'drain_oxy') {
          state.players.forEach((p) => {
            const n = getNode(p.location);
            if (p.status === 'alive' && n && n.layer !== 'land') {
              p.oxygenTurns += 1;
              emitFx('float', { nodeId: p.location, text: '氧额 -1!', kind: 'dmg' });
            }
          });
          addLog('🌠 许愿池【抽干氧源】：所有海/空玩家呼吸额度 -1！', 'system');
        } else if (w === 'jail') {
          const t = getPlayer(intent.targetId);
          if (!t || t.status !== 'alive') return;
          sendPlayerToJail(t, '遭许愿池天降法槌');
        } else if (w === 'disarm') {
          state.players.forEach((p) => { p.knives = 0; });
          addLog('🌠 许愿池【全图缴械】：全场所有玩家手中的刀全部清零！', 'system');
        } else {
          return;
        }
        state.pendingAction = null;
        emitFx('banner', { kicker: 'WISH GRANTED // 许愿达成', title: `${actor.name} 改写了现实`, sub: WISH_OPTIONS.find((o) => o.id === w)?.name || '', mood: 'p5r', durationMs: 2150 });
        Engine.finishCurrentActorIfDone(getPlayer(state.activePlayerId));
        return;
      }

      if (pa.type === 'ninja_chain') {
        if (intent.skip) {
          state.pendingAction = null;
          Engine.finishCurrentActorIfDone(getPlayer(state.activePlayerId));
          return;
        }
        const chosen = Engine.getNinjaChainTargets(actor).find((t) => t.id === intent.targetId);
        if (!chosen) return;
        if (!pa.freeMirror) {
          if (actor.activeCharges <= 0) { state.pendingAction = null; Engine.finishCurrentActorIfDone(actor); return; }
          actor.activeCharges -= 1;
        }
        state.lastActiveSkill = { roleId: 'ninja', skillName: '瞬身连撞', casterId: actor.id };
        state.pendingAction = null;
        movePlayerTo(actor, chosen.nodeId, { silent: true });
        addLog(`⚡ ${actor.name} 发动【瞬身连撞】突袭 ${chosen.name}！`, 'kill');

        if (chosen.isWarden) {
          if (state.warden.pants > 0) {
            state.warden.pants = Math.max(0, roundHalf(state.warden.pants - 1));
            emitFx('float', { nodeId: chosen.nodeId, text: '典狱长 -1👖', kind: 'pants' });
          } else {
            Engine.damageWarden(actor, 1);
          }
        } else {
          const target = getPlayer(chosen.id);
          if (target && target.status === 'alive') {
            if (target.pants > 0) applyPantsLoss(target, 1, '瞬身连撞');
            else {
              const res = applyHpDamage(target, 1, actor, { canDodge: true, reason: `被 ${actor.name} 瞬身连撞撞死` });
              if (res.killed) Engine.maybeTriggerNinjaChain(actor);
            }
          }
        }
        Engine.finishCurrentActorIfDone(getPlayer(state.activePlayerId));
        return;
      }


    },

    applyBlackMarketContract(actor, cid, target) {
      const role = ROLE_MAP[actor.roleId];
      switch (cid) {
        case 'bm_overcharge':
          if (role.activeMax > 0) { actor.activeCharges += 1; addLog(`😈 黑市【过载充能】：${actor.name} 主动技 +1！`, 'skill'); }
          else { actor.shield += 1; addLog(`😈 黑市【过载充能】：${actor.name} 获得 1 层黑市护盾！`, 'skill'); }
          if (actor.pants >= 1) applyPantsLoss(actor, 1, '过载代价');
          else applyHpDamage(actor, 0.5, null, { canDodge: false, ignoreShield: true, reason: '过载充能反噬' });
          break;

        case 'bm_bomb':
          if (role.activeMax > 0) actor.activeCharges = Math.max(actor.activeCharges, role.activeMax);
          else actor.knives += 2;
          actor.bomb = { turnsLeft: 2 };
          addLog(`💣 黑市【人体炸弹】：${actor.name} 战力拉满，但身绑 2 回合定时炸弹！`, 'kill');
          emitFx('float', { nodeId: actor.location, text: '💣 2回合自爆', kind: 'dmg' });
          break;

        case 'bm_sacrifice': {
          actor.knives += 2;
          const unfinished = ['SQ1', 'SQ2', 'SQ3', 'SQ4'].filter((id) => !state.artifacts[id].ownerId && !state.artifacts[id].droppedAt);
          if (unfinished.length > 0) {
            const pick = unfinished[Math.floor(Math.random() * unfinished.length)];
            const art = state.artifacts[pick];
            art.progress += 1;
            if (art.progress >= ARTIFACTS[pick].stepsNeed) {
              art.ownerId = actor.id;
              if (pick === 'SQ3') art.instanceId += 1;
              addLog(`🩸 黑市【血肉献祭】：${actor.name} 献血 0.5 命换 +2 刀，并直接完成了【${ARTIFACTS[pick].name}】！`, 'system');
              updateBountyStatus(actor);
            } else {
              addLog(`🩸 黑市【血肉献祭】：${actor.name} 献血 0.5 命换 +2 刀，并推进 ${ARTIFACTS[pick].short} +1 格（${art.progress}/${ARTIFACTS[pick].stepsNeed}）！`, 'skill');
            }
          } else {
            addLog(`🩸 黑市【血肉献祭】：${actor.name} 献血 0.5 命换 +2 刀！`, 'skill');
          }
          applyHpDamage(actor, 0.5, null, { canDodge: false, ignoreShield: true, reason: '血肉献祭身亡' });
          break;
        }

        case 'bm_elixir':
          actor.hp = roundHalf(actor.hp + 1);
          actor.pants = 0;
          addLog(`💉 黑市【禁药续命】：${actor.name} +1 命，代价：裤子清零！`, 'skill');
          emitFx('float', { nodeId: actor.location, text: '+1❤️ 裤清零', kind: 'heal' });
          break;

        case 'bm_overdraft':
          actor.steps += 1;
          actor.paralyzedNextTurn = true;
          addLog(`⏳ 黑市【透支未来】：${actor.name} 本回合立刻 +1 步，下回合强制麻痹！`, 'skill');
          emitFx('float', { nodeId: actor.location, text: '+1步 下回合麻痹', kind: 'skill' });
          break;

        case 'bm_swap_pants':
          if (target) {
            const tmp = actor.pants;
            actor.pants = Math.min(actor.maxPants, target.pants);
            target.pants = Math.min(target.maxPants, tmp);
            actor.knives = 0;
            addLog(`👖 黑市【强制换裤】：${actor.name} 清空所有刀，与 ${target.name} 远程互换裤子！`, 'skill');
          }
          break;

        case 'bm_bounty_strip':
          if (target) {
            applyPantsLoss(target, 1, '黑市通缉');
            actor.pants = Math.max(0, roundHalf(actor.pants - 0.5));
            if (!state.nodes.land_police.collapsed && !isBarrierActive('land_police')) movePlayerTo(actor, 'land_police', { silent: true });
            addLog(`🎯 黑市【黑市通缉】：${actor.name} 远程扒掉 ${target.name} 1 裤，被迫现身警察局且自身 -0.5 裤！`, 'skill');
          }
          break;

        case 'bm_smuggle_dive': {
          if (!actor.oxygenTank) actor.oxygenTank = true;
          else actor.antiSuffocate += 1;
          actor.pants = Math.min(actor.maxPants, roundHalf(actor.pants + 1));
          const oceans = Object.values(state.nodes).filter((n) => n.layer === 'ocean' && !n.collapsed && !isBarrierActive(n.id));
          if (oceans.length > 0) {
            const dest = oceans[Math.floor(Math.random() * oceans.length)];
            movePlayerTo(actor, dest.id, { silent: true });
            addLog(`🌊 黑市【走私潜航】：${actor.name} 强化供氧并 +1 裤，被走私艇冲入【${dest.name}】！`, 'skill');
          }
          break;
        }
      }
    },

    endTurnCleanup() {
      if (Engine.checkVictory()) return;

      // 1. 天一坠落（被结界封锁时无法穿出结界）
      state.players.forEach((p) => {
        if (p.status !== 'alive' || p.location !== 'sky_one' || isBarrierActive('sky_one')) return;
        const dropPool = Object.values(state.nodes).filter(
          (n) => !n.collapsed && n.layer !== 'sky' && n.kind !== 'dock' && n.kind !== 'prison_in' && !isBarrierActive(n.id)
        );
        if (dropPool.length === 0) return;
        const dest = dropPool[Math.floor(Math.random() * dropPool.length)];
        movePlayerTo(p, dest.id, { silent: true });
        if (dest.layer === 'land') {
          addLog(`☄ ${p.name} 滞留天一失足坠落至【${dest.name}】，重摔 -2 命！`, 'kill');
          applyHpDamage(p, 2, null, { canDodge: false, reason: '从天一高空坠落陆地摔死' });
        } else {
          p.oxygenTank = false;
          addLog(`💦 ${p.name} 从天一坠入海洋【${dest.name}】无伤落水，但氧气瓶摔坏了！`, 'skill');
          emitFx('float', { nodeId: dest.id, text: '落海 氧气瓶损坏!', kind: 'pants' });
        }
      });

      if (Engine.checkVictory()) return;

      // 2. 海空 5 回合阶梯缺氧
      state.players.forEach((p) => {
        if (p.status !== 'alive') return;
        const node = getNode(p.location);
        if (!node || node.layer === 'land') { p.oxygenTurns = 0; return; }
        if (node.layer === 'ocean' && hasEffectiveFrogMask(p)) { p.oxygenTurns = 0; return; }
        if (p.enteredNonLandTurn === state.turn || p.breathedThisTurn) return;

        p.oxygenTurns += 1;
        if (p.oxygenTurns >= state.config.oxygenMax) {
          if (p.antiSuffocate > 0) {
            p.antiSuffocate -= 1;
            p.oxygenTurns = 0;
            addLog(`🫧 ${p.name} 触发防窒息保险，逃过缺氧死劫！`, 'skill');
            emitFx('float', { nodeId: p.location, text: '保险防窒息!', kind: 'heal' });
          } else {
            addLog(`🫧 ${p.name} 在【${node.name}】缺氧耗尽，窒息身亡！`, 'kill');
            handlePlayerDeath(p, null, '海空缺氧窒息身亡');
          }
        } else if (p.oxygenTurns >= state.config.oxygenMax - 2) {
          addLog(`⚠ ${p.name} 缺氧 ${p.oxygenTurns}/${state.config.oxygenMax}（攻减半/禁主动）`, 'system');
          emitFx('float', { nodeId: p.location, text: `缺氧 ${p.oxygenTurns}/${state.config.oxygenMax}`, kind: 'dmg' });
        }
      });

      if (Engine.checkVictory()) return;

      // 3. 人体炸弹倒计时自爆
      state.players.forEach((p) => {
        if (p.status !== 'alive' || !p.bomb) return;
        p.bomb.turnsLeft -= 1;
        if (p.bomb.turnsLeft <= 0) {
          p.bomb = null;
          addLog(`💥 轰隆！${p.name} 身上的黑市人体炸弹引爆（-1 命）！`, 'kill');
          applyHpDamage(p, 1, null, { canDodge: false, reason: '人体炸弹自爆身亡' });
        }
      });

      if (Engine.checkVictory()) return;

      // 4. 第 10 回合起地图坍塌（含监狱外坍塌自动防卡死越狱）
      if (state.config.collapseEnabled && state.turn >= state.config.collapseStartTurn) {
        const candidates = Object.values(state.nodes).filter((n) => n.collapsible && !n.collapsed);
        if (candidates.length > 0) {
          const victimNode = candidates[Math.floor(Math.random() * candidates.length)];
          victimNode.collapsed = true;
          victimNode.barrierUntilTurn = 0;
          addLog(`🌋 【${victimNode.name}】永久坍塌！`, 'system');
          emitFx('banner', { kicker: `COLLAPSE // TURN ${state.turn}`, title: `${victimNode.name} 永久坍塌`, sub: '战区持续收缩，绝死对决逼近！', mood: 'p5r', durationMs: 2150 });
          emitFx('sfx', { name: 'collapse' });

          const safeLands = Object.values(state.nodes).filter((n) => !n.collapsed && n.layer === 'land' && n.kind !== 'prison_in');

          // 若监狱外坍塌，同步崩毁监狱围墙并释放所有在押者，彻底杜绝软锁死
          if (victimNode.id === 'land_prison_out' && safeLands.length > 0) {
            state.nodes.land_prison_in.collapsed = true;
            state.players.forEach((p) => {
              if (p.status === 'alive' && p.location === 'land_prison_in') {
                const safe = safeLands[Math.floor(Math.random() * safeLands.length)];
                movePlayerTo(p, safe.id, { silent: true });
                addLog(`🔓 监狱随坍塌崩毁，${p.name} 趁乱逃生至【${safe.name}】！`, 'system');
              }
            });
          }

          state.players.forEach((p) => {
            if (p.status === 'alive' && p.location === victimNode.id && safeLands.length > 0) {
              const safe = safeLands[Math.floor(Math.random() * safeLands.length)];
              movePlayerTo(p, safe.id, { silent: true });
              addLog(`🏃 ${p.name} 从坍塌的【${victimNode.name}】紧急逃生至【${safe.name}】！`, 'normal');
            }
          });
        }
      }

      if (Engine.checkVictory()) return;
      scheduleHostTask(() => Engine.beginNextTurn(), 1400);
    },

    checkVictory() {
      const alive = state.players.filter((p) => p.status === 'alive');
      const pending = state.players.filter((p) => p.status === 'pending_revive');
      if (alive.length <= 1 && pending.length === 0) {
        state.phase = 'gameover';
        state.activePlayerId = null;
        state.pendingAction = null;
        state.winnerId = alive.length === 1 ? alive[0].id : null;
        state.winnerReason = alive.length === 1
          ? `${alive[0].name}（${ROLE_MAP[alive[0].roleId]?.name}）成为最终幸存者！`
          : '全员同归于尽，无人幸存！';
        addLog(`🏆 战局终结：${state.winnerReason}`, 'system');
        emitFx('banner', { kicker: 'VICTORY // 终局裁决', title: alive.length === 1 ? `${alive[0].name} 胜出` : '全员覆灭', sub: state.winnerReason, mood: 'p5r', durationMs: 2600 });
        emitFx('sfx', { name: 'win' });
        Net.broadcastState();
        UI.renderAll();
        UI.openModal('gameover');
        return true;
      }
      return false;
    }
  });

  // ========================================================================
  // 7. Tactical AI Brain (Solo & Disconnect Takeover)
  // ========================================================================
  Object.assign(AI, {
    scheduleTick() {
      if (!isHostAuthority() || !state.started || state.phase === 'gameover') return;
      const delay = clamp(Number(state.config.aiDelayMs) || 1600, 400, 3500);
      const randHand = () => ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)];

      if (state.phase === 'rps' && state.rps && !state.rps.revealed) {
        state.rps.participants.forEach((pid) => {
          const p = getPlayer(pid);
          if (p && p.isAI && !state.rps.choices[pid]) {
            scheduleHostTask(() => Engine.submitMainRps(pid, randHand()), 300 + Math.random() * 450);
          }
        });
        return;
      }

      if (state.phase === 'initiative' && state.initiative) {
        if (state.initiative.mode === 'rps' && !state.initiative.revealed) {
          state.initiative.contenders.forEach((pid) => {
            const p = getPlayer(pid);
            if (p && p.isAI && !state.initiative.choices[pid]) {
              scheduleHostTask(() => Engine.submitInitiativeRps(pid, randHand()), 350 + Math.random() * 400);
            }
          });
        } else if (state.initiative.mode === 'pick_slot') {
          const first = getPlayer(state.initiative.firstWinnerId);
          if (first && first.isAI) {
            scheduleHostTask(() => Engine.pickInitiativeSlot(first.id, Math.random() < 0.65 ? 0 : state.initiative.allWinners.length - 1), delay);
          }
        }
        return;
      }

      if (state.phase === 'sub_rps' && state.subRps && !state.subRps.revealed) {
        [state.subRps.aId, state.subRps.bId].forEach((pid) => {
          const p = getPlayer(pid);
          if (p && p.isAI && !state.subRps.choices[pid]) {
            scheduleHostTask(() => Engine.submitSubRps(pid, randHand()), 400 + Math.random() * 350);
          }
        });
        return;
      }

      if (state.phase === 'stealth_reveal') {
        const raider = getPlayer(state.activePlayerId);
        if (raider && raider.isAI) {
          scheduleHostTask(() => {
            const moves = getReachableMoveNodes(raider);
            if (moves.length > 0 && Math.random() < 0.7) {
              Engine.resolveStealthReveal(raider.id, { subAction: 'move', destId: moves[Math.floor(Math.random() * moves.length)].id });
            } else {
              Engine.resolveStealthReveal(raider.id, { subAction: 'draw_knife' });
            }
          }, delay);
        }
        return;
      }

      if (state.pendingAction) {
        const actor = getPlayer(state.pendingAction.actorId);
        if (actor && actor.isAI) scheduleHostTask(() => AI.resolvePending(actor, state.pendingAction), delay);
        return;
      }

      if (state.phase === 'action') {
        const actor = getPlayer(state.activePlayerId);
        if (actor && actor.isAI && actor.steps > 0) scheduleHostTask(() => AI.takeAction(actor), delay);
      }
    },

    resolvePending(actor, pa) {
      if (pa.type === 'blackmarket') {
        const enemies = state.players.filter((p) => p.status === 'alive' && p.id !== actor.id && !needsPinchPigFace(actor, p));
        const target = enemies[0] || null;
        for (const cid of pa.contracts) {
          if (cid === 'bm_swap_pants' || cid === 'bm_bounty_strip') {
            if (target) { Engine.resolvePendingAction(actor.id, { contractId: cid, targetId: target.id }); return; }
          } else if (cid === 'bm_sacrifice' && actor.hp <= 0.5) {
            continue;
          } else {
            Engine.resolvePendingAction(actor.id, { contractId: cid });
            return;
          }
        }
        Engine.resolvePendingAction(actor.id, { cancel: true });
      } else if (pa.type === 'wish_pick') {
        const enemies = state.players.filter((p) => p.status === 'alive' && p.id !== actor.id);
        const wanted = enemies.find((e) => e.wanted) || enemies[0];
        if (wanted && wanted.location !== 'land_prison_in' && !state.nodes.land_prison_out?.collapsed) {
          Engine.resolvePendingAction(actor.id, { wishId: 'jail', targetId: wanted.id });
        } else {
          Engine.resolvePendingAction(actor.id, { wishId: 'disarm' });
        }
      } else if (pa.type === 'ninja_chain') {
        const targets = Engine.getNinjaChainTargets(actor);
        Engine.resolvePendingAction(actor.id, targets.length > 0 ? { targetId: targets[0].id } : { skip: true });
      }
    },

    takeAction(actor) {
      const curNode = getNode(actor.location);
      const enemiesHere = getAlivePlayersAt(actor.location, actor.id);
      const validHere = enemiesHere.filter((e) => !needsPinchPigFace(actor, e));
      const allAliveEnemies = state.players.filter((p) => p.status === 'alive' && p.id !== actor.id);
      const moves = getReachableMoveNodes(actor);

      if (actor.bomb && validHere.length > 0) { Engine.executePlayerAction(actor.id, { action: 'pass_bomb', targetId: validHere[0].id }); return; }

      if (curNode && curNode.layer !== 'land' && !(curNode.layer === 'ocean' && hasEffectiveFrogMask(actor))) {
        if (actor.oxygenTurns >= state.config.oxygenMax - 2) {
          if (hasEffectiveOxygenTank(actor)) { Engine.executePlayerAction(actor.id, { action: 'breathe' }); return; }
          const landDest = moves.find((n) => n.layer === 'land');
          if (landDest) { Engine.executePlayerAction(actor.id, { action: 'move', destId: landDest.id, carryIds: [] }); return; }
        }
      }

      if (curNode?.id === 'sky_one') {
        const sky2 = moves.find((n) => n.layer === 'sky' && n.id !== 'sky_one');
        if (sky2) { Engine.executePlayerAction(actor.id, { action: 'move', destId: sky2.id, carryIds: [] }); return; }
      }

      if (actor.parasiteHostId) {
        const host = getPlayer(actor.parasiteHostId);
        if (host && ((host.pants <= 0 && actor.knives > 0) || Math.random() < 0.45)) {
          Engine.executePlayerAction(actor.id, { action: 'use_skill', burstMode: host.pants <= 0 && actor.knives > 0 ? 'stab' : 'strip' });
          return;
        }
        Engine.executePlayerAction(actor.id, { action: 'pass' });
        return;
      }

      if (curNode && curNode.droppedArtifacts.length > 0) {
        Engine.executePlayerAction(actor.id, { action: 'pickup_artifact', sqId: curNode.droppedArtifacts[0] });
        return;
      }

      const zeroPantsEnemy = validHere.find((e) => e.pants <= 0);
      if (zeroPantsEnemy && actor.knives >= 1) {
        if (actor.roleId === 'piggy' && actor.activeCharges > 0 && !actor.piggyStealArmed && zeroPantsEnemy.knives > 0 && !isHypoxic(actor)) {
          Engine.executePlayerAction(actor.id, { action: 'use_skill' });
          return;
        }
        Engine.executePlayerAction(actor.id, { action: 'stab', targetId: zeroPantsEnemy.id });
        return;
      }

      if (hasSQ(actor, 'SQ2') && moves.length > 0) {
        for (const dest of moves) {
          const t = getAlivePlayersAt(dest.id, actor.id).find((e) => !needsPinchPigFace(actor, e));
          if (t && (t.pants <= 0 || Math.random() < 0.55)) {
            Engine.executePlayerAction(actor.id, { action: 'sq2_dash', destId: dest.id, targetId: t.id });
            return;
          }
        }
      }

      const unpinched = enemiesHere.find((e) => needsPinchPigFace(actor, e));
      if (unpinched && Math.random() < 0.65) {
        Engine.executePlayerAction(actor.id, { action: 'pinch_pigface', targetId: unpinched.id });
        return;
      }

      if (validHere.length > 0) {
        const target = validHere[0];
        if (actor.roleId === 'parasite' && actor.activeCharges > 0 && !isHypoxic(actor) && target.parasiteHostId !== actor.id && Math.random() < 0.45) {
          Engine.executePlayerAction(actor.id, { action: 'use_skill', targetId: target.id });
          return;
        }
        if (target.pants > 0) {
          Engine.executePlayerAction(actor.id, { action: 'strip_pants', targetId: target.id });
          return;
        }
      }

      if (actor.activeCharges > 0 && !isHypoxic(actor) && Math.random() < 0.45) {
        const validRemote = allAliveEnemies.filter((e) => !needsPinchPigFace(actor, e));
        if (actor.roleId === 'chili' && validRemote.length > 0) { Engine.executePlayerAction(actor.id, { action: 'use_skill', targetId: validRemote[0].id }); return; }
        if (actor.roleId === 'watcher' && !state.nodes.land_prison_out?.collapsed) {
          const arrestable = validRemote.find((e) => e.location !== 'land_prison_in');
          if (arrestable) { Engine.executePlayerAction(actor.id, { action: 'use_skill', targetId: arrestable.id }); return; }
        }
        if (actor.roleId === 'curser' && validRemote.length >= 2) { Engine.executePlayerAction(actor.id, { action: 'use_skill', targetAId: validRemote[0].id, targetBId: validRemote[1].id }); return; }
        if (actor.roleId === 'undertaker') {
          const revivable = state.players.find((p) => p.status === 'pending_revive');
          if (revivable) { Engine.executePlayerAction(actor.id, { action: 'use_skill', targetId: revivable.id }); return; }
        }
        if (actor.roleId === 'raider' && !actor.stealth) { Engine.executePlayerAction(actor.id, { action: 'use_skill' }); return; }
        if (actor.roleId === 'barrier' && validRemote.length > 0) {
          const bn = getNode(validRemote[0].location);
          if (bn && bn.kind !== 'prison_in' && !bn.collapsed) { Engine.executePlayerAction(actor.id, { action: 'use_skill', nodeId: bn.id }); return; }
        }
        if (actor.roleId === 'mirror' && !state.lastActiveSkill) { Engine.executePlayerAction(actor.id, { action: 'use_skill' }); return; }
      }

      if (curNode?.kind === 'palace') {
        const forgeable = ['SQ1', 'SQ2', 'SQ3', 'SQ4'].find((id) => !state.artifacts[id].ownerId && !state.artifacts[id].droppedAt);
        if (forgeable) { Engine.executePlayerAction(actor.id, { action: 'forge_artifact', sqId: forgeable }); return; }
      }
      if (curNode?.kind === 'blackmarket' && Math.random() < 0.65) { Engine.executePlayerAction(actor.id, { action: 'blackmarket_draw' }); return; }
      if (curNode?.kind === 'wish') { Engine.executePlayerAction(actor.id, { action: 'wish_step' }); return; }
      if (curNode?.kind === 'observatory' && !state.nextWeather) {
        const ws = ['bloodmoon', 'fog', 'storm'];
        Engine.executePlayerAction(actor.id, { action: 'set_weather', weather: ws[Math.floor(Math.random() * ws.length)] });
        return;
      }

      if (curNode?.kind === 'prison_in' && canAttackWardenFrom(curNode) && moves.length === 0) {
        if (state.warden.pants > 0) { Engine.executePlayerAction(actor.id, { action: 'strip_pants', targetId: 'NPC_WARDEN' }); return; }
        if (actor.knives >= 1) { Engine.executePlayerAction(actor.id, { action: 'stab', targetId: 'NPC_WARDEN' }); return; }
        Engine.executePlayerAction(actor.id, { action: 'draw_knife' });
        return;
      }

      if (actor.knives === 0 && Math.random() < 0.6) { Engine.executePlayerAction(actor.id, { action: 'draw_knife' }); return; }
      if (actor.pants < actor.maxPants && !(state.weather === 'storm' && curNode?.layer === 'land') && Math.random() < 0.55) {
        Engine.executePlayerAction(actor.id, { action: 'wear_pants' });
        return;
      }

      if (moves.length > 0) {
        const enemyNodes = moves.filter((n) => getAlivePlayersAt(n.id, actor.id).length > 0);
        const strategic = moves.filter((n) => ['ocean_palace', 'land_blackmarket', 'land_police', 'land_dock'].includes(n.id));
        const pool = enemyNodes.length > 0 && actor.knives > 0 ? enemyNodes : strategic.length > 0 && Math.random() < 0.55 ? strategic : moves;
        Engine.executePlayerAction(actor.id, { action: 'move', destId: pool[Math.floor(Math.random() * pool.length)].id, carryIds: [] });
        return;
      }

      if (actor.knives < 2) Engine.executePlayerAction(actor.id, { action: 'draw_knife' });
      else Engine.executePlayerAction(actor.id, { action: 'pass' });
    }
  });

  // ========================================================================
  // 8. 3D Layered Perspective Map Controller (Map3D)
  // ========================================================================
  Object.assign(Map3D, (() => {
    const cam = { rx: 56, rz: -28, scale: 1, tx: 0, ty: 0 };
    let dragging = false;
    let startX = 0, startY = 0, startRx = 56, startRz = -28;

    function applyTransform() {
      const root = document.documentElement.style;
      root.setProperty('--cam-rx', `${cam.rx.toFixed(1)}deg`);
      root.setProperty('--cam-rz', `${cam.rz.toFixed(1)}deg`);
      root.setProperty('--cam-scale', cam.scale.toFixed(2));
      root.setProperty('--cam-tx', `${cam.tx.toFixed(0)}px`);
      root.setProperty('--cam-ty', `${cam.ty.toFixed(0)}px`);
    }

    let currentPreset = 'default';

    function getResponsiveBaseScale() {
      const vp = document.getElementById('map-viewport');
      const w = vp && vp.clientWidth > 0 ? vp.clientWidth : window.innerWidth;
      return w < 680 ? clamp((w - 16) / 680, 0.48, 0.92) : 1;
    }

    function setPreset(preset) {
      currentPreset = preset || 'default';
      const base = getResponsiveBaseScale();
      if (currentPreset === 'top') { cam.rx = 14; cam.rz = 0; cam.scale = 1.02 * base; cam.tx = 0; cam.ty = 0; }
      else if (currentPreset === 'side') { cam.rx = 72; cam.rz = -36; cam.scale = 0.94 * base; cam.tx = 0; cam.ty = 8; }
      else { cam.rx = 54; cam.rz = -26; cam.scale = 1 * base; cam.tx = 0; cam.ty = 0; }
      applyTransform();
      ['default', 'top', 'side'].forEach((k) => document.getElementById(`btn-cam-${k}`)?.classList.toggle('is-active', k === currentPreset));
    }

    function zoom(delta) {
      cam.scale = clamp(cam.scale + delta, 0.42, 1.65);
      applyTransform();
    }

    function toggleEmptyNodes(forceVal) {
      localUI.showEmptyNodes = typeof forceVal === 'boolean' ? forceVal : !localUI.showEmptyNodes;
      const vp = document.getElementById('map-viewport');
      const btn = document.getElementById('btn-toggle-empty-nodes');
      if (vp) vp.classList.toggle('show-all-nodes', localUI.showEmptyNodes);
      if (btn) {
        btn.setAttribute('aria-pressed', String(localUI.showEmptyNodes));
        const lbl = btn.querySelector('.btn-label');
        if (lbl) lbl.textContent = localUI.showEmptyNodes ? '空地点: 显示' : '空地点: 隐藏';
      }
    }

    function getNodeClientRect(nodeId) {
      const el = document.querySelector(`.map-node[data-node-id="${CSS.escape(String(nodeId))}"]`);
      return el ? el.getBoundingClientRect() : null;
    }

    function bind() {
      const vp = document.getElementById('map-viewport');
      if (!vp) return;
      vp.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.map-camera-controls') || e.target.closest('.map-node')) return;
        dragging = true;
        startX = e.clientX; startY = e.clientY;
        startRx = cam.rx; startRz = cam.rz;
        vp.classList.add('is-dragging');
        vp.setPointerCapture?.(e.pointerId);
      });
      vp.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        cam.rz = startRz - (e.clientX - startX) * 0.35;
        cam.rx = clamp(startRx - (e.clientY - startY) * 0.28, 6, 82);
        applyTransform();
      });
      const endDrag = () => { dragging = false; vp.classList.remove('is-dragging'); };
      vp.addEventListener('pointerup', endDrag);
      vp.addEventListener('pointercancel', endDrag);
      vp.addEventListener('wheel', (e) => { e.preventDefault(); zoom(e.deltaY < 0 ? 0.08 : -0.08); }, { passive: false });
      window.addEventListener('resize', () => setPreset(currentPreset));
      setPreset('default');
    }

    return { bind, setPreset, zoom, toggleEmptyNodes, getNodeClientRect };
  })());

  // ========================================================================
  // 9. Complete DOM Renderer (UI)
  // ========================================================================
  Object.assign(UI, {
    renderAll() {
      const lobbyEl = document.getElementById('screen-lobby');
      const gameEl = document.getElementById('screen-game');
      const commsFab = document.getElementById('comms-fab');

      if (!state.started) {
        lobbyEl?.classList.add('is-active');
        gameEl?.classList.remove('is-active');
        commsFab?.classList.add('is-hidden');
        document.getElementById('comms-drawer')?.classList.add('is-hidden');
        UI.renderLobby();
        return;
      }

      lobbyEl?.classList.remove('is-active');
      gameEl?.classList.add('is-active');
      commsFab?.classList.remove('is-hidden');

      UI.renderHud();
      UI.renderArtifactsBar();
      UI.renderMap();
      if (window.innerWidth <= 820 && !gameEl?.dataset.camFitted) {
        if (gameEl) gameEl.dataset.camFitted = '1';
        window.requestAnimationFrame(() => Map3D.setPreset('default'));
      }
      UI.renderPlayers();
      UI.renderActionDock();
      UI.renderLog();
      UI.renderComms();
    },

    renderLobby() {
      syncLobbyRuleCheckboxes();
      UI.renderRoleDossier();

      const listEl = document.getElementById('lobby-player-list');
      if (listEl) {
        listEl.innerHTML = state.lobbyPlayers.map((p) => {
          const r = ROLE_MAP[p.roleId] || ROLE_MAP.normal;
          const selfClass = p.id === state.selfId ? 'is-self' : '';
          const canKick = isHostAuthority() && p.id !== state.selfId;
          return `
            <div class="lobby-seat ${selfClass}">
              <div class="lobby-seat-info">
                ${p.isHost ? '<span class="seat-badge seat-badge--host">HOST</span>' : ''}
                ${p.isAI ? '<span class="seat-badge seat-badge--ai">AI</span>' : ''}
                <span class="lobby-seat-name">${escapeHtml(p.name)}</span>
              </div>
              <div class="lobby-seat-info">
                <span class="seat-badge seat-badge--role">${escapeHtml(r.name)}</span>
                ${canKick ? `<button class="icon-close-btn" data-remove-seat="${p.id}" type="button" title="移除">✕</button>` : ''}
              </div>
            </div>
          `;
        }).join('');
      }

      const startBtn = document.getElementById('btn-start-match');
      const addAiBtn = document.getElementById('btn-add-ai');
      const hint = document.getElementById('lobby-host-hint');
      if (startBtn) startBtn.disabled = !isHostAuthority() || state.lobbyPlayers.length < 2;
      if (addAiBtn) addAiBtn.disabled = !isHostAuthority() || state.lobbyPlayers.length >= 8;
      if (hint) hint.textContent = isHostAuthority() ? `当前 ${state.lobbyPlayers.length}/8 人 · 可随时补位 AI 开局` : '等待房主开启对局...';
    },

    renderRoleDossier() {
      const grid = document.getElementById('role-grid');
      const detail = document.getElementById('role-detail-panel');
      if (!grid || !detail) return;

      const shown = localUI.selectedRoleFilter === 'all' ? ROLES : ROLES.filter((r) => r.arch === localUI.selectedRoleFilter);
      grid.innerHTML = shown.map((r) => `
        <button class="role-card ${r.id === localUI.selectedRoleId ? 'is-selected' : ''}" data-role-id="${r.id}" data-num="${r.num}" type="button">
          <div class="role-card-top">
            <span class="role-arch-tag arch-${r.arch}">${r.archName}</span>
            <span class="role-card-stats">${r.activeMax > 0 ? `技×${r.activeMax}` : '被动'}</span>
          </div>
          <div class="role-card-name">${escapeHtml(r.name)}</div>
          <div class="role-card-stats"><span>❤️${r.hp}</span><span>👖${r.pants}/${r.maxPants}</span><span>🔪${r.knives}</span></div>
          <div class="role-card-brief">${escapeHtml(r.brief)}</div>
        </button>
      `).join('');

      const cur = ROLE_MAP[localUI.selectedRoleId] || ROLES[0];
      detail.innerHTML = `
        <div class="role-detail-head">
          <span class="role-arch-tag arch-${cur.arch}">${cur.num} // ${cur.archName}</span>
          <h3>${escapeHtml(cur.name)}</h3>
          <div class="role-detail-stats">
            <span class="stat-chip">❤️ ${cur.hp} 命</span>
            <span class="stat-chip">👖 ${cur.pants}/${cur.maxPants} 裤</span>
            <span class="stat-chip">🔪 ${cur.knives} 刀</span>
            ${cur.atkMult > 1 ? `<span class="stat-chip">⚔ ${cur.atkMult}x 攻</span>` : ''}
          </div>
        </div>
        <div class="role-detail-skills">
          <div><span class="skill-badge skill-badge--passive">被动 · ${escapeHtml(cur.passiveName)}</span>${escapeHtml(cur.passiveDesc)}</div>
          <div><span class="skill-badge">主动 · ${escapeHtml(cur.activeName)}${cur.activeMax > 0 ? ` (${cur.activeMax}次)` : ''}</span>${escapeHtml(cur.activeDesc)}</div>
        </div>
      `;
    },

    renderHud() {
      const turnEl = document.getElementById('hud-turn');
      const phaseEl = document.getElementById('hud-phase');
      const weatherEl = document.getElementById('hud-weather');
      const collapseEl = document.getElementById('hud-collapse-info');
      const orderEl = document.getElementById('hud-turn-order');

      if (turnEl) turnEl.textContent = String(state.turn).padStart(2, '0');
      const phaseNames = { rps: '全员猜拳阶段', initiative: '第一解释权博弈', action: '战术行动阶段', sub_rps: state.subRps?.label || '对决猜拳', stealth_reveal: '量子隐身揭晓', gameover: '战局终结' };
      if (phaseEl) phaseEl.textContent = phaseNames[state.phase] || state.phase;

      if (weatherEl) {
        const w = WEATHERS[state.weather] || WEATHERS.clear;
        const nextHint = state.nextWeather ? ` → 下回合:${WEATHERS[state.nextWeather].name}` : '';
        weatherEl.textContent = `天象: ${w.name}${nextHint}`;
        weatherEl.className = `hud-tag ${state.weather === 'bloodmoon' ? 'hud-tag--danger' : state.weather !== 'clear' ? 'hud-tag--warn' : ''}`;
      }

      if (collapseEl) {
        if (!state.config.collapseEnabled) { collapseEl.textContent = '坍塌: 已关闭'; collapseEl.className = 'hud-tag'; }
        else if (state.turn < state.config.collapseStartTurn) { collapseEl.textContent = `坍塌倒计时: T${state.config.collapseStartTurn}`; collapseEl.className = 'hud-tag hud-tag--warn'; }
        else { collapseEl.textContent = '残局坍塌进行中!'; collapseEl.className = 'hud-tag hud-tag--danger'; }
      }

      if (orderEl) {
        orderEl.innerHTML = state.turnQueue.length === 0
          ? '<span class="order-pill">等待本回合顺位生成</span>'
          : state.turnQueue.map((e, i) => `<span class="order-pill ${state.activePlayerId === e.playerId && !e.done ? 'is-active' : ''} ${e.done ? 'is-done' : ''}">${i + 1}. ${escapeHtml(getPlayer(e.playerId)?.name || '?')}</span>`).join('');
      }
    },

    renderArtifactsBar() {
      const bar = document.getElementById('hud-artifacts-bar');
      if (!bar) return;
      bar.innerHTML = ['SQ1', 'SQ2', 'SQ3', 'SQ4'].map((id) => {
        const a = state.artifacts[id];
        const m = ARTIFACTS[id];
        const owner = a.ownerId ? getPlayer(a.ownerId) : null;
        const dropNode = a.droppedAt ? getNode(a.droppedAt) : null;
        const cls = owner ? 'is-owned' : dropNode ? 'is-dropped' : '';
        const rightHtml = owner
          ? `<span>👑 ${escapeHtml(owner.name)}</span>`
          : dropNode
            ? `<span>📍 掉落:${escapeHtml(dropNode.name)}</span>`
            : `<span class="artifact-pips">${Array.from({ length: m.stepsNeed }, (_, i) => `<span class="artifact-pip ${i < a.progress ? 'is-filled' : ''}"></span>`).join('')}</span>`;
        return `<div class="artifact-pill ${cls}" title="${escapeHtml(m.desc)}"><span>${escapeHtml(m.name)}</span>${rightHtml}</div>`;
      }).join('');
    },

    renderMap() {
      const containers = { sky: document.getElementById('nodes-sky'), land: document.getElementById('nodes-land'), ocean: document.getElementById('nodes-ocean') };
      if (!containers.land) return;

      const self = getSelfPlayer();
      const isMyAction = state.phase === 'action' && state.activePlayerId === state.selfId && !state.pendingAction;
      const reachableSet = new Set(isMyAction && self && self.status === 'alive' ? getReachableMoveNodes(self).map((n) => n.id) : []);
      const buckets = { sky: [], land: [], ocean: [] };

      Object.values(state.nodes).forEach((node) => {
        const occupants = state.players.filter((p) => p.status === 'alive' && p.location === node.id);
        const hasWarden = node.kind === 'prison_out' && !node.collapsed;
        const hasEntities = occupants.length > 0 || hasWarden || node.corpses.length > 0 || node.droppedArtifacts.length > 0 || isBarrierActive(node.id);
        const isSelfHere = self && self.status === 'alive' && self.location === node.id;
        const isTarget = localUI.subPanelState?.type === 'move' && reachableSet.has(node.id);

        const classes = ['map-node'];
        if (isSelfHere) classes.push('is-self-loc');
        if (isTarget) classes.push('is-targetable');
        if (node.collapsed) classes.push('is-collapsed');
        if (isBarrierActive(node.id)) classes.push('is-barrier');
        if (!hasEntities && !isTarget && !node.collapsed) classes.push('is-empty-hidden');

        const tokens = [];
        occupants.forEach((p) => {
          if (p.stealth?.active && p.id !== state.selfId) return;
          const tCls = p.id === state.selfId ? 'node-token--self' : p.wanted ? 'node-token--wanted' : '';
          const suffix = p.stealth?.active ? '(隐)' : p.parasiteHostId ? '(寄)' : '';
          tokens.push(`<span class="node-token ${tCls}">${escapeHtml(p.name)}${suffix}</span>`);
        });
        if (hasWarden) tokens.push(`<span class="node-token node-token--npc">典狱长 ${state.warden.pants}👖/${state.warden.hp}❤️</span>`);
        node.droppedArtifacts.forEach((sqId) => tokens.push(`<span class="node-token node-token--loot">掉落:${ARTIFACTS[sqId].short}</span>`));
        if (node.corpses.length > 0) tokens.push(`<span class="node-token node-token--corpse">尸×${node.corpses.length}</span>`);

        const badge = node.collapsed ? '💥' : isBarrierActive(node.id) ? '🔮' : '';
        if (buckets[node.layer]) {
          buckets[node.layer].push(`
            <div class="${classes.join(' ')}" data-node-id="${node.id}" style="--x:${node.x}%; --y:${node.y}%;" title="${escapeHtml(node.desc)}">
              <div class="node-title"><span>${escapeHtml(node.name)}</span><span>${badge}</span></div>
              <div class="node-tokens">${tokens.join('')}</div>
            </div>
          `);
        }
      });

      containers.sky.innerHTML = buckets.sky.join('');
      containers.land.innerHTML = buckets.land.join('');
      containers.ocean.innerHTML = buckets.ocean.join('');
    },

    renderPlayers() {
      const el = document.getElementById('ingame-player-list');
      if (!el) return;
      el.innerHTML = state.players.map((p) => {
        const r = ROLE_MAP[p.roleId] || ROLE_MAP.normal;
        const node = getNode(p.location);
        const cls = ['p-card'];
        if (p.id === state.selfId) cls.push('is-self');
        if (p.id === state.activePlayerId) cls.push('is-acting');
        if (p.wanted) cls.push('is-wanted');
        if (p.status !== 'alive') cls.push('is-dead');

        const flags = [];
        if (p.wanted) flags.push('<span class="flag-chip flag-chip--wanted">通缉</span>');
        if (p.status === 'pending_revive') flags.push('<span class="flag-chip flag-chip--debuff">地府待复活</span>');
        if (p.status === 'dead_final') flags.push('<span class="flag-chip">死透</span>');
        if (p.paralyzed || p.paralyzedNextTurn) flags.push(`<span class="flag-chip flag-chip--debuff">${p.paralyzed ? '麻痹中' : '下回麻痹'}</span>`);
        if (p.stealth?.active) flags.push('<span class="flag-chip flag-chip--buff">量子隐身</span>');
        if (p.bomb) flags.push(`<span class="flag-chip flag-chip--wanted">💣${p.bomb.turnsLeft}T</span>`);
        if (p.frogMask) flags.push('<span class="flag-chip flag-chip--buff">🐸面罩</span>');
        if (!p.oxygenTank) flags.push('<span class="flag-chip flag-chip--oxy">无氧瓶</span>');
        if (p.shield > 0) flags.push(`<span class="flag-chip flag-chip--buff">🛡×${p.shield}</span>`);
        if (p.roleId === 'reverser' && p.momentum > 0) flags.push(`<span class="flag-chip flag-chip--buff">势${p.momentum}/2</span>`);
        if (p.parasiteHostId) flags.push(`<span class="flag-chip flag-chip--debuff">寄生:${escapeHtml(getPlayer(p.parasiteHostId)?.name || '')}</span>`);
        if (node && node.layer !== 'land' && p.status === 'alive') flags.push(`<span class="flag-chip flag-chip--oxy">缺氧 ${p.oxygenTurns}/${state.config.oxygenMax}</span>`);
        ['SQ1', 'SQ2', 'SQ3', 'SQ4'].forEach((sq) => { if (hasSQ(p, sq)) flags.push(`<span class="flag-chip flag-chip--buff">${ARTIFACTS[sq].short}</span>`); });
        if (getLinkedPartners(p.id).length > 0) flags.push('<span class="flag-chip flag-chip--wanted">命运链接</span>');

        const locText = state.weather === 'fog' && p.id !== state.selfId ? '??? (迷雾)' : p.stealth?.active && p.id !== state.selfId ? '??? (隐身)' : node?.name || '-';
        return `
          <div class="${cls.join(' ')}">
            <div class="p-card-head"><span class="p-card-name">${escapeHtml(p.name)}${p.isAI ? ' 🤖' : ''}</span><span class="p-card-role">${escapeHtml(r.name)}</span></div>
            <div class="p-card-metrics"><span class="p-metric">❤️ ${p.hp}</span><span class="p-metric">👖 ${p.pants}/${p.maxPants}</span><span class="p-metric">🔪 ${p.knives}</span></div>
            <div class="p-card-loc"><span>📍 ${escapeHtml(locText)}</span><span>技:${p.activeCharges} · 杀:${p.kills}</span></div>
            ${flags.length ? `<div class="p-card-flags">${flags.join('')}</div>` : ''}
          </div>
        `;
      }).join('');
    },

    renderActionDock() {
      const self = getSelfPlayer();
      const strip = document.getElementById('self-status-strip');
      const boxRps = document.getElementById('stage-rps');
      const boxInit = document.getElementById('stage-initiative');
      const boxAct = document.getElementById('stage-actions');
      const boxSub = document.getElementById('stage-subpanel');
      if (!self || !strip) return;

      const role = ROLE_MAP[self.roleId] || ROLE_MAP.normal;
      const curNode = getNode(self.location);
      strip.innerHTML = `
        <div class="self-stat-group">
          <span class="self-pill">${escapeHtml(self.name)} · ${escapeHtml(role.name)}</span>
          <span class="self-pill">📍 ${escapeHtml(curNode?.name || '-')}</span>
          <span class="self-pill">❤️ ${self.hp}</span>
          <span class="self-pill">👖 ${self.pants}/${self.maxPants}</span>
          <span class="self-pill">🔪 ${self.knives}</span>
          <span class="self-pill">技 ${self.activeCharges}</span>
        </div>
        <div class="self-stat-group">
          ${self.steps > 0 ? `<span class="self-pill self-pill--steps">剩余 ${self.steps} 步</span>` : ''}
          ${isHypoxic(self) ? '<span class="self-pill self-pill--warn">缺氧（攻减半/禁主动技）</span>' : ''}
          ${self.bomb ? `<span class="self-pill self-pill--warn">💣 炸弹剩余 ${self.bomb.turnsLeft}T</span>` : ''}
        </div>
      `;

      [boxRps, boxInit, boxAct, boxSub].forEach((b) => b?.classList.add('is-hidden'));

      if (state.phase === 'rps' && state.rps) {
        boxRps.classList.remove('is-hidden');
        const canPlay = state.rps.participants.includes(self.id);
        const myChoice = state.rps.choices[self.id];
        const waiting = state.rps.participants.filter((id) => !state.rps.choices[id]).map((id) => getPlayer(id)?.name);
        boxRps.innerHTML = `
          <div class="subpanel-head"><span>${escapeHtml(state.rps.title)}</span><span>${waiting.length ? `等待出拳：${escapeHtml(waiting.join('、'))}` : '全员锁定，正在亮牌...'}</span></div>
          ${canPlay && !myChoice && !state.rps.revealed ? `
            <div class="rps-grid">
              <button class="pk-btn pk-btn--primary rps-btn" data-rps="rock" type="button"><span class="btn-label">✊ 石头</span></button>
              <button class="pk-btn pk-btn--accent rps-btn" data-rps="scissors" type="button"><span class="btn-label">✌️ 剪刀</span></button>
              <button class="pk-btn pk-btn--crimson rps-btn" data-rps="paper" type="button"><span class="btn-label">✋ 布</span></button>
            </div>
          ` : `<div class="action-btn-grid"><span>${canPlay ? `你已锁定 ${HAND_META[myChoice]?.icon || ''}，等待其他人...` : '本轮观战中...'}</span></div>`}
        `;
        return;
      }

      if (state.phase === 'sub_rps' && state.subRps) {
        boxRps.classList.remove('is-hidden');
        const sr = state.subRps;
        const pa = getPlayer(sr.aId);
        const pb = getPlayer(sr.bId);
        const isInDuel = self.id === sr.aId || self.id === sr.bId;
        const myChoice = sr.choices[self.id];
        boxRps.innerHTML = `
          <div class="subpanel-head"><span>⚔ ${escapeHtml(sr.label)}（${escapeHtml(pa?.name)} ${sr.aScore} : ${sr.bScore} ${escapeHtml(pb?.name)}）</span><span>第 ${sr.round} 小局</span></div>
          ${isInDuel && !myChoice && !sr.revealed ? `
            <div class="rps-grid">
              <button class="pk-btn pk-btn--primary rps-btn" data-sub-rps="rock" type="button"><span class="btn-label">✊ 石头</span></button>
              <button class="pk-btn pk-btn--accent rps-btn" data-sub-rps="scissors" type="button"><span class="btn-label">✌️ 剪刀</span></button>
              <button class="pk-btn pk-btn--crimson rps-btn" data-sub-rps="paper" type="button"><span class="btn-label">✋ 布</span></button>
            </div>
          ` : `<div class="action-btn-grid"><span>${isInDuel ? '已锁定手势，等待对手...' : '正在观战对决...'}</span></div>`}
        `;
        return;
      }

      if (state.phase === 'initiative' && state.initiative) {
        boxInit.classList.remove('is-hidden');
        const ini = state.initiative;
        if (ini.mode === 'rps') {
          const isContender = ini.contenders.includes(self.id);
          const myChoice = ini.choices[self.id];
          boxInit.innerHTML = `
            <div class="subpanel-head"><span>🎲 多人获步 · 内部猜拳抢「第一解释权」</span><span>参赛：${escapeHtml(ini.contenders.map((id) => getPlayer(id)?.name).join('、'))}</span></div>
            ${isContender && !myChoice && !ini.revealed ? `
              <div class="rps-grid">
                <button class="pk-btn pk-btn--primary rps-btn" data-init-rps="rock" type="button"><span class="btn-label">✊ 石头</span></button>
                <button class="pk-btn pk-btn--accent rps-btn" data-init-rps="scissors" type="button"><span class="btn-label">✌️ 剪刀</span></button>
                <button class="pk-btn pk-btn--crimson rps-btn" data-init-rps="paper" type="button"><span class="btn-label">✋ 布</span></button>
              </div>
            ` : '<div>等待解释权猜拳结果...</div>'}
          `;
        } else {
          const isPicker = ini.firstWinnerId === self.id;
          const total = ini.allWinners.length;
          boxInit.innerHTML = `
            <div class="subpanel-head"><span>📌 第一解释权：${escapeHtml(getPlayer(ini.firstWinnerId)?.name)} 自选出手顺位</span></div>
            ${isPicker ? `<div class="action-btn-grid">${Array.from({ length: total }, (_, idx) => `<button class="pk-btn pk-btn--primary" data-pick-slot="${idx}" type="button"><span class="btn-label">选择第 ${idx + 1} 个走${idx === 0 ? '（先手）' : idx === total - 1 ? '（压轴）' : ''}</span></button>`).join('')}</div>` : '<div>等待第一名决定出手顺位...</div>'}
          `;
        }
        return;
      }

      if (state.phase === 'stealth_reveal') {
        boxSub.classList.remove('is-hidden');
        if (state.activePlayerId !== self.id) {
          boxSub.innerHTML = `<div class="subpanel-head"><span>👁 等待突袭者 ${escapeHtml(getPlayer(state.activePlayerId)?.name)} 揭晓量子暗步...</span></div>`;
          return;
        }
        const moves = getReachableMoveNodes(self);
        boxSub.innerHTML = `
          <div class="subpanel-head"><span>👁 量子隐身揭晓：请从白名单选择你上回合的暗步</span></div>
          <div class="action-btn-grid">
            <button class="pk-btn pk-btn--primary" data-stealth-act="draw_knife" type="button"><span class="btn-label">🔪 暗中拔刀</span></button>
            <button class="pk-btn pk-btn--primary" data-stealth-act="wear_pants" type="button" ${self.pants >= self.maxPants || (state.weather === 'storm' && curNode?.layer === 'land') ? 'disabled' : ''}><span class="btn-label">👖 暗中穿裤</span></button>
            ${curNode?.layer !== 'land' ? '<button class="pk-btn pk-btn--primary" data-stealth-act="breathe" type="button"><span class="btn-label">💨 暗中呼吸</span></button>' : ''}
          </div>
          <div class="action-btn-grid" style="margin-top:8px;">
            ${moves.map((n) => `<button class="pk-btn pk-btn--ghost pk-btn--sm" data-stealth-move="${n.id}" type="button"><span class="btn-label">➤ 暗移至 ${escapeHtml(n.name)}</span></button>`).join('')}
          </div>
        `;
        return;
      }

      if (state.pendingAction) {
        boxSub.classList.remove('is-hidden');
        UI.renderPendingSubpanel(boxSub, self, state.pendingAction);
        return;
      }

      if (state.phase !== 'action') {
        boxAct.classList.remove('is-hidden');
        boxAct.innerHTML = '<div>对局已结束。</div>';
        return;
      }

      if (state.activePlayerId !== self.id) {
        localUI.subPanelState = null;
        boxAct.classList.remove('is-hidden');
        const activeP = getPlayer(state.activePlayerId);
        boxAct.innerHTML = `<div>当前轮到 <strong>${escapeHtml(activeP?.name || '...')}</strong>（${escapeHtml(ROLE_MAP[activeP?.roleId]?.name || '')}）行动，请静候或使用右下角战术通讯密谋...</div>`;
        return;
      }

      if (localUI.subPanelState) {
        boxSub.classList.remove('is-hidden');
        UI.renderLocalSubpanel(boxSub, self, localUI.subPanelState);
        return;
      }

      boxAct.classList.remove('is-hidden');
      const btns = [];
      const enemiesHere = getAlivePlayersAt(self.location, self.id);
      const hiddenRaiders = state.players.filter((p) => p.status === 'alive' && p.stealth?.active && p.stealth.turnUsed < state.turn && p.id !== self.id);
      const parasitesOnMe = state.players.filter((p) => p.status === 'alive' && p.parasiteHostId === self.id);

      if (self.bomb && enemiesHere.length > 0) btns.push('<button class="pk-btn pk-btn--crimson" data-open-sub="pass_bomb" type="button"><span class="btn-label">💣 免费过继炸弹</span></button>');
      if (!self.parasiteHostId && getReachableMoveNodes(self).length > 0) btns.push('<button class="pk-btn pk-btn--primary" data-open-sub="move" type="button"><span class="btn-label">➤ 移动 / 带人</span></button>');
      if (!self.parasiteHostId && hasSQ(self, 'SQ2') && getReachableMoveNodes(self).length > 0) btns.push('<button class="pk-btn pk-btn--crimson" data-open-sub="sq2_dash" type="button"><span class="btn-label">⚡ 利刃突进攻</span></button>');

      const canWear = self.pants < self.maxPants && !(state.weather === 'storm' && curNode?.layer === 'land');
      btns.push(`<button class="pk-btn pk-btn--ghost" data-quick-act="wear_pants" type="button" ${canWear ? '' : 'disabled'}><span class="btn-label">👖 穿裤</span></button>`);
      btns.push('<button class="pk-btn pk-btn--ghost" data-quick-act="draw_knife" type="button"><span class="btn-label">🔪 拔刀</span></button>');

      const hasWardenHere = canAttackWardenFrom(curNode);
      if (enemiesHere.length > 0 || hasWardenHere) {
        btns.push('<button class="pk-btn pk-btn--accent" data-open-sub="strip_pants" type="button"><span class="btn-label">👖 扒裤</span></button>');
        if (self.knives >= 1) btns.push('<button class="pk-btn pk-btn--crimson" data-open-sub="stab" type="button"><span class="btn-label">🔪 咔！（绝杀）</span></button>');
      }
      if (enemiesHere.some((e) => e.knives > 0)) btns.push('<button class="pk-btn pk-btn--ghost" data-open-sub="steal_knife" type="button"><span class="btn-label">✋ 抢刀</span></button>');
      if (enemiesHere.some((e) => needsPinchPigFace(self, e))) btns.push('<button class="pk-btn pk-btn--accent" data-open-sub="pinch_pigface" type="button"><span class="btn-label">🐷 捏猪脸</span></button>');
      if (enemiesHere.some((e) => e.oxygenTank) && !self.oxygenTank) btns.push('<button class="pk-btn pk-btn--ghost" data-open-sub="steal_tank" type="button"><span class="btn-label">🫧 抢氧气瓶</span></button>');

      if (curNode && curNode.layer !== 'land') btns.push('<button class="pk-btn pk-btn--primary" data-quick-act="breathe" type="button"><span class="btn-label">💨 呼吸重置</span></button>');
      if (curNode && curNode.droppedArtifacts.length > 0) {
        curNode.droppedArtifacts.forEach((sqId) => btns.push(`<button class="pk-btn pk-btn--accent" data-pickup-sq="${sqId}" type="button"><span class="btn-label">✨ 拾取 ${ARTIFACTS[sqId].short}</span></button>`));
      }
      if (parasitesOnMe.length > 0) btns.push('<button class="pk-btn pk-btn--accent" data-quick-act="shake_parasite" type="button"><span class="btn-label">💨 扒裤甩开寄生</span></button>');
      if (hiddenRaiders.length > 0) btns.push('<button class="pk-btn pk-btn--crimson" data-open-sub="predict_raider" type="button"><span class="btn-label">🎯 预判隐身突袭者</span></button>');

      if (curNode?.kind === 'police') {
        btns.push('<button class="pk-btn pk-btn--accent" data-open-sub="police_arrest" type="button"><span class="btn-label">🚔 远程逮捕</span></button>');
        btns.push('<button class="pk-btn pk-btn--ghost" data-quick-act="police_corpse" type="button"><span class="btn-label">🚑 搬尸 +0.5❤️</span></button>');
        btns.push('<button class="pk-btn pk-btn--danger" data-quick-act="police_surrender" type="button"><span class="btn-label">⛓ 自首入狱</span></button>');
      } else if (curNode?.kind === 'blackmarket') {
        btns.push('<button class="pk-btn pk-btn--crimson" data-quick-act="blackmarket_draw" type="button"><span class="btn-label">🕶 抽恶魔契约 (8选3)</span></button>');
      } else if (curNode?.kind === 'aquarium' && !self.frogMask) {
        btns.push('<button class="pk-btn pk-btn--accent" data-quick-act="equip_frog_mask" type="button"><span class="btn-label">🐸 戴青蛙面罩</span></button>');
      } else if (curNode?.kind === 'ruins') {
        btns.push('<button class="pk-btn pk-btn--accent" data-quick-act="ruins_dig" type="button"><span class="btn-label">⛏ 遗迹挖掘 (25%)</span></button>');
      } else if (curNode?.kind === 'palace') {
        btns.push('<button class="pk-btn pk-btn--primary" data-open-sub="forge_artifact" type="button"><span class="btn-label">🔱 锻造龙宫神器</span></button>');
      } else if (curNode?.kind === 'wish') {
        btns.push(`<button class="pk-btn pk-btn--primary" data-quick-act="wish_step" type="button"><span class="btn-label">🌠 许愿池 (${self.wishSteps}/3)</span></button>`);
      } else if (curNode?.kind === 'observatory') {
        btns.push('<button class="pk-btn pk-btn--primary" data-open-sub="set_weather" type="button"><span class="btn-label">🔭 改写下回合天象</span></button>');
      }

      const skillBtn = UI.buildRoleSkillButton(self);
      if (skillBtn) btns.push(skillBtn);
      btns.push('<button class="pk-btn pk-btn--ghost" data-quick-act="pass" type="button"><span class="btn-label">⏭ 结束行动</span></button>');
      boxAct.innerHTML = `<div class="action-btn-grid">${btns.join('')}</div>`;
    },

    buildRoleSkillButton(self) {
      // 任意处于附身态的玩家（寄生者或盗版附身的镜像师）均可破体而出
      if (self.parasiteHostId) {
        return '<button class="pk-btn pk-btn--crimson" data-open-sub="skill_parasite_burst" type="button"><span class="btn-label">💥 破体而出（免费扒/咔宿主）</span></button>';
      }
      const r = ROLE_MAP[self.roleId];
      if (!r || r.activeMax <= 0 || self.roleId === 'ninja') return '';
      const disabled = self.activeCharges <= 0 || isHypoxic(self) ? 'disabled' : '';
      const label = self.roleId === 'mirror'
        ? `🪞 盗版(${self.activeCharges})${state.lastActiveSkill ? `:${state.lastActiveSkill.skillName}` : ':+1刀+0.5裤'}`
        : `★ ${r.activeName} (${self.activeCharges})`;
      return `<button class="pk-btn pk-btn--crimson" data-open-skill="${self.roleId}" type="button" ${disabled}><span class="btn-label">${escapeHtml(label)}</span></button>`;
    },

    renderPendingSubpanel(box, self, pa) {
      if (pa.actorId !== self.id) {
        box.innerHTML = `<div class="subpanel-head"><span>⏳ 等待 ${escapeHtml(getPlayer(pa.actorId)?.name)} 完成抉择...</span></div>`;
        return;
      }

      if (pa.type === 'blackmarket') {
        const pickingTargetFor = localUI.subPanelState?.bmTargetContract || null;
        if (pickingTargetFor) {
          const targets = state.players.filter((p) => p.status === 'alive' && p.id !== self.id);
          box.innerHTML = `
            <div class="subpanel-head"><span>选择黑市契约目标</span><button class="pk-btn pk-btn--ghost pk-btn--sm" data-bm-back="1" type="button"><span class="btn-label">返回契约</span></button></div>
            <div class="action-btn-grid">${targets.map((t) => `<button class="pk-btn pk-btn--crimson pk-btn--sm" data-bm-commit="${pickingTargetFor}" data-target="${t.id}" type="button"><span class="btn-label">${escapeHtml(t.name)} (${t.pants}👖)</span></button>`).join('')}</div>
          `;
          return;
        }
        const cards = pa.contracts.map((cid) => {
          const c = CONTRACTS.find((x) => x.id === cid);
          return `<button class="contract-card" data-bm-pick="${cid}" type="button"><div class="contract-title">${escapeHtml(c.name)}</div><div class="contract-gain">＋ ${escapeHtml(c.gain)}</div><div class="contract-cost">－ ${escapeHtml(c.cost)}</div></button>`;
        }).join('');
        box.innerHTML = `
          <div class="subpanel-head">
            <span>🕶 黑市恶魔契约（8 抽 3 选 1）</span>
            <div>${pa.canFreeReroll ? '<button class="pk-btn pk-btn--accent pk-btn--sm" data-bm-reroll="1" type="button"><span class="btn-label">🔄 免费刷新</span></button>' : ''}<button class="pk-btn pk-btn--ghost pk-btn--sm" data-bm-cancel="1" type="button"><span class="btn-label">放弃</span></button></div>
          </div>
          <div class="contract-grid">${cards}</div>
        `;
        return;
      }

      if (pa.type === 'wish_pick') {
        const sub = localUI.subPanelState?.wishMode || null;
        if (sub === 'revive' || sub === 'jail') {
          const pool = sub === 'revive' ? state.players.filter((p) => p.status !== 'alive') : state.players.filter((p) => p.status === 'alive');
          box.innerHTML = `
            <div class="subpanel-head"><span>选择许愿目标（${sub === 'revive' ? '复活' : '强送入狱'}）</span><button class="pk-btn pk-btn--ghost pk-btn--sm" data-wish-back="1" type="button"><span class="btn-label">返回</span></button></div>
            <div class="action-btn-grid">${pool.map((t) => `<button class="pk-btn pk-btn--crimson pk-btn--sm" data-wish-exec="${sub}" data-target="${t.id}" type="button"><span class="btn-label">${escapeHtml(t.name)}</span></button>`).join('') || '<span>无可选目标</span>'}</div>
          `;
          return;
        }
        if (sub === 'swap') {
          const alive = state.players.filter((p) => p.status === 'alive');
          const first = localUI.subPanelState?.wishFirst || null;
          box.innerHTML = `
            <div class="subpanel-head"><span>空间置换：选择${first ? '第 2 名' : '第 1 名'}玩家</span><button class="pk-btn pk-btn--ghost pk-btn--sm" data-wish-back="1" type="button"><span class="btn-label">返回</span></button></div>
            <div class="action-btn-grid">${alive.filter((p) => p.id !== first).map((t) => `<button class="pk-btn pk-btn--primary pk-btn--sm" data-wish-swap="${t.id}" type="button"><span class="btn-label">${escapeHtml(t.name)}</span></button>`).join('')}</div>
          `;
          return;
        }
        box.innerHTML = `<div class="subpanel-head"><span>🌠 许愿池达成！请选择 1 项神迹</span></div><div class="action-btn-grid">${WISH_OPTIONS.map((w) => `<button class="pk-btn pk-btn--primary pk-btn--sm" data-wish-pick="${w.id}" type="button" title="${escapeHtml(w.desc)}"><span class="btn-label">${escapeHtml(w.name)}</span></button>`).join('')}</div>`;
        return;
      }

      if (pa.type === 'ninja_chain') {
        const targets = Engine.getNinjaChainTargets(self);
        box.innerHTML = `
          <div class="subpanel-head"><span>⚡ 忍者【瞬身连撞】：选择距离 1 单位撞击（1伤，撞死可连撞）</span><button class="pk-btn pk-btn--ghost pk-btn--sm" data-ninja-skip="1" type="button"><span class="btn-label">停止连撞</span></button></div>
          <div class="action-btn-grid">${targets.map((t) => `<button class="pk-btn pk-btn--crimson pk-btn--sm" data-ninja-hit="${t.id}" type="button"><span class="btn-label">⚡ 撞击 ${escapeHtml(t.name)}（${escapeHtml(getNode(t.nodeId)?.name || '')}）</span></button>`).join('')}</div>
        `;
        return;
      }


    },

    renderLocalSubpanel(box, self, sub) {
      const closeBtn = '<button class="pk-btn pk-btn--ghost pk-btn--sm" data-close-sub="1" type="button"><span class="btn-label">返回</span></button>';
      const curNode = getNode(self.location);
      const enemiesHere = getAlivePlayersAt(self.location, self.id);
      const aliveEnemies = state.players.filter((p) => p.status === 'alive' && p.id !== self.id);

      if (sub.type === 'move') {
        const moves = getReachableMoveNodes(self);
        const carryChecks = enemiesHere.map((e) => `
          <label class="pk-check"><input type="checkbox" data-carry-id="${e.id}" ${(sub.carryIds || []).includes(e.id) ? 'checked' : ''} /><span class="pk-check-box"></span><span class="pk-check-text">强带 ${escapeHtml(e.name)}</span></label>
        `).join('');
        box.innerHTML = `
          <div class="subpanel-head"><span>➤ 选择目的地（也可直接点击 3D 地图高亮节点）</span>${closeBtn}</div>
          ${carryChecks ? `<div class="action-btn-grid" style="margin-bottom:6px;">${carryChecks}</div>` : ''}
          <div class="action-btn-grid">${moves.map((n) => `<button class="pk-btn pk-btn--primary pk-btn--sm" data-move-dest="${n.id}" type="button"><span class="btn-label">${escapeHtml(n.name)} (${n.layer.toUpperCase()})</span></button>`).join('')}</div>
        `;
        return;
      }

      if (sub.type === 'sq2_dash') {
        const combos = [];
        getReachableMoveNodes(self).forEach((n) => {
          const foes = getAlivePlayersAt(n.id, self.id);
          if (foes.length === 0 && n.kind !== 'prison_out') combos.push(`<button class="pk-btn pk-btn--ghost pk-btn--sm" data-sq2-dest="${n.id}" data-sq2-target="" type="button"><span class="btn-label">突进至 ${escapeHtml(n.name)} (空)</span></button>`);
          foes.forEach((f) => combos.push(`<button class="pk-btn pk-btn--crimson pk-btn--sm" data-sq2-dest="${n.id}" data-sq2-target="${f.id}" type="button"><span class="btn-label">⚡ 突进【${escapeHtml(n.name)}】斩 ${escapeHtml(f.name)} (${f.pants}👖)</span></button>`));
          if (n.kind === 'prison_out') combos.push(`<button class="pk-btn pk-btn--accent pk-btn--sm" data-sq2-dest="${n.id}" data-sq2-target="NPC_WARDEN" type="button"><span class="btn-label">⚡ 突进斩典狱长</span></button>`);
        });
        box.innerHTML = `<div class="subpanel-head"><span>⚡ SQ2 利刃突进（1步移动 + 免费攻击 1 次）</span>${closeBtn}</div><div class="action-btn-grid">${combos.join('')}</div>`;
        return;
      }

      if (['strip_pants', 'stab', 'steal_knife', 'pinch_pigface', 'steal_tank', 'pass_bomb', 'police_arrest'].includes(sub.type)) {
        let targets = sub.type === 'police_arrest' ? aliveEnemies.filter((e) => e.location !== 'land_prison_in') : enemiesHere;
        if (sub.type === 'steal_knife') targets = targets.filter((e) => e.knives > 0);
        if (sub.type === 'pinch_pigface') targets = targets.filter((e) => needsPinchPigFace(self, e));
        if (sub.type === 'steal_tank') targets = targets.filter((e) => e.oxygenTank);

        const items = targets.map((t) => `<button class="pk-btn pk-btn--crimson pk-btn--sm" data-target-act="${sub.type}" data-target="${t.id}" type="button"><span class="btn-label">${escapeHtml(t.name)} (${t.pants}👖 / ${t.hp}❤️)</span></button>`);
        if ((sub.type === 'strip_pants' || sub.type === 'stab') && canAttackWardenFrom(curNode)) {
          items.push(`<button class="pk-btn pk-btn--accent pk-btn--sm" data-target-act="${sub.type}" data-target="NPC_WARDEN" type="button"><span class="btn-label">NPC 典狱长 (${state.warden.pants}👖/${state.warden.hp}❤️)</span></button>`);
        }
        box.innerHTML = `<div class="subpanel-head"><span>选择目标</span>${closeBtn}</div><div class="action-btn-grid">${items.join('') || '<span>暂无符合条件的目标</span>'}</div>`;
        return;
      }

      if (sub.type === 'predict_raider') {
        const raiders = state.players.filter((p) => p.status === 'alive' && p.stealth?.active && p.stealth.turnUsed < state.turn && p.id !== self.id);
        box.innerHTML = `
          <div class="subpanel-head"><span>🎯 在【${escapeHtml(curNode?.name)}】预判隐身突袭者现身</span>${closeBtn}</div>
          <div class="action-btn-grid">${raiders.map((r) => `
            <button class="pk-btn pk-btn--accent pk-btn--sm" data-predict="${r.id}" data-mode="strip" type="button"><span class="btn-label">预判扒裤 → ${escapeHtml(r.name)}</span></button>
            ${self.knives >= 1 ? `<button class="pk-btn pk-btn--crimson pk-btn--sm" data-predict="${r.id}" data-mode="stab" type="button"><span class="btn-label">预判绝杀 → ${escapeHtml(r.name)}</span></button>` : ''}
          `).join('')}</div>
        `;
        return;
      }

      if (sub.type === 'forge_artifact') {
        const list = ['SQ1', 'SQ2', 'SQ3', 'SQ4'].filter((id) => !state.artifacts[id].ownerId && !state.artifacts[id].droppedAt);
        box.innerHTML = `<div class="subpanel-head"><span>🔱 选择推进锻造的龙宫神器</span>${closeBtn}</div><div class="action-btn-grid">${list.map((id) => `<button class="pk-btn pk-btn--primary pk-btn--sm" data-forge-sq="${id}" type="button"><span class="btn-label">${ARTIFACTS[id].name} (${state.artifacts[id].progress}/${ARTIFACTS[id].stepsNeed})</span></button>`).join('') || '<span>四件神器已全部出世</span>'}</div>`;
        return;
      }

      if (sub.type === 'set_weather') {
        box.innerHTML = `
          <div class="subpanel-head"><span>🔭 改写下回合全图天象</span>${closeBtn}</div>
          <div class="action-btn-grid">
            <button class="pk-btn pk-btn--crimson pk-btn--sm" data-weather-pick="bloodmoon" type="button"><span class="btn-label">🩸 血月（伤害 +0.5）</span></button>
            <button class="pk-btn pk-btn--ghost pk-btn--sm" data-weather-pick="fog" type="button"><span class="btn-label">🌫 迷雾（隐藏地图坐标）</span></button>
            <button class="pk-btn pk-btn--primary pk-btn--sm" data-weather-pick="storm" type="button"><span class="btn-label">⛈ 雷暴（陆地禁穿裤）</span></button>
          </div>
        `;
        return;
      }

      if (sub.type === 'skill') {
        const effRole = sub.effectiveRole;
        if (effRole === 'parasite_burst') {
          const host = getPlayer(self.parasiteHostId);
          box.innerHTML = `
            <div class="subpanel-head"><span>💥 破体而出 · 奇袭宿主 ${escapeHtml(host?.name || '')}</span>${closeBtn}</div>
            <div class="action-btn-grid">
              <button class="pk-btn pk-btn--accent" data-skill-exec="parasite_burst" data-burst="strip" type="button"><span class="btn-label">破体免费扒裤</span></button>
              <button class="pk-btn pk-btn--crimson" data-skill-exec="parasite_burst" data-burst="stab" type="button" ${self.knives >= 1 && host?.pants <= 0 ? '' : 'disabled'}><span class="btn-label">破体免费「咔」绝杀</span></button>
            </div>
          `;
          return;
        }
        if (['chili', 'watcher', 'parasite'].includes(effRole)) {
          let pool = effRole === 'parasite' ? enemiesHere : aliveEnemies;
          if (effRole === 'watcher') pool = pool.filter((e) => e.location !== 'land_prison_in');
          box.innerHTML = `<div class="subpanel-head"><span>★ ${escapeHtml(ROLE_MAP[effRole].activeName)} · 选择目标</span>${closeBtn}</div><div class="action-btn-grid">${pool.map((t) => `<button class="pk-btn pk-btn--crimson pk-btn--sm" data-skill-target="${t.id}" type="button"><span class="btn-label">${escapeHtml(t.name)}</span></button>`).join('') || '<span>暂无合法目标</span>'}</div>`;
          return;
        }
        if (effRole === 'undertaker') {
          const souls = state.players.filter((p) => p.status === 'pending_revive');
          box.innerHTML = `<div class="subpanel-head"><span>⚰ 封魂 · 销毁待复活者资格并回 +0.5❤️</span>${closeBtn}</div><div class="action-btn-grid">${souls.map((t) => `<button class="pk-btn pk-btn--crimson pk-btn--sm" data-skill-target="${t.id}" type="button"><span class="btn-label">封魂 ${escapeHtml(t.name)}</span></button>`).join('') || '<span>地府目前无待复活目标</span>'}</div>`;
          return;
        }
        if (effRole === 'barrier') {
          const validNodes = Object.values(state.nodes).filter((n) => !n.collapsed && n.kind !== 'prison_in');
          box.innerHTML = `<div class="subpanel-head"><span>🔮 绝对领域 · 选择封锁地点至下回合末</span>${closeBtn}</div><div class="action-btn-grid">${validNodes.map((n) => `<button class="pk-btn pk-btn--primary pk-btn--sm" data-skill-node="${n.id}" type="button"><span class="btn-label">${escapeHtml(n.name)}</span></button>`).join('')}</div>`;
          return;
        }
        if (effRole === 'curser') {
          const first = sub.firstTarget || null;
          box.innerHTML = `<div class="subpanel-head"><span>🩸 命运链接 · 选择${first ? '第 2 名' : '第 1 名'}存活玩家</span>${closeBtn}</div><div class="action-btn-grid">${state.players.filter((p) => p.status === 'alive' && p.id !== first).map((t) => `<button class="pk-btn pk-btn--crimson pk-btn--sm" data-curser-pick="${t.id}" type="button"><span class="btn-label">${escapeHtml(t.name)}</span></button>`).join('')}</div>`;
          return;
        }
        if (effRole === 'storm') {
          if (!sub.stormTarget && !sub.stormSrcNode) {
            const occupied = Object.values(state.nodes).filter((n) => !n.collapsed && n.kind !== 'prison_in' && getAlivePlayersAt(n.id).length > 0);
            box.innerHTML = `
              <div class="subpanel-head"><span>🌪 乱流风暴 · 吹单人(免费) 或 吹全地点(1步)</span>${closeBtn}</div>
              <div class="action-btn-grid">${state.players.filter((p) => p.status === 'alive').map((t) => `<button class="pk-btn pk-btn--primary pk-btn--sm" data-storm-single="${t.id}" type="button"><span class="btn-label">免费吹 ${escapeHtml(t.name)}</span></button>`).join('')}</div>
              <div class="action-btn-grid" style="margin-top:6px;">${occupied.map((n) => `<button class="pk-btn pk-btn--crimson pk-btn--sm" data-storm-node="${n.id}" type="button"><span class="btn-label">1步吹空【${escapeHtml(n.name)}】</span></button>`).join('')}</div>
            `;
          } else {
            const refNode = sub.stormSrcNode ? getNode(sub.stormSrcNode) : getNode(getPlayer(sub.stormTarget)?.location);
            const dests = Object.values(state.nodes).filter((n) => !n.collapsed && n.layer === refNode?.layer && n.id !== refNode?.id && n.kind !== 'prison_in' && !isBarrierActive(n.id));
            box.innerHTML = `<div class="subpanel-head"><span>🌪 选择吹飞目的地（同层：${refNode?.layer.toUpperCase()}）</span>${closeBtn}</div><div class="action-btn-grid">${dests.map((n) => `<button class="pk-btn pk-btn--accent pk-btn--sm" data-storm-dest="${n.id}" type="button"><span class="btn-label">吹至 ${escapeHtml(n.name)}</span></button>`).join('')}</div>`;
          }
          return;
        }
        if (effRole === 'puppeteer') {
          if (!sub.puppetTarget) {
            const sameLayer = aliveEnemies.filter((e) => getNode(e.location)?.layer === curNode?.layer);
            box.innerHTML = `<div class="subpanel-head"><span>🧵 提线木偶 · 选择同层级目标</span>${closeBtn}</div><div class="action-btn-grid">${sameLayer.map((t) => `<button class="pk-btn pk-btn--crimson pk-btn--sm" data-puppet-target="${t.id}" type="button"><span class="btn-label">${escapeHtml(t.name)} (${escapeHtml(getNode(t.location)?.name || '')})</span></button>`).join('') || '<span>同层级无存活目标</span>'}</div>`;
          } else {
            const pt = getPlayer(sub.puppetTarget);
            const pMoves = pt && !pt.parasiteHostId ? getReachableMoveNodes(pt) : [];
            const pNeighbors = pt ? getAlivePlayersAt(pt.location, pt.id) : [];
            box.innerHTML = `
              <div class="subpanel-head"><span>🧵 强控 ${escapeHtml(pt?.name)} 执行基础动作</span>${closeBtn}</div>
              <div class="action-btn-grid">
                <button class="pk-btn pk-btn--ghost pk-btn--sm" data-puppet-cmd="wear_pants" type="button"><span class="btn-label">强迫穿裤</span></button>
                <button class="pk-btn pk-btn--ghost pk-btn--sm" data-puppet-cmd="draw_knife" type="button"><span class="btn-label">强迫拔刀</span></button>
                ${pNeighbors.map((v) => `<button class="pk-btn pk-btn--crimson pk-btn--sm" data-puppet-strip="${v.id}" type="button"><span class="btn-label">强迫扒 ${escapeHtml(v.name)} 的裤</span></button>`).join('')}
              </div>
              <div class="action-btn-grid" style="margin-top:6px;">${pMoves.map((n) => `<button class="pk-btn pk-btn--primary pk-btn--sm" data-puppet-move="${n.id}" type="button"><span class="btn-label">强移至 ${escapeHtml(n.name)}</span></button>`).join('')}</div>
            `;
          }
        }
      }
    },

    renderLog() {
      const el = document.getElementById('battle-log-list');
      const ticker = document.getElementById('mobile-live-ticker');
      const logBadge = document.getElementById('mobile-log-badge');

      if (state.logs.length > localUI.lastLogCount) {
        if (localUI.mobileTab !== 'log') {
          localUI.unreadLogCount += (state.logs.length - localUI.lastLogCount);
        }
        localUI.lastLogCount = state.logs.length;
      }

      const reversed = [...state.logs].slice(-50).reverse();

      if (el) {
        el.innerHTML = reversed.map((item, idx) => `
          <div class="log-entry log-entry--${item.kind} ${idx < 2 ? 'is-fresh' : ''}">
            <span class="log-turn-tag">T${String(item.turn).padStart(2, '0')}</span>
            <span class="log-body">${formatLogHtml(item.text)}</span>
          </div>
        `).join('');
        el.scrollTop = 0;
      }

      if (ticker) {
        const latestTwo = reversed.slice(0, 2);
        ticker.innerHTML = latestTwo.length
          ? latestTwo.map((item, idx) => `
              <div class="ticker-line ${idx === 0 ? 'is-newest' : ''}">
                <span class="log-turn-tag">T${String(item.turn).padStart(2, '0')}</span>
                <span>${formatLogHtml(item.text)}</span>
              </div>
            `).join('')
          : '<div class="ticker-line">战局即将开幕...</div>';
      }

      if (logBadge) {
        logBadge.textContent = localUI.unreadLogCount > 9 ? '9+' : String(localUI.unreadLogCount);
        logBadge.classList.toggle('is-hidden', localUI.unreadLogCount <= 0);
      }
    },

    renderComms() {
      const drawer = document.getElementById('comms-drawer');
      const fab = document.getElementById('comms-fab');
      const badge = document.getElementById('comms-unread-badge');
      const sel = document.getElementById('comms-channel-select');
      const list = document.getElementById('comms-messages');

      if (drawer) drawer.classList.toggle('is-hidden', !localUI.commsOpen);
      if (fab) fab.setAttribute('aria-expanded', String(localUI.commsOpen));
      if (badge) { badge.textContent = String(localUI.commsUnread); badge.classList.toggle('is-hidden', localUI.commsUnread <= 0); }

      if (sel) {
        const curVal = sel.value || 'all';
        const others = state.players.filter((p) => p.id !== state.selfId);
        sel.innerHTML = '<option value="all">📢 全员公屏</option>' + others.map((p) => `<option value="${p.id}">🔒 私聊 ${escapeHtml(p.name)}</option>`).join('');
        if ([...sel.options].some((o) => o.value === curVal)) sel.value = curVal;
      }

      if (list) {
        const visible = state.chat.filter((m) => Comms.canSeeMessage(m));
        list.innerHTML = visible.map((m) => `<div class="chat-msg ${m.isWhisper ? 'chat-msg--whisper' : ''}"><div class="chat-msg-head">${escapeHtml(m.fromName)}${m.isWhisper ? ` ▸ 🔒${escapeHtml(m.toName)}` : ''}</div><div>${escapeHtml(m.text)}</div></div>`).join('') || '<div class="chat-msg">暂无战术通讯，点击下方快捷短语或头顶表情开启博弈！</div>';
        list.scrollTop = list.scrollHeight;
      }
    },

    openModal(name) {
      const backdrop = document.getElementById('modal-backdrop');
      if (!backdrop) return;
      localUI.activeModal = name;
      backdrop.classList.remove('is-hidden');
      ['guide', 'host-config', 'gameover'].forEach((id) => document.getElementById(`modal-${id}`)?.classList.toggle('is-hidden', id !== name));
      if (name === 'guide') { localUI.guideStep = 0; UI.syncGuideStep(); }
      else if (name === 'host-config') syncLobbyRuleCheckboxes();
      else if (name === 'gameover') UI.renderGameOverModal();
    },

    closeModal() {
      localUI.activeModal = null;
      document.getElementById('modal-backdrop')?.classList.add('is-hidden');
    },

    syncGuideStep() {
      const step = clamp(localUI.guideStep, 0, 2);
      localUI.guideStep = step;
      document.querySelectorAll('#guide-steps .guide-step').forEach((el, i) => el.classList.toggle('is-active', i === step));
      document.querySelectorAll('#guide-step-dots .step-dot').forEach((el, i) => el.classList.toggle('is-active', i === step));
      const prev = document.getElementById('guide-prev');
      const next = document.getElementById('guide-next');
      if (prev) prev.disabled = step === 0;
      if (next) { const lbl = next.querySelector('.btn-label'); if (lbl) lbl.textContent = step === 2 ? '进入战场' : '下一步'; }
    },

    renderGameOverModal() {
      const winEl = document.getElementById('gameover-winner');
      const statsEl = document.getElementById('gameover-stats');
      if (winEl) winEl.textContent = state.winnerReason || '战局终结';
      if (statsEl) {
        statsEl.innerHTML = state.players.map((p) => {
          const r = ROLE_MAP[p.roleId] || ROLE_MAP.normal;
          return `<div class="gameover-row"><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(r.name)}</span><span>杀 ${p.kills}</span><span>❤️ ${p.hp}</span><span>${p.status === 'alive' ? '🏆 幸存' : '💀 阵亡'}</span></div>`;
        }).join('');
      }
    }
  });

  // ========================================================================
  // 10. Event Bindings & Bootstrap
  // ========================================================================
  function bindEvents() {
    const on = (id, ev, fn) => document.getElementById(id)?.addEventListener(ev, fn);

    on('btn-open-guide', 'click', () => UI.openModal('guide'));
    on('btn-open-guide-ingame', 'click', () => UI.openModal('guide'));
    on('guide-close', 'click', () => UI.closeModal());
    on('guide-prev', 'click', () => { localUI.guideStep -= 1; UI.syncGuideStep(); });
    on('guide-next', 'click', () => { if (localUI.guideStep >= 2) UI.closeModal(); else { localUI.guideStep += 1; UI.syncGuideStep(); } });

    on('btn-open-config', 'click', () => UI.openModal('host-config'));
    on('btn-host-config-ingame', 'click', () => UI.openModal('host-config'));
    on('btn-close-config', 'click', () => UI.closeModal());
    on('btn-apply-config', 'click', () => {
      const g = (id) => document.getElementById(id);
      Net.applyHostConfig({
        collapseStartTurn: clamp(Number(g('cfg-collapse-turn')?.value) || 10, 3, 30),
        oxygenMax: clamp(Number(g('cfg-oxygen-max')?.value) || 5, 3, 10),
        bountyArtifacts: clamp(Number(g('cfg-bounty-artifacts')?.value) || 2, 1, 4),
        bountyKills: clamp(Number(g('cfg-bounty-kills')?.value) || 2, 1, 6),
        aiDelayMs: clamp(Number(g('cfg-ai-delay')?.value) || 1600, 400, 3500),
        collapseEnabled: Boolean(g('cfg-opt-collapse')?.checked),
        bountyEnabled: Boolean(g('cfg-opt-bounty')?.checked),
        vfxEnabled: Boolean(g('cfg-opt-vfx')?.checked)
      });
      UI.closeModal();
    });

    const toggleAudio = () => { if (window.VFX) window.VFX.setAudioMuted(!window.VFX.isAudioMuted()); };
    on('btn-toggle-audio', 'click', toggleAudio);
    on('btn-toggle-audio-ingame', 'click', toggleAudio);

    on('btn-create-room', 'click', () => Net.createRoom());
    on('btn-join-room', 'click', () => Net.joinRoom(document.getElementById('input-room-code')?.value));
    on('btn-copy-invite', 'click', () => Net.copyInviteLink());
    on('btn-start-solo', 'click', () => Net.startSolo(Number(document.getElementById('select-ai-count')?.value) || 4));
    on('btn-add-ai', 'click', () => Net.addLobbyAi());
    on('btn-start-match', 'click', () => Engine.startMatch());

    on('input-nickname', 'change', (e) => {
      const seat = getSelfLobby();
      if (seat && !state.started) {
        seat.name = String(e.target.value || '').trim().slice(0, 12) || seat.name;
        Net.broadcastState();
        UI.renderLobby();
      }
    });

    ['opt-collapse', 'opt-bounty', 'opt-vfx'].forEach((id) => {
      on(id, 'change', () => {
        const cfg = readLobbyConfigFromDOM();
        if (id === 'opt-vfx') window.VFX?.setEnabled(cfg.vfxEnabled);
        if (isHostAuthority()) { state.config = cfg; Net.broadcastState(); }
      });
    });

    document.getElementById('role-filter-tabs')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.role-tab');
      if (!btn) return;
      localUI.selectedRoleFilter = btn.dataset.filter || 'all';
      document.querySelectorAll('#role-filter-tabs .role-tab').forEach((t) => t.classList.toggle('is-active', t === btn));
      UI.renderRoleDossier();
    });

    on('btn-random-role', 'click', () => {
      const pick = ROLES[Math.floor(Math.random() * ROLES.length)];
      Net.sendRoleSelect(pick.id);
      UI.renderRoleDossier();
      window.VFX?.toast(`随机盲选锁定：【${pick.name}】`, 'info');
    });

    document.getElementById('role-grid')?.addEventListener('click', (e) => {
      const card = e.target.closest('.role-card');
      if (!card) return;
      Net.sendRoleSelect(card.dataset.roleId);
      UI.renderRoleDossier();
    });

    document.getElementById('lobby-player-list')?.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-remove-seat]');
      if (rm) Net.removeLobbySeat(rm.dataset.removeSeat);
    });

    on('btn-cam-default', 'click', () => Map3D.setPreset('default'));
    on('btn-cam-top', 'click', () => Map3D.setPreset('top'));
    on('btn-cam-side', 'click', () => Map3D.setPreset('side'));
    on('btn-cam-zoom-in', 'click', () => Map3D.zoom(0.12));
    on('btn-cam-zoom-out', 'click', () => Map3D.zoom(-0.12));
    on('btn-toggle-empty-nodes', 'click', () => Map3D.toggleEmptyNodes());

    const setMobileTab = (tab) => {
      if (!['map', 'players', 'log'].includes(tab)) return;
      localUI.mobileTab = tab;
      if (tab === 'log') localUI.unreadLogCount = 0;
      const ws = document.querySelector('.game-workspace');
      if (ws) ws.dataset.mobileTab = tab;
      document.querySelectorAll('#mobile-stage-tabs .m-tab').forEach((b) =>
        b.classList.toggle('is-active', b.dataset.mtab === tab)
      );
      if (tab === 'map') window.requestAnimationFrame(() => Map3D.setPreset('default'));
      UI.renderLog();
    };
    document.getElementById('mobile-stage-tabs')?.addEventListener('click', (e) => {
      const b = e.target.closest('.m-tab');
      if (b) setMobileTab(b.dataset.mtab);
    });
    document.getElementById('mobile-live-ticker')?.addEventListener('click', () => setMobileTab('log'));

    document.getElementById('map-scene-3d')?.addEventListener('click', (e) => {
      const nodeEl = e.target.closest('.map-node');
      if (!nodeEl) return;
      const nodeId = nodeEl.dataset.nodeId;
      const node = getNode(nodeId);
      if (!node) return;
      if (localUI.subPanelState?.type === 'move' && state.activePlayerId === state.selfId) {
        const carryIds = localUI.subPanelState.carryIds || [];
        localUI.subPanelState = null;
        Net.sendIntent({ type: 'ACTION', action: 'move', destId: nodeId, carryIds });
        return;
      }
      window.VFX?.toast(`【${node.name}】${node.desc}`, 'info');
    });

    const backToLobby = () => {
      clearHostTasks();
      UI.closeModal();
      state.started = false;
      state.phase = 'lobby';
      localUI.subPanelState = null;
      window.VFX?.setWeather('clear');
      window.VFX?.setMood('p3r');
      Net.broadcastState();
      UI.renderAll();
    };
    on('btn-leave-game', 'click', backToLobby);
    on('btn-back-lobby', 'click', backToLobby);
    on('btn-rematch', 'click', () => {
      UI.closeModal();
      if (isHostAuthority()) Engine.startMatch();
      else window.VFX?.toast('等待房主开启下一局', 'info');
    });

    on('comms-fab', 'click', () => Comms.toggleDrawer());
    on('btn-close-comms', 'click', () => Comms.toggleDrawer(false));
    on('comms-form', 'submit', () => {
      const inp = document.getElementById('comms-input');
      const sel = document.getElementById('comms-channel-select');
      if (!inp || !inp.value.trim()) return;
      Net.sendChat(sel ? sel.value : 'all', inp.value);
      inp.value = '';
    });
    document.getElementById('comms-quick-phrases')?.addEventListener('click', (e) => {
      const chip = e.target.closest('.phrase-chip');
      if (!chip) return;
      Net.sendChat(document.getElementById('comms-channel-select')?.value || 'all', chip.dataset.phrase);
    });
    document.getElementById('comms-emoji-bar')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.emoji-btn');
      if (btn) Net.sendEmoji(btn.dataset.emoji);
    });

    document.getElementById('action-stage')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn || btn.disabled) return;
      const d = btn.dataset;
      const self = getSelfPlayer();

      if (d.rps) { Net.sendIntent({ type: 'RPS_CHOICE', hand: d.rps }); return; }
      if (d.subRps) { Net.sendIntent({ type: 'SUB_RPS_CHOICE', hand: d.subRps }); return; }
      if (d.initRps) { Net.sendIntent({ type: 'INITIATIVE_RPS', hand: d.initRps }); return; }
      if (d.pickSlot !== undefined) { Net.sendIntent({ type: 'INITIATIVE_PICK_SLOT', slotIndex: Number(d.pickSlot) }); return; }
      if (d.stealthAct) { Net.sendIntent({ type: 'STEALTH_REVEAL', subAction: d.stealthAct }); return; }
      if (d.stealthMove) { Net.sendIntent({ type: 'STEALTH_REVEAL', subAction: 'move', destId: d.stealthMove }); return; }

      if (d.bmCancel) { localUI.subPanelState = null; Net.sendIntent({ type: 'PENDING_CHOICE', cancel: true }); return; }
      if (d.bmReroll) { Net.sendIntent({ type: 'PENDING_CHOICE', reroll: true }); return; }
      if (d.bmBack) { localUI.subPanelState = null; UI.renderActionDock(); return; }
      if (d.bmPick) {
        if (d.bmPick === 'bm_swap_pants' || d.bmPick === 'bm_bounty_strip') { localUI.subPanelState = { bmTargetContract: d.bmPick }; UI.renderActionDock(); }
        else Net.sendIntent({ type: 'PENDING_CHOICE', contractId: d.bmPick });
        return;
      }
      if (d.bmCommit) { localUI.subPanelState = null; Net.sendIntent({ type: 'PENDING_CHOICE', contractId: d.bmCommit, targetId: d.target }); return; }

      if (d.wishBack) { localUI.subPanelState = null; UI.renderActionDock(); return; }
      if (d.wishPick) {
        if (d.wishPick === 'drain_oxy' || d.wishPick === 'disarm') Net.sendIntent({ type: 'PENDING_CHOICE', wishId: d.wishPick });
        else { localUI.subPanelState = { wishMode: d.wishPick }; UI.renderActionDock(); }
        return;
      }
      if (d.wishExec) { localUI.subPanelState = null; Net.sendIntent({ type: 'PENDING_CHOICE', wishId: d.wishExec, targetId: d.target }); return; }
      if (d.wishSwap) {
        if (!localUI.subPanelState?.wishFirst) { localUI.subPanelState = { wishMode: 'swap', wishFirst: d.wishSwap }; UI.renderActionDock(); }
        else { const first = localUI.subPanelState.wishFirst; localUI.subPanelState = null; Net.sendIntent({ type: 'PENDING_CHOICE', wishId: 'swap', targetAId: first, targetBId: d.wishSwap }); }
        return;
      }

      if (d.ninjaSkip) { Net.sendIntent({ type: 'PENDING_CHOICE', skip: true }); return; }
      if (d.ninjaHit) { Net.sendIntent({ type: 'PENDING_CHOICE', targetId: d.ninjaHit }); return; }

      if (d.closeSub) { localUI.subPanelState = null; UI.renderAll(); return; }
      if (d.quickAct) { Net.sendIntent({ type: 'ACTION', action: d.quickAct }); return; }
      if (d.pickupSq) { Net.sendIntent({ type: 'ACTION', action: 'pickup_artifact', sqId: d.pickupSq }); return; }
      if (d.openSub) {
        localUI.subPanelState = d.openSub === 'skill_parasite_burst' ? { type: 'skill', effectiveRole: 'parasite_burst' } : { type: d.openSub, carryIds: [] };
        UI.renderAll();
        return;
      }
      if (d.openSkill && self) {
        const effRole = d.openSkill === 'mirror' ? (state.lastActiveSkill ? state.lastActiveSkill.roleId : 'mirror_empty') : d.openSkill;
        if (['raider', 'piggy', 'mirror_empty', 'ninja'].includes(effRole)) { Net.sendIntent({ type: 'ACTION', action: 'use_skill' }); return; }
        localUI.subPanelState = { type: 'skill', effectiveRole: effRole };
        UI.renderActionDock();
        return;
      }

      if (d.moveDest) { const carryIds = localUI.subPanelState?.carryIds || []; localUI.subPanelState = null; Net.sendIntent({ type: 'ACTION', action: 'move', destId: d.moveDest, carryIds }); return; }
      if (d.sq2Dest !== undefined) { localUI.subPanelState = null; Net.sendIntent({ type: 'ACTION', action: 'sq2_dash', destId: d.sq2Dest, targetId: d.sq2Target || null }); return; }
      if (d.targetAct) { localUI.subPanelState = null; Net.sendIntent({ type: 'ACTION', action: d.targetAct, targetId: d.target }); return; }
      if (d.predict) { localUI.subPanelState = null; Net.sendIntent({ type: 'ACTION', action: 'predict_raider', targetId: d.predict, mode: d.mode }); return; }
      if (d.forgeSq) { localUI.subPanelState = null; Net.sendIntent({ type: 'ACTION', action: 'forge_artifact', sqId: d.forgeSq }); return; }
      if (d.weatherPick) { localUI.subPanelState = null; Net.sendIntent({ type: 'ACTION', action: 'set_weather', weather: d.weatherPick }); return; }

      if (d.skillExec === 'parasite_burst') { localUI.subPanelState = null; Net.sendIntent({ type: 'ACTION', action: 'use_skill', burstMode: d.burst }); return; }
      if (d.skillTarget) { localUI.subPanelState = null; Net.sendIntent({ type: 'ACTION', action: 'use_skill', targetId: d.skillTarget }); return; }
      if (d.skillNode) { localUI.subPanelState = null; Net.sendIntent({ type: 'ACTION', action: 'use_skill', nodeId: d.skillNode }); return; }
      if (d.curserPick) {
        if (!localUI.subPanelState?.firstTarget) { localUI.subPanelState.firstTarget = d.curserPick; UI.renderActionDock(); }
        else { const a = localUI.subPanelState.firstTarget; localUI.subPanelState = null; Net.sendIntent({ type: 'ACTION', action: 'use_skill', targetAId: a, targetBId: d.curserPick }); }
        return;
      }
      if (d.stormSingle) { localUI.subPanelState.stormTarget = d.stormSingle; UI.renderActionDock(); return; }
      if (d.stormNode) { localUI.subPanelState.stormSrcNode = d.stormNode; UI.renderActionDock(); return; }
      if (d.stormDest) {
        const st = localUI.subPanelState;
        localUI.subPanelState = null;
        Net.sendIntent({ type: 'ACTION', action: 'use_skill', mode: st.stormSrcNode ? 'node' : 'single', targetId: st.stormTarget || null, srcNodeId: st.stormSrcNode || null, destId: d.stormDest });
        return;
      }
      if (d.puppetTarget) { localUI.subPanelState.puppetTarget = d.puppetTarget; UI.renderActionDock(); return; }
      if (d.puppetCmd) { const pt = localUI.subPanelState.puppetTarget; localUI.subPanelState = null; Net.sendIntent({ type: 'ACTION', action: 'use_skill', targetId: pt, puppetAction: d.puppetCmd }); return; }
      if (d.puppetStrip) { const pt = localUI.subPanelState.puppetTarget; localUI.subPanelState = null; Net.sendIntent({ type: 'ACTION', action: 'use_skill', targetId: pt, puppetAction: 'strip_pants', stripVictimId: d.puppetStrip }); return; }
      if (d.puppetMove) { const pt = localUI.subPanelState.puppetTarget; localUI.subPanelState = null; Net.sendIntent({ type: 'ACTION', action: 'use_skill', targetId: pt, puppetAction: 'move', destId: d.puppetMove }); }
    });

    document.getElementById('action-stage')?.addEventListener('change', (e) => {
      const chk = e.target.closest('input[data-carry-id]');
      if (!chk || localUI.subPanelState?.type !== 'move') return;
      const cid = chk.dataset.carryId;
      const list = new Set(localUI.subPanelState.carryIds || []);
      if (chk.checked) list.add(cid); else list.delete(cid);
      localUI.subPanelState.carryIds = Array.from(list);
    });
  }

  function init() {
    window.VFX?.init();
    Map3D.bind();
    bindEvents();

    const nickInput = document.getElementById('input-nickname');
    const defaultName = '雨宫莲';
    if (nickInput && !nickInput.value) nickInput.value = defaultName;

    state = createEmptyLobbyState();
    state.lobbyPlayers = [{ id: state.selfId, name: defaultName, roleId: localUI.selectedRoleId, isHost: true, isAI: false, connected: true, peerId: 'local' }];
    for (let i = 0; i < 3; i++) {
      state.lobbyPlayers.push({ id: uid('ai'), name: pickUniqueAiName(state.lobbyPlayers), roleId: ROLES[Math.floor(Math.random() * ROLES.length)].id, isHost: false, isAI: true, connected: true, peerId: 'ai' });
    }

    const params = new URLSearchParams(window.location.search);
    const inviteCode = (params.get('room') || '').trim().toUpperCase();
    if (/^[A-Z0-9]{4}$/.test(inviteCode)) {
      const codeInput = document.getElementById('input-room-code');
      if (codeInput) codeInput.value = inviteCode;
      window.VFX?.toast(`检测到邀请房间码 ${inviteCode}，输入代号后点击「加入」即可进房`, 'success');
    }

    UI.renderAll();
  }

  window.LK = {
    init,
    get state() { return state; },
    roles: ROLES,
    net: Net,
    map3d: Map3D,
    ui: UI
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
