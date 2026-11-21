/* ==========================================================================
   Little Knife (v2.5 「战况版」) — Complete Unified Game Engine,
   16-Role State Machine, Map-Attached Battle Records, PeerJS Netcode & Comms
   核心改动：猜拳平局极速重猜 / 角色栏改为速览条 / 战报抽屉 / 地图承载战况
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
    bloodmoon: { id: 'bloodmoon', name: '血月', desc: '持续 2 回合：全局所有伤害 +0.5；施法者生效回合初自动 +1🔪', mood: 'p5r' },
    fog: { id: 'fog', name: '迷雾', desc: '持续 2 回合：隐藏地图坐标且禁止跨地点远程锁定；仅施法者免疫', mood: 'p3r' },
    storm: { id: 'storm', name: '雷暴', desc: '持续 2 回合：陆地禁止穿裤；施法者免疫且生效回合初自动 +0.5👖', mood: 'p3r' }
  };

  const ARTIFACTS = {
    SQ1: { id: 'SQ1', name: 'SQ1 大刀', short: '大刀', shortDesc: '伤害与扒裤翻倍', stepsNeed: 2, desc: '攻击伤害与扒裤效果翻倍' },
    SQ2: { id: 'SQ2', name: 'SQ2 利刃', short: '利刃', shortDesc: '常驻小刀判定 + 1步突进斩', stepsNeed: 1, desc: '自带常驻小刀判定（0普通刀亦可直接「咔」或突进扣血，不毁神器；有普通刀时优先消耗普通刀），且可耗1步突进移动到任意可达点并免费攻击1次' },
    SQ3: { id: 'SQ3', name: 'SQ3 猪脸', short: '猪脸', shortDesc: '互动前须贴脸捏脸', stepsNeed: 3, desc: '任何玩家对你互动（含远程）前须先贴脸花1步捏脸（按每张猪脸实例独立记录）' },
    SQ4: { id: 'SQ4', name: 'SQ4 云梯', short: '云梯', shortDesc: '免蓄力登天/降落海陆', stepsNeed: 2, desc: '免升天蓄力直接登天（含海洋层），或在天空1步降落陆地/海洋任意非狱内地点' },
    SQ5: { id: 'SQ5', name: 'SQ5 吸铁石', short: '吸铁石', shortDesc: '隔空夺1刀', stepsNeed: 1, desc: '耗1步远程吸走任意1名存活玩家手中的1把刀（受猪脸、结界与迷雾限制）' },
    SQ6: { id: 'SQ6', name: 'SQ6 钩爪', short: '钩爪', shortDesc: '跨层强拉目标', stepsNeed: 2, desc: '耗1步将任意非狱内非结界的1名存活玩家跨层强拉至你所在地点（受猪脸与迷雾限制，不触发带人）' },
    SQ7: { id: 'SQ7', name: 'SQ7 沙漏', short: '沙漏', shortDesc: '主动存1步至下回合', stepsNeed: 2, desc: '主动结束行动时，可将本回合剩余步数最多储存1步带入下回合（下回合输拳也能动，赢拳叠加）' },
    SQ8: { id: 'SQ8', name: 'SQ8 铁裤', short: '铁裤', shortDesc: '限伤0.5裤/自动生0.5裤', stepsNeed: 3, desc: '每次受扒裤最多扣0.5裤（无视大刀双倍）；每回合开始若为0裤自动生成0.5临时铁裤' }
  };

  const ALL_SQ_IDS = Object.keys(ARTIFACTS);

  function createInitialArtifacts() {
    const map = {};
    ALL_SQ_IDS.forEach((id) => {
      map[id] = { id, progress: 0, ownerId: null, droppedAt: null, destroyed: false };
      if (id === 'SQ3') map[id].instanceId = 1;
    });
    return map;
  }

  const WISH_OPTIONS = [
    { id: 'divine_reset', name: '神赐重整', shortDesc: '+1命 · 回满裤 · +1技/护盾', desc: '许愿者自身 +1 命、裤子回满至上限、且主动技次数 +1（无主动技角色改为获得 1 层黑市护盾）' },
    { id: 'restore_pos', name: '时空复原', shortDesc: '复原任意个单位至各自出生点', desc: '将任意数量的存活玩家或典狱长复原回各自出生点（玩家回各自的家，典狱长回监狱外；不受结界限制）' },
    { id: 'revive', name: '冥界召回', shortDesc: '复活1人(1裤1命地府)', desc: '复活1名阵亡玩家（1裤1命，位于地府；若地府已坍塌则降落安全陆地）' },
    { id: 'swap', name: '空间置换', shortDesc: '互换2名存活者位置', desc: '互换任意2名存活玩家的位置' },
    { id: 'drain_oxy', name: '抽干氧源', shortDesc: '除己外海空缺氧+2', desc: '除许愿者本人外，所有海/空存活玩家缺氧计数 +2（海王在海洋、青蛙面罩在海洋仍免疫）' },
    { id: 'jail', name: '天降法槌', shortDesc: '强送1名存活者入狱', desc: '强制送任意1名存活玩家入狱' },
    { id: 'disarm', name: '全图缴械', shortDesc: '除己外清空全场刀', desc: '除许愿者本人外，清空其他所有玩家手中的刀' }
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
    { id: 'normal', num: '01', name: '普通人', arch: 'survival', archName: '生存', hp: 1.5, pants: 1.5, maxPants: 2, knives: 0, atkMult: 1, activeMax: 0, activeCost: 0, activeName: '无主动技', activeDesc: '开局与常规复活自带 1 层黑市护盾，契约过载时改为获取黑市护盾。', passiveName: '精明淘货', passiveDesc: '每回合首次在黑市抽恶魔契约不消耗步数（0步），并保留每回合黑市免费刷新 1 次。', brief: '自带护盾 + 0步首进黑市免费重抽' },
    { id: 'raider', num: '02', name: '突袭者', arch: 'assassin', archName: '刺客', hp: 1, pants: 0.5, maxPants: 1, knives: 1, atkMult: 1.5, activeMax: 1, activeCost: 1, activeName: '量子隐身', activeDesc: '耗1步进入隐身且不立刻行动；下回合他人可在自身位置宣告预判攻击；全员走完后你从白名单揭晓暗步并结算预判。', passiveName: '刃锋分伤', passiveDesc: '开局自带 1 刀、1.5x 伤害；同地点有 ≥2 名 0 裤合法目标时，1 步即可将本次攻击总额按 0.5 自由分配给多个目标。', brief: '1.5x 攻 + 同房刃锋分伤 + 量子隐身' },
    { id: 'storm', num: '03', name: '风暴者', arch: 'control', archName: '控场', hp: 1.5, pants: 0.5, maxPants: 1.5, knives: 0, atkMult: 1, activeMax: 2, activeCost: 0, activeName: '乱流风暴', activeDesc: '远程将同层级的单人（免费，不耗步）或整个地点所有存活单位（耗 1 步）强制吹至同层其他非狱内地点，不触发带人（迷雾禁跨点）。', passiveName: '气压掌控', passiveDesc: '吹飞单人不消耗常规步数，可无缝衔接击杀或拆伙。', brief: '免费吹单人 / 1步吹全地点' },
    { id: 'tough', num: '04', name: '坚韧者', arch: 'survival', archName: '生存', hp: 4, pants: 1, maxPants: 2, knives: 0, atkMult: 1, activeMax: 0, activeCost: 0, activeName: '无主动技', activeDesc: '以绝对血量压制全场，无主动技（黑市过载改为获得护盾）。', passiveName: '钢铁躯体', passiveDesc: '初始拥有全场最高的 3 命，容错率冠绝全场。', brief: '3 命肉盾，硬抗致命斩杀' },
    { id: 'chili', num: '05', name: '辛红辣椒', arch: 'control', archName: '控场', hp: 1.5, pants: 1, maxPants: 1.5, knives: 0, atkMult: 1, activeMax: 1, activeCost: 1, activeName: '电击麻痹', activeDesc: '耗1步远程电击任意1名存活玩家（迷雾禁跨点），使其下回合无论获得多少步都无法行动（1次）。', passiveName: '高压电弧', passiveDesc: '关键回合一击封锁核心敌人的全部节奏。', brief: '1次强力远程电击麻痹' },
    { id: 'watcher', num: '06', name: '监视者', arch: 'control', archName: '控场', hp: 1.5, pants: 1, maxPants: 2, knives: 0, atkMult: 1, activeMax: 2, activeCost: 1, activeName: '远程抓捕', activeDesc: '耗1步随时随地（含狱内，迷雾禁跨点）对任意存活玩家发起三局两胜逮捕猜拳，败者入狱。', passiveName: '全境法眼', passiveDesc: '不受警局位置限制，狱内亦可反手拉人陪葬。', brief: '全图远程三局两胜逮捕入狱' },
    { id: 'aquaman', num: '07', name: '海王', arch: 'survival', archName: '生存', hp: 1.5, pants: 1, maxPants: 2, knives: 0, atkMult: 1, activeMax: 2, activeCost: 1, activeName: '深海潜行', activeDesc: '耗1步并消耗1次技能，随时随地（含狱内，被结界封锁时除外）单人直接潜入海洋层任意可达地点。', passiveName: '深海亲和', passiveDesc: '在海洋层永久免疫缺氧（无需青蛙面罩，天空层仍正常计算缺氧）；从海洋上岸固定回到码头。', brief: '海洋永久免缺氧 + 2次随时潜海' },
    { id: 'piggy', num: '08', name: '小猪', arch: 'trick', archName: '诡计', hp: 2, pants: 0, maxPants: 0, knives: 0, atkMult: 1, activeMax: 1, activeCost: 0, activeName: '顺手牵刀', activeDesc: '开启后，在你攻击（「咔」/利刃突进）同地点目标时免费抢走对方 1 把刀（1次）。', passiveName: '天生猪脸', passiveDesc: '1.5 命面板 + 开局自带独立 SQ3 猪脸（不占龙宫且死亡不掉落，地府重生生成全新猪脸实例需重捏）。', brief: '1.5命 + 天生猪脸 + 顺手牵刀' },
    { id: 'ninja', num: '09', name: '忍者', arch: 'assassin', archName: '刺客', hp: 1.5, pants: 0, maxPants: 0, knives: 0, atkMult: 1, activeMax: 2, activeCost: 0, activeName: '瞬身连撞', activeDesc: '斩杀任意单位后，可消耗1次技能免费向距离1的另1单位突进撞击（1伤，先扣裤，0裤扣命）；撞死可连撞！', passiveName: '弹刃·利刃', passiveDesc: '自带独立 SQ2 利刃（享常驻小刀判定，0普通刀亦可直接「咔」与突进扣血）；开局及每次复活后处于未弹刃态，首次发动任何攻击前须先耗 1 步「⚡ 弹刃」解锁（本条命永久生效）。', brief: '先弹刃解锁 + 0刀利刃绝杀 + 斩杀连撞' },
    { id: 'puppeteer', num: '10', name: '操偶师', arch: 'control', archName: '控场', hp: 1.5, pants: 0.5, maxPants: 1, knives: 0, atkMult: 1, activeMax: 2, activeCost: 1, activeName: '提线木偶', activeDesc: '耗1步强控同层级1名存活玩家（迷雾禁跨点），令其立刻执行1次基础动作（单人移动 / 穿裤 / 拔刀 / 同地点扒裤）。', passiveName: '丝线操纵', passiveDesc: '可借敌之手扒裤、把敌人拉出掩体或送进绝境。', brief: '远程强控同层目标执行动作' },
    { id: 'parasite', num: '11', name: '寄生者', arch: 'assassin', archName: '刺客', hp: 1.5, pants: 0.5, maxPants: 1, knives: 0, atkMult: 1, activeMax: 2, activeCost: 1, activeName: '寄生', activeDesc: '同地点耗1步附身目标，免费随行并共享氧气/面罩；宿主花1步扒裤甩开寄生者时，宿主自身也扣 0.5 裤；附身态可 0 步免费破体而出。', passiveName: '破体奇袭', passiveDesc: '破体而出不消耗步数，且破体「咔」额外 +0.5 伤。', brief: '0步破体 +0.5伤 + 甩开反扣宿主裤' },
    { id: 'mirror', num: '12', name: '镜像师', arch: 'trick', archName: '诡计', hp: 1.5, pants: 1, maxPants: 1.5, knives: 0, atkMult: 1, activeMax: 2, activeCost: 1, activeName: '盗版', activeDesc: '耗1步复刻并立刻释放本局上一个被使用的主动技（含海王潜海、收尸人封魂/烧尸等；无先例则 +1 刀 +0.5 裤）。', passiveName: '无限反射', passiveDesc: '以彼之道还施彼身，根据战局动态复制最强控制或爆发。', brief: '复制本局上一个主动技即时释放' },
    { id: 'reverser', num: '13', name: '逆转者', arch: 'trick', archName: '诡计', hp: 1.5, pants: 0.5, maxPants: 1.5, knives: 0, atkMult: 1, activeMax: 0, activeCost: 0, activeName: '无主动技', activeDesc: '越输越强，一朝翻盘打出多步连击终结战场。', passiveName: '蓄势逆转', passiveDesc: '每输 1 轮猜拳存 1 层「势」（上限 2）；赢拳引爆全部势额外加步；但主猜拳每出现 1 次平局，立刻扣除 1 层势。', brief: '输拳攒势爆发 · 平局扣1势' },
    { id: 'barrier', num: '14', name: '结界师', arch: 'control', archName: '控场', hp: 1.5, pants: 0.5, maxPants: 1.5, knives: 0, atkMult: 1, activeMax: 2, activeCost: 1, activeName: '绝对领域', activeDesc: '耗1步远程封锁任意非狱内地点直至下回合末，内外彻底隔绝（无视水遁、云梯、风暴与进出移动）。', passiveName: '空间锁死', passiveDesc: '可将关键地点变作孤岛，瓮中捉鳖或锁死海空缺氧者。', brief: '远程绝对封锁地点至下回合末' },
    { id: 'curser', num: '15', name: '诅咒师', arch: 'trick', archName: '诡计', hp: 1.5, pants: 1, maxPants: 1.5, knives: 0, atkMult: 1, activeMax: 2, activeCost: 1, activeName: '命运链接', activeDesc: '耗1步远程绑定任意 2 名存活玩家持续 2 回合（迷雾禁跨点），期间一方扣裤或扣血时另一方同步承受同等代价。', passiveName: '血咒共振', passiveDesc: '强行制造双人共死困局，令肉盾与通缉犯无处可逃。', brief: '绑定 2 人共担扣裤与伤害 2 回合' },
    { id: 'undertaker', num: '16', name: '收尸人', arch: 'survival', archName: '生存', hp: 1.5, pants: 1, maxPants: 1.5, knives: 0, atkMult: 1, activeMax: 2, activeCost: 1, activeName: '封魂', activeDesc: '耗1步远程销毁 1 名地府待复活者的复活资格并回 +0.5 命，或远程销毁场上任意 1 具尸体并回 +0.5 命。', passiveName: '敛尸成刃', passiveDesc: '场上有玩家阵亡自动 +1 刀；且每持有 2 把刀，「咔」伤害 +0.5（上限 +1.0）。', brief: '封魂/烧尸回血 + 每2刀增伤+0.5' }
  ];

  // v2.5 平衡：除突袭者外全员基础血量 -0.5；坚韧者固定 3 命
  ROLES.forEach((r) => {
    if (r.id === 'raider') return;
    if (r.id === 'tough') { r.hp = 3; return; }
    r.hp = Math.max(0.5, roundHalf(r.hp - 0.5));
  });

  const ROLE_MAP = Object.fromEntries(ROLES.map((r) => [r.id, r]));

  // 地图逻辑棋盘尺寸（与 style.css 中 .map-scene-3d 的宽高保持一致）
  const BOARD_W = 1460;
  const BOARD_H = 560;

  const STATIC_NODES = [
    { id: 'sky_stable', name: '马厩', layer: 'sky', x: 13, y: 18, kind: 'stable', collapsible: true, desc: '天空层：耗 1 步天马空降陆地任意非狱内非结界点，落地免费扒 1 名目标 1 裤（无目标则免费 +1🔪）。' },
    { id: 'sky_wish', name: '许愿池', layer: 'sky', x: 47, y: 14, kind: 'wish', collapsible: true, desc: '天空层：个人累计投入 2 步发动自利神迹（含神赐重整/抽干氧源/全图缴械/复活/换位/入狱）。' },
    { id: 'sky_observatory', name: '天象台', layer: 'sky', x: 81, y: 18, kind: 'observatory', collapsible: true, desc: '天空层：耗 1 步改写下回合天象（血月 / 迷雾 / 雷暴），施法者独享下回合主场特权！' },

    { id: 'land_police', name: '警察局', layer: 'land', x: 13, y: 44, kind: 'police', collapsible: true, desc: '1步远程三局两胜逮捕（迷雾禁跨点）；1步搬尸回 +0.5 HP；1步自首入狱。' },
    { id: 'land_prison_out', name: '监狱外', layer: 'land', x: 31, y: 44, kind: 'prison_out', collapsible: true, desc: '常驻无限刷新 NPC 典狱长（3裤1命），击杀后狱内全员立刻释放！' },
    { id: 'land_prison_in', name: '监狱内', layer: 'land', x: 49, y: 40, kind: 'prison_in', collapsible: false, desc: '与外界物理隔离。可直接扒/咔典狱长自行越狱，或等待外界劫狱、海王水遁逃生。' },
    { id: 'land_underworld', name: '地府', layer: 'land', x: 81, y: 44, kind: 'underworld', collapsible: true, desc: '普通陆地地点（活人可堵门），也是阵亡者赢拳复活后的出生之地。' },

    { id: 'land_dock', name: '码头', layer: 'land', x: 11, y: 70, kind: 'dock', collapsible: true, desc: '耗 1 步下海前往水族馆、遗迹或龙宫。' },
    { id: 'land_blackmarket', name: '黑市', layer: 'land', x: 36, y: 70, kind: 'blackmarket', collapsible: true, desc: '耗 1 步（普通人每回合首次 0 步）不猜拳，随机抽取 3 份恶魔契约择一签下。' },

    { id: 'ocean_aquarium', name: '水族馆', layer: 'ocean', x: 63, y: 64, kind: 'aquarium', collapsible: true, desc: '耗 1 步佩戴青蛙面罩（永久水下呼吸，代价：裤清零且上限永久 0，HP 变为 0.5）。' },
    { id: 'ocean_ruins', name: '遗迹', layer: 'ocean', x: 77, y: 72, kind: 'ruins', collapsible: true, desc: '受击享 50% 闪避；耗 1 步挖掘（25% 裤上限→10；75% 保底 +0.5 裤上限至 4，已 ≥4 则 +0.5 裤）。' },
    { id: 'ocean_palace', name: '龙宫', layer: 'ocean', x: 91, y: 64, kind: 'palace', collapsible: true, desc: '全服共享进度锻造 8 件唯一神器（大刀/利刃/猪脸/云梯/吸铁石/钩爪/沙漏/铁裤）。' }
  ];

  // 8 个「家」在陆地层最下方排成一行迷你卡，避免抢占主要地点版面
  const HOME_SLOTS = [
    { x: 7, y: 86 }, { x: 19.7, y: 86 }, { x: 32.4, y: 86 }, { x: 45.1, y: 86 },
    { x: 57.8, y: 86 }, { x: 70.5, y: 86 }, { x: 83.2, y: 86 }, { x: 95.9, y: 86 }
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
      weatherTurnsLeft: 0,
      weatherOwnerId: null,
      nextWeather: null,
      nextWeatherOwnerId: null,
      nextCollapseNodeId: null,
      config: { ...DEFAULT_CONFIG },
      lobbyPlayers: [],
      players: [],
      nodes: {},
      warden: { hp: 1, pants: 3, maxPants: 3, respawnCount: 0 },
      artifacts: createInitialArtifacts(),
      lastActiveSkill: null,
      links: [],
      rps: null,
      initiative: null,
      subRps: null,
      turnQueue: [],
      turnFeed: [],
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
    mobileLobbyTab: 'room',
    unreadLogCount: 0,
    lastLogCount: 0,
    focusLayer: 'all',
    pulsingNodes: new Map(),
    confirmArm: null,
    logDrawerOpen: false,
    focusNodeId: null,
    novice: true,
    hudMenuOpen: false,
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
  function notifyPlayer(playerId, msg, level = 'warn') { Net.sendToastTo(playerId, msg, level); }
  function isVisibleAlive(p) { return Boolean(p && p.status === 'alive' && !p.stealth?.active); }

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

  // ------------------------------------------------------------------
  // 地图战况记录：把每一条战报「钉」在对应的地点卡与角色身上，
  // 这样玩家不需要滚动日志，只要看地图就能知道谁做了什么、结果如何。
  // ------------------------------------------------------------------
  function pushNodeEvent(nodeId, ev) {
    const node = state.nodes[nodeId];
    if (!node) return;
    if (!Array.isArray(node.history)) node.history = [];
    const last = node.history[node.history.length - 1];
    if (last && last.turn === ev.turn && last.text === ev.text && last.order === ev.order) return;
    node.history.push(ev);
    if (node.history.length > 6) node.history.splice(0, node.history.length - 6);
    node.historySeq = (node.historySeq || 0) + 1;
    if (ev.actorId) node.lastActorId = ev.actorId;
    node.lastEventTurn = ev.turn;
  }

  // 从一条战报里推断它应该记在哪些地点卡上
  function deriveEventNodeIds(text, meta) {
    const set = new Set();
    const m = meta || {};
    if (m.locId) set.add(m.locId);
    const actor = m.actorId ? getPlayer(m.actorId) : null;
    if (actor && actor.location) set.add(actor.location);
    (m.targetIds || []).forEach((tid) => {
      const t = getPlayer(tid);
      if (t && t.location) set.add(t.location);
    });
    if (set.size === 0) {
      // 文本里带【地点名】的战报按地点名归属
      Object.values(state.nodes).forEach((n) => {
        if (n && n.name && text.includes(`【${n.name}】`)) set.add(n.id);
      });
    }
    if (set.size === 0) {
      // 兜底：文本里提到的角色所在地点
      state.players.forEach((p) => {
        if (p && p.name && p.location && text.includes(p.name)) set.add(p.location);
      });
    }
    return Array.from(set).filter((id) => Boolean(state.nodes[id])).slice(0, 4);
  }

  // ①②③… 行动顺位序号
  const CIRCLED = ['', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
  function orderMark(n) {
    const i = Number(n) || 0;
    return CIRCLED[i] || (i > 0 ? `#${i}` : '·');
  }

  // 本回合动作序列：谁先动、动了谁、什么结果 —— 地图上方的序列条只显示这些短词
  function recordTurnFeed(p) {
    if (!p || !p.actor || !isHostAuthority()) return;
    const ap = state.players.find((x) => x.name === p.actor);
    const tp = p.target ? state.players.find((x) => x.name === p.target) : null;
    const orderNum = Number(String(p.order || '').replace(/[^0-9]/g, '')) || 0;
    state.turnFeed.push({
      id: uid('tf'),
      turn: state.turn,
      order: orderNum,
      actorId: ap ? ap.id : null,
      actor: String(p.actor),
      verb: String(p.action || ''),
      target: String(p.target || ''),
      result: String(p.result || ''),
      nodeId: ap ? ap.location : null,
      targetNodeId: tp ? tp.location : null
    });
    if (state.turnFeed.length > 12) state.turnFeed.shift();
  }

  // 把战报压成地图用的短语：去掉前缀符号与重复人名
  function shortBattleText(text, actorName) {
    let s = String(text == null ? '' : text).trim();
    s = s.replace(/^[\s\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}✊✋✌❤👖🔪☠💥⚡🔥🐷🐸🌠⛏🔱🔭🚔🚑⛓🕶★🎯🧲🪝➤⏭⏳💨✋✦★☆]+/u, '');
    s = s.replace(/\s+/g, ' ').trim();
    if (actorName && s.startsWith(actorName)) s = s.slice(actorName.length).trim();
    return s;
  }

  function addLog(text, kind = 'normal', meta = null) {    const m = meta || {};
    state.logs.push({
      id: uid('log'),
      turn: state.turn,
      text,
      kind,
      actorId: m.actorId || null,
      targetIds: Array.isArray(m.targetIds) ? m.targetIds : [],
      locId: m.locId || null,
      isMoveToLoc: Boolean(m.isMoveToLoc)
    });
    if (state.logs.length > 140) state.logs.splice(0, state.logs.length - 140);
    try {
      const qi = Array.isArray(state.turnQueue) && m.actorId
        ? state.turnQueue.findIndex((e) => e.playerId === m.actorId) + 1
        : 0;
      const ev = {
        id: uid('ev'),
        turn: state.turn,
        order: qi > 0 ? qi : 0,
        kind,
        actorId: m.actorId || null,
        text,
        phase: state.phase
      };
      deriveEventNodeIds(text, m).forEach((nid) => pushNodeEvent(nid, ev));
      if (m.actorId) {
        const ap = getPlayer(m.actorId);
        if (ap) {
          ap.lastAct = { turn: state.turn, text, order: ev.order, kind };
          ap.lastActSeq = (ap.lastActSeq || 0) + 1;
        }
      }
    } catch (_) { /* 地图记录失败不应影响对局 */ }
  }

  function triggerNodePulse(nodeId) {
    if (!nodeId) return;
    const expireAt = Date.now() + 3000;
    localUI.pulsingNodes.set(nodeId, expireAt);
    const el = document.querySelector(`.map-node[data-node-id="${CSS.escape(String(nodeId))}"]`);
    if (el) el.classList.add('is-recent-pulse');
    window.setTimeout(() => {
      if ((localUI.pulsingNodes.get(nodeId) || 0) <= Date.now()) {
        localUI.pulsingNodes.delete(nodeId);
        const curEl = document.querySelector(`.map-node[data-node-id="${CSS.escape(String(nodeId))}"]`);
        if (curEl) curEl.classList.remove('is-recent-pulse');
      }
    }, 3050);
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
    if (state.recentFx.length > 36) state.recentFx.splice(0, state.recentFx.length - 36);
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
      case 'tacticalFeed': {
        vfx.tacticalFeed(p);
        recordTurnFeed(p);
        // 动作落到地图上：行动者所在地点砸出动词，跨地点互动拉一条箭头
        const ap = state.players.find((x) => x.name === p.actor);
        const tp = p.target ? state.players.find((x) => x.name === p.target) : null;
        if (ap && p.action) {
          vfx.verbSlam?.({
            nodeId: ap.location,
            verb: p.action,
            targetNodeId: tp && tp.location !== ap.location ? tp.location : null,
            hot: Boolean(p.highlight) || /咔|斩|突进|扒/.test(p.action)
          });
          if (tp && tp.location !== ap.location) triggerNodePulse(tp.location);
        }
        break;
      }
      case 'nodePulse': triggerNodePulse(p.nodeId); break;
      case 'slash': vfx.slash(p); if (p.nodeId) triggerNodePulse(p.nodeId); break;
      case 'electricArc': vfx.electricArc(p); if (p.toNodeId) triggerNodePulse(p.toNodeId); break;
      case 'float': vfx.floatOnNode(p.nodeId, p.text, p.kind); break;
      case 'ripple': vfx.rippleOnNode(p.nodeId, p.color, p.rings); if (p.nodeId) triggerNodePulse(p.nodeId); break;
      case 'rpsClash': vfx.rpsClash(p); break;
      case 'sfx': vfx.sfx(p.name); break;
      case 'mood': vfx.setMood(p.mood); break;
      case 'weather': vfx.setWeather(p.weather, state.weather === 'fog' && state.weatherOwnerId === state.selfId); break;
      case 'toast': vfx.toast(p.msg, p.level, p.durationMs); break;
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
      bountyArtifacts: clamp(Number(g('cfg-bounty-artifacts')?.value) || 2, 1, 8),
      bountyKills: clamp(Number(g('cfg-bounty-kills')?.value) || 2, 1, 6),
      oxygenMax: clamp(Number(g('cfg-oxygen-max')?.value) || 5, 3, 10),
      aiDelayMs: clamp(Number(g('cfg-ai-delay')?.value) || 1600, 400, 3500),
      vfxEnabled: g('opt-vfx') ? g('opt-vfx').checked : true
    };
  }

  // 新手模式：只影响提示与解说，不动规则
  function syncNovice() {
    document.body.dataset.novice = localUI.novice ? '1' : '0';
    const chk = document.getElementById('opt-novice');
    if (chk) chk.checked = Boolean(localUI.novice);
    const btn = document.getElementById('btn-toggle-novice-ingame');
    if (btn) {
      btn.setAttribute('aria-pressed', String(localUI.novice));
      const lbl = btn.querySelector('.btn-label');
      if (lbl) lbl.textContent = localUI.novice ? '新手模式：开' : '新手模式：关';
    }
  }

  function setNovice(v) {
    localUI.novice = Boolean(v);
    try { window.localStorage.setItem('lk_novice', localUI.novice ? '1' : '0'); } catch (_) {}
    syncNovice();
    if (state.started) UI.renderAll();
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
    syncNovice();
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
      if (msg.type === 'TOAST') { window.VFX?.toast(msg.msg || '', msg.level || 'info'); return; }
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
          window.VFX?.setWeather(state.weather, state.weather === 'fog' && state.weatherOwnerId === state.selfId);
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

    function sendToastTo(playerId, msg, level = 'warn') {
      if (!msg) return;
      if (playerId === state.selfId) {
        window.VFX?.toast(msg, level);
        return;
      }
      if (state.mode !== 'host') return;
      const target = getPlayer(playerId) || state.lobbyPlayers.find((p) => p.id === playerId);
      if (!target || target.isAI || !target.peerId) return;
      const conn = clientConns.get(target.peerId);
      if (conn && conn.open) {
        try { conn.send({ type: 'TOAST', msg, level }); } catch (_) {}
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

    function setLobbySeatRole(seatId, roleId) {
      if (!isHostAuthority() || state.started || !ROLE_MAP[roleId]) return;
      const seat = state.lobbyPlayers.find((p) => p.id === seatId);
      if (!seat) return;
      seat.roleId = roleId;
      broadcastState();
      UI.renderLobby?.();
    }

    function syncSoloAiCount(targetTotal) {
      if (!isHostAuthority() || state.started) return;
      const target = clamp(Number(targetTotal) || 4, 2, 8);
      while (state.lobbyPlayers.length < target) {
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
      while (state.lobbyPlayers.length > target) {
        let idx = -1;
        for (let i = state.lobbyPlayers.length - 1; i >= 0; i--) {
          if (state.lobbyPlayers[i].isAI) { idx = i; break; }
        }
        if (idx === -1) break;
        state.lobbyPlayers.splice(idx, 1);
      }
      broadcastState();
      UI.renderLobby?.();
    }

    return { createRoom, joinRoom, startSolo, teardownPeer, broadcastState, sendToastTo, sendRoleSelect, sendIntent, sendChat, sendEmoji, applyHostConfig, copyInviteLink, addLobbyAi, removeLobbySeat, setLobbySeatRole, syncSoloAiCount };
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
      nodes[n.id] = { ...n, collapsed: false, barrierUntilTurn: 0, droppedArtifacts: [], corpses: [], history: [], historySeq: 0 };
    });
    players.forEach((p, idx) => {
      const slot = HOME_SLOTS[idx % HOME_SLOTS.length];
      const homeId = `home_${p.id}`;
      nodes[homeId] = {
        id: homeId, name: `${p.name}的家`, layer: 'land', x: slot.x, y: slot.y,
        kind: 'home', ownerId: p.id, collapsible: false, collapsed: false,
        barrierUntilTurn: 0, droppedArtifacts: [], corpses: [], history: [], historySeq: 0,
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

  // 是否拥有可用的 SQ2 利刃作为常驻小刀判定（忍者需先完成弹刃）
  function hasUsableBlade(player) {
    if (!player || !hasSQ(player, 'SQ2')) return false;
    if (player.roleId === 'ninja' && !player.bladeReady) return false;
    return true;
  }

  // 是否具备执行「咔」/扣血斩击的武器条件（持有普通小刀 OR 拥有可用 SQ2 利刃）
  function canStabWithWeapon(player) {
    if (!player) return false;
    return (player.knives || 0) >= 1 || hasUsableBlade(player);
  }

  // 是否具有持刀威慑力（防 0 刀强带）
  function hasCarryDeterrence(player) {
    if (!player) return false;
    return (player.knives || 0) >= 1 || hasUsableBlade(player);
  }

  // v2.5：小刀不再消耗，仅作为「有武器即可咔」的持械条件；利刃同理常驻
  function consumeStabWeapon(player) {
    if (!player) return 'none';
    if ((player.knives || 0) >= 1) return 'knife';
    if (hasUsableBlade(player)) return 'blade';
    return 'none';
  }

  function countPalaceArtifacts(player) {
    return ALL_SQ_IDS.filter((id) => state.artifacts[id]?.ownerId === player.id).length;
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

  function isFogBlockedFor(actor) {
    return state.weather === 'fog' && state.weatherOwnerId !== actor?.id;
  }

  function isStormImmune(actor) {
    return state.weather === 'storm' && state.weatherOwnerId === actor?.id;
  }

  function isOceanOxygenImmune(player) {
    if (!player) return false;
    if (player.roleId === 'aquaman') return true;
    return hasEffectiveFrogMask(player);
  }

  function isHypoxic(player) {
    if (!player || player.status !== 'alive') return false;
    const node = getNode(player.location);
    if (!node || node.layer === 'land') return false;
    if (node.layer === 'ocean' && isOceanOxygenImmune(player)) return false;
    return player.oxygenTurns >= Math.max(1, state.config.oxygenMax - 2);
  }

  function getZeroPantsTargetsAt(actor, nodeId) {
    const out = [];
    const node = getNode(nodeId);
    getAlivePlayersAt(nodeId, actor.id).forEach((p) => {
      if (p.pants <= 0 && !needsPinchPigFace(actor, p)) {
        out.push({ id: p.id, name: p.name, hp: p.hp, isWarden: false, player: p });
      }
    });
    if (canAttackWardenFrom(node) && state.warden.pants <= 0) {
      out.push({ id: 'NPC_WARDEN', name: 'NPC 典狱长', hp: state.warden.hp, isWarden: true, player: null });
    }
    return out;
  }

  function getReachableMoveNodes(player, opts = {}) {
    const cur = getNode(player.location);
    if (!cur || isBarrierActive(cur.id)) return [];

    const allNodes = Object.values(state.nodes).filter(
      (n) => n.id !== cur.id && !n.collapsed && n.kind !== 'prison_in' && !isBarrierActive(n.id)
    );

    if (cur.kind === 'prison_in') {
      return [];
    }

    const result = new Map();
    const add = (n) => result.set(n.id, n);

    if (cur.layer === 'land') {
      allNodes.filter((n) => n.layer === 'land').forEach(add);
      if (cur.kind === 'dock') {
        allNodes.filter((n) => n.layer === 'ocean').forEach(add);
      }
      if (player.ascendCharged || (hasSQ(player, 'SQ4') && !opts.ignoreSQ4)) {
        allNodes.filter((n) => n.layer === 'sky').forEach(add);
      }
    } else if (cur.layer === 'ocean') {
      allNodes.filter((n) => n.layer === 'ocean').forEach(add);
      const dock = state.nodes.land_dock;
      if (dock && !dock.collapsed) {
        if (!isBarrierActive(dock.id)) add(dock);
      } else {
        allNodes.filter((n) => n.layer === 'land').forEach(add);
      }
      if (hasSQ(player, 'SQ4') && !opts.ignoreSQ4) {
        allNodes.filter((n) => n.layer === 'sky').forEach(add);
      }
    } else if (cur.layer === 'sky') {
      allNodes.filter((n) => n.layer === 'sky').forEach(add);
      const stableNode = state.nodes.sky_stable;
      const stableBlocked = !stableNode || stableNode.collapsed || isBarrierActive(stableNode.id);
      if (cur.kind === 'stable' || stableBlocked || (hasSQ(player, 'SQ4') && !opts.ignoreSQ4)) {
        const dropPool = (hasSQ(player, 'SQ4') && !opts.ignoreSQ4) ? allNodes : allNodes.filter((n) => n.layer === 'land');
        dropPool.forEach(add);
      }
    }

    return Array.from(result.values());
  }

  function getAlivePlayersAt(nodeId, excludeId = null, { includeStealth = false } = {}) {
    return state.players.filter((p) =>
      p.status === 'alive' && p.location === nodeId && p.id !== excludeId && (includeStealth || !p.stealth?.active)
    );
  }

  function syncParasites(host, prevLayer = null) {
    state.players.forEach((p) => {
      if (p.status === 'alive' && p.parasiteHostId === host.id) {
        p.location = host.location;
        const node = getNode(host.location);
        if (node && node.layer === 'land') {
          p.oxygenTurns = 0;
          p.enteredNonLandTurn = 0;
        } else if (prevLayer === 'land') {
          p.oxygenTurns = 0;
          p.enteredNonLandTurn = state.turn;
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
    syncParasites(player, prevLayer);

    const carriedNames = [];
    carryIds.forEach((cid) => {
      const t = getPlayer(cid);
      if (t && isVisibleAlive(t) && t.id !== player.id && t.location === prevNode?.id) {
        if (t.parasiteHostId) return;
        t.location = destId;
        if (destNode.layer === 'land') {
          t.oxygenTurns = 0;
          t.enteredNonLandTurn = 0;
        } else if (prevLayer === 'land') {
          t.oxygenTurns = 0;
          t.enteredNonLandTurn = state.turn;
        }
        syncParasites(t, prevLayer);
        carriedNames.push(t.name);
      }
    });

    if (!silent) {
      const carryStr = carriedNames.length ? `（强行带走 ${carriedNames.join('、')}）` : '';
      addLog(`➤ ${player.name} 移动至【${destNode.name}】${carryStr}`, 'normal', { actorId: player.id, targetIds: carryIds, locId: destId, isMoveToLoc: true });
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
    let effAmount = amount;
    if (hasSQ(target, 'SQ8') && reason !== '过载代价') {
      effAmount = Math.min(effAmount, 0.5);
    }
    const before = target.pants;
    target.pants = Math.max(0, roundHalf(target.pants - effAmount));
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

  function isUnderworldCollapsed() {
    return Boolean(state.nodes.land_underworld && state.nodes.land_underworld.collapsed);
  }

  function getSafeReviveNodeId(player) {
    if (state.nodes.land_underworld && !state.nodes.land_underworld.collapsed) return 'land_underworld';
    if (player?.homeId && state.nodes[player.homeId] && !state.nodes[player.homeId].collapsed) return player.homeId;
    const anyLand = Object.values(state.nodes).find((n) => n.layer === 'land' && !n.collapsed && n.kind !== 'prison_in');
    if (anyLand) return anyLand.id;
    const anyOpen = Object.values(state.nodes).find((n) => !n.collapsed && n.kind !== 'prison_in');
    return anyOpen ? anyOpen.id : 'land_underworld';
  }

  function handlePlayerDeath(victim, killer, reason) {
    if (!victim || victim.status !== 'alive') return;
    victim.hp = 0;
    victim.pants = 0;
    victim.knives = 0;
    victim.bomb = null;
    victim.stealth = null;
    victim.paralyzed = false;
    victim.savedSteps = 0;

    const deathNodeId = victim.location;
    const deathNode = getNode(deathNodeId);

    ejectParasitesFrom(victim, '阵亡');
    victim.parasiteHostId = null;

    const dropped = [];
    ALL_SQ_IDS.forEach((sqId) => {
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

  function revivePlayerAtUnderworld(p, { viaWish = false, remainingSteps = 0 } = {}) {
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
    p.paralyzedNextTurn = false;
    p.guaranteedStepNextTurn = false;
    p.savedSteps = 0;
    p.stealth = null;
    p.parasiteHostId = null;
    p.wanted = false;
    p.ascendCharged = false;
    p.bladeReady = p.roleId !== 'ninja';
    p.blackMarketFreeTurn = 0;

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
      p.momentum = 0;
      p.shield = p.roleId === 'normal' ? 1 : 0;
      p.wishSteps = 0;
      p.piggyStealArmed = false;
      p.pigFaceGen += 1;
      p.pinchedFaces = [];
      p.reviveUsed = true;
    }

    const stepNote = viaWish ? '（许愿召回）' : `（消耗1步${remainingSteps > 0 ? `，余+${remainingSteps}步` : ''}）`;
    addLog(`🔥 ${p.name} 在【${getNode(spawnId)?.name || '地府'}】复活${stepNote}`, 'system');
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
      state.weatherTurnsLeft = 0;
      state.weatherOwnerId = null;
      state.nextWeather = null;
      state.nextWeatherOwnerId = null;
      state.nextCollapseNodeId = null;
      state.winnerId = null;
      state.winnerReason = '';
      state.lastActiveSkill = null;
      state.links = [];
      state.logs = [];
      state.pendingAction = null;
      state.stealthRevealQueue = [];
      state.subRps = null;
      state.initiative = null;
      state.turnFeed = [];
      state.fxSeq = 0;
      state.recentFx = [];
      localUI.lastFxSeqPlayed = 0;
      localUI.subPanelState = null;
      localUI.unreadLogCount = 0;
      localUI.lastLogCount = 0;

      state.warden = { hp: 1, pants: 3, maxPants: 3, respawnCount: 0 };
      state.artifacts = createInitialArtifacts();

      state.players = state.lobbyPlayers.map((lp) => {
        const role = ROLE_MAP[lp.roleId] || ROLE_MAP.normal;
        return {
          id: lp.id, name: lp.name, roleId: role.id,
          isHost: lp.isHost, isAI: lp.isAI, connected: lp.connected, peerId: lp.peerId,
          status: 'alive',
          hp: role.hp, pants: role.pants, maxPants: role.maxPants, knives: role.knives,
          atkMult: role.atkMult, activeCharges: role.activeMax,
          steps: 0, deferredSteps: 0, savedSteps: 0, momentum: 0, shield: role.id === 'normal' ? 1 : 0,
          pigFaceGen: 1, pinchedFaces: [], wishSteps: 0,
          ascendCharged: false, bladeReady: role.id !== 'ninja',
          oxygenTurns: 0, enteredNonLandTurn: 0, breathedThisTurn: false,
          oxygenTank: true, antiSuffocate: 0, frogMask: false,
          paralyzed: false, paralyzedNextTurn: false, guaranteedStepNextTurn: false,
          blackMarketRerollTurn: 0, blackMarketFreeTurn: 0, piggyStealArmed: false,
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
      // 安全不变式：清理错过复活回合或地府已坍塌导致不可复活的 pending_revive
      state.players.forEach((p) => {
        if (p.status === 'pending_revive' && (p.reviveEligibleTurn < state.turn || isUnderworldCollapsed())) {
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
      state.turnFeed = [];
      state.activePlayerId = null;

      if (state.nextWeather) {
        state.weather = state.nextWeather;
        state.weatherOwnerId = state.nextWeatherOwnerId;
        state.weatherTurnsLeft = 2;
        state.nextWeather = null;
        state.nextWeatherOwnerId = null;
      } else if (state.weather !== 'clear' && state.weatherTurnsLeft > 1) {
        state.weatherTurnsLeft -= 1;
      } else {
        state.weather = 'clear';
        state.weatherTurnsLeft = 0;
        state.weatherOwnerId = null;
      }
      emitFx('weather', { weather: state.weather });

      if (state.weather !== 'clear') {
        const wMeta = WEATHERS[state.weather];
        const wOwner = state.weatherOwnerId ? getPlayer(state.weatherOwnerId) : null;
        const ownerNote = wOwner && wOwner.status === 'alive' ? `（主宰：${wOwner.name} · 剩${state.weatherTurnsLeft}回合）` : `（剩${state.weatherTurnsLeft}回合）`;
        addLog(`🌌 天象【${wMeta.name}】${ownerNote}：${wMeta.desc}`, 'system');
        emitFx('banner', { kicker: 'WEATHER SHIFT // 天象降临', title: `${wMeta.name}${ownerNote}`, sub: wMeta.desc, mood: wMeta.mood, durationMs: 2400 });

        if (wOwner && wOwner.status === 'alive') {
          if (state.weather === 'bloodmoon') {
            wOwner.knives += 1;
            addLog(`🩸 天象主宰 ${wOwner.name} 血月加持，自动 +1🔪！`, 'skill');
            emitFx('float', { nodeId: wOwner.location, text: '血月主宰 +1🔪', kind: 'skill' });
          } else if (state.weather === 'storm') {
            const beforeP = wOwner.pants;
            wOwner.pants = Math.min(wOwner.maxPants, roundHalf(wOwner.pants + 0.5));
            const gP = roundHalf(wOwner.pants - beforeP);
            if (gP > 0) {
              addLog(`⛈ 天象主宰 ${wOwner.name} 雷暴加持，免疫禁穿裤且自动 +${gP}👖！`, 'skill');
              emitFx('float', { nodeId: wOwner.location, text: `雷暴主宰 +${gP}👖`, kind: 'heal' });
            }
          }
        }
      }

      state.links = state.links.filter((lk) => lk.expiresTurn >= state.turn);

      state.players.forEach((p) => {
        p.steps = 0;
        p.deferredSteps = 0;
        p.breathedThisTurn = false;
        p.paralyzed = Boolean(p.paralyzedNextTurn);
        p.paralyzedNextTurn = false;
        if (p.status === 'alive' && hasSQ(p, 'SQ8') && p.pants < 0.5) {
          p.pants = 0.5;
          addLog(`🛡 ${p.name} 【铁裤】自动生成 0.5👖`, 'skill');
        }
        if (p.status === 'alive' && p.paralyzed) {
          addLog(`⚡ ${p.name} 麻痹，本回合跳过`, 'skill');
        }
      });

      syncMoodFromState();

      const allowRevive = !isUnderworldCollapsed();
      const participants = state.players
        .filter((p) => p.status === 'alive' || (allowRevive && p.status === 'pending_revive' && p.reviveEligibleTurn === state.turn))
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
        if (p?.status === 'pending_revive') {
          const rem = Math.max(0, losersCount - 1);
          tag = outcome === 'win' ? (rem > 0 ? `复活 +${rem}步` : '复活(耗1步)') : outcome === 'lose' ? '彻底死透' : '重猜';
        }
        return { name: p?.name || '特工', hand: h, outcome, tag };
      });

      if (isDraw) {
        addLog(`🤝 猜拳平局：${state.rps.participants.map((id) => getPlayer(id)?.name || '特工').join('、')} 同时出拳未分胜负 → 立刻重猜`, 'system', { actorId: null });
        state.players.forEach((p) => {
          if (p.status === 'alive' && p.roleId === 'reverser' && p.momentum > 0) {
            p.momentum -= 1;
            addLog(`🌀 猜拳平局！逆转者 ${p.name} 失去 1 层「势」（剩 ${p.momentum}/2）`, 'skill', { targetIds: [p.id] });
            emitFx('float', { nodeId: p.location, text: `平局 -1势 (${p.momentum}/2)`, kind: 'pants' });
          }
        });
      } else {
        const winNames = winners.map((id) => getPlayer(id)?.name).join('、');
        addLog(`✊ 猜拳：${winNames} 胜（各+${losersCount}步）`, 'system');
      }

      // 平局：极速闪一帧「平局」提示后立刻重猜，绝不插长播报拖手
      emitFx('rpsClash', {
        kicker: isDraw ? `TURN ${state.turn} // DRAW` : `TURN ${state.turn} // SHOWDOWN`,
        title: isDraw ? '平局 · 立刻重猜！' : `${winners.map((id) => getPlayer(id)?.name).join('、')} 胜出！`,
        subtitle: isDraw ? '同步出拳 · 无分胜负 · 下一轮出拳！' : `击败 ${losersCount} 人 · 胜者各获 +${losersCount}步`,
        entries,
        quick: isDraw,
        durationMs: isDraw ? 520 : 1750
      });
      if (isDraw) {
        emitFx('tacticalFeed', { actor: '全员', action: '猜拳平局', result: '极速重猜 · 无需等待播报', highlight: true });
      }

      Net.broadcastState();
      UI.renderAll();

      // 平局用最短间隔（约 0.55 秒）重开下一轮猜拳
      scheduleHostTask(() => {
        if (isDraw) Engine.startMainRps(state.rps.participants, state.rps.round + 1);
        else Engine.finalizeMainRps(winners, losersCount);
      }, isDraw ? 560 : 1800);
    },

    finalizeMainRps(winnerIds, baseSteps = 1) {
      const winnerSet = new Set(winnerIds);
      const actingWinners = [];
      const revivedThisTurn = new Set();

      state.rps.participants.forEach((pid) => {
        const p = getPlayer(pid);
        if (!p || p.status !== 'pending_revive') return;
        if (isUnderworldCollapsed()) {
          p.reviveUsed = true;
          p.status = 'dead_final';
          addLog(`☠【地府】已坍塌不可复活，${p.name} 死透`, 'kill');
          return;
        }
        if (winnerSet.has(pid)) {
          const rem = Math.max(0, baseSteps - 1);
          revivePlayerAtUnderworld(p, { viaWish: false, remainingSteps: rem });
          revivedThisTurn.add(p.id);
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
          let steps = revivedThisTurn.has(p.id) ? Math.max(0, baseSteps - 1) : baseSteps;
          if (!revivedThisTurn.has(p.id) && p.roleId === 'reverser' && p.momentum > 0) {
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

        if (p.savedSteps > 0) {
          p.steps += p.savedSteps;
          addLog(`⏳ ${p.name} 释放【沙漏】储存 +${p.savedSteps}步`, 'skill');
          emitFx('float', { nodeId: p.location, text: `沙漏 +${p.savedSteps}步`, kind: 'skill' });
          p.savedSteps = 0;
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

      // 解释权争夺同样按「平局极速、分出胜负短暂」的节奏推进
      emitFx('rpsClash', {
        kicker: isDraw ? 'INITIATIVE // DRAW' : 'INITIATIVE // 解释权争夺',
        title: isDraw ? '解释权平局 · 立刻重猜！' : `${winners.map((id) => getPlayer(id)?.name).join('、')} 胜出！`,
        subtitle: isDraw ? '下一轮出拳！' : winners.length === 1 ? '夺得第一解释权，即将自选行动顺位' : '胜者继续角逐唯一第一名',
        entries: state.initiative.contenders.map((id) => ({
          name: getPlayer(id)?.name || '特工',
          hand: state.initiative.choices[id],
          outcome: isDraw ? 'draw' : winners.includes(id) ? 'win' : 'lose',
          tag: isDraw ? 'DRAW' : winners.includes(id) ? '晋级' : '顺位递推'
        })),
        quick: isDraw,
        durationMs: isDraw ? 500 : 1500
      });

      Net.broadcastState();
      UI.renderAll();

      scheduleHostTask(() => {
        if (isDraw) Engine.startInitiativeRps(state.initiative.contenders, state.initiative.allWinners, state.initiative.round + 1);
        else if (winners.length > 1) Engine.startInitiativeRps(winners, state.initiative.allWinners, state.initiative.round + 1);
        else Engine.enterInitiativeSlotPick(winners[0], state.initiative.allWinners);
      }, isDraw ? 540 : 1560);
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
        if (state.weather === 'storm' && cur?.layer === 'land' && !isStormImmune(raider)) {
          notifyPlayer(raider.id, '雷暴天象下陆地禁穿裤！', 'warn');
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
        if (!hasEffectiveOxygenTank(raider) && !(cur.layer === 'ocean' && hasEffectiveFrogMask(raider))) {
          notifyPlayer(raider.id, '氧气瓶已损坏或被抢，无法暗中呼吸！', 'danger');
          return;
        }
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
        const isStabPred = pred.mode === 'stab';
        let stabDmg = 0;
        let usedKind = 'none';
        if (isStabPred) {
          if (!canStabWithWeapon(attacker)) {
            addLog(`💨 ${attacker.name} 手中无刀且无可用利刃，预判斩击失效！`, 'normal');
            return;
          }
          stabDmg = Engine.calcStabDamage(attacker);
          usedKind = consumeStabWeapon(attacker);
        }
        const costTag = usedKind === 'knife' ? '刀' : '利刃';
        if (pred.loc === raider.location) {
          if (pred.mode === 'strip') {
            const lost = applyPantsLoss(raider, hasSQ(attacker, 'SQ1') ? 2 : 1, '预判扒裤');
            addLog(`🎯 预判命中！${attacker.name} 在【${getNode(pred.loc)?.name}】截胡扒掉 ${raider.name} ${lost} 裤！`, 'kill', { actorId: attacker.id, targetIds: [raider.id] });
          } else if (raider.pants <= 0) {
            const pRes = applyHpDamage(raider, stabDmg, attacker, { canDodge: true, reason: `被 ${attacker.name} 预判斩杀` });
            if (pRes.dodged) {
              addLog(`🎯 ${attacker.name} 预判位置命中（${costTag}），但 ${raider.name} 触发遗迹闪避 MISS！`, 'skill', { actorId: attacker.id, targetIds: [raider.id] });
            } else if (pRes.blocked) {
              addLog(`🎯 ${attacker.name} 预判位置命中（${costTag}），但被 ${raider.name} 的护盾抵消！`, 'skill', { actorId: attacker.id, targetIds: [raider.id] });
            } else {
              const hitWord = pRes.killed ? '预判绝杀命中' : '预判重创命中';
              const remStr = pRes.killed ? '' : `，剩余 ${raider.hp}❤️`;
              addLog(`🎯 ${hitWord}！${attacker.name} (${costTag})在【${getNode(pred.loc)?.name}】斩中现身的 ${raider.name}（-${stabDmg}❤️${remStr}）！`, 'kill', { actorId: attacker.id, targetIds: [raider.id] });
            }
          } else {
            addLog(`🎯 ${attacker.name} 预判位置命中（${costTag}），但 ${raider.name} 有裤子护体未能「咔」中！`, 'skill', { actorId: attacker.id, targetIds: [raider.id] });
            emitFx('float', { nodeId: raider.location, text: '有裤免疫!', kind: 'info' });
          }
        } else {
          addLog(`💨 预判扑空！${attacker.name} 在【${getNode(pred.loc)?.name}】挥空${isStabPred ? `（${costTag}）` : ''}！`, 'normal');
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

    calcStabDamage(attacker, opts = {}) {
      let dmg = 1 * (attacker.atkMult || 1);
      if (attacker.roleId === 'undertaker') {
        dmg += Math.min(1.0, Math.floor((attacker.knives || 0) / 2) * 0.5);
      }
      if (hasSQ(attacker, 'SQ1')) dmg *= 2;
      if (state.weather === 'bloodmoon') dmg += 0.5;
      if (opts.parasiteBurstBonus) dmg += 0.5;
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
          notifyPlayer(actor.id, `目标【${target.name}】戴着猪脸！必须先同地点花 1 步捏脸！`, 'warn');
          return true;
        }
        return false;
      };

      const checkFogRemoteBlock = (targetLocId, label) => {
        if (isFogBlockedFor(actor) && targetLocId && targetLocId !== actor.location) {
          notifyPlayer(actor.id, `迷雾天象遮蔽视野，无法跨地点远程使用【${label}】！`, 'warn');
          return true;
        }
        return false;
      };

      if (act === 'pass_bomb') {
        if (!actor.bomb) return;
        const target = getPlayer(intent.targetId);
        if (!isVisibleAlive(target) || target.location !== actor.location || target.id === actor.id) return;
        if (checkPigFaceBlock(target)) return;
        target.bomb = { turnsLeft: actor.bomb.turnsLeft };
        actor.bomb = null;
        addLog(`💣 ${actor.name} 贴脸将人体炸弹（剩 ${target.bomb.turnsLeft} 回合）过继给了 ${target.name}！`, 'kill', { actorId: actor.id, targetIds: [target.id] });
        emitFx('bannerAction', { order: orderTag, actor: actor.name, action: '炸弹过继', target: target.name, result: `剩余 ${target.bomb.turnsLeft} 回合`, mood: 'p5r', highlight: true });
        emitFx('float', { nodeId: target.location, text: '💣 接雷!', kind: 'dmg' });
        emitFx('nodePulse', { nodeId: target.location });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'pass') {
        if (hasSQ(actor, 'SQ7') && actor.steps > 0) {
          actor.savedSteps = 1;
          actor.steps = 0;
          addLog(`⏳ ${actor.name} 用【沙漏】储存 +1步 至下回合`, 'skill', { actorId: actor.id });
          emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '沙漏存步', result: '储存 +1步 至下回合' });
          emitFx('float', { nodeId: actor.location, text: '⏳ 存1步', kind: 'skill' });
        } else {
          actor.steps = 0;
          addLog(`⏭ ${actor.name} 结束行动`, 'muted', { actorId: actor.id });
          emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '结束行动', result: '本回合待机' });
        }
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'blade_draw') {
        if (actor.steps < 1 || actor.roleId !== 'ninja' || actor.bladeReady) return;
        actor.steps -= 1;
        actor.bladeReady = true;
        addLog(`⚡ 忍者 ${actor.name} 发动【弹刃】解锁攻击态（本条命永久生效）！`, 'skill', { actorId: actor.id });
        emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '弹刃', result: '攻击态已解锁！' });
        emitFx('float', { nodeId: actor.location, text: '⚡ 弹刃就绪!', kind: 'skill' });
        emitFx('nodePulse', { nodeId: actor.location });
        emitFx('sfx', { name: 'knife' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'charge_ascend') {
        if (actor.steps < 1 || !curNode || curNode.layer !== 'land' || curNode.kind === 'prison_in' || actor.ascendCharged || actor.parasiteHostId) return;
        actor.steps -= 1;
        actor.ascendCharged = true;
        addLog(`☁ ${actor.name} 完成【升天蓄力】，本条命永久解锁陆地 1 步直飞天空！`, 'skill', { actorId: actor.id });
        emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '升天蓄力', result: '解锁陆地直飞天空' });
        emitFx('float', { nodeId: actor.location, text: '☁ 升天已蓄力', kind: 'skill' });
        emitFx('nodePulse', { nodeId: actor.location });
        emitFx('sfx', { name: 'skill' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'move') {
        if (actor.steps < 1) return;
        if (actor.parasiteHostId) { notifyPlayer(actor.id, '寄生附身态无法普通移动，请使用「破体而出」', 'warn'); return; }
        const destNode = getNode(intent.destId);
        if (!destNode || !getReachableMoveNodes(actor).some((n) => n.id === intent.destId)) {
          notifyPlayer(actor.id, '目标地点不可直达或被结界封锁', 'warn');
          return;
        }
        const rawCarry = Array.isArray(intent.carryIds) ? intent.carryIds.filter(Boolean) : [];
        if (rawCarry.length > 1) {
          notifyPlayer(actor.id, '单次移动最多只能强带 1 名同地点玩家！', 'warn');
          return;
        }
        for (const cid of rawCarry) {
          const ct = getPlayer(cid);
          if (!ct || !isVisibleAlive(ct) || ct.location !== actor.location || ct.id === actor.id || ct.parasiteHostId) continue;
          if (checkPigFaceBlock(ct)) return;
          // v2.5：取消「持刀威慑」，强带不再受目标是否持刀影响
        }

        const isStableDrop = curNode?.kind === 'stable' && destNode.layer === 'land';
        actor.steps -= 1;
        movePlayerTo(actor, intent.destId, { carryIds: rawCarry });

        const stableBonusText = isStableDrop ? Engine.triggerStableDropBonus(actor, destNode, intent.stableTargetId) : '';

        const moveRes = stableBonusText || (rawCarry.length ? `强带 ${getPlayer(rawCarry[0])?.name || '1人'}` : '抵达目标地点');
        emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: isStableDrop ? '天马空降' : '移动', target: `【${destNode.name}】`, result: moveRes });
        emitFx('nodePulse', { nodeId: destNode.id });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'wear_pants') {
        if (actor.steps < 1) return;
        if (state.weather === 'storm' && curNode?.layer === 'land' && !isStormImmune(actor)) {
          notifyPlayer(actor.id, '雷暴天象下陆地禁止穿裤！', 'warn');
          return;
        }
        if (actor.pants >= actor.maxPants) { notifyPlayer(actor.id, '裤子已达上限', 'warn'); return; }
        actor.steps -= 1;
        const before = actor.pants;
        actor.pants = Math.min(actor.maxPants, roundHalf(actor.pants + 1));
        const gain = roundHalf(actor.pants - before);
        addLog(`👖 ${actor.name} 穿裤 +${gain}👖 (${actor.pants}/${actor.maxPants})`, 'normal', { actorId: actor.id });
        emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '穿裤', result: `+${gain}👖 (${actor.pants}/${actor.maxPants})` });
        emitFx('float', { nodeId: actor.location, text: `+${gain}👖`, kind: 'heal' });
        emitFx('nodePulse', { nodeId: actor.location });
        emitFx('sfx', { name: 'click' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'draw_knife') {
        if (actor.steps < 1) return;
        actor.steps -= 1;
        actor.knives += 1;
        addLog(`🔪 ${actor.name} 拔刀 +1🔪 (共${actor.knives})`, 'normal', { actorId: actor.id });
        emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '拔刀', result: `+1🔪 (共${actor.knives}刀)` });
        emitFx('float', { nodeId: actor.location, text: '+1🔪', kind: 'info' });
        emitFx('nodePulse', { nodeId: actor.location });
        emitFx('sfx', { name: 'knife' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'steal_knife') {
        if (actor.steps < 1) return;
        const target = getPlayer(intent.targetId);
        if (!isVisibleAlive(target) || target.location !== actor.location || target.knives <= 0) return;
        if (checkPigFaceBlock(target)) return;
        actor.steps -= 1;
        target.knives -= 1;
        actor.knives += 1;
        addLog(`✋ ${actor.name} 贴脸抢走了 ${target.name} 的 1 把刀！`, 'normal', { actorId: actor.id, targetIds: [target.id] });
        emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '抢刀', target: target.name, result: '+1🔪' });
        emitFx('float', { nodeId: actor.location, text: '抢刀 +1🔪', kind: 'skill' });
        emitFx('nodePulse', { nodeId: actor.location });
        emitFx('sfx', { name: 'knife' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'steal_tank') {
        if (actor.steps < 1) return;
        const target = getPlayer(intent.targetId);
        if (!isVisibleAlive(target) || target.location !== actor.location || !target.oxygenTank) return;
        if (checkPigFaceBlock(target)) return;
        actor.steps -= 1;
        target.oxygenTank = false;
        actor.oxygenTank = true;
        addLog(`🫧 ${actor.name} 贴脸抢走了 ${target.name} 的氧气瓶！`, 'skill', { actorId: actor.id, targetIds: [target.id] });
        emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '抢氧气瓶', target: target.name, result: '夺取供氧设备' });
        emitFx('float', { nodeId: actor.location, text: '抢走氧气瓶!', kind: 'pants' });
        emitFx('nodePulse', { nodeId: actor.location });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'pinch_pigface') {
        if (actor.steps < 1) return;
        const target = getPlayer(intent.targetId);
        if (!isVisibleAlive(target) || target.location !== actor.location) return;
        const keys = getPigFaceInstances(target);
        if (keys.length === 0) return;
        actor.steps -= 1;
        keys.forEach((k) => { if (!actor.pinchedFaces.includes(k)) actor.pinchedFaces.push(k); });
        addLog(`🐷 ${actor.name} 贴脸捏了 ${target.name} 的猪脸，解除互动限制！`, 'skill', { actorId: actor.id, targetIds: [target.id] });
        emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '捏猪脸', target: target.name, result: '解除猪脸限制' });
        emitFx('float', { nodeId: actor.location, text: '🐷 已捏脸!', kind: 'skill' });
        emitFx('nodePulse', { nodeId: actor.location });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'strip_pants') {
        if (actor.steps < 1) return;
        const power = hasSQ(actor, 'SQ1') ? 2 : 1;
        if (intent.targetId === 'NPC_WARDEN') {
          if (!canAttackWardenFrom(curNode)) return;
          if (state.warden.pants <= 0) { notifyPlayer(actor.id, '典狱长已 0 裤，持刀直接「咔」！', 'warn'); return; }
          actor.steps -= 1;
          const before = state.warden.pants;
          state.warden.pants = Math.max(0, roundHalf(state.warden.pants - power));
          const lost = roundHalf(before - state.warden.pants);
          addLog(`👖 ${actor.name} 扒掉典狱长 ${lost} 裤（剩余 ${state.warden.pants}）`, 'normal', { actorId: actor.id });
          emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '扒裤', target: 'NPC 典狱长', result: `-${lost}👖 (剩 ${state.warden.pants})` });
          emitFx('float', { nodeId: actor.location, text: `典狱长 -${lost}👖`, kind: 'pants' });
          emitFx('nodePulse', { nodeId: actor.location });
          emitFx('sfx', { name: 'pants' });
          Engine.finishCurrentActorIfDone(actor);
          return;
        }
        const target = getPlayer(intent.targetId);
        if (!isVisibleAlive(target) || target.location !== actor.location || target.id === actor.id) return;
        if (checkPigFaceBlock(target)) return;
        actor.steps -= 1;
        const lost = applyPantsLoss(target, power, '扒裤');
        addLog(`👖 ${actor.name} 扒 ${target.name} -${lost}👖 (剩${target.pants})`, 'normal', { actorId: actor.id, targetIds: [target.id] });
        emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: hasSQ(actor, 'SQ1') ? '大刀重扒' : '扒裤', target: target.name, result: `-${lost}👖（剩 ${target.pants}）` });
        emitFx('nodePulse', { nodeId: actor.location });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'stab') {
        if (actor.steps < 1) return;
        if (actor.roleId === 'ninja' && !actor.bladeReady) {
          notifyPlayer(actor.id, '忍者处于未弹刃状态！请先耗 1 步执行「⚡ 弹刃」解锁攻击！', 'warn');
          return;
        }
        if (!canStabWithWeapon(actor)) {
          notifyPlayer(actor.id, '没有普通刀也没有可用利刃，无法执行「咔」！', 'warn');
          return;
        }
        const totalDmg = Engine.calcStabDamage(actor);

        // 突袭者「刃锋分伤」分支
        if (actor.roleId === 'raider' && intent.splitAlloc && typeof intent.splitAlloc === 'object') {
          const eligible = getZeroPantsTargetsAt(actor, actor.location);
          if (eligible.length < 2) {
            notifyPlayer(actor.id, '同地点 0 裤合法目标不足 2 名，无法分伤', 'warn');
            return;
          }
          const eligibleMap = new Map(eligible.map((t) => [t.id, t]));
          const entries = [];
          let sum = 0;
          for (const [tid, rawAmt] of Object.entries(intent.splitAlloc)) {
            const amt = roundHalf(Number(rawAmt) || 0);
            if (amt <= 0) continue;
            if (!eligibleMap.has(tid)) { notifyPlayer(actor.id, '分伤包含无效目标', 'warn'); return; }
            entries.push({ info: eligibleMap.get(tid), amt });
            sum = roundHalf(sum + amt);
          }
          if (entries.length === 0 || sum !== totalDmg) {
            notifyPlayer(actor.id, `分伤总额必须恰好等于 ${totalDmg}！`, 'warn');
            return;
          }

          actor.steps -= 1;
          const wUsed = consumeStabWeapon(actor);
          const wTag = wUsed === 'knife' ? '刀' : '利刃';
          const summaryParts = [];
          const hitTargetIds = [];

          entries.forEach(({ info, amt }) => {
            if (info.isWarden) {
              Engine.damageWarden(actor, amt);
              summaryParts.push(`典狱长-${amt}❤️`);
            } else {
              const t = info.player;
              hitTargetIds.push(t.id);
              Engine.tryPiggyStealKnife(actor, t);
              const res = applyHpDamage(t, amt, actor, { canDodge: true, reason: `被突袭者 ${actor.name} 刃锋分伤斩杀` });
              summaryParts.push(`${t.name}${res.dodged ? 'MISS' : res.blocked ? '护盾' : `-${amt}❤️`}`);
            }
          });

          addLog(`⚔ 突袭者 ${actor.name} (${wTag})发动【刃锋分伤】(${totalDmg}伤)：${summaryParts.join(' / ')}`, 'kill', { actorId: actor.id, targetIds: hitTargetIds });
          emitFx('bannerAction', { order: orderTag, actor: actor.name, action: '刃锋分伤', target: `${entries.length}名目标`, result: summaryParts.join(' · '), mood: 'p5r', highlight: true });
          emitFx('nodePulse', { nodeId: actor.location });
          Engine.finishCurrentActorIfDone(actor);
          return;
        }

        if (intent.targetId === 'NPC_WARDEN') {
          if (!canAttackWardenFrom(curNode)) return;
          if (state.warden.pants > 0) { notifyPlayer(actor.id, '典狱长还有裤子，必须先扒至 0 裤才能「咔」！', 'warn'); return; }
          actor.steps -= 1;
          const wUsed = consumeStabWeapon(actor);
          const wTag = wUsed === 'knife' ? '刀' : '利刃';
          Engine.damageWarden(actor, totalDmg);
          emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: `咔！(${wTag})`, target: 'NPC 典狱长', result: `-${totalDmg}❤️`, highlight: true });
          emitFx('nodePulse', { nodeId: actor.location });
          Engine.finishCurrentActorIfDone(actor);
          return;
        }
        const target = getPlayer(intent.targetId);
        if (!isVisibleAlive(target) || target.location !== actor.location || target.id === actor.id) return;
        if (target.pants > 0) { notifyPlayer(actor.id, '目标还有裤子，必须先扒至 0 裤才能「咔」！', 'warn'); return; }
        if (checkPigFaceBlock(target)) return;

        actor.steps -= 1;
        const wUsed = consumeStabWeapon(actor);
        const wTag = wUsed === 'knife' ? '刀' : '利刃';
        Engine.tryPiggyStealKnife(actor, target);
        const res = applyHpDamage(target, totalDmg, actor, { canDodge: true, reason: `被 ${actor.name} 持刃「咔」死` });
        const hitVerb = res.killed ? '绝杀咔' : '重创咔';
        const bannerAct = res.killed ? '咔！绝杀斩击' : '咔！重创斩击';
        const remHpNote = res.killed ? '目标阵亡！' : `-${totalDmg}❤️ (剩 ${target.hp}❤️)`;
        addLog(res.dodged ? `🔪 ${actor.name} (${wTag})咔 ${target.name} → MISS` : res.blocked ? `🔪 ${actor.name} (${wTag})咔 ${target.name} → 被护盾挡下` : `🔪 ${actor.name} (${wTag})${hitVerb} ${target.name} -${totalDmg}❤️${res.killed ? '' : ` (剩${target.hp}❤️)`}`, 'kill', { actorId: actor.id, targetIds: [target.id] });
        emitFx('bannerAction', { order: orderTag, actor: actor.name, action: bannerAct, target: target.name, result: res.dodged ? `MISS! (${wTag})` : res.blocked ? `护盾抵消 (${wTag})` : remHpNote, mood: 'p5r', highlight: true });
        emitFx('nodePulse', { nodeId: actor.location });
        if (res.killed) Engine.maybeTriggerNinjaChain(actor);
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'sq2_dash') {
        if (actor.steps < 1 || !hasSQ(actor, 'SQ2') || actor.parasiteHostId) return;
        const destNode = getNode(intent.destId);
        if (!destNode || !getReachableMoveNodes(actor).some((n) => n.id === intent.destId)) return;

        let target = null;
        if (intent.targetId && intent.targetId !== 'NPC_WARDEN') {
          target = getPlayer(intent.targetId);
          if (!isVisibleAlive(target) || target.location !== intent.destId || target.id === actor.id) return;
          if (checkPigFaceBlock(target)) return;
        }

        const isAttacking = Boolean(target || (intent.targetId === 'NPC_WARDEN' && intent.destId === 'land_prison_out'));
        if (isAttacking && actor.roleId === 'ninja' && !actor.bladeReady) {
          notifyPlayer(actor.id, '忍者未弹刃！请先耗 1 步执行「⚡ 弹刃」再发动利刃攻击！', 'warn');
          return;
        }

        const isStableDrop = curNode?.kind === 'stable' && destNode.layer === 'land';
        const dmg = Engine.calcStabDamage(actor);
        actor.steps -= 1;

        movePlayerTo(actor, intent.destId, { carryIds: [], silent: true });
        emitFx('nodePulse', { nodeId: intent.destId });

        // 从马厩空降陆地时，先结算天马空降奖励（免费扒 1 人 1 裤；无目标则 +1 刀）
        const preferredStripId = intent.stableTargetId || (target ? target.id : null);
        const stableBonusText = isStableDrop ? Engine.triggerStableDropBonus(actor, destNode, preferredStripId) : '';
        const stablePrefix = stableBonusText ? `${stableBonusText} → ` : '';

        if (!isAttacking) {
          addLog(`⚡ ${actor.name} 【SQ2 利刃】突进至【${destNode.name}】`, 'normal', { actorId: actor.id, locId: intent.destId, isMoveToLoc: true });
          emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: isStableDrop ? '天马利刃空降' : '利刃突进', target: `【${destNode.name}】`, result: stableBonusText || '抵达目标点' });
        } else if (intent.targetId === 'NPC_WARDEN' && intent.destId === 'land_prison_out') {
          if (state.warden.pants > 0) {
            const pLost = Math.min(state.warden.pants, hasSQ(actor, 'SQ1') ? 2 : 1);
            state.warden.pants = roundHalf(state.warden.pants - pLost);
            addLog(`⚔ ${actor.name} 利刃突进斩掉典狱长 ${pLost} 裤！`, 'normal', { actorId: actor.id });
            emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '利刃突进', target: 'NPC 典狱长', result: `${stablePrefix}-${pLost}👖` });
          } else {
            const wUsed = consumeStabWeapon(actor);
            const wTag = wUsed === 'knife' ? '刀' : '利刃';
            addLog(`⚔ ${actor.name} (${wTag})利刃突进斩击典狱长！`, 'kill', { actorId: actor.id });
            Engine.damageWarden(actor, dmg);
            emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: `利刃突进(${wTag})`, target: 'NPC 典狱长', result: `${stablePrefix}-${dmg}❤️`, highlight: true });
          }
        } else if (target) {
          Engine.tryPiggyStealKnife(actor, target);
          if (target.pants > 0) {
            const lost = applyPantsLoss(target, hasSQ(actor, 'SQ1') ? 2 : 1, '利刃突进');
            addLog(`⚔ ${actor.name} 利刃突进至【${destNode.name}】划破 ${target.name} 裤子 (-${lost}👖)`, 'kill', { actorId: actor.id, targetIds: [target.id], locId: intent.destId, isMoveToLoc: true });
            emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: isStableDrop ? '天马利刃空降' : '利刃突进', target: target.name, result: `${stablePrefix}-${lost}👖`, highlight: true });
          } else {
            const wUsed = consumeStabWeapon(actor);
            const wTag = wUsed === 'knife' ? '刀' : '利刃';
            const res = applyHpDamage(target, dmg, actor, { canDodge: true, reason: `被 ${actor.name} 利刃突进斩杀` });
            const dashVerb = res.killed ? '利刃突进绝杀' : '利刃突进重创';
            const dashResText = res.dodged ? 'MISS' : res.blocked ? '护盾' : res.killed ? `-${dmg}❤️` : `-${dmg}❤️ · 剩${target.hp}❤️`;
            addLog(`⚔ ${actor.name} (${wTag})${dashVerb} ${target.name} (${dashResText})`, 'kill', { actorId: actor.id, targetIds: [target.id], locId: intent.destId, isMoveToLoc: true });
            emitFx('bannerAction', { order: orderTag, actor: actor.name, action: dashVerb, target: target.name, result: `${stablePrefix}${res.dodged ? `MISS! (${wTag})` : res.blocked ? '护盾抵消' : res.killed ? '瞬杀！' : `-${dmg}❤️ (剩 ${target.hp}❤️)`}`, mood: 'p5r', highlight: true });
            if (res.killed) Engine.maybeTriggerNinjaChain(actor);
          }
        }
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'sq5_magnet') {
        if (actor.steps < 1 || !hasSQ(actor, 'SQ5')) return;
        const target = getPlayer(intent.targetId);
        if (!isVisibleAlive(target) || target.id === actor.id || target.knives <= 0) return;
        if (checkFogRemoteBlock(target.location, 'SQ5 吸铁石')) return;
        if (actor.location !== target.location && (isBarrierActive(actor.location) || isBarrierActive(target.location))) {
          notifyPlayer(actor.id, '结界内外隔绝，吸铁石无法穿透！', 'warn');
          return;
        }
        if (checkPigFaceBlock(target)) return;
        actor.steps -= 1;
        target.knives -= 1;
        actor.knives += 1;
        addLog(`🧲 ${actor.name} 用【SQ5 吸铁石】隔空吸走 ${target.name} 1把刀 (+1🔪)`, 'skill', { actorId: actor.id, targetIds: [target.id] });
        emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '吸铁石缴械', target: target.name, result: '夺刀 +1🔪' });
        emitFx('float', { nodeId: target.location, text: '-1🔪 被吸走!', kind: 'pants' });
        emitFx('float', { nodeId: actor.location, text: '+1🔪', kind: 'skill' });
        emitFx('nodePulse', { nodeId: target.location });
        emitFx('sfx', { name: 'knife' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'sq6_hook') {
        if (actor.steps < 1 || !hasSQ(actor, 'SQ6') || actor.parasiteHostId) return;
        if (!curNode || curNode.kind === 'prison_in' || isBarrierActive(curNode.id)) {
          notifyPlayer(actor.id, '狱内或结界内无法使用钩爪！', 'warn');
          return;
        }
        const target = getPlayer(intent.targetId);
        if (!isVisibleAlive(target) || target.id === actor.id || target.location === actor.location) return;
        if (checkFogRemoteBlock(target.location, 'SQ6 钩爪')) return;
        if (target.location === 'land_prison_in' || isBarrierActive(target.location) || target.parasiteHostId) {
          notifyPlayer(actor.id, '目标在狱内、结界内或寄生中，无法钩抓！', 'warn');
          return;
        }
        if (checkPigFaceBlock(target)) return;
        actor.steps -= 1;
        movePlayerTo(target, actor.location, { carryIds: [], silent: true });
        addLog(`🪝 ${actor.name} 用【SQ6 钩爪】将 ${target.name} 跨层强拉至【${curNode.name}】`, 'kill', { actorId: actor.id, targetIds: [target.id], locId: actor.location });
        emitFx('bannerAction', { order: orderTag, actor: actor.name, action: '钩爪强拉', target: target.name, result: `拖入【${curNode.name}】`, mood: 'p5r', highlight: true });
        emitFx('ripple', { nodeId: actor.location, color: '#ffe600', rings: 2 });
        emitFx('sfx', { name: 'skill' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'breathe') {
        if (actor.steps < 1 || !curNode || curNode.layer === 'land') return;
        if (!hasEffectiveOxygenTank(actor) && !(curNode.layer === 'ocean' && isOceanOxygenImmune(actor))) {
          notifyPlayer(actor.id, '氧气瓶已损坏或被抢，无法在海空呼吸！', 'danger');
          return;
        }
        actor.steps -= 1;
        actor.oxygenTurns = 0;
        actor.breathedThisTurn = true;
        state.players.forEach((p) => {
          if (p.status === 'alive' && p.parasiteHostId === actor.id) {
            p.oxygenTurns = 0;
            p.breathedThisTurn = true;
          }
        });
        addLog(`💨 ${actor.name} 呼吸重置`, 'muted', { actorId: actor.id });
        emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '呼吸换气', target: `【${curNode.name}】`, result: '缺氧计数清零' });
        emitFx('float', { nodeId: actor.location, text: '呼吸重置!', kind: 'heal' });
        emitFx('nodePulse', { nodeId: actor.location });
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
        addLog(`✨ ${actor.name} 拾取了掉落的龙宫神器【${ARTIFACTS[sqId].name}】！`, 'system', { actorId: actor.id });
        emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '拾取神器', target: ARTIFACTS[sqId].name, result: ARTIFACTS[sqId].shortDesc, highlight: true });
        emitFx('float', { nodeId: actor.location, text: `获得 ${ARTIFACTS[sqId].short}!`, kind: 'skill' });
        emitFx('nodePulse', { nodeId: actor.location });
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
        const selfLost = applyPantsLoss(actor, 0.5, '甩开寄生');
        paras.forEach((p) => {
          p.parasiteHostId = null;
          addLog(`💨 ${actor.name} 扒裤甩开了寄生者 ${p.name}（宿主自身 -${selfLost}👖）！`, 'skill', { actorId: actor.id, targetIds: [p.id] });
          emitFx('float', { nodeId: actor.location, text: '甩开寄生!', kind: 'skill' });
        });
        emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '甩开寄生', result: `自身 -${selfLost}👖` });
        emitFx('nodePulse', { nodeId: actor.location });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'predict_raider') {
        if (actor.steps < 1) return;
        const raider = getPlayer(intent.targetId);
        if (!raider || raider.status !== 'alive' || !raider.stealth?.active || raider.stealth.turnUsed >= state.turn) return;
        if (checkPigFaceBlock(raider)) return;
        const mode = intent.mode === 'strip' ? 'strip' : 'stab';
        if (mode === 'stab' && !canStabWithWeapon(actor)) { notifyPlayer(actor.id, '预判「咔」需要持刀或可用利刃！', 'warn'); return; }
        actor.steps -= 1;
        raider.stealth.predictions.push({ predictorId: actor.id, loc: actor.location, mode });
        addLog(`🎯 ${actor.name} 在【${curNode?.name}】对隐身突袭者 ${raider.name} 宣告了预判${mode === 'stab' ? '斩击' : '扒裤'}！`, 'skill', { actorId: actor.id, targetIds: [raider.id] });
        emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '预判锁定', target: raider.name, result: `【${curNode?.name}】${mode === 'stab' ? '预判斩击' : '预判扒裤'}` });
        emitFx('float', { nodeId: actor.location, text: '🎯 预判锁定', kind: 'skill' });
        emitFx('nodePulse', { nodeId: actor.location });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'police_arrest') {
        if (actor.steps < 1 || curNode?.kind !== 'police') return;
        if (state.nodes.land_prison_out?.collapsed) { notifyPlayer(actor.id, '监狱已坍塌，无法逮捕入狱！', 'warn'); return; }
        const target = getPlayer(intent.targetId);
        if (!isVisibleAlive(target) || target.id === actor.id || target.location === 'land_prison_in') return;
        if (checkFogRemoteBlock(target.location, '警局远程逮捕')) return;
        if (actor.location !== target.location && (isBarrierActive(target.location) || isBarrierActive(actor.location))) { notifyPlayer(actor.id, '结界隔绝，无法逮捕！', 'warn'); return; }
        if (checkPigFaceBlock(target)) return;
        actor.steps -= 1;
        Engine.startArrestBo3(actor, target, '警局远程逮捕');
        return;
      }

      if (act === 'police_corpse') {
        if (actor.steps < 1 || curNode?.kind !== 'police') return;
        const holder = Object.values(state.nodes).find((n) => n.corpses.length > 0);
        if (!holder) { notifyPlayer(actor.id, '场上目前没有可搬运的尸体', 'warn'); return; }
        actor.steps -= 1;
        const corpse = holder.corpses.shift();
        actor.hp = roundHalf(actor.hp + 0.5);
        addLog(`🚑 ${actor.name} 在警察局搬运了 ${corpse.name} 的尸体，回复 +0.5 命！`, 'normal', { actorId: actor.id });
        emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '警局搬尸', target: corpse.name, result: '+0.5❤️' });
        emitFx('float', { nodeId: actor.location, text: '+0.5❤️', kind: 'heal' });
        emitFx('nodePulse', { nodeId: actor.location });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'police_surrender') {
        if (actor.steps < 1 || curNode?.kind !== 'police') return;
        if (state.nodes.land_prison_out?.collapsed) { notifyPlayer(actor.id, '监狱已坍塌，无法自首入狱！', 'warn'); return; }
        actor.steps -= 1;
        sendPlayerToJail(actor, '主动自首');
        emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '自首入狱', target: '【监狱内】', result: '主动收押' });
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
        addLog(`🐸 ${actor.name} 戴上青蛙面罩！获得永久水下呼吸，代价：裤上限永久 0，HP 变为 0.5！`, 'skill', { actorId: actor.id });
        emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '戴青蛙面罩', result: '永久水下呼吸 (0裤 / 0.5❤️)' });
        emitFx('float', { nodeId: actor.location, text: '🐸 青蛙面罩', kind: 'skill' });
        emitFx('nodePulse', { nodeId: actor.location });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'ruins_dig') {
        if (actor.steps < 1 || curNode?.kind !== 'ruins') return;
        actor.steps -= 1;
        if (Math.random() < 0.25) {
          actor.maxPants = 10;
          addLog(`🏛 奇迹降临！${actor.name} 在遗迹挖出古代神裤，裤子上限暴增至 10！`, 'system', { actorId: actor.id });
          emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '遗迹挖掘', result: '大奇迹！裤上限 → 10', highlight: true });
          emitFx('float', { nodeId: actor.location, text: '裤上限→10!', kind: 'heal' });
          emitFx('sfx', { name: 'rps_win' });
        } else if (actor.maxPants < 4) {
          const before = actor.maxPants;
          actor.maxPants = Math.min(4, roundHalf(actor.maxPants + 0.5));
          const gain = roundHalf(actor.maxPants - before);
          addLog(`⛏ ${actor.name} 【遗迹】挖掘保底：裤子上限永久 +${gain}👖（当前上限 ${actor.maxPants}）`, 'normal', { actorId: actor.id });
          emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '遗迹挖掘', result: `保底 +${gain}👖 上限 (→${actor.maxPants})` });
          emitFx('float', { nodeId: actor.location, text: `保底上限+${gain}👖`, kind: 'heal' });
        } else {
          const before = actor.pants;
          actor.pants = Math.min(actor.maxPants, roundHalf(actor.pants + 0.5));
          const gain = roundHalf(actor.pants - before);
          addLog(`⛏ ${actor.name} 【遗迹】挖掘保底：当前裤子 +${gain}👖 (${actor.pants}/${actor.maxPants})`, 'normal', { actorId: actor.id });
          emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '遗迹挖掘', result: `保底 +${gain}👖` });
          emitFx('float', { nodeId: actor.location, text: `保底+${gain}👖`, kind: 'heal' });
        }
        emitFx('nodePulse', { nodeId: actor.location });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'forge_artifact') {
        if (actor.steps < 1 || curNode?.kind !== 'palace') return;
        const sqId = intent.sqId;
        const art = state.artifacts[sqId];
        const meta = ARTIFACTS[sqId];
        if (!art || !meta || art.ownerId || art.droppedAt || art.destroyed) return;
        actor.steps -= 1;
        art.progress += 1;
        if (art.progress >= meta.stepsNeed) {
          art.ownerId = actor.id;
          if (sqId === 'SQ3') art.instanceId += 1;
          addLog(`👑 ${actor.name} 锻成【${meta.name}】`, 'system', { actorId: actor.id });
          emitFx('banner', { kicker: 'ARTIFACT FORGED // 龙宫神器出世', title: `${actor.name} 获得 ${meta.name}`, sub: meta.desc, mood: 'p5r', durationMs: 2400 });
          emitFx('sfx', { name: 'skill' });
          updateBountyStatus(actor);
        } else {
          addLog(`🔱 ${actor.name} 锻造【${meta.short}】${art.progress}/${meta.stepsNeed}`, 'normal', { actorId: actor.id });
          emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '锻造神器', target: meta.name, result: `进度 ${art.progress}/${meta.stepsNeed}` });
          emitFx('float', { nodeId: actor.location, text: `${meta.short} ${art.progress}/${meta.stepsNeed}`, kind: 'skill' });
        }
        emitFx('nodePulse', { nodeId: actor.location });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'wish_step') {
        if (actor.steps < 1 || curNode?.kind !== 'wish') return;
        actor.steps -= 1;
        actor.wishSteps += 1;
        if (actor.wishSteps >= 2) {
          actor.wishSteps = 0;
          state.pendingAction = { type: 'wish_pick', actorId: actor.id };
          addLog(`🌠 ${actor.name} 集齐 2 步许愿，正在向许愿池许下神迹！`, 'system', { actorId: actor.id });
          emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '许愿池达成', result: '正在选择神迹...', highlight: true });
          emitFx('sfx', { name: 'skill' });
        } else {
          addLog(`✨ ${actor.name} 向许愿池投币祈祷（个人进度 ${actor.wishSteps}/2）`, 'normal', { actorId: actor.id });
          emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '许愿祈祷', result: `进度 ${actor.wishSteps}/2` });
          emitFx('float', { nodeId: actor.location, text: `许愿 ${actor.wishSteps}/2`, kind: 'skill' });
        }
        emitFx('nodePulse', { nodeId: actor.location });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'set_weather') {
        if (actor.steps < 1 || curNode?.kind !== 'observatory') return;
        const w = intent.weather;
        if (!['bloodmoon', 'fog', 'storm'].includes(w)) return;
        actor.steps -= 1;
        state.nextWeather = w;
        state.nextWeatherOwnerId = actor.id;
        addLog(`🔭 ${actor.name} 在天象台改写星轨：下回合起【${WEATHERS[w].name}】生效并持续 2 回合（主宰特权生效）！`, 'system', { actorId: actor.id });
        emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '改写天象', target: `【${WEATHERS[w].name}】`, result: '下回合起持续 2 回合 · 独享主场', highlight: true });
        emitFx('float', { nodeId: actor.location, text: `下回合:${WEATHERS[w].name}`, kind: 'skill' });
        emitFx('nodePulse', { nodeId: actor.location });
        emitFx('sfx', { name: 'skill' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'blackmarket_draw') {
        if (curNode?.kind !== 'blackmarket') return;
        const isFreeNormal = actor.roleId === 'normal' && actor.blackMarketFreeTurn !== state.turn;
        if (!isFreeNormal && actor.steps < 1) return;
        if (isFreeNormal) actor.blackMarketFreeTurn = state.turn;
        else actor.steps -= 1;

        state.pendingAction = {
          type: 'blackmarket',
          actorId: actor.id,
          contracts: Engine.rollBlackMarketContracts(),
          canFreeReroll: actor.roleId === 'normal' && actor.blackMarketRerollTurn !== state.turn
        };
        addLog(`🕶 ${actor.name} ${isFreeNormal ? '（0步免费）' : ''}踏入黑市，掀开了 3 份恶魔契约...`, 'skill', { actorId: actor.id });
        emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '黑市抽契约', result: isFreeNormal ? '普通人 0 步白嫖' : '8 选 3 抉择中' });
        emitFx('nodePulse', { nodeId: actor.location });
        emitFx('sfx', { name: 'blackmarket' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (act === 'use_skill') {
        Engine.executeRoleSkill(actor, intent, orderTag, checkPigFaceBlock, null, checkFogRemoteBlock);
      }
    },

    executeRoleSkill(actor, intent, orderTag, checkPigFaceBlock, forcedRoleId = null, checkFogRemoteBlock = null) {
      const fogCheck = checkFogRemoteBlock || ((locId, label) => {
        if (isFogBlockedFor(actor) && locId && locId !== actor.location) {
          notifyPlayer(actor.id, `迷雾天象遮蔽视野，无法跨地点远程使用【${label}】！`, 'warn');
          return true;
        }
        return false;
      });

      // 破体而出：v2.4 改为 0 步免费！破体「咔」额外 +0.5 伤且仍消耗 1 把刀
      if (actor.parasiteHostId && intent.burstMode) {
        const host = getPlayer(actor.parasiteHostId);
        if (intent.burstMode === 'stab') {
          if (!canStabWithWeapon(actor)) { notifyPlayer(actor.id, '破体「咔」需要持有普通刀或可用利刃！', 'warn'); return; }
          if (!host || host.status !== 'alive' || host.pants > 0) { notifyPlayer(actor.id, '宿主仍有裤子，无法直接破体「咔」！', 'warn'); return; }
          const dmg = Engine.calcStabDamage(actor, { parasiteBurstBonus: true });
          actor.parasiteHostId = null;
          const wUsed = consumeStabWeapon(actor);
          const wTag = wUsed === 'knife' ? '刀' : '利刃';
          const res = applyHpDamage(host, dmg, actor, { canDodge: true, reason: `被 ${actor.name} 破体斩杀` });
          const burstAct = res.killed ? '破体绝杀(0步)' : '破体重创(0步)';
          const burstRes = res.dodged ? 'MISS!' : res.blocked ? '护盾抵消' : res.killed ? '宿主爆体阵亡！' : `-${dmg}❤️ (剩 ${host.hp}❤️)`;
          addLog(`💥 ${actor.name} 0步破体而出！(${wTag})免费「咔」宿主 ${host.name}（${res.dodged ? 'MISS' : res.blocked ? '护盾抵消' : `-${dmg}❤️${res.killed ? '' : ` · 剩${host.hp}❤️`}`}）！`, 'kill', { actorId: actor.id, targetIds: [host.id] });
          emitFx('bannerAction', { order: orderTag, actor: actor.name, action: burstAct, target: host.name, result: burstRes, mood: 'p5r', highlight: true });
        } else {
          actor.parasiteHostId = null;
          if (host && host.status === 'alive') {
            const lost = applyPantsLoss(host, hasSQ(actor, 'SQ1') ? 2 : 1, '破体扒裤');
            addLog(`💥 ${actor.name} 0步破体而出！免费扒掉宿主 ${host.name} ${lost} 裤！`, 'skill', { actorId: actor.id, targetIds: [host.id] });
            emitFx('bannerAction', { order: orderTag, actor: actor.name, action: '破体奇袭(0步)', target: host.name, result: `免费扒 -${lost}👖`, mood: 'p5r', highlight: true });
          }
        }
        emitFx('nodePulse', { nodeId: actor.location });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (isHypoxic(actor)) {
        notifyPlayer(actor.id, '缺氧状态下禁用角色主动技！', 'danger');
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
          addLog(`🪞 镜像师 ${actor.name} 发动【盗版】（场上尚无先例），转化为 +1 刀 +0.5 裤！`, 'skill', { actorId: actor.id });
          emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '盗版转化', result: '+1🔪 +0.5👖' });
          emitFx('float', { nodeId: actor.location, text: '+1🔪 +0.5👖', kind: 'skill' });
          emitFx('nodePulse', { nodeId: actor.location });
          emitFx('sfx', { name: 'skill' });
          Engine.finishCurrentActorIfDone(actor);
          return;
        }
        Engine.executeRoleSkill(actor, intent, orderTag, checkPigFaceBlock, state.lastActiveSkill.roleId, fogCheck);
        return;
      }

      const recordLastActive = (roleId, skillName) => {
        if (roleId !== 'mirror') state.lastActiveSkill = { roleId, skillName, casterId: actor.id };
      };

      if (skillRole === 'raider') {
        if (actor.steps < 1 || actor.activeCharges < 1) return;
        if (actor.steps > 1) {
          notifyPlayer(actor.id, `你还有 ${actor.steps} 步！请先用完多余步数，剩最后 1 步时再发动量子隐身`, 'warn');
          return;
        }
        actor.steps -= 1;
        actor.activeCharges -= 1;
        actor.stealth = { active: true, originLoc: actor.location, turnUsed: state.turn, predictions: [] };
        recordLastActive('raider', '量子隐身');
        addLog(`👤 ${actor.name} 发动【量子隐身】消失在观测之外！下回合全员走完后揭晓暗步！`, 'skill', { actorId: actor.id });
        emitFx('bannerAction', { order: orderTag, actor: actor.name, action: '量子隐身', result: '行踪加密 · 等待下回合揭晓', mood: 'p5r', highlight: true });
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
          if (fogCheck(srcNode.id, '乱流风暴')) return;
          victims = getAlivePlayersAt(srcNode.id);
        } else {
          const target = getPlayer(intent.targetId);
          if (!isVisibleAlive(target)) return;
          if (fogCheck(target.location, '乱流风暴')) return;
          const tNode = getNode(target.location);
          if (!tNode || tNode.layer !== destNode.layer || tNode.id === destNode.id || isBarrierActive(tNode.id)) return;
          if (checkPigFaceBlock(target)) return;
          victims = [target];
        }

        actor.steps -= costStep;
        actor.activeCharges -= 1;
        recordLastActive('storm', '乱流风暴');
        const blown = [];
        const blownIds = [];
        victims.forEach((v) => {
          if (isWholeNode && needsPinchPigFace(actor, v)) return;
          movePlayerTo(v, destNode.id, { carryIds: [], silent: true });
          blown.push(v.name);
          blownIds.push(v.id);
        });
        addLog(`🌪 ${actor.name} 发动【乱流风暴】将 ${blown.join('、') || '无人'} 吹至【${destNode.name}】！`, 'skill', { actorId: actor.id, targetIds: blownIds, locId: destNode.id });
        emitFx('bannerAction', { order: orderTag, actor: actor.name, action: '乱流风暴', target: destNode.name, result: `吹飞 ${blown.join('、') || '空地'}`, highlight: true });
        emitFx('ripple', { nodeId: destNode.id, color: '#00d4ff', rings: 3 });
        emitFx('sfx', { name: 'skill' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (skillRole === 'chili') {
        if (actor.steps < 1 || actor.activeCharges < 1) return;
        const target = getPlayer(intent.targetId);
        if (!isVisibleAlive(target) || target.id === actor.id) return;
        if (fogCheck(target.location, '电击麻痹')) return;
        if (actor.location !== target.location && (isBarrierActive(target.location) || isBarrierActive(actor.location))) {
          notifyPlayer(actor.id, '结界内外隔绝，电击无法穿透！', 'warn');
          return;
        }
        if (checkPigFaceBlock(target)) return;

        actor.steps -= 1;
        actor.activeCharges -= 1;
        target.paralyzedNextTurn = true;
        recordLastActive('chili', '电击麻痹');
        addLog(`⚡ ${actor.name} 电击 ${target.name} → 下回麻痹`, 'skill', { actorId: actor.id, targetIds: [target.id] });
        emitFx('electricArc', { fromNodeId: actor.location, toNodeId: target.location, durationMs: 520 });
        emitFx('float', { nodeId: target.location, text: '⚡ 下回合麻痹!', kind: 'skill' });
        emitFx('bannerAction', { order: orderTag, actor: actor.name, action: '电击麻痹', target: target.name, result: '下回合强制无法行动', mood: 'p5r', highlight: true });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (skillRole === 'watcher') {
        if (actor.steps < 1 || actor.activeCharges < 1) return;
        if (state.nodes.land_prison_out?.collapsed) { notifyPlayer(actor.id, '监狱已坍塌，无法抓捕入狱！', 'warn'); return; }
        const target = getPlayer(intent.targetId);
        if (!isVisibleAlive(target) || target.id === actor.id || target.location === 'land_prison_in') return;
        if (fogCheck(target.location, '远程抓捕')) return;
        if (isBarrierActive(target.location)) { notifyPlayer(actor.id, '目标处于结界保护中，无法抓捕！', 'warn'); return; }
        if (checkPigFaceBlock(target)) return;

        actor.steps -= 1;
        actor.activeCharges -= 1;
        recordLastActive('watcher', '远程抓捕');
        Engine.startArrestBo3(actor, target, '监视者远程抓捕');
        return;
      }

      if (skillRole === 'aquaman') {
        if (actor.steps < 1 || actor.activeCharges < 1) return;
        if (actor.parasiteHostId) { notifyPlayer(actor.id, '寄生附身态无法发动深海潜行！', 'warn'); return; }
        if (isBarrierActive(actor.location)) { notifyPlayer(actor.id, '当前地点被结界封锁，无法潜入海洋！', 'warn'); return; }
        const destNode = getNode(intent.nodeId);
        if (!destNode || destNode.collapsed || destNode.layer !== 'ocean' || destNode.id === actor.location || isBarrierActive(destNode.id)) {
          notifyPlayer(actor.id, '请选择有效的海洋层地点！', 'warn');
          return;
        }
        actor.steps -= 1;
        actor.activeCharges -= 1;
        recordLastActive('aquaman', '深海潜行');
        movePlayerTo(actor, destNode.id, { carryIds: [], silent: true });
        addLog(`🌊 ${actor.name} 发动【深海潜行】潜入【${destNode.name}】（余${actor.activeCharges}次）`, 'skill', { actorId: actor.id, locId: destNode.id, isMoveToLoc: true });
        emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '深海潜行', target: `【${destNode.name}】`, result: `直潜海洋（剩${actor.activeCharges}次）`, highlight: true });
        emitFx('ripple', { nodeId: destNode.id, color: '#00d4ff', rings: 2 });
        emitFx('sfx', { name: 'skill' });
        Engine.finishCurrentActorIfDone(actor);
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
        addLog(`🐷 ${actor.name} 蓄势【顺手牵刀】：下次攻击目标时将免费顺走对方 1 把刀！`, 'skill', { actorId: actor.id });
        emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '顺手牵刀', result: '下次攻击免费抢 1 刀' });
        emitFx('float', { nodeId: actor.location, text: '顺手牵刀就绪!', kind: 'skill' });
        emitFx('nodePulse', { nodeId: actor.location });
        emitFx('sfx', { name: 'knife' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (skillRole === 'ninja' && isMirrorCopy) {
        if (actor.steps < 1 || actor.activeCharges < 1) return;
        if (Engine.getNinjaChainTargets(actor).length === 0) {
          notifyPlayer(actor.id, '距离 1 内暂无可撞击目标！', 'warn');
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
        if (!isVisibleAlive(target) || target.id === actor.id) return;
        if (fogCheck(target.location, '提线木偶')) return;
        if (actor.location !== target.location && (isBarrierActive(target.location) || isBarrierActive(actor.location))) {
          notifyPlayer(actor.id, '结界内外隔绝，提线木偶无法操控！', 'warn');
          return;
        }
        const aNode = getNode(actor.location);
        const tNode = getNode(target.location);
        if (!aNode || !tNode || aNode.layer !== tNode.layer) { notifyPlayer(actor.id, '提线木偶只能操控同层级玩家！', 'warn'); return; }
        if (checkPigFaceBlock(target)) return;

        const cmd = intent.puppetAction;
        let resultText = '';
        if (cmd === 'move') {
          if (target.parasiteHostId) { notifyPlayer(actor.id, '目标正处于寄生附身态，无法强制移动！', 'warn'); return; }
          if (!getReachableMoveNodes(target).some((n) => n.id === intent.destId)) { notifyPlayer(actor.id, '木偶无法移动到该地点', 'warn'); return; }
          movePlayerTo(target, intent.destId, { carryIds: [], silent: true });
          resultText = `被迫移动至【${getNode(intent.destId)?.name}】`;
        } else if (cmd === 'wear_pants') {
          if (state.weather === 'storm' && tNode.layer === 'land' && !isStormImmune(target)) { notifyPlayer(actor.id, '雷暴陆地禁穿裤', 'warn'); return; }
          target.pants = Math.min(target.maxPants, roundHalf(target.pants + 1));
          resultText = `被迫穿裤（${target.pants}/${target.maxPants}）`;
        } else if (cmd === 'draw_knife') {
          target.knives += 1;
          resultText = `被迫拔刀（${target.knives}刀）`;
        } else if (cmd === 'strip_pants') {
          const subVictim = getPlayer(intent.stripVictimId);
          if (!subVictim || subVictim.status !== 'alive' || subVictim.location !== target.location || subVictim.id === target.id) return;
          if (needsPinchPigFace(target, subVictim)) { notifyPlayer(actor.id, `木偶尚未捏过 ${subVictim.name} 的猪脸！`, 'warn'); return; }
          const lost = applyPantsLoss(subVictim, hasSQ(target, 'SQ1') ? 2 : 1, '提线扒裤');
          resultText = `被迫扒掉 ${subVictim.name} ${lost} 裤`;
        } else {
          return;
        }

        actor.steps -= 1;
        actor.activeCharges -= 1;
        recordLastActive('puppeteer', '提线木偶');
        addLog(`🧵 ${actor.name} 发动【提线木偶】强控 ${target.name}：${resultText}！`, 'skill', { actorId: actor.id, targetIds: [target.id] });
        emitFx('bannerAction', { order: orderTag, actor: actor.name, action: '提线木偶', target: target.name, result: resultText, mood: 'p5r', highlight: true });
        emitFx('nodePulse', { nodeId: target.location });
        emitFx('sfx', { name: 'skill' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (skillRole === 'parasite') {
        if (actor.steps < 1 || actor.activeCharges < 1) return;
        const host = getPlayer(intent.targetId);
        if (!isVisibleAlive(host) || host.location !== actor.location || host.id === actor.id) return;
        if (host.parasiteHostId === actor.id) { notifyPlayer(actor.id, '对方正寄生在你体内，不能互相嵌套寄生！', 'warn'); return; }
        if (checkPigFaceBlock(host)) return;

        actor.steps -= 1;
        actor.activeCharges -= 1;
        actor.parasiteHostId = host.id;
        recordLastActive('parasite', '寄生');
        addLog(`🦠 ${actor.name} 发动【寄生】钻入 ${host.name} 体内，免费随行并共享氧气/面罩！`, 'skill', { actorId: actor.id, targetIds: [host.id] });
        emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '寄生附身', target: host.name, result: '共享随行与氧气' });
        emitFx('float', { nodeId: actor.location, text: `寄生→${host.name}`, kind: 'skill' });
        emitFx('nodePulse', { nodeId: actor.location });
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
        addLog(`🔮 ${actor.name} 展开【绝对领域】彻底封锁【${node.name}】至第 ${state.turn + 1} 回合末！`, 'skill', { actorId: actor.id, locId: node.id });
        emitFx('bannerAction', { order: orderTag, actor: actor.name, action: '绝对领域', target: node.name, result: `内外彻底隔绝至 T${state.turn + 1}`, mood: 'p5r', highlight: true });
        emitFx('ripple', { nodeId: node.id, color: '#b666ff', rings: 3 });
        emitFx('sfx', { name: 'skill' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (skillRole === 'curser') {
        if (actor.steps < 1 || actor.activeCharges < 1) return;
        const a = getPlayer(intent.targetAId);
        const b = getPlayer(intent.targetBId);
        if (!isVisibleAlive(a) || !isVisibleAlive(b) || a.id === b.id) return;
        if (fogCheck(a.location, '命运链接') || fogCheck(b.location, '命运链接')) return;
        if (checkPigFaceBlock(a) || checkPigFaceBlock(b)) return;

        actor.steps -= 1;
        actor.activeCharges -= 1;
        state.links.push({ id: uid('lnk'), aId: a.id, bId: b.id, expiresTurn: state.turn + 2 });
        recordLastActive('curser', '命运链接');
        addLog(`🩸 ${actor.name} 施放【命运链接】绑定 ${a.name} ⇄ ${b.name}（持续 2 回合，扣裤扣血同步承受）！`, 'skill', { actorId: actor.id, targetIds: [a.id, b.id] });
        emitFx('bannerAction', { order: orderTag, actor: actor.name, action: '命运链接', target: `${a.name} ⇄ ${b.name}`, result: '扣裤扣血同步共振 2 回合', mood: 'p5r', highlight: true });
        emitFx('sfx', { name: 'blackmarket' });
        Engine.finishCurrentActorIfDone(actor);
        return;
      }

      if (skillRole === 'undertaker') {
        if (actor.steps < 1 || actor.activeCharges < 1) return;
        if (intent.corpseNodeId) {
          const cNode = getNode(intent.corpseNodeId);
          if (!cNode || cNode.corpses.length === 0) { notifyPlayer(actor.id, '该地点暂无可销毁的尸体！', 'warn'); return; }
          actor.steps -= 1;
          actor.activeCharges -= 1;
          const corpse = cNode.corpses.shift();
          actor.hp = roundHalf(actor.hp + 0.5);
          recordLastActive('undertaker', '封魂');
          addLog(`⚰ ${actor.name} 发动【封魂·烧尸】远程销毁【${cNode.name}】的 ${corpse.name} 尸体，回复 +0.5❤️！`, 'skill', { actorId: actor.id });
          emitFx('tacticalFeed', { order: orderTag, actor: actor.name, action: '封魂·烧尸', target: corpse.name, result: '销毁尸体 · 自身 +0.5❤️', highlight: true });
          emitFx('float', { nodeId: actor.location, text: '+0.5❤️', kind: 'heal' });
          emitFx('nodePulse', { nodeId: cNode.id });
          emitFx('sfx', { name: 'blackmarket' });
          Engine.finishCurrentActorIfDone(actor);
          return;
        }
        const target = getPlayer(intent.targetId);
        if (!target || target.status !== 'pending_revive') return;

        actor.steps -= 1;
        actor.activeCharges -= 1;
        target.reviveUsed = true;
        target.status = 'dead_final';
        actor.hp = roundHalf(actor.hp + 0.5);
        recordLastActive('undertaker', '封魂');
        addLog(`⚰ ${actor.name} 发动【封魂】彻底捏碎 ${target.name} 的地府复活资格，并回复 +0.5 命！`, 'kill', { actorId: actor.id, targetIds: [target.id] });
        emitFx('bannerAction', { order: orderTag, actor: actor.name, action: '封魂灭魄', target: target.name, result: '复活资格销毁 · 自身 +0.5❤️', mood: 'p5r', highlight: true });
        emitFx('float', { nodeId: actor.location, text: '+0.5❤️', kind: 'heal' });
        emitFx('sfx', { name: 'blackmarket' });
        Engine.finishCurrentActorIfDone(actor);
      }
    },

    triggerStableDropBonus(actor, destNode, preferredTargetId = null) {
      if (!actor || !destNode || destNode.layer !== 'land') return '';
      const strippables = getAlivePlayersAt(destNode.id, actor.id).filter((t) => !needsPinchPigFace(actor, t) && t.pants > 0);
      if (strippables.length > 0) {
        const chosen = (preferredTargetId && strippables.find((t) => t.id === preferredTargetId)) || strippables[0];
        const lost = applyPantsLoss(chosen, 1, '天马空降');
        addLog(`🐎 ${actor.name} 【天马空降】落点奇袭，免费扒掉 ${chosen.name} ${lost}👖！`, 'skill', { actorId: actor.id, targetIds: [chosen.id], locId: destNode.id });
        emitFx('float', { nodeId: destNode.id, text: `🐎 空降 -${lost}👖`, kind: 'pants' });
        return `天马空降扒 ${chosen.name} -${lost}👖`;
      }
      actor.knives += 1;
      addLog(`🐎 ${actor.name} 【天马空降】落点无目标，免费获得 +1🔪！`, 'skill', { actorId: actor.id, locId: destNode.id });
      emitFx('float', { nodeId: destNode.id, text: '🐎 空降 +1🔪', kind: 'skill' });
      emitFx('sfx', { name: 'knife' });
      return '天马空降 +1🔪';
    },

    tryPiggyStealKnife(actor, target) {
      if (actor.piggyStealArmed && target.knives > 0) {
        actor.piggyStealArmed = false;
        target.knives -= 1;
        actor.knives += 1;
        addLog(`🐷 ${actor.name} 触发【顺手牵刀】免费抢走 ${target.name} 1 把刀！`, 'skill', { actorId: actor.id, targetIds: [target.id] });
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
        addLog(`🔓 ${actor.name} 击杀典狱长！${freed.length ? `${freed.join('、')} 越狱` : '牢内无人'}`, 'system', { actorId: actor.id });
        emitFx('banner', { kicker: 'JAILBREAK // 越狱成功', title: '典狱长倒下！', sub: freed.length ? `${freed.join('、')} 全部出狱` : '新任典狱长已就位', mood: 'p5r', durationMs: 2400 });
        Engine.maybeTriggerNinjaChain(actor);
      }
    },

    maybeTriggerNinjaChain(actor) {
      if (!actor || actor.status !== 'alive' || actor.roleId !== 'ninja') return;
      if (!actor.bladeReady || actor.activeCharges <= 0 || isHypoxic(actor)) return;
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
      addLog(`🚔 ${initiator.name} 对 ${target.name} 发起【${label}】三局两胜猜拳！`, 'skill', { actorId: initiator.id, targetIds: [target.id] });
      emitFx('tacticalFeed', { actor: initiator.name, action: label, target: target.name, result: '三局两胜对决！', highlight: true });
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

      const subIsTie = !roundWinner;
      emitFx('rpsClash', {
        kicker: sr.label,
        title: roundWinner ? `${getPlayer(roundWinner)?.name} 拿下本小局！` : '小局平手 · 立刻重出！',
        subtitle: `当前比分 ${pa?.name} ${sr.aScore} : ${sr.bScore} ${pb?.name}`,
        entries: [
          { name: pa?.name, hand: ha, outcome: roundWinner === sr.aId ? 'win' : roundWinner ? 'lose' : 'draw', tag: `${sr.aScore} 胜` },
          { name: pb?.name, hand: hb, outcome: roundWinner === sr.bId ? 'win' : roundWinner ? 'lose' : 'draw', tag: `${sr.bScore} 胜` }
        ],
        quick: subIsTie,
        durationMs: subIsTie ? 480 : 1250
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
      }, subIsTie ? 520 : 1320);
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
          addLog(`🕶 ${actor.name} 放弃了本轮黑市契约。`, 'normal', { actorId: actor.id });
          emitFx('tacticalFeed', { actor: actor.name, action: '黑市离场', result: '未签署契约' });
          Engine.finishCurrentActorIfDone(getPlayer(state.activePlayerId));
          return;
        }
        if (intent.reroll && pa.canFreeReroll) {
          actor.blackMarketRerollTurn = state.turn;
          pa.canFreeReroll = false;
          pa.contracts = Engine.rollBlackMarketContracts();
          addLog(`🔄 普通人 ${actor.name} 免费刷新了黑市恶魔契约！`, 'skill', { actorId: actor.id });
          emitFx('sfx', { name: 'blackmarket' });
          Net.broadcastState();
          UI.renderAll();
          AI.scheduleTick();
          return;
        }
        const cid = intent.contractId;
        if (!pa.contracts.includes(cid)) return;
        const target = intent.targetId ? getPlayer(intent.targetId) : null;
        if ((cid === 'bm_swap_pants' || cid === 'bm_bounty_strip') && (!isVisibleAlive(target) || target.id === actor.id)) {
          notifyPlayer(actor.id, '该契约需要指定 1 名存活目标', 'warn');
          return;
        }
        if (target && isFogBlockedFor(actor) && target.location !== actor.location) {
          notifyPlayer(actor.id, '迷雾天象遮蔽视野，无法跨地点远程签署该黑市契约！', 'warn');
          return;
        }
        if (target && needsPinchPigFace(actor, target)) {
          notifyPlayer(actor.id, `目标 ${target.name} 戴着猪脸，请先捏脸或改选其他契约！`, 'warn');
          return;
        }
        state.pendingAction = null;
        Engine.applyBlackMarketContract(actor, cid, target);
        Engine.finishCurrentActorIfDone(getPlayer(state.activePlayerId));
        return;
      }

      if (pa.type === 'wish_pick') {
        const w = intent.wishId;
        if (w === 'divine_reset') {
          const role = ROLE_MAP[actor.roleId];
          actor.hp = roundHalf(actor.hp + 1);
          actor.pants = actor.maxPants;
          let extra = '';
          if (role.activeMax > 0) {
            actor.activeCharges += 1;
            extra = '+1主动技';
          } else {
            actor.shield += 1;
            extra = '+1层护盾';
          }
          addLog(`🌠 许愿池【神赐重整】：${actor.name} +1❤️、裤子回满至 ${actor.maxPants}、${extra}！`, 'system', { actorId: actor.id });
          emitFx('float', { nodeId: actor.location, text: `+1❤️ 回满裤 ${extra}`, kind: 'heal' });
        } else if (w === 'restore_pos') {
          const unitIds = Array.isArray(intent.unitIds) ? intent.unitIds : [];
          if (unitIds.length === 0) { notifyPlayer(actor.id, '请至少选择 1 个要复原的单位！', 'warn'); return; }
          const restoredNames = [];
          const hitPlayerIds = [];
          unitIds.forEach((uidTarget) => {
            if (uidTarget === 'NPC_WARDEN') {
              const wOut = state.nodes.land_prison_out;
              if (wOut && !wOut.collapsed) {
                state.warden.hp = 1;
                state.warden.pants = 3;
                restoredNames.push('NPC 典狱长(回监狱外)');
                emitFx('float', { nodeId: 'land_prison_out', text: '时空复原!', kind: 'skill' });
              }
              return;
            }
            const tp = getPlayer(uidTarget);
            if (!tp || tp.status !== 'alive') return;
            const birthId = tp.homeId && state.nodes[tp.homeId] && !state.nodes[tp.homeId].collapsed
              ? tp.homeId
              : getSafeReviveNodeId(tp);
            movePlayerTo(tp, birthId, { carryIds: [], silent: true });
            restoredNames.push(`${tp.name}→${getNode(birthId)?.name || '出生点'}`);
            hitPlayerIds.push(tp.id);
            emitFx('float', { nodeId: birthId, text: '时空复原!', kind: 'skill' });
          });
          if (restoredNames.length === 0) { notifyPlayer(actor.id, '没有可复原的有效单位', 'warn'); return; }
          addLog(`🌠 许愿池【时空复原】：${actor.name} 复原了 ${restoredNames.join('、')}！`, 'system', { actorId: actor.id, targetIds: hitPlayerIds });
        } else if (w === 'revive') {
          if (isUnderworldCollapsed()) { notifyPlayer(actor.id, '地府已坍塌，无法使用冥界召回复活！', 'warn'); return; }
          const dead = getPlayer(intent.targetId);
          if (!dead || dead.status === 'alive') return;
          revivePlayerAtUnderworld(dead, { viaWish: true });
        } else if (w === 'swap') {
          const p1 = getPlayer(intent.targetAId);
          const p2 = getPlayer(intent.targetBId);
          if (!isVisibleAlive(p1) || !isVisibleAlive(p2) || p1.id === p2.id) return;
          if (isBarrierActive(p1.location) || isBarrierActive(p2.location)) { notifyPlayer(actor.id, '结界内玩家无法被空间置换！', 'warn'); return; }
          const l1 = p1.location;
          const l2 = p2.location;
          movePlayerTo(p1, l2, { silent: true });
          movePlayerTo(p2, l1, { silent: true });
          addLog(`🌠 许愿池【空间置换】：${p1.name} 与 ${p2.name} 互换了位置！`, 'system', { actorId: actor.id, targetIds: [p1.id, p2.id] });
        } else if (w === 'drain_oxy') {
          const hitIds = [];
          state.players.forEach((p) => {
            if (p.id === actor.id || p.status !== 'alive') return;
            const n = getNode(p.location);
            if (!n || n.layer === 'land') return;
            if (n.layer === 'ocean' && isOceanOxygenImmune(p)) return;
            p.oxygenTurns += 2;
            hitIds.push(p.id);
            emitFx('float', { nodeId: p.location, text: '缺氧 +2!', kind: 'dmg' });
          });
          addLog(`🌠 许愿池【抽干氧源】：除 ${actor.name} 外，所有海/空存活玩家缺氧计数 +2！`, 'system', { actorId: actor.id, targetIds: hitIds });
        } else if (w === 'jail') {
          const t = getPlayer(intent.targetId);
          if (!isVisibleAlive(t)) return;
          if (isBarrierActive(t.location)) { notifyPlayer(actor.id, '目标处于结界保护中，无法强送入狱！', 'warn'); return; }
          sendPlayerToJail(t, '遭许愿池天降法槌');
        } else if (w === 'disarm') {
          const hitIds = [];
          state.players.forEach((p) => {
            if (p.id !== actor.id && p.knives > 0) {
              p.knives = 0;
              hitIds.push(p.id);
            }
          });
          addLog(`🌠 许愿池【全图缴械】：除 ${actor.name} 外，其余所有玩家手中的刀全部清零！`, 'system', { actorId: actor.id, targetIds: hitIds });
        } else {
          return;
        }
        state.pendingAction = null;
        emitFx('banner', { kicker: 'WISH GRANTED // 许愿达成', title: `${actor.name} 改写了现实`, sub: WISH_OPTIONS.find((o) => o.id === w)?.name || '', mood: 'p5r', durationMs: 2400 });
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
        addLog(`⚡ ${actor.name} 发动【瞬身连撞】突袭 ${chosen.name}！`, 'kill', { actorId: actor.id, targetIds: chosen.isWarden ? [] : [chosen.id] });
        emitFx('tacticalFeed', { actor: actor.name, action: '瞬身连撞', target: chosen.name, result: '1伤突袭', highlight: true });
        emitFx('nodePulse', { nodeId: chosen.nodeId });

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
      }
    },

    applyBlackMarketContract(actor, cid, target) {
      const role = ROLE_MAP[actor.roleId];
      const cMeta = CONTRACTS.find((x) => x.id === cid);
      emitFx('tacticalFeed', { actor: actor.name, action: '黑市签约', target: cMeta?.name || cid, result: target ? `目标: ${target.name}` : '恶魔契约生效', highlight: true });
      emitFx('nodePulse', { nodeId: actor.location });

      switch (cid) {
        case 'bm_overcharge':
          if (role.activeMax > 0) { actor.activeCharges += 1; addLog(`😈 黑市【过载充能】：${actor.name} 主动技 +1！`, 'skill', { actorId: actor.id }); }
          else { actor.shield += 1; addLog(`😈 黑市【过载充能】：${actor.name} 获得 1 层黑市护盾！`, 'skill', { actorId: actor.id }); }
          if (actor.pants >= 1) applyPantsLoss(actor, 1, '过载代价');
          else applyHpDamage(actor, 0.5, null, { canDodge: false, ignoreShield: true, reason: '过载充能反噬' });
          break;

        case 'bm_bomb':
          if (role.activeMax > 0) actor.activeCharges = Math.max(actor.activeCharges, role.activeMax);
          else actor.knives += 2;
          actor.bomb = { turnsLeft: 2 };
          addLog(`💣 黑市【人体炸弹】：${actor.name} 战力拉满，但身绑 2 回合定时炸弹！`, 'kill', { actorId: actor.id });
          emitFx('float', { nodeId: actor.location, text: '💣 2回合自爆', kind: 'dmg' });
          break;

        case 'bm_sacrifice': {
          actor.knives += 2;
          const unfinished = ALL_SQ_IDS.filter((id) => !state.artifacts[id].ownerId && !state.artifacts[id].droppedAt && !state.artifacts[id].destroyed);
          if (unfinished.length > 0) {
            const pick = unfinished[Math.floor(Math.random() * unfinished.length)];
            const art = state.artifacts[pick];
            art.progress += 1;
            if (art.progress >= ARTIFACTS[pick].stepsNeed) {
              art.ownerId = actor.id;
              if (pick === 'SQ3') art.instanceId += 1;
              addLog(`🩸 黑市【血肉献祭】：${actor.name} 献血 0.5 命换 +2 刀，并直接完成了【${ARTIFACTS[pick].name}】！`, 'system', { actorId: actor.id });
              updateBountyStatus(actor);
            } else {
              addLog(`🩸 黑市【血肉献祭】：${actor.name} 献血 0.5 命换 +2 刀，并推进 ${ARTIFACTS[pick].short} +1 格（${art.progress}/${ARTIFACTS[pick].stepsNeed}）！`, 'skill', { actorId: actor.id });
            }
          } else {
            addLog(`🩸 黑市【血肉献祭】：${actor.name} 献血 0.5 命换 +2 刀！`, 'skill', { actorId: actor.id });
          }
          applyHpDamage(actor, 0.5, null, { canDodge: false, ignoreShield: true, reason: '血肉献祭身亡' });
          break;
        }

        case 'bm_elixir':
          actor.hp = roundHalf(actor.hp + 1);
          actor.pants = 0;
          addLog(`💉 黑市【禁药续命】：${actor.name} +1 命，代价：裤子清零！`, 'skill', { actorId: actor.id });
          emitFx('float', { nodeId: actor.location, text: '+1❤️ 裤清零', kind: 'heal' });
          break;

        case 'bm_overdraft':
          actor.steps += 1;
          actor.paralyzedNextTurn = true;
          addLog(`⏳ 黑市【透支未来】：${actor.name} 本回合立刻 +1 步，下回合强制麻痹！`, 'skill', { actorId: actor.id });
          emitFx('float', { nodeId: actor.location, text: '+1步 下回合麻痹', kind: 'skill' });
          break;

        case 'bm_swap_pants':
          if (target) {
            const tmp = actor.pants;
            actor.pants = Math.min(actor.maxPants, target.pants);
            target.pants = Math.min(target.maxPants, tmp);
            actor.knives = 0;
            addLog(`👖 黑市【强制换裤】：${actor.name} 清空所有刀，与 ${target.name} 远程互换裤子！`, 'skill', { actorId: actor.id, targetIds: [target.id] });
          }
          break;

        case 'bm_bounty_strip':
          if (target) {
            applyPantsLoss(target, 1, '黑市通缉');
            actor.pants = Math.max(0, roundHalf(actor.pants - 0.5));
            if (!state.nodes.land_police.collapsed && !isBarrierActive('land_police')) movePlayerTo(actor, 'land_police', { silent: true });
            addLog(`🎯 黑市【黑市通缉】：${actor.name} 远程扒掉 ${target.name} 1 裤，被迫现身警察局且自身 -0.5 裤！`, 'skill', { actorId: actor.id, targetIds: [target.id] });
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
            addLog(`🌊 黑市【走私潜航】：${actor.name} 强化供氧并 +1 裤，被走私艇冲入【${dest.name}】！`, 'skill', { actorId: actor.id, locId: dest.id, isMoveToLoc: true });
          }
          break;
        }
      }
    },

    pickNextCollapseTarget() {
      const candidates = Object.values(state.nodes).filter((n) => n.collapsible && !n.collapsed);
      if (candidates.length === 0) return null;
      return candidates[Math.floor(Math.random() * candidates.length)];
    },

    endTurnCleanup() {
      if (Engine.checkVictory()) return;

      // 1. 海空 5 回合阶梯缺氧（海王在海洋、青蛙面罩在海洋永久免疫）
      state.players.forEach((p) => {
        if (p.status !== 'alive') return;
        const node = getNode(p.location);
        if (!node || node.layer === 'land') { p.oxygenTurns = 0; return; }
        if (node.layer === 'ocean' && isOceanOxygenImmune(p)) { p.oxygenTurns = 0; return; }
        if (p.enteredNonLandTurn === state.turn || p.breathedThisTurn) return;

        p.oxygenTurns += 1;
        if (p.oxygenTurns >= state.config.oxygenMax) {
          if (p.antiSuffocate > 0) {
            p.antiSuffocate -= 1;
            p.oxygenTurns = 0;
            addLog(`🫧 ${p.name} 触发防窒息保险，逃过缺氧死劫！`, 'skill', { targetIds: [p.id] });
            emitFx('float', { nodeId: p.location, text: '保险防窒息!', kind: 'heal' });
          } else {
            addLog(`🫧 ${p.name} 在【${node.name}】缺氧耗尽，窒息身亡！`, 'kill', { targetIds: [p.id] });
            handlePlayerDeath(p, null, '海空缺氧窒息身亡');
          }
        } else if (p.oxygenTurns >= state.config.oxygenMax - 2) {
          addLog(`⚠ ${p.name} 缺氧 ${p.oxygenTurns}/${state.config.oxygenMax}（攻减半/禁主动）`, 'system', { targetIds: [p.id] });
          emitFx('float', { nodeId: p.location, text: `缺氧 ${p.oxygenTurns}/${state.config.oxygenMax}`, kind: 'dmg' });
        }
      });

      if (Engine.checkVictory()) return;

      // 2. 人体炸弹倒计时自爆
      state.players.forEach((p) => {
        if (p.status !== 'alive' || !p.bomb) return;
        p.bomb.turnsLeft -= 1;
        if (p.bomb.turnsLeft <= 0) {
          p.bomb = null;
          addLog(`💥 轰隆！${p.name} 身上的黑市人体炸弹引爆（-1 命）！`, 'kill', { targetIds: [p.id] });
          applyHpDamage(p, 1, null, { canDodge: false, reason: '人体炸弹自爆身亡' });
        }
      });

      if (Engine.checkVictory()) return;

      // 3. 残局坍塌：正式坍塌（滞留先扣 -0.5 命不可闪避） + 提前 1 回合预告下一个坍塌目标
      if (state.config.collapseEnabled && state.turn >= state.config.collapseStartTurn) {
        let victimNode = state.nextCollapseNodeId ? getNode(state.nextCollapseNodeId) : null;
        if (!victimNode || victimNode.collapsed || !victimNode.collapsible) {
          victimNode = Engine.pickNextCollapseTarget();
        }
        state.nextCollapseNodeId = null;

        if (victimNode) {
          victimNode.collapsed = true;
          victimNode.barrierUntilTurn = 0;
          addLog(`🌋 【${victimNode.name}】永久坍塌！`, 'system', { locId: victimNode.id });
          if (victimNode.droppedArtifacts.length > 0) {
            victimNode.droppedArtifacts.forEach((sqId) => {
              state.artifacts[sqId].droppedAt = null;
              state.artifacts[sqId].destroyed = true;
              addLog(`💥 【${ARTIFACTS[sqId].name}】随【${victimNode.name}】毁灭消失！`, 'kill');
            });
            victimNode.droppedArtifacts = [];
          }
          emitFx('banner', { kicker: `COLLAPSE // TURN ${state.turn}`, title: `${victimNode.name} 永久坍塌`, sub: '滞留者承受 -0.5❤️ 塌方伤害，存活者紧急逃生！', mood: 'p5r', durationMs: 2400 });
          emitFx('sfx', { name: 'collapse' });

          const safeLands = Object.values(state.nodes).filter((n) => !n.collapsed && n.layer === 'land' && n.kind !== 'prison_in');

          // 先对滞留在坍塌地点的存活玩家结算 -0.5 命不可闪避塌方伤害，未死亡者再逃生
          state.players.forEach((p) => {
            if (p.status === 'alive' && p.location === victimNode.id) {
              addLog(`💥 ${p.name} 滞留于坍塌的【${victimNode.name}】，承受 -0.5❤️ 塌方伤害！`, 'kill', { targetIds: [p.id] });
              applyHpDamage(p, 0.5, null, { canDodge: false, reason: `在【${victimNode.name}】塌方中丧生` });
              if (p.status === 'alive' && safeLands.length > 0) {
                const safe = safeLands[Math.floor(Math.random() * safeLands.length)];
                movePlayerTo(p, safe.id, { silent: true });
                addLog(`🏃 ${p.name} 负伤从【${victimNode.name}】逃生至【${safe.name}】！`, 'normal', { targetIds: [p.id] });
              }
            }
          });

          // 若地府坍塌，地府通道断绝，待复活者不可再通过地府复活
          if (victimNode.id === 'land_underworld') {
            state.players.forEach((p) => {
              if (p.status === 'pending_revive') {
                p.reviveUsed = true;
                p.status = 'dead_final';
                addLog(`☠【地府】已坍塌，${p.name} 失去地府复活资格，彻底死透！`, 'kill', { targetIds: [p.id] });
              }
            });
          }

          // 若监狱外坍塌，同步崩毁监狱围墙并释放所有在押者，彻底杜绝软锁死
          if (victimNode.id === 'land_prison_out' && safeLands.length > 0) {
            state.nodes.land_prison_in.collapsed = true;
            state.players.forEach((p) => {
              if (p.status === 'alive' && p.location === 'land_prison_in') {
                const safe = safeLands[Math.floor(Math.random() * safeLands.length)];
                movePlayerTo(p, safe.id, { silent: true });
                addLog(`🔓 监狱随坍塌崩毁，${p.name} 趁乱逃生至【${safe.name}】！`, 'system', { targetIds: [p.id] });
              }
            });
          }
        }
      }

      if (Engine.checkVictory()) return;

      // 提前 1 回合锁定并预告下一个坍塌目标
      if (state.config.collapseEnabled && state.turn >= state.config.collapseStartTurn - 1) {
        const nextNode = Engine.pickNextCollapseTarget();
        state.nextCollapseNodeId = nextNode ? nextNode.id : null;
        if (nextNode) {
          addLog(`⚠ 坍塌预警：下回合末【${nextNode.name}】即将永久坍塌！滞留将承受 -0.5❤️ 塌方伤害！`, 'system', { locId: nextNode.id });
          emitFx('nodePulse', { nodeId: nextNode.id });
        }
      }

      const pauseMs = Math.max(1200, (window.VFX?.getRemainingBannerMs?.() || 0) + 450);
      scheduleHostTask(() => Engine.beginNextTurn(), pauseMs);
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
  // 7. Tactical AI Brain (Solo & Disconnect Takeover — v2.4 Synced)
  // ========================================================================
  Object.assign(AI, {
    getSyncedDelay() {
      const baseCfg = clamp(Number(state.config.aiDelayMs) || 1600, 400, 3500);
      const speedPause = window.VFX?.getSpeedConfig?.().actionPauseMs || 1500;
      const bannerRem = window.VFX?.getRemainingBannerMs?.() || 0;
      return Math.max(baseCfg, speedPause) + (bannerRem > 0 ? bannerRem + 260 : 0);
    },

    scheduleTick() {
      if (!isHostAuthority() || !state.started || state.phase === 'gameover') return;
      const delay = AI.getSyncedDelay();
      const randHand = () => ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)];

      if (state.phase === 'rps' && state.rps && !state.rps.revealed) {
        // 平局重猜轮：AI 立刻出拳，避免「等 AI 慢慢出拳」的卡手感
        const reroll = state.rps.round > 1;
        state.rps.participants.forEach((pid) => {
          const p = getPlayer(pid);
          if (p && p.isAI && !state.rps.choices[pid]) {
            scheduleHostTask(() => Engine.submitMainRps(pid, randHand()), reroll ? 80 + Math.random() * 130 : 300 + Math.random() * 450);
          }
        });
        return;
      }

      if (state.phase === 'initiative' && state.initiative) {
        if (state.initiative.mode === 'rps' && !state.initiative.revealed) {
          const reroll = (state.initiative.round || 1) > 1;
          state.initiative.contenders.forEach((pid) => {
            const p = getPlayer(pid);
            if (p && p.isAI && !state.initiative.choices[pid]) {
              scheduleHostTask(() => Engine.submitInitiativeRps(pid, randHand()), reroll ? 80 + Math.random() * 120 : 350 + Math.random() * 400);
            }
          });
        } else if (state.initiative.mode === 'pick_slot') {
          const first = getPlayer(state.initiative.firstWinnerId);
          if (first && first.isAI) {
            scheduleHostTask(() => Engine.pickInitiativeSlot(first.id, Math.random() < 0.65 ? 0 : state.initiative.allWinners.length - 1), Math.min(delay, 2200));
          }
        }
        return;
      }

      if (state.phase === 'sub_rps' && state.subRps && !state.subRps.revealed) {
        const reroll = (state.subRps.round || 1) > 1;
        [state.subRps.aId, state.subRps.bId].forEach((pid) => {
          const p = getPlayer(pid);
          if (p && p.isAI && !state.subRps.choices[pid]) {
            scheduleHostTask(() => Engine.submitSubRps(pid, randHand()), reroll ? 80 + Math.random() * 130 : 400 + Math.random() * 350);
          }
        });
        return;
      }

      if (state.phase === 'stealth_reveal') {
        const raider = getPlayer(state.activePlayerId);
        if (raider && raider.isAI) {
          scheduleHostTask(() => {
            const moves = getReachableMoveNodes(raider).filter((n) => n.id !== state.nextCollapseNodeId);
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
        const enemies = state.players.filter((p) => isVisibleAlive(p) && p.id !== actor.id && !needsPinchPigFace(actor, p) && (!isFogBlockedFor(actor) || p.location === actor.location));
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
        if (actor.hp <= 1.5 || actor.pants < actor.maxPants) {
          Engine.resolvePendingAction(actor.id, { wishId: 'divine_reset' });
          return;
        }
        const enemies = state.players.filter((p) => isVisibleAlive(p) && p.id !== actor.id);
        const wanted = enemies.find((e) => e.wanted) || enemies[0];
        if (wanted && wanted.location !== 'land_prison_in' && !state.nodes.land_prison_out?.collapsed && !isBarrierActive(wanted.location)) {
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
      const allAliveEnemies = state.players.filter((p) => isVisibleAlive(p) && p.id !== actor.id);
      const moves = getReachableMoveNodes(actor);
      const safeMoves = moves.filter((n) => n.id !== state.nextCollapseNodeId);
      const movePool = safeMoves.length > 0 ? safeMoves : moves;

      // 1. 优先过继人体炸弹
      if (actor.bomb && validHere.length > 0) {
        Engine.executePlayerAction(actor.id, { action: 'pass_bomb', targetId: validHere[0].id });
        return;
      }

      // 2. 逃离即将坍塌的危险节点
      if (state.nextCollapseNodeId && actor.location === state.nextCollapseNodeId && !actor.parasiteHostId && movePool.length > 0) {
        Engine.executePlayerAction(actor.id, { action: 'move', destId: movePool[Math.floor(Math.random() * movePool.length)].id, carryIds: [] });
        return;
      }

      // 3. 海空缺氧自救（海王在海洋免疫）
      if (curNode && curNode.layer !== 'land' && !(curNode.layer === 'ocean' && isOceanOxygenImmune(actor))) {
        if (actor.oxygenTurns >= state.config.oxygenMax - 2) {
          if (hasEffectiveOxygenTank(actor)) { Engine.executePlayerAction(actor.id, { action: 'breathe' }); return; }
          const landDest = movePool.find((n) => n.layer === 'land');
          if (landDest) { Engine.executePlayerAction(actor.id, { action: 'move', destId: landDest.id, carryIds: [] }); return; }
        }
      }

      // 4. 寄生附身态：0 步免费破体奇袭
      if (actor.parasiteHostId) {
        const host = getPlayer(actor.parasiteHostId);
        if (host && host.pants <= 0 && canStabWithWeapon(actor)) {
          Engine.executePlayerAction(actor.id, { action: 'use_skill', burstMode: 'stab' });
          return;
        }
        if (host && Math.random() < 0.45) {
          Engine.executePlayerAction(actor.id, { action: 'use_skill', burstMode: 'strip' });
          return;
        }
        Engine.executePlayerAction(actor.id, { action: 'pass' });
        return;
      }

      // 5. 普通人 0 步免费黑市抽契约
      if (actor.roleId === 'normal' && curNode?.kind === 'blackmarket' && actor.blackMarketFreeTurn !== state.turn) {
        Engine.executePlayerAction(actor.id, { action: 'blackmarket_draw' });
        return;
      }

      // 6. 拾取地上神器
      if (curNode && curNode.droppedArtifacts.length > 0) {
        Engine.executePlayerAction(actor.id, { action: 'pickup_artifact', sqId: curNode.droppedArtifacts[0] });
        return;
      }

      // 7. 忍者优先弹刃解锁攻击态
      if (actor.roleId === 'ninja' && !actor.bladeReady) {
        Engine.executePlayerAction(actor.id, { action: 'blade_draw' });
        return;
      }

      // 8. 同地点 0 裤斩杀（含突袭者刃锋分伤 + SQ2 利刃常驻小刀判定）
      const zeroTargets = getZeroPantsTargetsAt(actor, actor.location);
      if (zeroTargets.length > 0 && canStabWithWeapon(actor)) {
        if (actor.roleId === 'raider' && zeroTargets.length >= 2) {
          const totalDmg = Engine.calcStabDamage(actor);
          const sorted = [...zeroTargets].sort((a, b) => a.hp - b.hp);
          let rem = totalDmg;
          const splitAlloc = {};
          for (const t of sorted) {
            if (rem <= 0) break;
            const need = Math.min(rem, Math.max(0.5, Math.ceil(t.hp * 2) / 2));
            splitAlloc[t.id] = roundHalf(need);
            rem = roundHalf(rem - need);
          }
          if (rem > 0) {
            const firstId = sorted[0].id;
            splitAlloc[firstId] = roundHalf((splitAlloc[firstId] || 0) + rem);
          }
          Engine.executePlayerAction(actor.id, { action: 'stab', splitAlloc });
          return;
        }
        const playerZero = zeroTargets.find((t) => !t.isWarden);
        if (playerZero) {
          if (actor.roleId === 'piggy' && actor.activeCharges > 0 && !actor.piggyStealArmed && playerZero.player.knives > 0 && !isHypoxic(actor)) {
            Engine.executePlayerAction(actor.id, { action: 'use_skill' });
            return;
          }
          Engine.executePlayerAction(actor.id, { action: 'stab', targetId: playerZero.id });
          return;
        }
      }

      // 9. SQ2 利刃突进（自带小刀判定，弹刃后 0 普通刀亦可直接突进扣血）
      if (hasUsableBlade(actor) && movePool.length > 0) {
        for (const dest of movePool) {
          const t = getAlivePlayersAt(dest.id, actor.id).find((e) => !needsPinchPigFace(actor, e));
          if (!t) continue;
          if (t.pants <= 0) {
            Engine.executePlayerAction(actor.id, { action: 'sq2_dash', destId: dest.id, targetId: t.id });
            return;
          }
          if (t.pants > 0 && Math.random() < 0.55) {
            Engine.executePlayerAction(actor.id, { action: 'sq2_dash', destId: dest.id, targetId: t.id });
            return;
          }
        }
      }

      // 10. 捏猪脸
      const unpinched = enemiesHere.find((e) => needsPinchPigFace(actor, e));
      if (unpinched && Math.random() < 0.65) {
        Engine.executePlayerAction(actor.id, { action: 'pinch_pigface', targetId: unpinched.id });
        return;
      }

      // 11. 同地点寄生或扒裤
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

      // 12. SQ5 / SQ6（遵守迷雾禁跨地点限制）
      if (hasSQ(actor, 'SQ5') && actor.knives === 0) {
        const armed = allAliveEnemies.find((e) => e.knives > 0 && !needsPinchPigFace(actor, e) && (!isFogBlockedFor(actor) || e.location === actor.location) && (e.location === actor.location || (!isBarrierActive(actor.location) && !isBarrierActive(e.location))));
        if (armed) { Engine.executePlayerAction(actor.id, { action: 'sq5_magnet', targetId: armed.id }); return; }
      }
      if (hasSQ(actor, 'SQ6') && !isFogBlockedFor(actor) && actor.steps >= 2 && actor.knives >= 1 && curNode?.kind !== 'prison_in' && !isBarrierActive(curNode?.id)) {
        const hookable = allAliveEnemies.find((e) => e.location !== actor.location && e.location !== 'land_prison_in' && !e.parasiteHostId && !isBarrierActive(e.location) && !needsPinchPigFace(actor, e) && e.pants <= 1);
        if (hookable) { Engine.executePlayerAction(actor.id, { action: 'sq6_hook', targetId: hookable.id }); return; }
      }

      // 13. 海王狱内潜海脱逃
      if (actor.roleId === 'aquaman' && curNode?.kind === 'prison_in' && actor.activeCharges > 0 && !isHypoxic(actor) && !isBarrierActive(actor.location)) {
        const oceanDests = Object.values(state.nodes).filter((n) => n.layer === 'ocean' && !n.collapsed && !isBarrierActive(n.id));
        if (oceanDests.length > 0) {
          Engine.executePlayerAction(actor.id, { action: 'use_skill', nodeId: oceanDests[Math.floor(Math.random() * oceanDests.length)].id });
          return;
        }
      }

      // 14. 主动技决策（遵守迷雾禁跨点 + 收尸人烧尸）
      if (actor.activeCharges > 0 && !isHypoxic(actor) && Math.random() < 0.48) {
        const validRemote = allAliveEnemies.filter((e) => !needsPinchPigFace(actor, e) && (!isFogBlockedFor(actor) || e.location === actor.location));
        if (actor.roleId === 'chili' && validRemote.length > 0) {
          const zappable = validRemote.find((e) => e.location === actor.location || (!isBarrierActive(actor.location) && !isBarrierActive(e.location)));
          if (zappable) { Engine.executePlayerAction(actor.id, { action: 'use_skill', targetId: zappable.id }); return; }
        }
        if (actor.roleId === 'watcher' && !state.nodes.land_prison_out?.collapsed) {
          const arrestable = validRemote.find((e) => e.location !== 'land_prison_in' && !isBarrierActive(e.location));
          if (arrestable) { Engine.executePlayerAction(actor.id, { action: 'use_skill', targetId: arrestable.id }); return; }
        }
        if (actor.roleId === 'curser' && validRemote.length >= 2) {
          Engine.executePlayerAction(actor.id, { action: 'use_skill', targetAId: validRemote[0].id, targetBId: validRemote[1].id });
          return;
        }
        if (actor.roleId === 'undertaker') {
          const revivable = state.players.find((p) => p.status === 'pending_revive');
          if (revivable) { Engine.executePlayerAction(actor.id, { action: 'use_skill', targetId: revivable.id }); return; }
          const corpseNode = Object.values(state.nodes).find((n) => n.corpses.length > 0);
          if (corpseNode) { Engine.executePlayerAction(actor.id, { action: 'use_skill', corpseNodeId: corpseNode.id }); return; }
        }
        if (actor.roleId === 'raider' && !actor.stealth && actor.steps === 1) { Engine.executePlayerAction(actor.id, { action: 'use_skill' }); return; }
        if (actor.roleId === 'barrier' && allAliveEnemies.length > 0) {
          const bn = getNode(allAliveEnemies[0].location);
          if (bn && bn.kind !== 'prison_in' && !bn.collapsed) { Engine.executePlayerAction(actor.id, { action: 'use_skill', nodeId: bn.id }); return; }
        }
        if (actor.roleId === 'mirror' && !state.lastActiveSkill) { Engine.executePlayerAction(actor.id, { action: 'use_skill' }); return; }
      }

      // 15. 地点交互
      if (curNode?.kind === 'palace') {
        const forgeable = ALL_SQ_IDS.find((id) => !state.artifacts[id].ownerId && !state.artifacts[id].droppedAt && !state.artifacts[id].destroyed);
        if (forgeable) { Engine.executePlayerAction(actor.id, { action: 'forge_artifact', sqId: forgeable }); return; }
      }
      if (curNode?.kind === 'blackmarket' && Math.random() < 0.65) { Engine.executePlayerAction(actor.id, { action: 'blackmarket_draw' }); return; }
      if (curNode?.kind === 'wish') { Engine.executePlayerAction(actor.id, { action: 'wish_step' }); return; }
      if (curNode?.kind === 'observatory' && !state.nextWeather) {
        const ws = ['bloodmoon', 'fog', 'storm'];
        Engine.executePlayerAction(actor.id, { action: 'set_weather', weather: ws[Math.floor(Math.random() * ws.length)] });
        return;
      }

      // 16. 狱内越狱
      if (curNode?.kind === 'prison_in' && canAttackWardenFrom(curNode) && moves.length === 0) {
        if (state.warden.pants > 0) { Engine.executePlayerAction(actor.id, { action: 'strip_pants', targetId: 'NPC_WARDEN' }); return; }
        if (actor.knives >= 1) { Engine.executePlayerAction(actor.id, { action: 'stab', targetId: 'NPC_WARDEN' }); return; }
        Engine.executePlayerAction(actor.id, { action: 'draw_knife' });
        return;
      }

      // 17. 基础发育（拔刀 / 穿裤 / 升天蓄力）
      if (actor.knives === 0 && !hasUsableBlade(actor) && Math.random() < 0.65) { Engine.executePlayerAction(actor.id, { action: 'draw_knife' }); return; }
      if (actor.pants < actor.maxPants && !(state.weather === 'storm' && curNode?.layer === 'land' && !isStormImmune(actor)) && Math.random() < 0.55) {
        Engine.executePlayerAction(actor.id, { action: 'wear_pants' });
        return;
      }
      if (curNode?.layer === 'land' && curNode.kind !== 'prison_in' && !actor.ascendCharged && !hasSQ(actor, 'SQ4') && Math.random() < 0.18) {
        Engine.executePlayerAction(actor.id, { action: 'charge_ascend' });
        return;
      }

      // 18. 策略移动
      if (movePool.length > 0) {
        const enemyNodes = movePool.filter((n) => getAlivePlayersAt(n.id, actor.id).length > 0);
        const strategic = movePool.filter((n) => ['ocean_palace', 'land_blackmarket', 'land_police', 'land_dock', 'sky_wish', 'sky_observatory'].includes(n.id));
        const pool = enemyNodes.length > 0 && canStabWithWeapon(actor) ? enemyNodes : strategic.length > 0 && Math.random() < 0.55 ? strategic : movePool;
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
    const cam = { rx: 28, rz: -5, scale: 1, tx: 0, ty: 0 };
    let dragging = false;
    let panning = false;
    let startX = 0, startY = 0, startRx = 28, startRz = -5, startTx = 0, startTy = 0;

    function applyTransform() {
      const root = document.documentElement.style;
      root.setProperty('--cam-rx', `${cam.rx.toFixed(1)}deg`);
      root.setProperty('--cam-rz', `${cam.rz.toFixed(1)}deg`);
      root.setProperty('--cam-scale', cam.scale.toFixed(2));
      root.setProperty('--cam-tx', `${cam.tx.toFixed(0)}px`);
      root.setProperty('--cam-ty', `${cam.ty.toFixed(0)}px`);
    }

    let currentPreset = 'default';

    // 让整块战术棋盘尽量铺满视口：取宽高较小者作为适配基准
    function getResponsiveBaseScale() {
      const vp = document.getElementById('map-viewport');
      const w = vp && vp.clientWidth > 0 ? vp.clientWidth : window.innerWidth;
      const h = vp && vp.clientHeight > 0 ? vp.clientHeight : window.innerHeight * 0.6;
      // 手机竖屏：不强行把 1460px 宽的战术棋盘塞进 400px 屏幕（那样字会小到看不清），
      // 改为放大棋盘 + 单指拖动平移 / 双指缩放来浏览。
      if (w <= 820) return clamp(w / 520, 0.62, 1.0);
      const s = Math.min(w / BOARD_W, h / BOARD_H);
      return clamp(s * 1.02, 0.42, 1.06);
    }

    function setPreset(preset) {
      currentPreset = preset || 'default';
      const base = getResponsiveBaseScale();
      if (currentPreset === 'flat') { cam.rx = 0; cam.rz = 0; cam.scale = base * 1.02; cam.tx = 0; cam.ty = 0; }
      else if (currentPreset === 'top') { cam.rx = 8; cam.rz = 0; cam.scale = base; cam.tx = 0; cam.ty = 0; }
      else if (currentPreset === 'depth') { cam.rx = 52; cam.rz = -22; cam.scale = base * 0.98; cam.tx = 0; cam.ty = 0; }
      else if (currentPreset === 'side') { cam.rx = 66; cam.rz = -30; cam.scale = base * 0.94; cam.tx = 0; cam.ty = 10; }
      else { cam.rx = 28; cam.rz = -5; cam.scale = base; cam.tx = 0; cam.ty = 0; }
      applyTransform();
      ['default', 'depth', 'flat', 'top', 'side'].forEach((k) => document.getElementById(`btn-cam-${k}`)?.classList.toggle('is-active', k === currentPreset));
    }

    // 把某个地点推到视线中心：高亮 + 短暂强制显示空地点
    // 桌面端棋盘已完整可见时只高亮；手机端 / 放大后会把该地点平移到视口中央。
    function focusNode(nodeId) {
      if (!nodeId) return;
      const node = getNode(nodeId);
      if (!node) return;
      localUI.focusNodeId = nodeId;
      triggerNodePulse(nodeId);

      const fit = getResponsiveBaseScale();
      const needCenter = window.innerWidth <= 820 || cam.scale > fit * 1.12;
      if (needCenter) {
        const rad = (cam.rx * Math.PI) / 180;
        const dx = (node.x / 100 - 0.5) * BOARD_W * cam.scale;
        const dy = (node.y / 100 - 0.5) * BOARD_H * cam.scale * Math.cos(rad);
        cam.tx = clamp(-dx, -BOARD_W, BOARD_W);
        cam.ty = clamp(-dy, -BOARD_H, BOARD_H);
        applyTransform();
      }

      const el = document.querySelector(`.map-node[data-node-id="${CSS.escape(String(nodeId))}"]`);
      if (el) {
        el.classList.add('is-node-focus', 'is-forced-visible');
        window.setTimeout(() => {
          el.classList.remove('is-forced-visible');
        }, 3200);
      }
      window.clearTimeout(focusNode._t);
      focusNode._t = window.setTimeout(() => {
        localUI.focusNodeId = null;
        document.querySelectorAll('.map-node.is-node-focus').forEach((n) => n.classList.remove('is-node-focus'));
      }, 3200);
    }

    function setFocusLayer(layer) {
      const valid = ['all', 'sky', 'land', 'ocean'].includes(layer) ? layer : 'all';
      localUI.focusLayer = valid;
      const scene = document.getElementById('map-scene-3d');
      if (scene) scene.dataset.focusLayer = valid;
      document.querySelectorAll('.cam-layer-btn').forEach((b) => {
        b.classList.toggle('is-active', b.dataset.layerFocus === valid);
      });
    }

    function zoom(delta) {
      cam.scale = clamp(cam.scale + delta, 0.42, 1.9);
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
      const pointers = new Map();
      let pinchStartDist = 0;
      let pinchStartScale = 1;

      vp.addEventListener('pointerdown', (e) => {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 2) {
          const pts = Array.from(pointers.values());
          pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
          pinchStartScale = cam.scale;
          dragging = false;
          vp.classList.remove('is-dragging');
          return;
        }
        if (e.target.closest('.map-camera-controls') || e.target.closest('.map-node')) return;
        // 触屏 / 中键 / 右键 / Shift+左键 = 平移棋盘；鼠标左键 = 旋转
        panning = e.pointerType === 'touch' || e.button === 1 || e.button === 2 || e.shiftKey;
        dragging = true;
        startX = e.clientX; startY = e.clientY;
        startRx = cam.rx; startRz = cam.rz; startTx = cam.tx; startTy = cam.ty;
        vp.classList.add('is-dragging');
        vp.setPointerCapture?.(e.pointerId);
      });
      vp.addEventListener('pointermove', (e) => {
        if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size >= 2) {
          const pts = Array.from(pointers.values());
          const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
          cam.scale = clamp(pinchStartScale * (dist / pinchStartDist), 0.42, 1.9);
          applyTransform();
          return;
        }
        if (!dragging) return;
        if (panning) {
          cam.tx = startTx + (e.clientX - startX);
          cam.ty = startTy + (e.clientY - startY);
        } else {
          cam.rz = startRz - (e.clientX - startX) * 0.28;
          cam.rx = clamp(startRx - (e.clientY - startY) * 0.24, 0, 82);
        }
        applyTransform();
      });
      const endDrag = (e) => {
        if (e && e.pointerId !== undefined) pointers.delete(e.pointerId);
        dragging = false; panning = false;
        vp.classList.remove('is-dragging');
      };
      vp.addEventListener('pointerup', endDrag);
      vp.addEventListener('pointercancel', endDrag);
      vp.addEventListener('pointerleave', () => { if (pointers.size === 0) endDrag(); });
      vp.addEventListener('contextmenu', (e) => { if (vp.contains(e.target)) e.preventDefault(); });
      vp.addEventListener('wheel', (e) => { e.preventDefault(); zoom(e.deltaY < 0 ? 0.08 : -0.08); }, { passive: false });
      window.addEventListener('resize', () => setPreset(currentPreset));
      setPreset('default');
      window.setTimeout(() => setPreset(currentPreset), 120);
    }

    function resetView() {
      setPreset('default');
    }

    return { bind, setPreset, setFocusLayer, zoom, toggleEmptyNodes, getNodeClientRect, focusNode, resetView };
  })());

  // ========================================================================
  // 9. Complete DOM Renderer (UI — v2.4.6 地图战况版)
  // ========================================================================
  const NODE_LAYER_LABEL = { sky: '天空', land: '陆地', ocean: '海洋' };
  const NODE_KIND_ICON = {
    stable: '🐎', wish: '⛲', observatory: '🔭',
    police: '🚓', prison_out: '🗝', prison_in: '⛓', dock: '⚓', blackmarket: '🕶', underworld: '☠',
    aquarium: '🐠', ruins: '🏛', palace: '🐉', home: '🏠'
  };

  // 单个角色身上的全部增益 / 减益 / 神器（地图卡与速览条共用）
  function statusChipDefs(p, node) {
    const chips = [];
    const add = (txt, cls, tip) => chips.push({ txt, cls: cls || '', tip: tip || txt });
    if (p.status === 'pending_revive') add('地府待复', 'mu-chip--debuff', '阵亡后在地府等待猜拳复活');
    if (p.status === 'dead_final') add('死透', 'mu-chip--dead', '无法再次复活');
    if (p.wanted) add('通缉', 'mu-chip--wanted', '全服通缉：击杀者回 1 命 + 下回合保底 1 步');
    if (p.paralyzed) add('麻痹', 'mu-chip--debuff', '本回合无法行动');
    else if (p.paralyzedNextTurn) add('下回麻痹', 'mu-chip--debuff', '下回合将无法行动');
    if (p.stealth?.active) add('隐身', 'mu-chip--buff', '量子隐身：暗步待揭晓');
    if (p.bomb) add(`💣${p.bomb.turnsLeft}`, 'mu-chip--wanted', `人体炸弹：剩 ${p.bomb.turnsLeft} 回合`);
    if (p.ascendCharged) add('☁蓄力', 'mu-chip--buff', '已升天蓄力：可 1 步直飞天空层');
    if (p.roleId === 'ninja') add(p.bladeReady ? '⚡刃' : '未弹刃', p.bladeReady ? 'mu-chip--buff' : 'mu-chip--warn', p.bladeReady ? '利刃已解锁' : '须先耗 1 步弹刃');
    if (p.frogMask) add('🐸面罩', 'mu-chip--buff', '青蛙面罩：水下呼吸（裤上限 0，HP 0.5）');
    if (!p.oxygenTank) add('无氧瓶', 'mu-chip--warn', '氧气瓶已损坏或被抢');
    if (p.shield > 0) add(`🛡${p.shield}`, 'mu-chip--buff', `护盾 ${p.shield} 层`);
    if (p.roleId === 'reverser' && p.momentum > 0) add(`势${p.momentum}`, 'mu-chip--buff', `蓄势 ${p.momentum}/2`);
    if (p.savedSteps > 0) add(`⏳${p.savedSteps}`, 'mu-chip--buff', `沙漏储存 ${p.savedSteps} 步`);
    if (p.parasiteHostId) add(`寄生·${getPlayer(p.parasiteHostId)?.name || '?'}`, 'mu-chip--debuff', '正附身于宿主');
    if (node && node.layer !== 'land' && p.status === 'alive' && !(node.layer === 'ocean' && isOceanOxygenImmune(p))) {
      add(`缺氧${p.oxygenTurns}/${state.config.oxygenMax}`, p.oxygenTurns >= state.config.oxygenMax - 2 ? 'mu-chip--warn' : 'mu-chip--oxy', '海空缺氧计数，归零则窒息');
    }
    ALL_SQ_IDS.forEach((sq) => { if (hasSQ(p, sq)) add(ARTIFACTS[sq].short, 'mu-chip--artifact', ARTIFACTS[sq].desc); });
    if (getLinkedPartners(p.id).length > 0) add('命运链接', 'mu-chip--wanted', '命运链接：一方扣裤/扣血时另一方同步承受');
    return chips;
  }

  function buildStatusChips(p, node) {
    // 状态用彩色文字，不套小方块：更像游戏 HUD，不像表格
    return statusChipDefs(p, node)
      .map((c) => `<span class="mu-buff ${c.cls}" title="${escapeHtml(c.tip)}">${c.txt}</span>`)
      .join('<span class="mu-dot">·</span>');
  }

  function statusChipText(p, node) {
    return statusChipDefs(p, node).map((c) => c.txt).join(' · ');
  }

  // 地图上的角色行：名字 · 职业 · 四个数字 · 状态文字 · 上一动
  function buildUnitCard(p, node) {
    const role = ROLE_MAP[p.roleId] || ROLE_MAP.normal;
    const isActive = state.phase === 'action' && state.activePlayerId === p.id;
    const cls = ['mn-unit'];
    if (p.id === state.selfId) cls.push('is-self');
    if (isActive) cls.push('is-active');
    if (p.wanted) cls.push('is-wanted');
    if (p.status !== 'alive') cls.push('is-down');

    const chips = buildStatusChips(p, node);
    const last = p.lastAct;
    const lastHtml = last
      ? `<div class="mu-last ${last.turn === state.turn ? '' : 'is-stale'}" title="${escapeHtml(last.text)}"><b class="mu-last-tag">T${String(last.turn).padStart(2, '0')}${last.order ? orderMark(last.order) : ''}</b>${escapeHtml(shortBattleText(last.text, p.name))}</div>`
      : '';
    const stepHtml = isActive
      ? `<span class="mu-turn">行动中${p.steps > 0 ? ` ${p.steps}步` : ''}</span>`
      : p.steps > 0 ? `<span class="mu-step">${p.steps}步</span>` : '';

    return `
      <div class="${cls.join(' ')}" data-agent-id="${p.id}">
        <div class="mu-line">
          <span class="mu-name">${escapeHtml(p.name)}</span>
          <span class="mu-role">${escapeHtml(role.name)}</span>
          <span class="mu-nums">
            <b class="mu-hp">❤${p.hp}</b>
            <b class="mu-pants">👖${p.pants}/${p.maxPants}</b>
            <b class="mu-knife">🔪${p.knives}</b>
            <b class="mu-skill">技${p.activeCharges}</b>
          </span>
          ${stepHtml}
        </div>
        ${chips ? `<div class="mu-buffs">${chips}</div>` : ''}
        ${lastHtml}
      </div>`;
  }

  // 地点卡上的常驻战况记录：①②③ 就是行动顺序
  function buildNodeHistory(node) {
    const hist = Array.isArray(node.history) ? node.history.slice(-4) : [];
    if (hist.length === 0) return '';
    const rows = hist.slice().reverse().map((ev) => `
      <div class="mn-hist-row ${ev.turn === state.turn ? 'is-now' : ''} ${ev.kind === 'kill' ? 'is-kill' : ''} ${ev.kind === 'muted' ? 'is-muted' : ''}" title="${escapeHtml(ev.text)}">
        <b class="mn-hist-ord">${orderMark(ev.order)}</b>
        <span class="mn-hist-txt">${escapeHtml(shortBattleText(ev.text))}</span>
      </div>`).join('');
    return `<div class="mn-hist" aria-label="本地点战况记录">${rows}</div>`;
  }

  function clearConfirmArm() {
    if (localUI.confirmArm?.timer) window.clearTimeout(localUI.confirmArm.timer);
    localUI.confirmArm = null;
  }

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
        document.getElementById('panel-log')?.classList.add('is-hidden');
        localUI.logDrawerOpen = false;
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
        window.requestAnimationFrame(() => {
          Map3D.setPreset('default');
          const me = getSelfPlayer();
          if (me && me.location) window.setTimeout(() => Map3D.focusNode(me.location), 80);
        });
      }
      UI.renderPlayers();
      UI.renderTurnRail();
      UI.renderNoviceHint();
      UI.renderActionDock();
      UI.renderLog();
      UI.renderComms();
    },

    // 本回合动作序列条：① 雨宫莲 移动 ② 夜神月 扒裤→雨宫莲
    renderTurnRail() {
      const nowEl = document.getElementById('rail-now');
      const track = document.getElementById('rail-track');
      if (!track || !nowEl) return;
      const activeP = getPlayer(state.activePlayerId);
      const phaseMap = {
        rps: '猜拳', initiative: '抢顺位', action: activeP ? `${activeP.name} 行动` : '行动',
        sub_rps: '对决', stealth_reveal: '揭晓', gameover: '终局'
      };
      nowEl.textContent = `T${String(state.turn).padStart(2, '0')} ${phaseMap[state.phase] || ''}`;
      const feed = Array.isArray(state.turnFeed) ? state.turnFeed : [];
      const chips = feed.map((e, i) => {
        const last = i === feed.length - 1;
        return `<button class="rail-chip ${last ? 'is-last' : ''}" type="button" data-node-id="${e.nodeId || ''}" title="${escapeHtml(`${e.actor} ${e.verb}${e.target ? ' → ' + e.target : ''}${e.result ? ' · ' + e.result : ''}`)}">
          <b>${e.order ? orderMark(e.order) : orderMark(i + 1)}</b>${escapeHtml(e.actor)}<i>${escapeHtml(e.verb)}</i>${e.target ? `<em>→${escapeHtml(e.target)}</em>` : ''}
        </button>`;
      }).join('');
      track.innerHTML = chips || '<span class="rail-empty">还没有人动作</span>';
      track.scrollLeft = track.scrollWidth;
    },

    // 新手模式：一句话讲清现在该干什么
    renderNoviceHint() {
      const el = document.getElementById('novice-hint');
      const txt = document.getElementById('novice-hint-text');
      if (!el || !txt) return;
      if (!localUI.novice) { el.classList.add('is-hidden'); return; }
      el.classList.remove('is-hidden');
      const me = getSelfPlayer();
      let msg = '';
      if (state.phase === 'rps') msg = me && state.rps?.choices?.[me.id] ? '已出拳，等别人亮牌…' : '先出拳：赢了才有步数，平局会立刻重猜。';
      else if (state.phase === 'initiative') msg = '赢了！抢「第一解释权」：决定自己第几个走。';
      else if (state.phase === 'sub_rps') msg = '三局两胜，先赢两小局的人获胜。';
      else if (state.phase === 'action') {
        msg = state.activePlayerId === state.selfId
          ? `轮到你了：用下面的按钮花掉 ${me?.steps ?? 0} 步，行动会自动记在地图上。`
          : `看别人行动：地图卡上会实时记下谁做了什么。`;
      } else if (state.phase === 'stealth_reveal') msg = '突袭者要现形了：他的暗步即将揭晓。';
      else msg = '战局进行中。';
      txt.textContent = msg;
    },

    renderLobby() {
      syncLobbyRuleCheckboxes();
      UI.renderRoleDossier();

      const listEl = document.getElementById('lobby-player-list');
      if (listEl) {
        const canEditAi = isHostAuthority() && !state.started;
        const roleOptionsHtml = (selectedId) => ROLES.map((r) => `<option value="${r.id}" ${r.id === selectedId ? 'selected' : ''}>${r.num} ${escapeHtml(r.name)}</option>`).join('');

        listEl.innerHTML = state.lobbyPlayers.map((p) => {
          const r = ROLE_MAP[p.roleId] || ROLE_MAP.normal;
          const selfClass = p.id === state.selfId ? 'is-self' : '';
          const canKick = isHostAuthority() && p.id !== state.selfId;
          const roleControl = p.isAI
            ? `<select class="pk-select pk-select--xs lobby-ai-role-select" data-ai-role-select="${p.id}" ${canEditAi ? '' : 'disabled'} aria-label="指定 ${escapeHtml(p.name)} 角色">${roleOptionsHtml(p.roleId)}</select>`
            : `<span class="seat-badge seat-badge--role">${escapeHtml(r.name)}</span>`;
          return `
            <div class="lobby-seat ${selfClass}">
              <div class="lobby-seat-info">
                ${p.isHost ? '<span class="seat-badge seat-badge--host">HOST</span>' : ''}
                ${p.isAI ? '<span class="seat-badge seat-badge--ai">AI</span>' : ''}
                <span class="lobby-seat-name">${escapeHtml(p.name)}</span>
              </div>
              <div class="lobby-seat-info">
                ${roleControl}
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
      if (hint) hint.textContent = isHostAuthority() ? `当前 ${state.lobbyPlayers.length}/8 人 · 下拉框可手选 AI 角色，点「开始对局」按当前配置开局` : '等待房主开启对局...';
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
      const mRoleLbl = document.getElementById('mobile-lobby-role-name');
      if (mRoleLbl) mRoleLbl.textContent = cur.name;
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
        const wOwner = state.weatherOwnerId ? getPlayer(state.weatherOwnerId) : null;
        const durTag = state.weather !== 'clear' && state.weatherTurnsLeft > 0 ? `[剩${state.weatherTurnsLeft}T]` : '';
        const ownerTag = wOwner && state.weather !== 'clear' ? `(${wOwner.name})` : '';
        const nextHint = state.nextWeather ? ` → 下:${WEATHERS[state.nextWeather].name}` : '';
        weatherEl.textContent = `天象: ${w.name}${durTag}${ownerTag}${nextHint}`;
        weatherEl.className = `hud-tag ${state.weather === 'bloodmoon' ? 'hud-tag--danger' : state.weather !== 'clear' ? 'hud-tag--warn' : ''}`;
      }

      if (collapseEl) {
        const warnNode = state.nextCollapseNodeId ? getNode(state.nextCollapseNodeId) : null;
        if (!state.config.collapseEnabled) { collapseEl.textContent = '坍塌: 已关闭'; collapseEl.className = 'hud-tag'; }
        else if (warnNode && !warnNode.collapsed) { collapseEl.textContent = `⚠ 下回坍塌: ${warnNode.name}`; collapseEl.className = 'hud-tag hud-tag--danger'; }
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
      bar.innerHTML = ALL_SQ_IDS.map((id) => {
        const a = state.artifacts[id];
        const m = ARTIFACTS[id];
        const owner = a.ownerId ? getPlayer(a.ownerId) : null;
        const dropNode = a.droppedAt ? getNode(a.droppedAt) : null;
        const cls = a.destroyed ? 'is-destroyed' : owner ? 'is-owned' : dropNode ? 'is-dropped' : '';
        const rightHtml = a.destroyed
          ? '<span>💥 已毁</span>'
          : owner
            ? `<span>👑 ${escapeHtml(owner.name)}</span>`
            : dropNode
              ? `<span>📍 ${escapeHtml(dropNode.name)}</span>`
              : `<span class="artifact-pips">${Array.from({ length: m.stepsNeed }, (_, i) => `<span class="artifact-pip ${i < a.progress ? 'is-filled' : ''}"></span>`).join('')}</span>`;
        return `<div class="artifact-pill ${cls}" data-artifact-info="${id}" title="${escapeHtml(m.desc)}"><span>${escapeHtml(m.name)}</span>${rightHtml}</div>`;
      }).join('');
    },

    renderMap() {
      const containers = { sky: document.getElementById('nodes-sky'), land: document.getElementById('nodes-land'), ocean: document.getElementById('nodes-ocean') };
      if (!containers.land) return;

      const vp = document.getElementById('map-viewport');
      if (vp) vp.classList.toggle('is-fog-immune', state.weather === 'fog' && state.weatherOwnerId === state.selfId);

      const self = getSelfPlayer();
      const isMyAction = state.phase === 'action' && state.activePlayerId === state.selfId && !state.pendingAction;
      const reachableSet = new Set(isMyAction && self && self.status === 'alive' ? getReachableMoveNodes(self).map((n) => n.id) : []);
      const buckets = { sky: [], land: [], ocean: [] };
      const nowMs = Date.now();

      Object.values(state.nodes).forEach((node) => {
        const occupants = state.players.filter((p) => p.status === 'alive' && p.location === node.id);
        const visibleOccupants = occupants.filter((p) => !(p.stealth?.active && p.id !== state.selfId));
        const hasWarden = node.kind === 'prison_out' && !node.collapsed;
        const isWarnCollapse = state.nextCollapseNodeId === node.id && !node.collapsed;
        const isPulsing = (localUI.pulsingNodes.get(node.id) || 0) > nowMs;
        const hist = Array.isArray(node.history) ? node.history : [];
        const hasEntities = visibleOccupants.length > 0 || hasWarden || node.corpses.length > 0 || node.droppedArtifacts.length > 0 || isBarrierActive(node.id) || isWarnCollapse || isPulsing || hist.length > 0;
        const isSelfHere = self && self.status === 'alive' && self.location === node.id;
        const isTarget = localUI.subPanelState?.type === 'move' && reachableSet.has(node.id);
        const isFocused = localUI.focusNodeId === node.id;

        const classes = ['map-node'];
        classes.push(node.kind === 'home' ? 'map-node--home' : 'map-node--site');
        if (node.layer) classes.push(`map-node--${node.layer}`);
        if (isSelfHere) classes.push('is-self-loc');
        if (isTarget) classes.push('is-targetable');
        if (node.collapsed) classes.push('is-collapsed');
        if (isWarnCollapse) classes.push('is-collapse-warn');
        if (isBarrierActive(node.id)) classes.push('is-barrier');
        if (isPulsing) classes.push('is-recent-pulse');
        if (isFocused) classes.push('is-node-focus');
        if (!hasEntities && !isTarget && !node.collapsed) classes.push('is-empty-hidden');

        if (!buckets[node.layer]) return;

        const badge = node.collapsed ? '💥已塌' : isWarnCollapse ? '⚠将塌' : isBarrierActive(node.id) ? '🔮结界' : '';
        const turnActs = hist.filter((h) => h.turn === state.turn).length;
        const titleTip = escapeHtml(node.desc || node.name);

        if (node.kind === 'home') {
          // 出生点用迷你卡：名字 + 关键指标，避免挤占主要地点版面
          const chips = visibleOccupants.map((p) => {
            const chipCls = p.id === state.selfId ? 'is-self' : p.wanted ? 'is-wanted' : '';
            const tip = `${p.name}｜❤${p.hp} 👖${p.pants}/${p.maxPants} 🔪${p.knives} 技${p.activeCharges}｜${statusChipText(p, node) || '无状态'}`;
            return `<span class="home-chip ${chipCls}" data-agent-id="${p.id}" title="${escapeHtml(tip)}">${escapeHtml(p.name)} <b>❤${p.hp}</b><b>👖${p.pants}</b><b>🔪${p.knives}</b></span>`;
          }).join('');
          buckets[node.layer].push(`
            <div class="${classes.join(' ')}" data-node-id="${node.id}" style="--x:${node.x}%; --y:${node.y}%;" title="${titleTip}">
              <div class="mn-head">
                <span class="mn-name">🏠 ${escapeHtml(node.name)}</span>
                ${badge ? `<span class="mn-tag mn-tag--alert">${badge}</span>` : ''}
              </div>
              <div class="node-tokens home-tokens">${chips || '<span class="home-empty">空</span>'}</div>
            </div>
          `);
          return;
        }

        const unitsHtml = visibleOccupants.slice(0, 4).map((p) => buildUnitCard(p, node)).join('');
        const moreUnits = visibleOccupants.length > 4 ? `<div class="mn-more">+${visibleOccupants.length - 4} 人仍在此地</div>` : '';

        const assets = [];
        if (hasWarden) assets.push(`<span class="mn-asset mn-asset--npc" title="NPC 典狱长：3裤1命，击杀后狱内全员释放">🗝 典狱长 ${state.warden.pants}👖/${state.warden.hp}❤</span>`);
        node.droppedArtifacts.forEach((sqId) => assets.push(`<span class="mn-asset mn-asset--loot" title="${escapeHtml(ARTIFACTS[sqId].desc)}">🔻 ${ARTIFACTS[sqId].short}</span>`));
        if (node.corpses.length) assets.push(`<span class="mn-asset mn-asset--corpse">☠ 尸×${node.corpses.length}</span>`);

        const unitsBlock = (visibleOccupants.length || assets.length)
          ? `<div class="mn-units node-tokens">${unitsHtml}${assets.join('')}${moreUnits}</div>`
          : '';

        buckets[node.layer].push(`
          <div class="${classes.join(' ')}" data-node-id="${node.id}" style="--x:${node.x}%; --y:${node.y}%;" title="${titleTip}">
            <div class="mn-head">
              <span class="mn-name">${NODE_KIND_ICON[node.kind] || '◈'} ${escapeHtml(node.name)}</span>
              <span class="mn-head-tags">
                ${turnActs > 0 ? `<span class="mn-tag mn-tag--live" title="本回合已有 ${turnActs} 条动作记录">⚡${turnActs}</span>` : ''}
                ${badge ? `<span class="mn-tag mn-tag--alert">${badge}</span>` : ''}
                <span class="mn-tag mn-tag--layer">${NODE_LAYER_LABEL[node.layer] || ''}</span>
              </span>
            </div>
            ${unitsBlock}
            ${buildNodeHistory(node)}
          </div>
        `);
      });

      containers.sky.innerHTML = buckets.sky.join('');
      containers.land.innerHTML = buckets.land.join('');
      containers.ocean.innerHTML = buckets.ocean.join('');

      // 开局引导水印：棋盘上还没有任何战况时才显示
      const hintEl = document.getElementById('map-empty-hint');
      if (hintEl) {
        const anyHistory = Object.values(state.nodes).some((n) => Array.isArray(n.history) && n.history.length > 0);
        hintEl.classList.toggle('is-hidden', anyHistory || state.turn > 2);
      }
    },

    renderPlayers() {
      const el = document.getElementById('agent-ribbon');
      if (!el) return;
      const selfFogImmune = state.weather === 'fog' && state.weatherOwnerId === state.selfId;
      const orderIndex = new Map();
      (state.turnQueue || []).forEach((e, i) => { if (!orderIndex.has(e.playerId)) orderIndex.set(e.playerId, i + 1); });

      el.innerHTML = state.players.map((p) => {
        const role = ROLE_MAP[p.roleId] || ROLE_MAP.normal;
        const node = getNode(p.location);
        const cls = ['agent-chip'];
        if (p.id === state.selfId) cls.push('is-self');
        if (p.id === state.activePlayerId && state.phase === 'action') cls.push('is-acting');
        if (p.wanted) cls.push('is-wanted');
        if (p.status !== 'alive') cls.push('is-down');

        const hidden = (state.weather === 'fog' && !selfFogImmune && p.id !== state.selfId) || (p.stealth?.active && p.id !== state.selfId);
        const loc = hidden ? '???' : node?.name || '-';

        const flags = [];
        if (p.wanted) flags.push('🚨');
        if (p.stealth?.active) flags.push('👁');
        if (p.paralyzed) flags.push('⚡');
        if (p.bomb) flags.push('💣');
        if (p.ascendCharged) flags.push('☁');
        if (p.shield > 0) flags.push(`🛡${p.shield}`);
        if (p.roleId === 'reverser' && p.momentum > 0) flags.push(`势${p.momentum}`);
        if (p.status === 'pending_revive') flags.push('待复');
        if (p.status === 'dead_final') flags.push('死透');

        const ord = orderIndex.get(p.id);
        const stepTxt = p.steps > 0 ? `<span class="ac-step">${p.steps}步</span>` : '';
        const tip = `${p.name} · ${role.name}｜${loc}｜❤${p.hp} 👖${p.pants}/${p.maxPants} 🔪${p.knives} 技${p.activeCharges} 杀${p.kills}`;

        return `
          <button class="${cls.join(' ')}" type="button" data-agent-id="${p.id}" data-node-id="${p.location}" title="${escapeHtml(tip)}">
            ${ord ? `<span class="ac-order">#${ord}</span>` : ''}
            <span class="ac-main"><span class="ac-name">${escapeHtml(p.name)}</span><span class="ac-role">${escapeHtml(role.name)}</span></span>
            <span class="ac-stats"><b class="ac-hp">❤${p.hp}</b><b>👖${p.pants}/${p.maxPants}</b><b>🔪${p.knives}</b><b>技${p.activeCharges}</b></span>
            <span class="ac-foot">
              <span class="ac-loc">📍${escapeHtml(loc)}</span>
              ${flags.length ? `<span class="ac-flags">${flags.join(' ')}</span>` : ''}
            </span>
            ${stepTxt}
          </button>`;
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
          ${self.roleId === 'ninja' && !self.bladeReady ? '<span class="self-pill self-pill--warn">未弹刃 (需先弹刃)</span>' : ''}
          ${self.ascendCharged ? '<span class="self-pill">☁已蓄力</span>' : ''}
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
          const selfFogImmune = state.weather === 'fog' && state.weatherOwnerId === self.id;
          const intelHtml = ini.allWinners
            .filter((id) => id !== ini.firstWinnerId)
            .map((id) => {
              const op = getPlayer(id);
              const loc = (state.weather === 'fog' && !selfFogImmune && op?.id !== self.id) ? '???' : (getNode(op?.location)?.name || '-');
              return `<span class="init-intel-chip">${escapeHtml(op?.name || '?')} · ${escapeHtml(loc)} · ${op?.steps || 0}步 · ${op?.knives || 0}🔪 · ${op?.pants || 0}👖</span>`;
            }).join('');
          boxInit.innerHTML = `
            <div class="subpanel-head"><span>📌 第一解释权：${escapeHtml(getPlayer(ini.firstWinnerId)?.name)} 自选出手顺位</span></div>
            ${intelHtml ? `<div class="init-intel-bar">${intelHtml}</div>` : ''}
            ${isPicker ? `<div class="action-btn-grid">${Array.from({ length: total }, (_, idx) => `<button class="pk-btn pk-btn--primary" data-pick-slot="${idx}" type="button"><span class="btn-label">选择第 ${idx + 1} 个走${idx === 0 ? '（先手）' : idx === total - 1 ? '（压轴）' : ''}</span></button>`).join('')}</div>` : '<div>等待第一名决定出手顺位...</div>'}
          `;
        }
        return;
      }

      if (state.phase === 'stealth_reveal') {
        boxSub.classList.remove('is-hidden');
        if (state.activePlayerId !== self.id) {
          boxSub.innerHTML = `<div class="subpanel-head"><span>等待 ${escapeHtml(getPlayer(state.activePlayerId)?.name || '…')} 揭晓</span></div>`;
          return;
        }
        const moves = getReachableMoveNodes(self);
        boxSub.innerHTML = `
          <div class="subpanel-head"><span>暗步</span></div>
          <div class="action-btn-grid">
            <button class="pk-btn pk-btn--primary" data-stealth-act="draw_knife" type="button"><span class="btn-label">🔪 暗中拔刀</span></button>
            <button class="pk-btn pk-btn--primary" data-stealth-act="wear_pants" type="button" ${self.pants >= self.maxPants || (state.weather === 'storm' && curNode?.layer === 'land' && !isStormImmune(self)) ? 'disabled' : ''}><span class="btn-label">👖 暗中穿裤</span></button>
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
        clearConfirmArm();
        boxAct.classList.remove('is-hidden');
        const activeP = getPlayer(state.activePlayerId);
        boxAct.innerHTML = `<div>轮到 <strong>${escapeHtml(activeP?.name || '…')}</strong> · 等待</div>`;
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

      const confirmBtn = (key, cls, quickAct, label) => {
        const isArmed = localUI.confirmArm?.key === key;
        const text = isArmed ? '再点确认' : label;
        return `<button class="pk-btn ${cls} ${isArmed ? 'is-confirm-arm' : ''}" data-quick-act="${quickAct}" data-confirm-key="${key}" type="button"><span class="btn-label">${text}</span></button>`;
      };

      if (self.roleId === 'ninja' && !self.bladeReady) {
        btns.push('<button class="pk-btn pk-btn--crimson" data-quick-act="blade_draw" type="button"><span class="btn-label">弹刃</span></button>');
      }
      if (self.bomb && enemiesHere.length > 0) btns.push('<button class="pk-btn pk-btn--crimson" data-open-sub="pass_bomb" type="button"><span class="btn-label">过继💣</span></button>');
      if (!self.parasiteHostId && getReachableMoveNodes(self).length > 0) btns.push('<button class="pk-btn pk-btn--primary" data-open-sub="move" type="button"><span class="btn-label">移动</span></button>');
      if (!self.parasiteHostId && curNode?.layer === 'land' && curNode.kind !== 'prison_in' && !self.ascendCharged && !hasSQ(self, 'SQ4')) {
        btns.push('<button class="pk-btn pk-btn--accent" data-quick-act="charge_ascend" type="button"><span class="btn-label">升天</span></button>');
      }
      if (!self.parasiteHostId && hasSQ(self, 'SQ2') && getReachableMoveNodes(self).length > 0) btns.push('<button class="pk-btn pk-btn--crimson" data-open-sub="sq2_dash" type="button"><span class="btn-label">突进</span></button>');
      if (hasSQ(self, 'SQ5')) btns.push('<button class="pk-btn pk-btn--accent" data-open-sub="sq5_magnet" type="button"><span class="btn-label">吸刀</span></button>');
      if (!self.parasiteHostId && hasSQ(self, 'SQ6') && curNode?.kind !== 'prison_in' && !isBarrierActive(curNode?.id)) btns.push('<button class="pk-btn pk-btn--crimson" data-open-sub="sq6_hook" type="button"><span class="btn-label">钩爪</span></button>');

      const canWear = self.pants < self.maxPants && !(state.weather === 'storm' && curNode?.layer === 'land' && !isStormImmune(self));
      btns.push(`<button class="pk-btn pk-btn--ghost" data-quick-act="wear_pants" type="button" ${canWear ? '' : 'disabled'}><span class="btn-label">穿裤</span></button>`);
      btns.push('<button class="pk-btn pk-btn--ghost" data-quick-act="draw_knife" type="button"><span class="btn-label">拔刀</span></button>');

      const hasWardenHere = canAttackWardenFrom(curNode);
      if (enemiesHere.length > 0 || hasWardenHere) {
        btns.push('<button class="pk-btn pk-btn--accent" data-open-sub="strip_pants" type="button"><span class="btn-label">扒裤</span></button>');
        const ninjaLocked = self.roleId === 'ninja' && !self.bladeReady;
        if (canStabWithWeapon(self) || ninjaLocked) {
          const stabTag = ninjaLocked ? '需先弹刃' : self.knives >= 1 ? '刀' : '利刃';
          btns.push(`<button class="pk-btn pk-btn--crimson" data-open-sub="stab" type="button" ${ninjaLocked ? 'disabled' : ''}><span class="btn-label">咔</span></button>`);
        }
      }
      if (enemiesHere.some((e) => e.knives > 0)) btns.push('<button class="pk-btn pk-btn--ghost" data-open-sub="steal_knife" type="button"><span class="btn-label">抢刀</span></button>');
      if (enemiesHere.some((e) => needsPinchPigFace(self, e))) btns.push('<button class="pk-btn pk-btn--accent" data-open-sub="pinch_pigface" type="button"><span class="btn-label">捏脸</span></button>');
      if (enemiesHere.some((e) => e.oxygenTank) && !self.oxygenTank) btns.push('<button class="pk-btn pk-btn--ghost" data-open-sub="steal_tank" type="button"><span class="btn-label">抢氧</span></button>');

      if (curNode && curNode.layer !== 'land') btns.push('<button class="pk-btn pk-btn--primary" data-quick-act="breathe" type="button"><span class="btn-label">换气</span></button>');
      if (curNode && curNode.droppedArtifacts.length > 0) {
        curNode.droppedArtifacts.forEach((sqId) => btns.push(`<button class="pk-btn pk-btn--accent" data-pickup-sq="${sqId}" type="button"><span class="btn-label">拾 ${ARTIFACTS[sqId].short}</span></button>`));
      }
      if (parasitesOnMe.length > 0) btns.push('<button class="pk-btn pk-btn--accent" data-quick-act="shake_parasite" type="button"><span class="btn-label">甩寄生</span></button>');
      if (hiddenRaiders.length > 0) btns.push('<button class="pk-btn pk-btn--crimson" data-open-sub="predict_raider" type="button"><span class="btn-label">预判</span></button>');

      if (curNode?.kind === 'police') {
        btns.push('<button class="pk-btn pk-btn--accent" data-open-sub="police_arrest" type="button"><span class="btn-label">逮捕</span></button>');
        btns.push('<button class="pk-btn pk-btn--ghost" data-quick-act="police_corpse" type="button"><span class="btn-label">搬尸</span></button>');
        btns.push(confirmBtn('police_surrender', 'pk-btn--danger', 'police_surrender', '自首'));
      } else if (curNode?.kind === 'blackmarket') {
        const isFreeBm = self.roleId === 'normal' && self.blackMarketFreeTurn !== state.turn;
        btns.push(`<button class="pk-btn pk-btn--crimson" data-quick-act="blackmarket_draw" type="button"><span class="btn-label">契约 ${isFreeBm ? '0步' : '8选3'}</span></button>`);
      } else if (curNode?.kind === 'aquarium' && !self.frogMask) {
        btns.push(confirmBtn('equip_frog_mask', 'pk-btn--accent', 'equip_frog_mask', '面罩'));
      } else if (curNode?.kind === 'ruins') {
        btns.push('<button class="pk-btn pk-btn--accent" data-quick-act="ruins_dig" type="button"><span class="btn-label">挖掘</span></button>');
      } else if (curNode?.kind === 'palace') {
        btns.push('<button class="pk-btn pk-btn--primary" data-open-sub="forge_artifact" type="button"><span class="btn-label">锻造</span></button>');
      } else if (curNode?.kind === 'wish') {
        btns.push(`<button class="pk-btn pk-btn--primary" data-quick-act="wish_step" type="button"><span class="btn-label">许愿 ${self.wishSteps}/2</span></button>`);
      } else if (curNode?.kind === 'observatory') {
        btns.push('<button class="pk-btn pk-btn--primary" data-open-sub="set_weather" type="button"><span class="btn-label">天象</span></button>');
      }

      const skillBtn = UI.buildRoleSkillButton(self);
      if (skillBtn) btns.push(skillBtn);

      const passLabel = hasSQ(self, 'SQ7') && self.steps > 0 ? '存步·结束' : '结束';
      if (self.steps > 0) {
        btns.push(confirmBtn('pass_with_steps', 'pk-btn--ghost', 'pass', passLabel));
      } else {
        btns.push(`<button class="pk-btn pk-btn--ghost" data-quick-act="pass" type="button"><span class="btn-label">${passLabel}</span></button>`);
      }
      boxAct.innerHTML = `<div class="action-btn-grid">${btns.join('')}</div>`;
    },

    buildRoleSkillButton(self) {
      if (self.parasiteHostId) {
        return '<button class="pk-btn pk-btn--crimson" data-open-sub="skill_parasite_burst" type="button"><span class="btn-label">破体</span></button>';
      }
      const r = ROLE_MAP[self.roleId];
      if (!r || r.activeMax <= 0 || self.roleId === 'ninja') return '';
      const disabled = self.activeCharges <= 0 || isHypoxic(self) ? 'disabled' : '';
      const label = self.roleId === 'mirror'
        ? `盗版(${self.activeCharges})${state.lastActiveSkill ? `:${state.lastActiveSkill.skillName}` : ':+1刀+0.5裤'}`
        : `${r.activeName} (${self.activeCharges})`;
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
          const targets = state.players.filter((p) => isVisibleAlive(p) && p.id !== self.id && (!isFogBlockedFor(self) || p.location === self.location));
          box.innerHTML = `
            <div class="subpanel-head"><span>对谁</span><button class="pk-btn pk-btn--ghost pk-btn--sm" data-bm-back="1" type="button"><span class="btn-label">返回契约</span></button></div>
            <div class="action-btn-grid">${targets.map((t) => `<button class="pk-btn pk-btn--crimson pk-btn--sm" data-bm-commit="${pickingTargetFor}" data-target="${t.id}" type="button"><span class="btn-label">${escapeHtml(t.name)} (${t.pants}👖)</span></button>`).join('') || '<span>暂无合法目标</span>'}</div>
          `;
          return;
        }
        const cards = pa.contracts.map((cid) => {
          const c = CONTRACTS.find((x) => x.id === cid);
          return `<button class="contract-card" data-bm-pick="${cid}" type="button"><div class="contract-title">${escapeHtml(c.name)}</div><div class="contract-gain">＋ ${escapeHtml(c.gain)}</div><div class="contract-cost">－ ${escapeHtml(c.cost)}</div></button>`;
        }).join('');
        box.innerHTML = `
          <div class="subpanel-head">
            <span>契约</span>
            <div>${pa.canFreeReroll ? '<button class="pk-btn pk-btn--accent pk-btn--sm" data-bm-reroll="1" type="button"><span class="btn-label">🔄 免费刷新</span></button>' : ''}<button class="pk-btn pk-btn--ghost pk-btn--sm" data-bm-cancel="1" type="button"><span class="btn-label">放弃</span></button></div>
          </div>
          <div class="contract-grid">${cards}</div>
        `;
        return;
      }

      if (pa.type === 'wish_pick') {
        const sub = localUI.subPanelState?.wishMode || null;
        if (sub === 'restore_pos') {
          const selected = new Set(localUI.subPanelState?.restoreIds || []);
          const aliveList = state.players.filter((p) => isVisibleAlive(p));
          const hasWardenOut = Boolean(state.nodes.land_prison_out && !state.nodes.land_prison_out.collapsed);
          const checks = aliveList.map((p) => `
            <label class="pk-check"><input type="checkbox" data-restore-uid="${p.id}" ${selected.has(p.id) ? 'checked' : ''} /><span class="pk-check-box"></span><span class="pk-check-text">${escapeHtml(p.name)} (${escapeHtml(getNode(p.location)?.name || '')})</span></label>
          `).join('');
          const wardenCheck = hasWardenOut
            ? `<label class="pk-check"><input type="checkbox" data-restore-uid="NPC_WARDEN" ${selected.has('NPC_WARDEN') ? 'checked' : ''} /><span class="pk-check-box"></span><span class="pk-check-text">NPC 典狱长 (${escapeHtml(getNode(state.warden.locationId || 'land_prison_out')?.name || '监狱外')})</span></label>`
            : '';
          box.innerHTML = `
            <div class="subpanel-head"><span>复原</span><button class="pk-btn pk-btn--ghost pk-btn--sm" data-wish-back="1" type="button"><span class="btn-label">返回</span></button></div>
            <div class="action-btn-grid" style="margin-bottom:8px;">${checks}${wardenCheck}</div>
            <button class="pk-btn pk-btn--crimson pk-btn--sm" data-wish-restore-confirm="1" type="button" ${selected.size === 0 ? 'disabled' : ''}><span class="btn-label">✨ 确认复原所选 (${selected.size}个单位)</span></button>
          `;
          return;
        }
        if (sub === 'revive' || sub === 'jail') {
          if (sub === 'revive' && isUnderworldCollapsed()) {
            box.innerHTML = `<div class="subpanel-head"><span>【地府】已坍塌，冥界召回不可复活！</span><button class="pk-btn pk-btn--ghost pk-btn--sm" data-wish-back="1" type="button"><span class="btn-label">返回</span></button></div>`;
            return;
          }
          const pool = sub === 'revive' ? state.players.filter((p) => p.status !== 'alive' && p.status !== 'dead_final') : state.players.filter((p) => isVisibleAlive(p) && !isBarrierActive(p.location));
          box.innerHTML = `
            <div class="subpanel-head"><span>${sub === 'revive' ? '复活谁' : '关谁'}</span><button class="pk-btn pk-btn--ghost pk-btn--sm" data-wish-back="1" type="button"><span class="btn-label">返回</span></button></div>
            <div class="action-btn-grid">${pool.map((t) => `<button class="pk-btn pk-btn--crimson pk-btn--sm" data-wish-exec="${sub}" data-target="${t.id}" type="button"><span class="btn-label">${escapeHtml(t.name)}</span></button>`).join('') || '<span>无可选目标</span>'}</div>
          `;
          return;
        }
        if (sub === 'swap') {
          const alive = state.players.filter((p) => isVisibleAlive(p) && !isBarrierActive(p.location));
          const first = localUI.subPanelState?.wishFirst || null;
          box.innerHTML = `
            <div class="subpanel-head"><span>交换</span><button class="pk-btn pk-btn--ghost pk-btn--sm" data-wish-back="1" type="button"><span class="btn-label">返回</span></button></div>
            <div class="action-btn-grid">${alive.filter((p) => p.id !== first).map((t) => `<button class="pk-btn pk-btn--primary pk-btn--sm" data-wish-swap="${t.id}" type="button"><span class="btn-label">${escapeHtml(t.name)}</span></button>`).join('')}</div>
          `;
          return;
        }
        box.innerHTML = `<div class="subpanel-head"><span>许愿</span></div><div class="action-btn-grid">${WISH_OPTIONS.map((w) => `<button class="pk-btn pk-btn--primary pk-btn--sm pk-btn--rich" data-wish-pick="${w.id}" type="button" title="${escapeHtml(w.desc)}"><span class="btn-label"><strong>${escapeHtml(w.name)}</strong><span class="btn-sub-line">${escapeHtml(w.shortDesc)}</span></span></button>`).join('')}</div>`;
        return;
      }

      if (pa.type === 'ninja_chain') {
        const targets = Engine.getNinjaChainTargets(self);
        box.innerHTML = `
          <div class="subpanel-head"><span>连撞</span><button class="pk-btn pk-btn--ghost pk-btn--sm" data-ninja-skip="1" type="button"><span class="btn-label">停止连撞</span></button></div>
          <div class="action-btn-grid">${targets.map((t) => `<button class="pk-btn pk-btn--crimson pk-btn--sm" data-ninja-hit="${t.id}" type="button"><span class="btn-label">撞击 ${escapeHtml(t.name)}</span></button>`).join('')}</div>
        `;
      }
    },

    renderLocalSubpanel(box, self, sub) {
      const closeBtn = '<button class="pk-btn pk-btn--ghost pk-btn--sm" data-close-sub="1" type="button"><span class="btn-label">返回</span></button>';
      const curNode = getNode(self.location);
      const enemiesHere = getAlivePlayersAt(self.location, self.id);
      const aliveEnemies = state.players.filter((p) => isVisibleAlive(p) && p.id !== self.id);
      const fogBlocked = isFogBlockedFor(self);
      const targetTags = (t) => {
        const tags = [];
        if (needsPinchPigFace(self, t)) tags.push('🐷需捏脸');
        if (t.shield > 0) tags.push(`🛡×${t.shield}`);
        if (hasSQ(t, 'SQ8')) tags.push('铁裤');
        if (getNode(t.location)?.kind === 'ruins') tags.push('50%闪避');
        return tags.length ? ` [${tags.join('·')}]` : '';
      };

      if (sub.type === 'move') {
        const moves = getReachableMoveNodes(self);
        const carryable = enemiesHere.filter((e) => !e.parasiteHostId);
        const carryChecks = carryable.map((e) => {
          const checked = (sub.carryIds || []).includes(e.id);
          return `
            <label class="pk-check">
              <input type="checkbox" data-carry-id="${e.id}" ${checked ? 'checked' : ''} />
              <span class="pk-check-box"></span>
              <span class="pk-check-text">强带 ${escapeHtml(e.name)}${needsPinchPigFace(self, e) ? ' 🐷' : ''}</span>
            </label>
          `;
        }).join('');

        const isFromStable = curNode?.kind === 'stable';
        const renderDestBtn = (n, cls) => {
          const warnTag = state.nextCollapseNodeId === n.id ? ' ⚠将塌' : '';
          if (isFromStable && n.layer === 'land') {
            const strippables = getAlivePlayersAt(n.id, self.id).filter((t) => !needsPinchPigFace(self, t) && t.pants > 0);
            if (strippables.length > 1) {
              return strippables.map((t) => `<button class="pk-btn pk-btn--crimson pk-btn--sm" data-move-dest="${n.id}" data-stable-target="${t.id}" type="button"><span class="btn-label">🐎 空降【${escapeHtml(n.name)}】扒 ${escapeHtml(t.name)}${warnTag}</span></button>`).join('');
            }
            const bonus = strippables.length === 1 ? ` · 扒${strippables[0].name}` : ' · +1🔪';
            return `<button class="pk-btn pk-btn--accent pk-btn--sm" data-move-dest="${n.id}" type="button"><span class="btn-label">🐎 ${escapeHtml(n.name)}${escapeHtml(bonus)}${warnTag}</span></button>`;
          }
          return `<button class="pk-btn ${cls} pk-btn--sm" data-move-dest="${n.id}" type="button"><span class="btn-label">${escapeHtml(n.name)}${warnTag}</span></button>`;
        };

        const groups = [
          { layer: 'sky', label: '☁ 天空', cls: 'pk-btn--accent' },
          { layer: 'land', label: '🏔 陆地', cls: 'pk-btn--primary' },
          { layer: 'ocean', label: '🌊 海洋', cls: 'pk-btn--ghost' }
        ].map((g) => {
          const list = moves.filter((n) => n.layer === g.layer);
          if (list.length === 0) return '';
          return `<div class="move-group-row"><span class="move-group-label">${g.label}</span>${list.map((n) => renderDestBtn(n, g.cls)).join('')}</div>`;
        }).join('');
        box.innerHTML = `
          <div class="subpanel-head"><span>去哪</span>${closeBtn}</div>
          ${carryChecks ? `<div class="action-btn-grid" style="margin-bottom:6px;">${carryChecks}</div>` : ''}
          ${groups}
        `;
        return;
      }

      if (sub.type === 'sq2_dash') {
        const ninjaLocked = self.roleId === 'ninja' && !self.bladeReady;
        const weaponTag = self.knives >= 1 ? '刀' : '利刃';
        const isFromStable = curNode?.kind === 'stable';
        const combos = [];
        getReachableMoveNodes(self).forEach((n) => {
          const foes = getAlivePlayersAt(n.id, self.id);
          const stableLand = isFromStable && n.layer === 'land';
          const stableNoFoeTag = stableLand ? ' · 🐎空降+1🔪' : '';
          if (foes.length === 0 && n.kind !== 'prison_out') combos.push(`<button class="pk-btn pk-btn--ghost pk-btn--sm" data-sq2-dest="${n.id}" data-sq2-target="" type="button"><span class="btn-label">突进至 ${escapeHtml(n.name)} (空${stableNoFoeTag})</span></button>`);
          foes.forEach((f) => {
            const canStableStrip = stableLand && !needsPinchPigFace(self, f) && f.pants > 0;
            const willZeroAfterDrop = canStableStrip && Math.max(0, roundHalf(f.pants - (hasSQ(f, 'SQ8') ? 0.5 : 1))) <= 0;
            const note = ninjaLocked
              ? ' [需先弹刃]'
              : canStableStrip
                ? (willZeroAfterDrop ? ` (🐎空降扒光+${weaponTag})` : ` (🐎空降扒1+突进再扒 · 原${f.pants}👖)`)
                : f.pants <= 0
                  ? ` (${stableLand ? '🐎+1🔪+' : ''}${weaponTag})`
                  : ` (${f.pants}👖)`;
            combos.push(`<button class="pk-btn pk-btn--crimson pk-btn--sm" data-sq2-dest="${n.id}" data-sq2-target="${f.id}" type="button" ${ninjaLocked ? 'disabled' : ''}><span class="btn-label">⚡ 突进【${escapeHtml(n.name)}】${escapeHtml(f.name)}${note}</span></button>`);
          });
          if (n.kind === 'prison_out') {
            const noteW = ninjaLocked ? ' [需先弹刃]' : state.warden.pants <= 0 ? ` (${stableLand ? '🐎+1🔪+' : ''}${weaponTag})` : ` (${state.warden.pants}👖)`;
            combos.push(`<button class="pk-btn pk-btn--accent pk-btn--sm" data-sq2-dest="${n.id}" data-sq2-target="NPC_WARDEN" type="button" ${ninjaLocked ? 'disabled' : ''}><span class="btn-label">⚡ 突进斩典狱长${noteW}</span></button>`);
          }
        });
        box.innerHTML = `<div class="subpanel-head"><span>突进 · 选目标</span>${closeBtn}</div><div class="action-btn-grid">${combos.join('')}</div>`;
        return;
      }

      if (['strip_pants', 'stab', 'steal_knife', 'pinch_pigface', 'steal_tank', 'pass_bomb', 'police_arrest', 'sq5_magnet', 'sq6_hook'].includes(sub.type)) {
        const isRemoteAct = ['police_arrest', 'sq5_magnet', 'sq6_hook'].includes(sub.type);
        let targets = isRemoteAct ? aliveEnemies : enemiesHere;
        if (isRemoteAct && fogBlocked) targets = targets.filter((e) => e.location === self.location);
        if (sub.type === 'police_arrest') targets = targets.filter((e) => e.location !== 'land_prison_in' && !isBarrierActive(e.location));
        if (sub.type === 'steal_knife') targets = targets.filter((e) => e.knives > 0);
        if (sub.type === 'sq5_magnet') targets = targets.filter((e) => e.knives > 0 && (e.location === self.location || (!isBarrierActive(self.location) && !isBarrierActive(e.location))));
        if (sub.type === 'sq6_hook') targets = targets.filter((e) => e.location !== self.location && e.location !== 'land_prison_in' && !e.parasiteHostId && !isBarrierActive(e.location));
        if (sub.type === 'pinch_pigface') targets = targets.filter((e) => needsPinchPigFace(self, e));
        if (sub.type === 'steal_tank') targets = targets.filter((e) => e.oxygenTank);

        const items = targets.map((t) => {
          const extra = sub.type === 'sq5_magnet' ? `${t.knives}🔪` : sub.type === 'sq6_hook' ? `${escapeHtml(getNode(t.location)?.name || '')}` : `${t.pants}👖/${t.hp}❤️`;
          const hint = sub.type === 'pinch_pigface' ? '' : targetTags(t);
          return `<button class="pk-btn pk-btn--crimson pk-btn--sm" data-target-act="${sub.type}" data-target="${t.id}" type="button"><span class="btn-label">${escapeHtml(t.name)} (${extra})${escapeHtml(hint)}</span></button>`;
        });
        if ((sub.type === 'strip_pants' || sub.type === 'stab') && canAttackWardenFrom(curNode)) {
          items.push(`<button class="pk-btn pk-btn--accent pk-btn--sm" data-target-act="${sub.type}" data-target="NPC_WARDEN" type="button"><span class="btn-label">NPC 典狱长 (${state.warden.pants}👖/${state.warden.hp}❤️)</span></button>`);
        }

        // 突袭者同房 >=2 名 0 裤合法目标：展开「⚔ 刃锋分伤」卡片
        let splitHtml = '';
        if (sub.type === 'stab' && self.roleId === 'raider') {
          const zeroList = getZeroPantsTargetsAt(self, self.location);
          if (zeroList.length >= 2) {
            const totalDmg = Engine.calcStabDamage(self);
            if (!sub.splitAlloc) {
              sub.splitAlloc = {};
              zeroList.forEach((z) => { sub.splitAlloc[z.id] = 0; });
            }
            const used = roundHalf(Object.values(sub.splitAlloc).reduce((a, b) => a + (Number(b) || 0), 0));
            const rem = roundHalf(totalDmg - used);
            const rows = zeroList.map((z) => {
              const curAmt = roundHalf(sub.splitAlloc[z.id] || 0);
              return `
                <div class="split-row">
                  <span>${escapeHtml(z.name)} (❤️${z.hp})</span>
                  <div class="split-stepper">
                    <button class="split-btn" data-split-adj="${z.id}" data-delta="-0.5" type="button" ${curAmt <= 0 ? 'disabled' : ''}>−</button>
                    <span class="split-val">${curAmt}</span>
                    <button class="split-btn" data-split-adj="${z.id}" data-delta="0.5" type="button" ${rem < 0.5 ? 'disabled' : ''}>+</button>
                  </div>
                </div>
              `;
            }).join('');
            splitHtml = `
              <div class="raider-split-card">
                <div class="raider-split-head">
                  <span>⚔ 刃锋分伤 (1步+1刀 · 总额 ${totalDmg})</span>
                  <span>待分配: ${rem}</span>
                </div>
                ${rows}
                <button class="pk-btn pk-btn--crimson pk-btn--sm" data-split-confirm="1" type="button" ${rem !== 0 ? 'disabled' : ''}>
                  <span class="btn-label">⚔ 确认分伤斩击 (${used}/${totalDmg})</span>
                </button>
              </div>
            `;
          }
        }

        const fogNote = isRemoteAct && fogBlocked ? ' · 迷雾屏蔽跨点远程' : '';
        box.innerHTML = `<div class="subpanel-head"><span>选目标</span>${closeBtn}</div><div class="action-btn-grid">${items.join('') || '<span>暂无符合条件的目标</span>'}</div>${splitHtml}`;
        return;
      }

      if (sub.type === 'predict_raider') {
        const raiders = state.players.filter((p) => p.status === 'alive' && p.stealth?.active && p.stealth.turnUsed < state.turn && p.id !== self.id);
        box.innerHTML = `
          <div class="subpanel-head"><span>预判</span>${closeBtn}</div>
          <div class="action-btn-grid">${raiders.map((r) => `
            <button class="pk-btn pk-btn--accent pk-btn--sm" data-predict="${r.id}" data-mode="strip" type="button"><span class="btn-label">预判扒裤 → ${escapeHtml(r.name)}</span></button>
            ${canStabWithWeapon(self) ? `<button class="pk-btn pk-btn--crimson pk-btn--sm" data-predict="${r.id}" data-mode="stab" type="button"><span class="btn-label">预判绝杀(${self.knives >= 1 ? '刀' : '利刃'}) → ${escapeHtml(r.name)}</span></button>` : ''}
          `).join('')}</div>
        `;
        return;
      }

      if (sub.type === 'forge_artifact') {
        const list = ALL_SQ_IDS.filter((id) => !state.artifacts[id].ownerId && !state.artifacts[id].droppedAt && !state.artifacts[id].destroyed);
        box.innerHTML = `<div class="subpanel-head"><span>锻造</span>${closeBtn}</div><div class="action-btn-grid">${list.map((id) => `<button class="pk-btn pk-btn--primary pk-btn--sm pk-btn--rich" data-forge-sq="${id}" type="button" title="${escapeHtml(ARTIFACTS[id].desc)}"><span class="btn-label"><strong>${ARTIFACTS[id].name} (${state.artifacts[id].progress}/${ARTIFACTS[id].stepsNeed})</strong><span class="btn-sub-line">${escapeHtml(ARTIFACTS[id].shortDesc)}</span></span></button>`).join('') || '<span>八件神器已全部出世或毁灭</span>'}</div>`;
        return;
      }

      if (sub.type === 'set_weather') {
        box.innerHTML = `
          <div class="subpanel-head"><span>天象</span>${closeBtn}</div>
          <div class="action-btn-grid">
            <button class="pk-btn pk-btn--crimson pk-btn--sm pk-btn--rich" data-weather-pick="bloodmoon" type="button"><span class="btn-label"><strong>🩸 血月</strong><span class="btn-sub-line">全局伤+0.5 · 自己下回合初 +1🔪</span></span></button>
            <button class="pk-btn pk-btn--ghost pk-btn--sm pk-btn--rich" data-weather-pick="fog" type="button"><span class="btn-label"><strong>🌫 迷雾</strong><span class="btn-sub-line">禁跨点远程与坐标 · 仅自己豁免</span></span></button>
            <button class="pk-btn pk-btn--primary pk-btn--sm pk-btn--rich" data-weather-pick="storm" type="button"><span class="btn-label"><strong>⛈ 雷暴</strong><span class="btn-sub-line">陆地禁穿裤 · 自己免疫且 +0.5👖</span></span></button>
          </div>
        `;
        return;
      }

      if (sub.type === 'skill') {
        const effRole = sub.effectiveRole;
        if (effRole === 'parasite_burst') {
          const host = getPlayer(self.parasiteHostId);
          box.innerHTML = `
            <div class="subpanel-head"><span>破体</span>${closeBtn}</div>
            <div class="action-btn-grid">
              <button class="pk-btn pk-btn--accent" data-skill-exec="parasite_burst" data-burst="strip" type="button"><span class="btn-label">0步破体免费扒裤</span></button>
              <button class="pk-btn pk-btn--crimson" data-skill-exec="parasite_burst" data-burst="stab" type="button" ${canStabWithWeapon(self) && host?.pants <= 0 ? '' : 'disabled'}><span class="btn-label">0步破体「咔」(+0.5伤 · ${self.knives >= 1 ? '刀' : '利刃'})</span></button>
            </div>
          `;
          return;
        }
        if (effRole === 'aquaman') {
          const oceanNodes = Object.values(state.nodes).filter((n) => n.layer === 'ocean' && !n.collapsed && n.id !== self.location && !isBarrierActive(n.id));
          box.innerHTML = `<div class="subpanel-head"><span>潜海</span>${closeBtn}</div><div class="action-btn-grid">${oceanNodes.map((n) => `<button class="pk-btn pk-btn--primary pk-btn--sm" data-skill-node="${n.id}" type="button"><span class="btn-label">潜入 ${escapeHtml(n.name)}</span></button>`).join('') || '<span>暂无可潜入的海洋地点</span>'}</div>`;
          return;
        }
        if (['chili', 'watcher', 'parasite'].includes(effRole)) {
          let pool = effRole === 'parasite' ? enemiesHere : aliveEnemies;
          if (effRole !== 'parasite' && fogBlocked) pool = pool.filter((e) => e.location === self.location);
          if (effRole === 'watcher') pool = pool.filter((e) => e.location !== 'land_prison_in' && !isBarrierActive(e.location));
          const fogHint = effRole !== 'parasite' && fogBlocked ? ' (迷雾仅限同地点)' : '';
          box.innerHTML = `<div class="subpanel-head"><span>${escapeHtml(ROLE_MAP[effRole].activeName)}</span>${closeBtn}</div><div class="action-btn-grid">${pool.map((t) => `<button class="pk-btn pk-btn--crimson pk-btn--sm" data-skill-target="${t.id}" type="button"><span class="btn-label">${escapeHtml(t.name)}${escapeHtml(targetTags(t))}</span></button>`).join('') || '<span>暂无合法目标</span>'}</div>`;
          return;
        }
        if (effRole === 'undertaker') {
          const souls = isUnderworldCollapsed() ? [] : state.players.filter((p) => p.status === 'pending_revive');
          const corpseNodes = Object.values(state.nodes).filter((n) => n.corpses.length > 0);
          const soulBtns = souls.map((t) => `<button class="pk-btn pk-btn--crimson pk-btn--sm" data-skill-target="${t.id}" type="button"><span class="btn-label">封魂 ${escapeHtml(t.name)}</span></button>`);
          const corpseBtns = corpseNodes.map((n) => `<button class="pk-btn pk-btn--accent pk-btn--sm" data-skill-corpse-node="${n.id}" type="button"><span class="btn-label">烧尸 ${escapeHtml(n.name)}</span></button>`);
          box.innerHTML = `<div class="subpanel-head"><span>封魂</span>${closeBtn}</div><div class="action-btn-grid">${[...soulBtns, ...corpseBtns].join('') || '<span>场上暂无待复活者或尸体</span>'}</div>`;
          return;
        }
        if (effRole === 'barrier') {
          const validNodes = Object.values(state.nodes).filter((n) => !n.collapsed && n.kind !== 'prison_in');
          box.innerHTML = `<div class="subpanel-head"><span>结界</span>${closeBtn}</div><div class="action-btn-grid">${validNodes.map((n) => `<button class="pk-btn pk-btn--primary pk-btn--sm" data-skill-node="${n.id}" type="button"><span class="btn-label">${escapeHtml(n.name)}</span></button>`).join('')}</div>`;
          return;
        }
        if (effRole === 'curser') {
          const first = sub.firstTarget || null;
          const pool = state.players.filter((p) => isVisibleAlive(p) && p.id !== first && (!fogBlocked || p.location === self.location));
          box.innerHTML = `<div class="subpanel-head"><span>链接</span>${closeBtn}</div><div class="action-btn-grid">${pool.map((t) => `<button class="pk-btn pk-btn--crimson pk-btn--sm" data-curser-pick="${t.id}" type="button"><span class="btn-label">${escapeHtml(t.name)}${escapeHtml(targetTags(t))}</span></button>`).join('') || '<span>暂无合法目标</span>'}</div>`;
          return;
        }
        if (effRole === 'storm') {
          if (!sub.stormTarget && !sub.stormSrcNode) {
            const singlePool = state.players.filter((p) => isVisibleAlive(p) && (!fogBlocked || p.location === self.location));
            const occupied = Object.values(state.nodes).filter((n) => !n.collapsed && n.kind !== 'prison_in' && getAlivePlayersAt(n.id).length > 0 && (!fogBlocked || n.id === self.location));
            box.innerHTML = `
              <div class="subpanel-head"><span>风暴</span>${closeBtn}</div>
              <div class="action-btn-grid">${singlePool.map((t) => `<button class="pk-btn pk-btn--primary pk-btn--sm" data-storm-single="${t.id}" type="button"><span class="btn-label">免费吹 ${escapeHtml(t.name)}${escapeHtml(targetTags(t))}</span></button>`).join('')}</div>
              <div class="action-btn-grid" style="margin-top:6px;">${occupied.map((n) => `<button class="pk-btn pk-btn--crimson pk-btn--sm" data-storm-node="${n.id}" type="button"><span class="btn-label">1步吹空【${escapeHtml(n.name)}】</span></button>`).join('')}</div>
            `;
          } else {
            const refNode = sub.stormSrcNode ? getNode(sub.stormSrcNode) : getNode(getPlayer(sub.stormTarget)?.location);
            const dests = Object.values(state.nodes).filter((n) => !n.collapsed && n.layer === refNode?.layer && n.id !== refNode?.id && n.kind !== 'prison_in' && !isBarrierActive(n.id));
            box.innerHTML = `<div class="subpanel-head"><span>吹去哪</span>${closeBtn}</div><div class="action-btn-grid">${dests.map((n) => `<button class="pk-btn pk-btn--accent pk-btn--sm" data-storm-dest="${n.id}" type="button"><span class="btn-label">吹至 ${escapeHtml(n.name)}</span></button>`).join('')}</div>`;
          }
          return;
        }
        if (effRole === 'puppeteer') {
          if (!sub.puppetTarget) {
            const sameLayer = aliveEnemies.filter((e) => getNode(e.location)?.layer === curNode?.layer && (!fogBlocked || e.location === self.location));
            box.innerHTML = `<div class="subpanel-head"><span>木偶</span>${closeBtn}</div><div class="action-btn-grid">${sameLayer.map((t) => `<button class="pk-btn pk-btn--crimson pk-btn--sm" data-puppet-target="${t.id}" type="button"><span class="btn-label">${escapeHtml(t.name)} (${escapeHtml(getNode(t.location)?.name || '')})</span></button>`).join('') || '<span>暂无合法目标</span>'}</div>`;
          } else {
            const pt = getPlayer(sub.puppetTarget);
            const pMoves = pt && !pt.parasiteHostId ? getReachableMoveNodes(pt) : [];
            const pNeighbors = pt ? getAlivePlayersAt(pt.location, pt.id) : [];
            box.innerHTML = `
              <div class="subpanel-head"><span>强控 ${escapeHtml(pt?.name)}</span>${closeBtn}</div>
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
      const self = getSelfPlayer();

      if (state.logs.length > localUI.lastLogCount) {
        if (localUI.mobileTab !== 'log') {
          localUI.unreadLogCount += (state.logs.length - localUI.lastLogCount);
        }
        localUI.lastLogCount = state.logs.length;
      }

      const isTargetingMe = (item) => {
        if (!self || item.actorId === state.selfId) return false;
        if (Array.isArray(item.targetIds) && item.targetIds.includes(state.selfId)) return true;
        if (item.isMoveToLoc && item.locId && self.status === 'alive' && item.locId === self.location) return true;
        return false;
      };

      const reversed = [...state.logs].slice(-60).reverse();

      if (el) {
        let lastTurn = null;
        const rows = [];
        reversed.forEach((item, idx) => {
          if (item.turn !== lastTurn) {
            lastTurn = item.turn;
            rows.push(`<div class="log-turn-divider">── T${String(item.turn).padStart(2, '0')} ──</div>`);
          }
          const alertMe = isTargetingMe(item);
          rows.push(`
            <div class="log-entry log-entry--${item.kind} ${idx < 2 ? 'is-fresh' : ''} ${alertMe ? 'log-entry--alert-me' : ''}">
              <span class="log-turn-tag">T${String(item.turn).padStart(2, '0')}</span>
              <span class="log-body">${alertMe ? '<span class="log-me-badge">⚠ 针对你</span>' : ''}${formatLogHtml(item.text)}</span>
            </div>
          `);
        });
        el.innerHTML = rows.join('');
        el.scrollTop = 0;
      }

      if (ticker) {
        const latestTwo = reversed.slice(0, 2);
        ticker.innerHTML = latestTwo.length
          ? latestTwo.map((item, idx) => {
              const alertMe = isTargetingMe(item);
              return `
                <div class="ticker-line ${idx === 0 ? 'is-newest' : ''}">
                  <span class="log-turn-tag">T${String(item.turn).padStart(2, '0')}</span>
                  <span>${alertMe ? '<span class="log-me-badge">⚠针对你</span>' : ''}${formatLogHtml(item.text)}</span>
                </div>
              `;
            }).join('')
          : '<div class="ticker-line">战局即将开幕...</div>';
      }

      if (logBadge) {
        logBadge.textContent = localUI.unreadLogCount > 9 ? '9+' : String(localUI.unreadLogCount);
        logBadge.classList.toggle('is-hidden', localUI.unreadLogCount <= 0);
      }

      // 战报抽屉收起时，在顶栏按钮上提示未读条数
      if (!localUI.logDrawerOpen) {
        const lbl = document.querySelector('#btn-toggle-log .btn-label');
        if (lbl) lbl.textContent = localUI.unreadLogCount > 0 ? `📜 战报(${localUI.unreadLogCount > 9 ? '9+' : localUI.unreadLogCount})` : '📜 战报';
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
        bountyArtifacts: clamp(Number(g('cfg-bounty-artifacts')?.value) || 2, 1, 8),
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

    on('btn-toggle-speed', 'click', () => {
      const next = window.VFX?.cycleSpeed?.();
      const cfg = window.VFX?.getSpeedConfig?.();
      if (cfg) window.VFX?.toast(`播报节奏已切换为：${cfg.label}`, 'info', 2200);
    });

    on('btn-create-room', 'click', () => Net.createRoom());
    on('btn-join-room', 'click', () => Net.joinRoom(document.getElementById('input-room-code')?.value));
    on('btn-copy-invite', 'click', () => Net.copyInviteLink());
    on('btn-start-solo', 'click', () => Net.startSolo(Number(document.getElementById('select-ai-count')?.value) || 4));
    on('select-ai-count', 'change', (e) => Net.syncSoloAiCount(Number(e.target.value) || 4));
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

    // 新手模式开关（大厅 + 局内）
    on('opt-novice', 'change', (e) => setNovice(e.target.checked));
    on('btn-toggle-novice-ingame', 'click', () => setNovice(!localUI.novice));
    on('novice-hint-off', 'click', () => setNovice(false));

    // 顶栏「更多」抽屉
    const setHudMenu = (open) => {
      localUI.hudMenuOpen = Boolean(open);
      document.getElementById('hud-more')?.classList.toggle('is-hidden', !localUI.hudMenuOpen);
      document.getElementById('btn-hud-menu')?.setAttribute('aria-expanded', String(localUI.hudMenuOpen));
    };
    on('btn-hud-menu', 'click', (e) => { e.stopPropagation(); setHudMenu(!localUI.hudMenuOpen); });
    document.getElementById('hud-more')?.addEventListener('click', () => setHudMenu(false));
    document.addEventListener('click', (e) => {
      if (!localUI.hudMenuOpen) return;
      if (e.target.closest('#hud-more') || e.target.closest('#btn-hud-menu')) return;
      setHudMenu(false);
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

    document.getElementById('mobile-lobby-tabs')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.m-tab');
      if (!btn || !btn.dataset.ltab) return;
      localUI.mobileLobbyTab = btn.dataset.ltab;
      const gridEl = document.getElementById('lobby-grid');
      if (gridEl) {
        gridEl.dataset.lobbyTab = localUI.mobileLobbyTab;
        gridEl.scrollTop = 0;
      }
      document.querySelectorAll('#mobile-lobby-tabs .m-tab').forEach((b) =>
        b.classList.toggle('is-active', b === btn)
      );
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

    document.getElementById('lobby-player-list')?.addEventListener('change', (e) => {
      const sel = e.target.closest('[data-ai-role-select]');
      if (sel) Net.setLobbySeatRole(sel.dataset.aiRoleSelect, sel.value);
    });

    document.getElementById('hud-artifacts-bar')?.addEventListener('click', (e) => {
      const pill = e.target.closest('[data-artifact-info]');
      if (!pill) return;
      const sqId = pill.dataset.artifactInfo;
      const meta = ARTIFACTS[sqId];
      if (meta) window.VFX?.toast(`【${meta.name}】${meta.desc}`, 'info', 3500);
    });

    on('btn-cam-default', 'click', () => Map3D.setPreset('default'));
    on('btn-cam-depth', 'click', () => Map3D.setPreset('depth'));
    on('btn-cam-flat', 'click', () => Map3D.setPreset('flat'));
    on('btn-cam-top', 'click', () => Map3D.setPreset('top'));
    on('btn-cam-side', 'click', () => Map3D.setPreset('side'));
    on('btn-cam-zoom-in', 'click', () => Map3D.zoom(0.12));
    on('btn-cam-zoom-out', 'click', () => Map3D.zoom(-0.12));
    on('btn-toggle-empty-nodes', 'click', () => Map3D.toggleEmptyNodes());

    // 战报抽屉：默认收起，需要追溯时再展开，把版面让给地图
    const setLogDrawer = (open) => {
      localUI.logDrawerOpen = Boolean(open);
      const panel = document.getElementById('panel-log');
      if (panel) panel.classList.toggle('is-hidden', !localUI.logDrawerOpen);
      const btn = document.getElementById('btn-toggle-log');
      if (btn) {
        btn.setAttribute('aria-pressed', String(localUI.logDrawerOpen));
        const lbl = btn.querySelector('.btn-label');
        if (lbl) lbl.textContent = localUI.logDrawerOpen ? '📜 收起' : '📜 战报';
      }
      if (localUI.logDrawerOpen) {
        localUI.unreadLogCount = 0;
        UI.renderLog();
      }
    };
    on('btn-toggle-log', 'click', () => setLogDrawer(!localUI.logDrawerOpen));
    on('btn-close-log', 'click', () => setLogDrawer(false));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && localUI.logDrawerOpen) setLogDrawer(false);
    });

    // 全员速览条：点击任意角色 → 地图定位高亮
    document.getElementById('agent-ribbon')?.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-agent-id]');
      if (!chip) return;
      const p = getPlayer(chip.dataset.agentId);
      if (!p) return;
      const node = getNode(p.location);
      Map3D.focusNode?.(p.location);
      const role = ROLE_MAP[p.roleId] || ROLE_MAP.normal;
      const hidden = (p.stealth?.active && p.id !== state.selfId);
      window.VFX?.toast(
        `${p.name} · ${role.name}｜📍${hidden ? '???' : node?.name || '-'}｜❤${p.hp} 👖${p.pants}/${p.maxPants} 🔪${p.knives} 技${p.activeCharges}`,
        p.wanted ? 'danger' : 'info',
        3200
      );
    });

    document.getElementById('map-camera-controls')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-layer-focus]');
      if (btn) Map3D.setFocusLayer(btn.dataset.layerFocus);
    });

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
    document.getElementById('mobile-live-ticker')?.addEventListener('click', () => setLogDrawer(true));

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
      // 点角色卡：直接播报该角色当前完整状态
      const agentEl = e.target.closest('[data-agent-id]');
      if (agentEl) {
        const p = getPlayer(agentEl.dataset.agentId);
        if (p) {
          const role = ROLE_MAP[p.roleId] || ROLE_MAP.normal;
          const chips = statusChipText(p, node);
          window.VFX?.toast(
            `${p.name} · ${role.name}｜❤${p.hp} 👖${p.pants}/${p.maxPants} 🔪${p.knives} 技${p.activeCharges} 杀${p.kills}${chips ? `｜${chips}` : ''}`,
            p.wanted ? 'danger' : 'info',
            4000
          );
          triggerNodePulse(node.id);
          return;
        }
      }
      window.VFX?.toast(`【${node.name}】${node.desc}`, 'info', 3500);
    });

    const backToLobby = () => {
      clearHostTasks();
      clearConfirmArm();
      UI.closeModal();
      state.started = false;
      state.phase = 'lobby';
      localUI.subPanelState = null;
      window.VFX?.setWeather('clear', false);
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

      // 高危操作二次确认拦截（3秒未点自动复原）
      if (d.confirmKey) {
        if (localUI.confirmArm?.key !== d.confirmKey) {
          clearConfirmArm();
          const timer = window.setTimeout(() => {
            localUI.confirmArm = null;
            UI.renderActionDock();
          }, 3000);
          localUI.confirmArm = { key: d.confirmKey, timer };
          UI.renderActionDock();
          return;
        }
        clearConfirmArm();
      } else {
        clearConfirmArm();
      }

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
        if (['drain_oxy', 'disarm', 'divine_reset'].includes(d.wishPick)) Net.sendIntent({ type: 'PENDING_CHOICE', wishId: d.wishPick });
        else if (d.wishPick === 'restore_pos') { localUI.subPanelState = { wishMode: 'restore_pos', restoreIds: [] }; UI.renderActionDock(); }
        else { localUI.subPanelState = { wishMode: d.wishPick }; UI.renderActionDock(); }
        return;
      }
      if (d.wishRestoreConfirm) {
        const unitIds = localUI.subPanelState?.restoreIds || [];
        localUI.subPanelState = null;
        Net.sendIntent({ type: 'PENDING_CHOICE', wishId: 'restore_pos', unitIds });
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

      // 突袭者刃锋分伤步进器与确认
      if (d.splitAdj && localUI.subPanelState?.splitAlloc) {
        const tid = d.splitAdj;
        const delta = Number(d.delta) || 0;
        const cur = roundHalf(localUI.subPanelState.splitAlloc[tid] || 0);
        localUI.subPanelState.splitAlloc[tid] = Math.max(0, roundHalf(cur + delta));
        UI.renderActionDock();
        return;
      }
      if (d.splitConfirm && localUI.subPanelState?.splitAlloc) {
        const alloc = { ...localUI.subPanelState.splitAlloc };
        localUI.subPanelState = null;
        Net.sendIntent({ type: 'ACTION', action: 'stab', splitAlloc: alloc });
        return;
      }

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

      if (d.moveDest) {
        const carryIds = localUI.subPanelState?.carryIds || [];
        const stableTargetId = d.stableTarget || null;
        localUI.subPanelState = null;
        Net.sendIntent({ type: 'ACTION', action: 'move', destId: d.moveDest, carryIds, stableTargetId });
        return;
      }
      if (d.sq2Dest !== undefined) { localUI.subPanelState = null; Net.sendIntent({ type: 'ACTION', action: 'sq2_dash', destId: d.sq2Dest, targetId: d.sq2Target || null }); return; }
      if (d.targetAct) { localUI.subPanelState = null; Net.sendIntent({ type: 'ACTION', action: d.targetAct, targetId: d.target }); return; }
      if (d.predict) { localUI.subPanelState = null; Net.sendIntent({ type: 'ACTION', action: 'predict_raider', targetId: d.predict, mode: d.mode }); return; }
      if (d.forgeSq) { localUI.subPanelState = null; Net.sendIntent({ type: 'ACTION', action: 'forge_artifact', sqId: d.forgeSq }); return; }
      if (d.weatherPick) { localUI.subPanelState = null; Net.sendIntent({ type: 'ACTION', action: 'set_weather', weather: d.weatherPick }); return; }

      if (d.skillExec === 'parasite_burst') { localUI.subPanelState = null; Net.sendIntent({ type: 'ACTION', action: 'use_skill', burstMode: d.burst }); return; }
      if (d.skillTarget) { localUI.subPanelState = null; Net.sendIntent({ type: 'ACTION', action: 'use_skill', targetId: d.skillTarget }); return; }
      if (d.skillCorpseNode) { localUI.subPanelState = null; Net.sendIntent({ type: 'ACTION', action: 'use_skill', corpseNodeId: d.skillCorpseNode }); return; }
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

    // 强带单选互斥（最多强带 1 人） & 许愿时空复原多选
    document.getElementById('action-stage')?.addEventListener('change', (e) => {
      const rChk = e.target.closest('input[data-restore-uid]');
      if (rChk && localUI.subPanelState?.wishMode === 'restore_pos') {
        const set = new Set(localUI.subPanelState.restoreIds || []);
        if (rChk.checked) set.add(rChk.dataset.restoreUid);
        else set.delete(rChk.dataset.restoreUid);
        localUI.subPanelState.restoreIds = Array.from(set);
        UI.renderActionDock();
        return;
      }
      const chk = e.target.closest('input[data-carry-id]');
      if (!chk || localUI.subPanelState?.type !== 'move') return;
      const cid = chk.dataset.carryId;
      if (chk.checked) {
        localUI.subPanelState.carryIds = [cid];
        document.querySelectorAll('#action-stage input[data-carry-id]').forEach((other) => {
          if (other !== chk) other.checked = false;
        });
      } else {
        localUI.subPanelState.carryIds = [];
      }
    });
  }

  function init() {
    window.VFX?.init();
    Map3D.bind();
    try {
      const savedNovice = window.localStorage.getItem('lk_novice');
      if (savedNovice === '0' || savedNovice === '1') localUI.novice = savedNovice === '1';
    } catch (_) {}
    syncNovice();
    bindEvents();

    const hint = document.querySelector('.map-drag-hint');
    const syncHint = () => {
      if (!hint) return;
      hint.textContent = window.innerWidth <= 820
        ? '单指拖动平移 · 双指缩放 · 点击地点/角色查看详情'
        : '拖拽旋转 · 右键/Shift 拖动平移 · 滚轮缩放 · 点击地点或角色查看详情';
    };
    syncHint();
    window.addEventListener('resize', syncHint);

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
