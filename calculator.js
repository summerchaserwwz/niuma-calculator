// ============ 工作值不值计算器 — 计算引擎 v3 ============

// ---- 中国个税计算（2024年）----
// ssBase: 社保公积金缴纳基数（null=按税前全额，否则用填写值）
// ssRate: 个人社保+公积金合计比例
function calcAfterTax(preTax, ssRate, ssBase) {
  const base = (ssBase != null && ssBase > 0) ? ssBase : preTax;
  const ssDeduct = base * ssRate;
  const taxBase = Math.max(preTax - ssDeduct - 5000, 0);
  const brackets = [
    [80000, 0.45, 15160],
    [55000, 0.35,  7160],
    [35000, 0.30,  4410],
    [25000, 0.25,  2660],
    [12000, 0.20,  1410],
    [ 3000, 0.10,   210],
    [    0, 0.03,     0],
  ];
  let tax = 0;
  for (const [line, rate, deduct] of brackets) {
    if (taxBase > line) { tax = taxBase * rate - deduct; break; }
  }
  return Math.round(preTax - ssDeduct - tax);
}

// ---- 系数表 ----
const STABILITY = {
  civil:          { coef: 1.35, label: '公务员' },
  institution:    { coef: 1.28, label: '事业单位/编制' },
  central_soe:    { coef: 1.20, label: '央企/国企' },
  fortune500:     { coef: 1.10, label: '大外企/500强' },
  bigtech:        { coef: 1.05, label: '国内大厂' },
  listed_private: { coef: 1.02, label: '上市公司/知名大型私企' },
  medium:         { coef: 0.95, label: '普通中型公司' },
  small:          { coef: 0.88, label: '小公司' },
  startup:        { coef: 0.78, label: '初创/创业' },
};
const LEADER_COEF    = [0, 0.72, 0.86, 1.00, 1.13, 1.24];
const COLLEAGUE_COEF = [0, 0.85, 0.92, 1.00, 1.07, 1.12];
const OVERTIME = {
  none:    { coef: 1.15, label: '几乎不加班', desc: '弹性上下班，按时走人，个人时间有保障' },
  light:   { coef: 1.05, label: '偶尔加班',   desc: '忙时多待，整体可控，月均 <20小时' },
  moderate:{ coef: 0.90, label: '经常加班',   desc: '几乎每天晚走，月均20~50小时，生活受压缩' },
  heavy:   { coef: 0.78, label: '大量/大小周', desc: '大小周或月加班50h+，基本没有完整周末' },
  intense: { coef: 0.65, label: '严重内卷/996', desc: '996或更狠，身心透支风险极高' },
};
// 行业基准时薪（元/h，2024年中国含中小规模公司均值）
const INDUSTRY_BENCH = {
  internet:    { rate: 90,  label: '互联网/科技',  mean: 82, std: 22 },  // 含中小厂均值下修
  finance:     { rate: 78,  label: '金融/投行',    mean: 75, std: 22 },  // 投行高但普通银行拉低
  consulting:  { rate: 68,  label: '咨询/律所',    mean: 70, std: 20 },  // 普通会计所/律所偏低
  medical:     { rate: 56,  label: '医疗/生物',    mean: 64, std: 19 },
  education:   { rate: 42,  label: '教育',         mean: 58, std: 17 },
  manufacture: { rate: 55,  label: '制造/工程',    mean: 60, std: 18 },  // 原44偏低，工程师普遍10-25万
  government:  { rate: 48,  label: '体制/事业',    mean: 62, std: 16 },
  realestate:  { rate: 55,  label: '房地产/建筑',  mean: 60, std: 18 },
  retail:      { rate: 42,  label: '零售/消费',    mean: 55, std: 17 },
  other:       { rate: 52,  label: '其他',         mean: 66, std: 20 },
};

// 学历期望系数（8档，区分院校背景）
const EDU_FACTOR = {
  junior:        { f: 0.75, label: '专科/高职' },
  bachelor:      { f: 0.88, label: '双非本科' },
  uni211:        { f: 0.96, label: '211本科' },
  b985_or_mbd:   { f: 1.05, label: '985本科 / 双非硕士' },  // 985本科含金量≈普通硕士
  master985:     { f: 1.18, label: '985硕士（普通985）' },
  top985master:  { f: 1.30, label: '顶尖985硕（清北/复浙交等top10）' },
  phd:           { f: 1.38, label: '博士研究生' },
  topphd:        { f: 1.48, label: '顶尖博士（清北+/海外top50）' },
};

// 城市生活成本系数（影响期望薪资基准，参考各城市20242025GDP与薪资报告）
const CITY_COST = {
  s1:    { coef: 1.00, label: '超一线（北京/上海/深圳）' },
  tier1: { coef: 0.93, label: '一线（广州）' },
  tier1b:{ coef: 0.85, label: '新一线（杭州/成都/南京等）' },
  tier2s:{ coef: 0.76, label: '强二线（苏州/厉门/无锡/合肥/东莞等）' },
  tier2: { coef: 0.67, label: '二线省会（沈阳/长沙/南昌等）' },
  tier3: { coef: 0.58, label: '三线及以下城市' },
};

// 按行业分类的常见岗位（参考Boss直聘2024，mult为相对行业基准的倍率）
const JOB_ROLES = {
  internet: [
    { k:'algo_ai',    label:'算法/AI/机器学习',  mult:2.3 },
    { k:'backend',    label:'后端/服务端开发',    mult:1.7 },
    { k:'frontend',   label:'前端/移动开发',      mult:1.4 },
    { k:'data',       label:'数据分析/BI',        mult:1.2 },
    { k:'product',    label:'产品经理',           mult:1.25 },
    { k:'design',     label:'UI/UX设计',          mult:1.0 },
    { k:'test',       label:'测试/QA',            mult:0.9 },
    { k:'ops',        label:'运营/市场',           mult:0.7 },
    { k:'hr_admin',   label:'行政/人力',           mult:0.55 },
  ],
  finance: [
    { k:'ib_pe',      label:'投行/PE/VC',         mult:3.2 },
    { k:'quant_fund', label:'量化/公募基金',       mult:2.8 },
    { k:'research',   label:'证券研究员',          mult:2.0 },
    { k:'risk',       label:'风控/合规',           mult:1.3 },
    { k:'bank_f',     label:'银行前台/对公',       mult:1.0 },
    { k:'insurance',  label:'保险/理财顾问',       mult:0.85 },
    { k:'bank_b',     label:'银行中后台',          mult:0.75 },
  ],
  consulting: [
    { k:'mbb',        label:'顶级管理咨询（MBB）', mult:3.2 },
    { k:'consult',    label:'普通管理咨询',        mult:2.0 },
    { k:'big4_m',     label:'四大合伙人方向',      mult:1.8 },
    { k:'lawyer',     label:'律所律师',            mult:1.5 },
    { k:'big4',       label:'四大审计/税务',       mult:1.0 },
    { k:'legal',      label:'企业法务',            mult:1.0 },
    { k:'big4_b',     label:'四大中后台',          mult:0.65 },
  ],
  medical: [
    { k:'med_ai',    label:'医疗AI/影像算法',      mult:2.1 },
    { k:'doctor_sr', label:'医生（主治/主任级）', mult:2.5 },
    { k:'pharma_rd', label:'医药研发（硕博）',   mult:1.9 },
    { k:'meddev_rd', label:'医疗器械研发工程师',  mult:1.6 },
    { k:'med_sales', label:'医疗器械/医药销售',  mult:1.5 },
    { k:'cra',       label:'临床研究员CRA',       mult:1.2 },
    { k:'doctor_jr', label:'住院医/规培医',       mult:0.85 },
    { k:'nurse',     label:'护士/护师',           mult:0.75 },
    { k:'hosp_admin',label:'医院行政',            mult:0.6 },
  ],
  education: [
    { k:'prof',       label:'高校教授/副教授',    mult:2.2 },
    { k:'trainer',    label:'知名培训讲师',        mult:1.6 },
    { k:'lecturer',   label:'高校讲师',           mult:1.1 },
    { k:'k12',        label:'K12公立教师（编制）', mult:1.0 },
    { k:'edu_ops',    label:'教育运营/产品',       mult:0.95 },
    { k:'tutor',      label:'校外培训老师',        mult:0.85 },
  ],
  manufacture: [
    { k:'chip_ee',    label:'芯片/集成电路工程师', mult:1.8 },
    { k:'embed_ee',   label:'嵌入式/电子工程师',  mult:1.5 },
    { k:'mech',       label:'机械设计工程师',      mult:1.2 },
    { k:'chem_mat',   label:'化工/材料工程师',     mult:1.1 },
    { k:'qa',         label:'质量/品控工程师',     mult:0.9 },
    { k:'prod_mgr',   label:'生产管理',           mult:0.8 },
    { k:'worker',     label:'技术工人',           mult:0.5 },
  ],
  government: [
    { k:'leader',     label:'领导职位（处级+）',  mult:2.1 },
    { k:'researcher', label:'科研院所研究员',     mult:1.6 },
    { k:'civil_sr',   label:'公务员（副处级）',   mult:1.3 },
    { k:'civil',      label:'公务员（科员）',     mult:1.0 },
    { k:'inst_staff', label:'事业单位（普通）',   mult:0.9 },
  ],
  realestate: [
    { k:'arch_a',     label:'建筑设计（甲方）',   mult:1.8 },
    { k:'invest',     label:'地产开发/投拓',      mult:1.6 },
    { k:'arch_b',     label:'建筑设计（乙方）',   mult:1.1 },
    { k:'site_mgr',   label:'施工管理/项目经理',  mult:1.0 },
    { k:'agent',      label:'房产中介/销售',      mult:0.85 },
  ],
  retail: [
    { k:'brand_mgr',  label:'品牌/市场经理',      mult:1.7 },
    { k:'buyer',      label:'商品/买手',          mult:1.2 },
    { k:'ecom',       label:'电商运营',           mult:1.1 },
    { k:'store_mgr',  label:'门店运营管理',       mult:0.85 },
    { k:'sales',      label:'销售/导购',          mult:0.65 },
  ],
  other: [
    { k:'mgr',        label:'管理层/总监',        mult:2.0 },
    { k:'tech',       label:'技术研发类',         mult:1.4 },
    { k:'product',    label:'产品/运营',          mult:1.0 },
    { k:'support',    label:'职能支持（行政等）', mult:0.65 },
  ],
};


// 工龄正向期望系数
function yearsFactor(y) {
  if (y <= 0)  return 1.00;
  if (y <= 3)  return 1 + y * 0.04;
  if (y <= 8)  return 1.12 + (y - 3) * 0.03;
  if (y <= 15) return 1.27 + (y - 8) * 0.02;
  return 1.41;
}

// 通勤系数（有效单程分钟）
function commuteCoef(m) {
  if (m <= 15) return 1.14;
  if (m <= 30) return 1.06;
  if (m <= 45) return 1.00;
  if (m <= 60) return 0.93;
  if (m <= 90) return 0.83;
  return 0.71;
}

// 正态CDF
function normalCDF(x, mean, std) {
  const z = (x - mean) / std;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const p = t*(0.319381530+t*(-0.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
  const c = 1 - Math.exp(-0.5*z*z)/Math.sqrt(2*Math.PI)*p;
  return z >= 0 ? c : 1 - c;
}

// ============ 主计算 ============
function calculate(d) {
  // A. 税后月薪
  const ssRate = d.ssRate || 0.14;
  const ssBase = d.ssBase ?? null; // null = 全额缴纳
  const monthlyNet = calcAfterTax(d.preTaxSalary, ssRate, ssBase);
  const bonusNet   = calcAfterTax(d.preTaxSalary * d.bonusMonths, 0.05, null); // 年终奖按全额扣税
  const yearlyIncome = monthlyNet * 12 + bonusNet + d.monthlySubsidy * 12;

  // B. 有效工作日/时
  const effectiveDays = Math.max(52 * d.workDaysPerWeek - d.annualLeave - d.publicHolidays - d.sickLeave * 0.5, 50);
  const wfhRatio = Math.min(d.wfhDays / d.workDaysPerWeek, 1);
  const effectiveCommute = (d.commuteMinutes / 60) * (1 - wfhRatio);
  const slackHours = d.slackHours || 0;  // 每日平均摸鱼时间
  const actualWorkHours = Math.max(d.workHoursPerDay - slackHours, 1);
  const totalHoursPerDay = actualWorkHours + effectiveCommute * 2;
  const effectiveHourlyRate = (yearlyIncome / effectiveDays) / totalHoursPerDay;

  // C. 基础分（期望时薪 = 行业基准 × 学历 × 工龄 × 岗位倍率 × 城市系数）
  const bench    = INDUSTRY_BENCH[d.industry]?.rate || 55;
  const eduF     = EDU_FACTOR[d.education]?.f || 1.0;
  const yrsF     = yearsFactor(d.workYears);
  const cityCoef = CITY_COST[d.cityTier]?.coef || 1.0;
  const jobMult  = (() => {
    const roles = JOB_ROLES[d.industry] || [];
    return roles.find(r => r.k === d.jobRole)?.mult || 1.0;
  })();
  const expectedRate = bench * eduF * yrsF * jobMult * cityCoef;
  const baseScore = (effectiveHourlyRate / expectedRate) * 100;

  // D. 五大系数
  const stabilityC  = STABILITY[d.companyType]?.coef || 1.0;
  const leaderC     = LEADER_COEF[d.leaderScore]   || 1.0;
  const colleagueC  = COLLEAGUE_COEF[d.colleagueScore] || 1.0;
  const atmosphereC = Math.pow(leaderC, 0.7) * Math.pow(colleagueC, 0.3);
  const overtimeC   = OVERTIME[d.overtimeLevel]?.coef || 1.0;
  const wfhBonus    = d.wfhDays >= 3 ? 0.08 : d.wfhDays >= 1 ? 0.04 : 0;
  const freedomC    = overtimeC * (1 + wfhBonus);
  const effectiveMin= d.commuteMinutes * (1 - wfhRatio);
  const commuteC    = commuteCoef(effectiveMin);

  // E. 最终得分
  const rawScore   = baseScore * stabilityC * atmosphereC * freedomC * commuteC;
  const finalScore = Math.round(Math.min(Math.max(rawScore, 0), 200) * 10) / 10;

  // F. 百分位
  const ind = INDUSTRY_BENCH[d.industry] || INDUSTRY_BENCH.other;
  const percentile = normalCDF(finalScore, ind.mean, ind.std);
  const beat = Math.min(Math.round(percentile * 100), 99);

  // G. 诊断
  const diagnosis = buildDiag({ finalScore, baseScore, stabilityC, atmosphereC, freedomC, commuteC,
    effectiveHourlyRate, expectedRate, totalHoursPerDay, yearlyIncome, effectiveDays });

  // 显示分数（压缩到 0-100 制）
  // 使用对数压缩：rawScore=50→display≈40, 80→60, 100→72, 130→84, 200→100
  const displayScore = Math.min(100, Math.max(0, Math.round(
    rawScore <= 0 ? 0 :
    rawScore <= 200 ? 100 * Math.log(1 + rawScore) / Math.log(201) :
    100
  )));

  return {
    finalScore, displayScore, beat, percentile,
    monthlyNet, yearlyIncome: Math.round(yearlyIncome),
    effectiveHourlyRate: Math.round(effectiveHourlyRate),
    expectedRate: Math.round(expectedRate),
    dailyValue: Math.round(yearlyIncome / effectiveDays),
    effectiveDays: Math.round(effectiveDays),
    totalHoursPerDay: Math.round(totalHoursPerDay * 10) / 10,
    stabilityC, atmosphereC, freedomC, commuteC,
    diagnosis, distParams: { mean: ind.mean, std: ind.std },
  };
}

function buildDiag({ finalScore, baseScore, stabilityC, atmosphereC, freedomC, commuteC,
    effectiveHourlyRate, expectedRate, totalHoursPerDay, yearlyIncome, effectiveDays }) {
  const items = [];
  const r = effectiveHourlyRate / expectedRate;
  if (r >= 1.3)        items.push({ icon:'💰', level:'good', label:'薪资远超期望', tip:`等效时薪 ¥${Math.round(effectiveHourlyRate)}/h，高出期望 ${Math.round((r-1)*100)}%` });
  else if (r >= 1.0)   items.push({ icon:'💰', level:'good', label:'薪资符合期望', tip:`等效时薪 ¥${Math.round(effectiveHourlyRate)}/h，达到行业期望水平` });
  else if (r >= 0.75)  items.push({ icon:'💰', level:'mid',  label:'薪资略低于期望', tip:`等效时薪 ¥${Math.round(effectiveHourlyRate)}/h，低于期望 ${Math.round((1-r)*100)}%` });
  else                 items.push({ icon:'💰', level:'bad',  label:'薪资明显偏低', tip:`等效时薪 ¥${Math.round(effectiveHourlyRate)}/h，显著低于同段位期望` });

  if (stabilityC >= 1.25)     items.push({ icon:'🏛️', level:'good', label:'稳定性溢价显著', tip:`${STABILITY[Object.keys(STABILITY).find(k=>STABILITY[k].coef===stabilityC)]?.label || ''}带来 +${Math.round((stabilityC-1)*100)}% 隐性价值` });
  else if (stabilityC < 0.90) items.push({ icon:'⚠️', level:'bad',  label:'稳定性风险折损', tip:`公司类型带来 ${Math.round((stabilityC-1)*100)}% 风险折扣` });
  else                        items.push({ icon:'🏢', level:'mid',  label:'稳定性处于中位', tip:'公司稳定性在市场正常水平' });

  if (atmosphereC >= 1.12)    items.push({ icon:'🌟', level:'good', label:'工作氛围极佳', tip:'领导/同事质量高，精神损耗小' });
  else if (atmosphereC < 0.88)items.push({ icon:'😰', level:'bad',  label:'氛围严重拖累价值', tip:`综合氛围系数 ${atmosphereC.toFixed(2)}，有效价值缩水明显` });
  else                        items.push({ icon:'🤝', level:'mid',  label:'工作氛围一般', tip:'领导和同事处于正常区间' });

  if (freedomC >= 1.10)       items.push({ icon:'🕊️', level:'good', label:'高度自由，体验极佳', tip:'加班少，弹性高，生活质量有保障' });
  else if (freedomC < 0.80)   items.push({ icon:'🔥', level:'bad',  label:'强度过高，严重内耗', tip:`自由度系数 ${freedomC.toFixed(2)}，日均耗时 ${totalHoursPerDay}h` });
  else                        items.push({ icon:'⚖️', level:'mid',  label:'工作强度适中', tip:`日均有效耗时 ${totalHoursPerDay}h，尚在可控范围` });

  if (commuteC >= 1.10)       items.push({ icon:'🚶', level:'good', label:'通勤是大加分项', tip:'极短通勤节省大量个人时间' });
  else if (commuteC < 0.84)   items.push({ icon:'🚇', level:'bad',  label:'通勤严重消耗人生', tip:'长通勤每年侵蚀数百小时' });
  else                        items.push({ icon:'🚌', level:'mid',  label:'通勤在可接受范围', tip:'通勤时间处于正常水平' });

  const v = finalScore >= 130 ? { icon:'🚀', l:'综合来看：远超所值', t:'当前岗位是高性价比机会，值得珍惜' }
        : finalScore >= 100 ? { icon:'✅', l:'综合来看：挺值的',    t:'各维度综合评估达到期望' }
        : finalScore >= 75  ? { icon:'🤔', l:'综合来看：尚可接受',  t:'略低于理想值，可继续观望' }
        : finalScore >= 50  ? { icon:'⚠️', l:'综合来看：性价比偏低',t:'多个维度有明显短板，建议认真评估' }
        :                     { icon:'💔', l:'综合来看：亟需改变',  t:'性价比严重偏低，每天都在消耗时间和健康' };
  items.push({ icon: v.icon, level: finalScore >= 100 ? 'good' : finalScore >= 75 ? 'mid' : 'bad', label: v.l, tip: v.t });
  return items;
}

window.Calc = { calculate, calcAfterTax, STABILITY, OVERTIME, INDUSTRY_BENCH, EDU_FACTOR, LEADER_COEF, COLLEAGUE_COEF, JOB_ROLES, CITY_COST };
