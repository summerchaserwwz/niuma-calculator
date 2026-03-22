// ============ 工作值不值 — 交互逻辑 v3 ============
const C = window.Calc;
let lastResult = null;

// ---- 全局数据 ----
const D = {
  preTaxSalary: 20000, ssRate: 0.14, ssBase: null,
  bonusMonths: 2, monthlySubsidy: 0,
  workDaysPerWeek: 5, workHoursPerDay: 9, commuteMinutes: 40,
  wfhDays: 0, annualLeave: 10, publicHolidays: 11, sickLeave: 5,
  companyType: 'medium', overtimeLevel: 'light',
  leaderScore: 3, colleagueScore: 3,
  education: 'bachelor', workYears: 3, industry: 'internet',
  cityTier: 's1',  // 默认超一线
  jobRole: '',
};

// ---- 评分描述 ----
const LEADER_DESC = [
  { n:'1', emoji:'😱', title:'极差/PUA',  desc:'甩锅画大饼，针对你，每天精神严重内耗' },
  { n:'2', emoji:'😤', title:'差',        desc:'能力或人品有明显问题，经常添堵' },
  { n:'3', emoji:'😐', title:'一般',      desc:'不拖累也不加分，正常工作关系' },
  { n:'4', emoji:'😊', title:'好',        desc:'给资源给方向，保护下属，有安全感' },
  { n:'5', emoji:'🤩', title:'极好/导师', desc:'帮你成长，跟对人比涨薪更值' },
];
const COLLEAGUE_DESC = [
  { n:'1', emoji:'😤', title:'内斗严重',  desc:'推卸责任，互相拆台，人际消耗极大' },
  { n:'2', emoji:'😑', title:'各顾各的',  desc:'偶尔摩擦，合作有些勉强' },
  { n:'3', emoji:'🙂', title:'正常协作',  desc:'没有明显问题，日常顺畅' },
  { n:'4', emoji:'😄', title:'互帮互助',  desc:'氛围融洽，遇到问题愿意帮' },
  { n:'5', emoji:'🌟', title:'优秀团队',  desc:'大家都很强，互相带动成长' },
];
const OVERTIME_OPTS = [
  { k:'none',     emoji:'☀️', title:'几乎不加班',    desc:'弹性上下班，按时走人，个人时间完全有保障' },
  { k:'light',    emoji:'🌤️', title:'偶尔加班',      desc:'忙时多待，整体可控，月均 <20 小时' },
  { k:'moderate', emoji:'⛅', title:'经常加班',      desc:'几乎每天晚走，月均20~50小时，生活受压缩' },
  { k:'heavy',    emoji:'🌧️', title:'大量/大小周',   desc:'大小周或月加班50h以上，基本没有完整周末' },
  { k:'intense',  emoji:'🔥', title:'严重内卷/996',  desc:'996或更狠，透支身心，健康风险极高' },
];
const COMPANY_OPTS = [
  { k:'civil',          emoji:'🏛️', title:'公务员',             desc:'终身制，裁员焦虑几乎为零，社保/医疗/退休保障最高' },
  { k:'institution',   emoji:'📚', title:'事业单位/编制',      desc:'教师、医生、科研机构等，接近公务员稳定性' },
  { k:'central_soe',   emoji:'🏗️', title:'央企/国企',          desc:'大型国有企业，有保障，晋升相对慢' },
  { k:'fortune500',    emoji:'🌐', title:'大外企/500强',       desc:'品牌背书好，相对稳定，裁员有N+补偿' },
  { k:'bigtech',       emoji:'💻', title:'国内大厂',           desc:'阿里/腾讯/字节/华为等，名气大但说裁就裁' },
  { k:'listed_private',emoji:'📈', title:'上市公司/知名大型私企', desc:'A股/港股/美股上市或千人+知名私企，有一定背书，比大厂稳定性略低' },
  { k:'medium',        emoji:'🏢', title:'普通中型公司',       desc:'几百人未上市私企，基准参照，风险适中' },
  { k:'small',         emoji:'🏠', title:'小公司',             desc:'200人以下，现金流和稳定性有一定风险' },
  { k:'startup',       emoji:'🚀', title:'初创/创业',          desc:'高风险高压，期权价值不确定，随时可能关张' },
];

// ---- 页面切换 ----
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.getElementById(id)?.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function renderProg(cur) {
  const w = document.getElementById('prog');
  if (cur < 1 || cur > 4) { w.classList.add('hidden'); return; }
  w.classList.remove('hidden');
  const labs = ['💰 薪酬','⏰ 时间','🌟 氛围','🎓 背景'];
  w.innerHTML = `<div class="prog-steps">${labs.map((l,i)=>{
    const n=i+1, cls=n<cur?'done':n===cur?'active':'';
    return `<div class="prog-step ${cls}"><div class="prog-dot">${n<cur?'✓':n}</div><span class="prog-lbl">${l}</span></div>`;
  }).join('')}</div>`;
}
function goTo(s) {
  renderProg(s);
  const pages={0:'hero',1:'s1',2:'s2',3:'s3',4:'s4',5:'result'};
  showPage(pages[s]||'hero');
  ({1:drawS1,2:drawS2,3:drawS3,4:drawS4})[s]?.();
}

// ---- 税后预览 ----
function taxPreview(pre, rate, base) {
  const net = C.calcAfterTax(+pre || 0, +rate || 0, base != null ? +base : null);
  const el = document.getElementById('tax-prev');
  if (el) el.textContent = `💡 税后到手约 ¥${net.toLocaleString()}/月`;
}
function updateTaxPreview() {
  const sal = +document.getElementById('f-sal')?.value || 0;
  const rt  = getSsRate();
  const bse = getSsBase();
  D.ssRate = rt; D.ssBase = bse;
  taxPreview(sal, rt, bse);
}
function getSsRate() {
  const sel = document.getElementById('ss-rate-sel')?.value;
  if (sel === 'custom') return +(document.getElementById('ss-rate-inp')?.value || 14) / 100;
  return +(sel || 14) / 100;
}
function getSsBase() {
  const sel = document.getElementById('ss-base-sel')?.value;
  if (sel === 'full' || !sel) return null;
  return +(document.getElementById('ss-base-inp')?.value) || null;
}
function onSsBaseSel(v) {
  const inp = document.getElementById('ss-base-inp-wrap');
  if (inp) inp.style.display = v === 'custom' ? 'block' : 'none';
  updateTaxPreview();
}
function onSsRateSel(v) {
  const inp = document.getElementById('ss-rate-inp-wrap');
  if (inp) inp.style.display = v === 'custom' ? 'block' : 'none';
  updateTaxPreview();
}

// ======== Step 1: 薪酬 ========
function drawS1() {
  document.getElementById('s1').innerHTML = `
<div class="step-hd"><div class="step-title">💰 薪酬信息</div><div class="step-desc">填写税前月薪，自动换算税后到手</div></div>
<div class="form-grid">
  <div class="fg ff">
    <div class="lbl">税前月薪 <span class="lbl-note">不含年终奖</span></div>
    <div class="iu"><input class="fi" id="f-sal" type="number" value="${D.preTaxSalary}" min="0" step="500" oninput="updateTaxPreview()"><span class="unit">元/月</span></div>
    <div id="tax-prev" class="tax-preview">💡 税后到手约 ¥${C.calcAfterTax(D.preTaxSalary, D.ssRate, D.ssBase).toLocaleString()}/月</div>
  </div>
  <div class="fg">
    <div class="lbl">年终奖</div>
    <div class="iu"><input class="fi" id="f-bon" type="number" value="${D.bonusMonths}" min="0" max="24" step="0.5"><span class="unit">个月薪</span></div>
  </div>
  <div class="fg">
    <div class="lbl">每月补贴 <span class="lbl-note">餐补+交通+住房</span></div>
    <div class="iu"><input class="fi" id="f-sub" type="number" value="${D.monthlySubsidy}" min="0" step="100"><span class="unit">元/月</span></div>
  </div>

  <div class="fg ff">
    <div class="lbl">社保公积金缴纳设置 <span class="lbl-note">个人部分</span></div>
    <div class="grid-2col">
      <div class="fg">
        <div class="lbl" style="font-size:11px;font-weight:500">缴纳基数</div>
        <select class="fs" id="ss-base-sel" onchange="onSsBaseSel(this.value)">
          <option value="full" ${!D.ssBase?'selected':''}>全额（按税前月薪）</option>
          <option value="custom" ${D.ssBase?'selected':''}>自定义基数</option>
        </select>
        <div id="ss-base-inp-wrap" style="display:${D.ssBase?'block':'none'}">
          <input class="fi" id="ss-base-inp" type="number" value="${D.ssBase||''}"
            placeholder="输入实际缴纳基数" min="0" oninput="updateTaxPreview()">
        </div>
      </div>
      <div class="fg">
        <div class="lbl" style="font-size:11px;font-weight:500">个人缴纳比例</div>
        <select class="fs" id="ss-rate-sel" onchange="onSsRateSel(this.value)">
          <option value="0.14" ${D.ssRate===0.14?'selected':''}>14%</option>
          <option value="0.12" ${D.ssRate===0.12?'selected':''}>12%</option>
          <option value="0.10" ${D.ssRate===0.10?'selected':''}>10%</option>
          <option value="0.07" ${D.ssRate===0.07?'selected':''}>7%</option>
          <option value="0.05" ${D.ssRate===0.05?'selected':''}>5%</option>
          <option value="0" ${D.ssRate===0?'selected':''}>0%</option>
          <option value="custom">自定义%</option>
        </select>
        <div id="ss-rate-inp-wrap" style="display:${![0,0.05,0.07,0.10,0.12,0.14].includes(D.ssRate)?'block':'none'}">
          <div class="iu"><input class="fi" id="ss-rate-inp" type="number" value="${Math.round(D.ssRate*100)}"
            placeholder="比例，如 13" min="0" max="30" oninput="updateTaxPreview()"><span class="unit">%</span></div>
        </div>
      </div>
    </div>
    <div class="hint">缴纳基数×比例 = 每月社保公积金扣除额，影响应纳税所得额和到手金额</div>
  </div>
</div>
<div class="step-acts"><button class="btn btn-p" onclick="saveS1()">下一步 →</button></div>`;
}
function saveS1() {
  D.preTaxSalary  = +document.getElementById('f-sal').value || 0;
  D.bonusMonths   = +document.getElementById('f-bon').value || 0;
  D.monthlySubsidy= +document.getElementById('f-sub').value || 0;
  D.ssRate = getSsRate();
  D.ssBase = getSsBase();
  goTo(2);
}

// ======== Step 2: 时间 ========
function drawS2() {
  document.getElementById('s2').innerHTML = `
<div class="step-hd"><div class="step-title">⏰ 时间成本</div><div class="step-desc">时间是最重要的隐性成本</div></div>
<div class="form-grid">
  <div class="fg">
    <div class="lbl">每周工作天数</div>
    <select class="fs" id="f-wd">${[4,4.5,5,5.5,6,6.5,7].map(v=>`<option value="${v}" ${D.workDaysPerWeek==v?'selected':''}>${v}天</option>`).join('')}</select>
  </div>
  <div class="fg">
    <div class="lbl">日均工时 <span class="lbl-note">含隐性加班</span></div>
    <div class="iu"><input class="fi" id="f-wh" type="number" value="${D.workHoursPerDay}" min="4" max="20" step="0.5"><span class="unit">小时</span></div>
  </div>
  <div class="fg">
    <div class="lbl">单程通勤 <span class="lbl-note">从家门到工位</span></div>
    <div class="iu"><input class="fi" id="f-cm" type="number" value="${D.commuteMinutes}" min="0" max="180" step="5"><span class="unit">分钟</span></div>
  </div>
  <div class="fg">
    <div class="lbl">每周远程天数</div>
    <select class="fs" id="f-wfh">${[0,1,2,3,4,5].map(v=>`<option value="${v}" ${D.wfhDays==v?'selected':''}>${v===0?'不远程':v+'天/周'}</option>`).join('')}</select>
  </div>
  <div class="fg">
    <div class="lbl">年假天数 <span class="lbl-note">实际能休的</span></div>
    <div class="iu"><input class="fi" id="f-al" type="number" value="${D.annualLeave}" min="0" max="40"><span class="unit">天</span></div>
  </div>
  <div class="fg">
    <div class="lbl">法定节假日</div>
    <div class="iu"><input class="fi" id="f-ph" type="number" value="${D.publicHolidays}" min="0" max="30"><span class="unit">天</span></div>
  </div>
</div>
<hr class="hr">
<div class="fg">
  <div class="lbl">加班程度</div>
  <div class="opt-cards">${OVERTIME_OPTS.map(o=>`
    <div class="opt-card ${D.overtimeLevel===o.k?'on':''}" onclick="selOT('${o.k}')">
      <div class="opt-card-icon">${o.emoji}</div>
      <div class="opt-card-body"><div class="opt-card-title">${o.title}</div><div class="opt-card-desc">${o.desc}</div></div>
      <div class="opt-card-check">${D.overtimeLevel===o.k?'✓':''}</div>
    </div>`).join('')}
  </div>
</div>
<div class="step-acts">
  <button class="btn btn-g" onclick="goTo(1)">← 上一步</button>
  <button class="btn btn-p" onclick="saveS2()">下一步 →</button>
</div>`;
}
function selOT(k) {
  D.overtimeLevel = k;
  document.querySelectorAll('#s2 .opt-card').forEach((el,i)=>{
    el.classList.toggle('on', OVERTIME_OPTS[i].k===k);
    el.querySelector('.opt-card-check').textContent = OVERTIME_OPTS[i].k===k?'✓':'';
  });
}
function saveS2() {
  D.workDaysPerWeek = +document.getElementById('f-wd').value;
  D.workHoursPerDay = +document.getElementById('f-wh').value;
  D.commuteMinutes  = +document.getElementById('f-cm').value;
  D.wfhDays         = +document.getElementById('f-wfh').value;
  D.annualLeave     = +document.getElementById('f-al').value;
  D.publicHolidays  = +document.getElementById('f-ph').value;
  goTo(3);
}

// ======== Step 3: 氛围 ========
function scoreHTML(id, cur, items) {
  return `<div class="score-cards" id="${id}">${items.map((it,i)=>`
    <div class="score-card ${cur===i+1?'on':''}" onclick="setScore('${id}',${i+1})">
      <div class="score-num-lbl">${it.emoji}</div>
      <div class="score-title">${it.title}</div>
      <div class="score-desc">${it.desc}</div>
    </div>`).join('')}</div>`;
}
function setScore(id, v) {
  const key={
    'sg-ldr':'leaderScore',
    'sg-col':'colleagueScore',
  }[id];
  if(key) D[key]=v;
  document.querySelectorAll(`#${id} .score-card`).forEach((el,i)=>el.classList.toggle('on',i+1===v));
}
function drawS3() {
  document.getElementById('s3').innerHTML = `
<div class="step-hd"><div class="step-title">🌟 氛围与公司性质</div><div class="step-desc">这两个维度影响稳定性、心态和隐性价值</div></div>
<div class="fg" style="margin-bottom:20px">
  <div class="lbl">公司/单位性质</div>
  <div class="opt-cards">${COMPANY_OPTS.map(o=>`
    <div class="opt-card ${D.companyType===o.k?'on':''}" onclick="selCo('${o.k}')">
      <div class="opt-card-icon">${o.emoji}</div>
      <div class="opt-card-body"><div class="opt-card-title">${o.title}</div><div class="opt-card-desc">${o.desc}</div></div>
      <div class="opt-card-check">${D.companyType===o.k?'✓':''}</div>
    </div>`).join('')}
  </div>
</div>
<hr class="hr">
<div class="fg" style="margin-bottom:20px">
  <div class="lbl">直系领导质量 <span class="lbl-note">权重70%，对你影响最大</span></div>
  ${scoreHTML('sg-ldr', D.leaderScore, LEADER_DESC)}
</div>
<div class="fg">
  <div class="lbl">同事氛围 <span class="lbl-note">权重30%</span></div>
  ${scoreHTML('sg-col', D.colleagueScore, COLLEAGUE_DESC)}
</div>
<div class="step-acts">
  <button class="btn btn-g" onclick="goTo(2)">← 上一步</button>
  <button class="btn btn-p" onclick="goTo(4)">下一步 →</button>
</div>`;
}
function selCo(k) {
  D.companyType = k;
  document.querySelectorAll('#s3 .opt-card').forEach((el,i)=>{
    el.classList.toggle('on', COMPANY_OPTS[i].k===k);
    el.querySelector('.opt-card-check').textContent = COMPANY_OPTS[i].k===k?'✓':'';
  });
}

// ======== Step 4: 背景 ========
function drawS4() {
  document.getElementById('s4').innerHTML = `
<div class="step-hd"><div class="step-title">🎓 个人背景</div><div class="step-desc">用于校准你这个"段位"的期望基准</div></div>
<div class="form-grid">
  <div class="fg">
    <div class="lbl">最高学历</div>
    <select class="fs" id="f-edu">
      ${Object.entries(C.EDU_FACTOR).map(([k,v])=>`<option value="${k}" ${D.education===k?'selected':''}>${v.label}</option>`).join('')}
    </select>
  </div>
  <div class="fg">
    <div class="lbl">工作年限</div>
    <div class="iu"><input class="fi" id="f-yr" type="number" value="${D.workYears}" min="0" max="40"><span class="unit">年</span></div>
  </div>

  <div class="fg ff">
    <div class="lbl">城市级别 <span class="lbl-note">影响当地生活成本和期望薪资基准</span></div>
    <div class="ind-btns">
      ${Object.entries(C.CITY_COST).map(([k,v])=>`<button class="ind-btn city-btn ${D.cityTier===k?'on':''}" onclick="selCity('${k}')">${v.label}</button>`).join('')}
    </div>
  </div>

  <div class="fg ff">
    <div class="lbl">所在行业</div>
    <div class="ind-btns">${Object.entries(C.INDUSTRY_BENCH).map(([k,v])=>
      `<button class="ind-btn ind-s-btn ${D.industry===k?'on':''}" onclick="selInd('${k}')">${v.label}</button>`
    ).join('')}</div>
  </div>

  <div class="fg ff">
    <div class="lbl">岗位类别 <span class="lbl-note">不选则用行业均值，选了更精准</span></div>
    <div class="ind-btns" id="role-btns">${renderRoleBtns(D.industry)}</div>
    <div class="hint">岗位决定期望薪资倍率：算法工程师 vs 行政岗，期望差 3-4 倍</div>
  </div>
</div>
<div class="step-acts">
  <button class="btn btn-g" onclick="goTo(3)">← 上一步</button>
  <button class="btn btn-p btn-lg" onclick="saveS4()">🔍 开始测算</button>
</div>`;
}
function renderRoleBtns(ind) {
  const roles = C.JOB_ROLES[ind] || [];
  if (!roles.length) return `<span class="hint">暂无岗位细分数据</span>`;
  const clearBtn = `<button class="ind-btn ${!D.jobRole?'on':''}" onclick="selRole('')">不指定（行业均值）</button>`;
  return clearBtn + roles.map(r => `<button class="ind-btn role-btn ${D.jobRole===r.k?'on':''}" onclick="selRole('${r.k}')">${r.label}</button>`).join('');
}
function selCity(k) {
  D.cityTier = k;
  document.querySelectorAll('.city-btn').forEach(b => {
    const m = b.getAttribute('onclick')?.match(/'([^']+)'/);
    if (m) b.classList.toggle('on', m[1]===k);
  });
}
function selInd(k) {
  D.industry = k;
  D.jobRole = ''; // 切换行业时清空岗位
  document.querySelectorAll('.ind-s-btn').forEach(b => {
    const m = b.getAttribute('onclick')?.match(/'([^']+)'/);
    if (m) b.classList.toggle('on', m[1]===k);
  });
  const rb = document.getElementById('role-btns');
  if (rb) rb.innerHTML = renderRoleBtns(k);
}
function selRole(k) {
  D.jobRole = k;
  document.querySelectorAll('#role-btns .ind-btn').forEach(b => {
    const m = b.getAttribute('onclick')?.match(/'([^']+)'/);
    const isThis = m ? m[1]===k : (k==='' && b.getAttribute('onclick')?.includes("''"));
    b.classList.toggle('on', isThis);
  });
}
function saveS4() {
  D.education = document.getElementById('f-edu').value;
  D.workYears = +document.getElementById('f-yr').value;
  renderResult(); goTo(5);
}

// ======== 结果页 ========
// ---- 分数档位（牛马主题锐评，基于 displayScore 0-100）----
function scoreLevel(s) {
  if (s >= 88) return { cls:'lvl-s', color:'#6366f1', bg:'rgba(99,102,241,.15)', label:'💰 牛马界顶流，不卷了',      pct: Math.min(100, 89+((s-88)/12)*11) };
  if (s >= 75) return { cls:'lvl-a', color:'#30D158', bg:'rgba(48,209,88,.12)', label:'🎯 优质打工人，小日子还行',   pct: 70+((s-75)/13)*19 };
  if (s >= 60) return { cls:'lvl-b', color:'#0A84FF', bg:'rgba(10,132,255,.12)', label:'😑 标准牛马，混着就行',       pct: 50+((s-60)/15)*20 };
  if (s >= 48) return { cls:'lvl-c', color:'#FF9F0A', bg:'rgba(255,159,10,.12)', label:'🤡 吃亏的牛马，谁在创造价值', pct: 32+((s-48)/12)*18 };
  if (s >= 35) return { cls:'lvl-d', color:'#FF6B35', bg:'rgba(255,107,53,.12)', label:'😮‍💨 被榨的牛马，认真想想退出', pct: 16+((s-35)/13)*16 };
  return         { cls:'lvl-e', color:'#FF453A', bg:'rgba(255,69,58,.12)',  label:'⚰️ 极品牛马，甘蔗比你甜',       pct: (s/35)*16 };
}

// ---- 分析段落生成（有趣的牛马风格，不含行业名隐私）----
function genAnalysis(r, d) {
  const parts = [];
  const sr = r.effectiveHourlyRate / r.expectedRate;

  // 薪资维度（有趣，不含行业名）
  if (sr >= 1.3)       parts.push(`薪资碾压同段位 ${Math.round((sr-1)*100)}%，这份工对你来说是洼地，继续挖`);
  else if (sr >= 1.1)  parts.push(`薪资比同段位高 ${Math.round((sr-1)*100)}%，属于混得不错的那波人`);
  else if (sr >= 1.0)  parts.push('薪资刚好踩在期望线上，不多不少，你就是"人均"本均');
  else if (sr >= 0.85) parts.push(`薪资仅低于期望 ${Math.round((1-sr)*100)}%，就差那么一点，公司就是不给`);
  else                 parts.push(`薪资比同段位低 ${Math.round((1-sr)*100)}%，你的工资让同行暗暗庆幸自己不是你`);

  // 稳定性
  if (r.stabilityC >= 1.25) parts.push('铁饭碗护身，下岗焦虑和你无缘，稳定是一种隐形涨薪');
  else if (r.stabilityC < 0.9) parts.push('公司随时可能变小弓大，简历随时备好不吃亏');

  // 加班+通勤（有趣）
  const timeIssues = [];
  if (r.freedomC < 0.85) timeIssues.push(`加班买走了你的灵魂，不知道折算下来时薪算到几点`);
  if (r.commuteC < 0.88) timeIssues.push(`每天通勤 ${d.commuteMinutes} 分钟，一年相当于 ${Math.round(d.commuteMinutes*2*250/60)} 小时都在路上飘`);
  if (timeIssues.length) parts.push(timeIssues.join('，'));

  // 氛围
  if (r.atmosphereC >= 1.12) parts.push('领导靠谱同事给力，这年头比中彩票还难，别被挖走');
  else if (r.atmosphereC < 0.88) parts.push('工作氛围堪忧，精神损耗才是最贵的隐形成本');

  // 牛马等级总结
  const seg = r.displayScore;
  const finals = [
    [88, '综合来看你是高性价比打工人，工作回报率优秀，这份工不亏，暂时别乱动'],
    [75, '综合来看你超过大多数同行，属于有点小幸运的那波打工人'],
    [60, '综合来看你是标准牛马，不亏不赚，工作还行但也没啥惊喜'],
    [48, '综合来看你在微亏，这份工作拿走的比给你的多，值得认真评估'],
    [35, '综合来看你在明显亏损，多个维度在拖后腿，需要认真想想退出计划'],
    [0,  '综合来看你是极品级牛马，性价比极低，要么快跑要么快涨，不然就卷死老板'],
  ];
  parts.push(finals.find(([t]) => seg >= t)[1]);
  return parts.join('。');
}



// ---- 雷达图维度归一化 ----
function radarVal(coef, min, max) { return Math.max(0, Math.min(1, (coef - min) / (max - min))); }

function renderResult() {
  const r = C.calculate(D);
  lastResult = r;
  const lv = scoreLevel(r.displayScore);  // 使用0-100的displayScore
  const analysis = genAnalysis(r, D);

  // 雷达图5维归一化（0-1）
  const radar = [
    { label:'薪资', v: Math.min(1, Math.max(0, r.effectiveHourlyRate / r.expectedRate / 1.5)) },
    { label:'稳定', v: radarVal(r.stabilityC, 0.75, 1.38) },
    { label:'氛围', v: radarVal(r.atmosphereC, 0.65, 1.28) },
    { label:'自由', v: radarVal(r.freedomC, 0.60, 1.28) },
    { label:'通勤', v: radarVal(r.commuteC, 0.68, 1.18) },
  ];

  document.getElementById('result').innerHTML = `
<div class="res-score-area">
  <div class="ring ring-lg">
    <canvas id="rc" width="200" height="200"></canvas>
    <div class="ring-inner">
      <div class="score-num" id="sn">0</div>
      <div class="score-label-tiny">综合得分</div>
    </div>
  </div>
  <div class="score-badge" style="background:${lv.bg};color:${lv.color};border-color:${lv.color}40">${lv.label}</div>
</div>

<div class="score-bar-wrap">
  <div class="score-bar-track">
    <div class="score-bar-seg" style="flex:16;background:rgba(255,69,58,.5)" title="<50 亟需改变"></div>
    <div class="score-bar-seg" style="flex:20;background:rgba(255,107,53,.55)" title="50-70 明显偏低"></div>
    <div class="score-bar-seg" style="flex:20;background:rgba(255,159,10,.6)" title="70-90 略低期望"></div>
    <div class="score-bar-seg" style="flex:20;background:rgba(10,132,255,.65)" title="90-110 符合期望"></div>
    <div class="score-bar-seg" style="flex:20;background:rgba(48,209,88,.65)" title="110-130 超出期望"></div>
    <div class="score-bar-seg" style="flex:14;background:rgba(99,102,241,.75)" title=">130 远超所值"></div>
    <div class="score-bar-pin" id="sbar-pin" style="left:${lv.pct}%">
      <div class="sbar-dot" style="background:${lv.color}"></div>
    </div>
  </div>
  <div class="score-bar-labels">
    <span>50</span><span>70</span><span>90</span><span>110</span><span>130</span>
  </div>
</div>

<div class="analysis-box">
  <div class="analysis-text" id="analysis-txt">${analysis}</div>
</div>

<div class="beat-box">
  <div class="beat-pct" id="bp">0%</div>
  <div class="beat-txt">打败了同行业 <strong>${r.beat}%</strong> 的打工人</div>
  <div class="beat-note">* 基于行业统计分布模型估算，仅供参考</div>
</div>

<div class="sec-title">📡 五维雷达图</div>
<div class="radar-wrap"><canvas id="rdr" width="280" height="260"></canvas></div>

<hr class="hr">
<div class="sec-title">📋 分项诊断</div>
<div class="diag-list">
  ${r.diagnosis.map(d=>`<div class="diag ${d.level} diag-anim">
    <span class="diag-icon">${d.icon}</span>
    <div><div class="diag-label">${d.label}</div><div class="diag-tip">${d.tip}</div></div>
  </div>`).join('')}
</div>

<div class="collapse-wrap">
  <button class="collapse-btn" onclick="toggleCollapse(this)">
    <span>📊 详细数据（时薪、日均等）</span><span class="collapse-arrow">▼</span>
  </button>
  <div class="collapse-body">
    <div class="stats">
      <div class="stat"><div class="stat-v">¥${r.effectiveHourlyRate}/h</div><div class="stat-k">等效时薪</div></div>
      <div class="stat"><div class="stat-v">¥${r.dailyValue.toLocaleString()}</div><div class="stat-k">等效日均价值</div></div>
      <div class="stat"><div class="stat-v">¥${r.expectedRate}/h</div><div class="stat-k">行业期望时薪</div></div>
      <div class="stat"><div class="stat-v">${r.effectiveDays}天</div><div class="stat-k">实际年工作日</div></div>
      <div class="stat"><div class="stat-v">${r.totalHoursPerDay}h</div><div class="stat-k">日均有效耗时</div></div>
      <div class="stat"><div class="stat-v">¥${(r.yearlyIncome/10000).toFixed(1)}万</div><div class="stat-k">年税后总收入</div></div>
    </div>
    <div class="sec-title" style="margin-top:16px;font-size:13px">📊 行业分布曲线</div>
    <div class="chart-box"><canvas id="dc" height="100"></canvas></div>
  </div>
</div>

<div class="res-acts">
  <button class="btn btn-g" onclick="goTo(1)">重新测试</button>
  <button class="btn btn-c" onclick="copyLink()">🔗 分享链接</button>
  <button class="btn btn-p" onclick="genCard()">📷 生成分享图</button>
</div>`;

  requestAnimationFrame(() => {
    animScore(r.finalScore, lv.color);
    animBeat(r.beat);
    animRadar(radar);
    animPin(lv.pct);
    // 分布曲线仅在折叠展开时绘制
    document.querySelector('.collapse-btn')?.addEventListener('click', () => {
      setTimeout(() => drawCurve(r.finalScore, r.distParams), 50);
    }, { once: true });
    // 诊断项目错落淡入
    document.querySelectorAll('.diag-anim').forEach((el, i) => {
      el.style.opacity = '0'; el.style.transform = 'translateY(12px)';
      setTimeout(() => { el.style.transition = 'all 0.4s ease'; el.style.opacity = '1'; el.style.transform = 'none'; }, 600 + i * 80);
    });
  });
}

// ---- 折叠 ----
function toggleCollapse(btn) {
  const body = btn.nextElementSibling;
  const arrow = btn.querySelector('.collapse-arrow');
  const open = body.classList.toggle('open');
  arrow.textContent = open ? '▲' : '▼';
}

// ---- 进度条指示针动画 ----
function animPin(targetPct) {
  const pin = document.getElementById('sbar-pin'); if (!pin) return;
  pin.style.left = '0%';
  setTimeout(() => {
    pin.style.transition = 'left 1s cubic-bezier(0.34,1.56,0.64,1)';
    pin.style.left = targetPct + '%';
  }, 300);
}

// ---- 雷达图动画 ----
function animRadar(dims) {
  const cv = document.getElementById('rdr'); if (!cv) return;
  const ctx = cv.getContext('2d');
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const gridCol  = isDark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)';
  const axisCol  = isDark ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.12)';
  const textCol  = isDark ? 'rgba(235,235,245,.9)'  : 'rgba(40,40,50,.85)';
  const accentCol= '#0A84FF';
  const fill1    = isDark ? 'rgba(10,132,255,.4)' : 'rgba(0,122,255,.3)';
  const fill2    = isDark ? 'rgba(48,209,88,.25)' : 'rgba(52,199,89,.2)';

  const W = 280, H = 270, cx = W/2, cy = H/2 + 8, R = 92;
  const N = dims.length;
  const angles = dims.map((_, i) => -Math.PI/2 + (i * 2 * Math.PI / N));
  let prog = 0;
  const tick = () => {
    prog = Math.min(prog + 0.03, 1);
    const t = prog;
    ctx.clearRect(0, 0, W, H);
    // 网格
    for (let ring = 1; ring <= 4; ring++) {
      const r2 = R * ring / 4;
      ctx.beginPath();
      angles.forEach((a, i) => { const x=cx+r2*Math.cos(a), y=cy+r2*Math.sin(a); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
      ctx.closePath();
      ctx.strokeStyle = gridCol; ctx.lineWidth = ring===4 ? 1.5 : 1; ctx.stroke();
    }
    // 轴线
    angles.forEach(a => {
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx+R*Math.cos(a), cy+R*Math.sin(a));
      ctx.strokeStyle = axisCol; ctx.lineWidth = 1; ctx.stroke();
    });
    // 数据多边形
    ctx.beginPath();
    dims.forEach((d, i) => {
      const rv = R * d.v * t;
      const x = cx + rv*Math.cos(angles[i]), y = cy + rv*Math.sin(angles[i]);
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.closePath();
    const g = ctx.createLinearGradient(cx-R,cy-R,cx+R,cy+R);
    g.addColorStop(0, fill1); g.addColorStop(1, fill2);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = accentCol; ctx.lineWidth = 2.5; ctx.stroke();
    // 节点
    dims.forEach((d, i) => {
      const rv = R * d.v * t;
      const x = cx + rv*Math.cos(angles[i]), y = cy + rv*Math.sin(angles[i]);
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI*2);
      ctx.fillStyle = accentCol; ctx.fill();
      ctx.strokeStyle = isDark ? '#111' : '#fff'; ctx.lineWidth = 2; ctx.stroke();
    });
    // 标签
    dims.forEach((d, i) => {
      const lx = cx + (R+28)*Math.cos(angles[i]);
      const ly = cy + (R+28)*Math.sin(angles[i]);
      ctx.font = '700 13px -apple-system,sans-serif';
      ctx.fillStyle = textCol; ctx.textAlign = 'center';
      ctx.fillText(d.label, lx, ly+3);
      ctx.font = '600 11px -apple-system,sans-serif';
      ctx.fillStyle = accentCol;
      ctx.fillText(Math.round(d.v*100)+'%', lx, ly+17);
    });
    if (prog < 1) requestAnimationFrame(tick);
  };
  tick();
}


// ---- 分数环动画 ----
function animScore(target, color) {
  const cv = document.getElementById('rc'); if (!cv) return;
  const ctx = cv.getContext('2d');
  const SIZE = 200, cx = 100, cy = 100, rad = 86;
  let cur = 0;
  const tick = () => {
    cur = Math.min(cur + target / 60, target);
    ctx.clearRect(0, 0, SIZE, SIZE);
    // 底圈
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 10; ctx.stroke();
    // 彩色弧（上限150分=满圆）
    const maxScore = 150;
    const ang = (Math.min(cur, maxScore) / maxScore) * Math.PI * 2 - Math.PI / 2;
    const g = ctx.createLinearGradient(cx - rad, 0, cx + rad, 0);
    g.addColorStop(0, '#0A84FF'); g.addColorStop(1, color);
    ctx.beginPath(); ctx.arc(cx, cy, rad, -Math.PI / 2, ang);
    ctx.strokeStyle = g; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.stroke();
    // 数字
    const el = document.getElementById('sn');
    if (el) el.textContent = Math.round(cur);
    if (cur < target) requestAnimationFrame(tick);
  };
  tick();
}
function animBeat(t) {
  const el=document.getElementById('bp'); if(!el) return;
  let c=0;
  const tick=()=>{ c=Math.min(c+t/60,t); el.textContent=Math.floor(c)+'%'; if(c<t) requestAnimationFrame(tick); else el.textContent=t+'%'; };
  tick();
}

// ---- 分布曲线 ----
function drawCurve(score, params) {
  const cv=document.getElementById('dc'); if(!cv) return;
  cv.width=cv.parentElement.clientWidth-36;
  const ctx=cv.getContext('2d'), W=cv.width, H=100;
  const{mean,std}=params, lo=mean-4*std, hi=mean+4*std;
  const pts=Array.from({length:W+1},(_,px)=>{
    const x=lo+(px/W)*(hi-lo);
    const y=Math.exp(-0.5*((x-mean)/std)**2)/(std*Math.sqrt(2*Math.PI));
    return{px,y,x};
  });
  const maxY=Math.max(...pts.map(p=>p.y));
  const ty=y=>H-14-(y/maxY)*(H-26);
  const spx=Math.min(Math.round(((score-lo)/(hi-lo))*W),W);

  // 全体背景
  ctx.beginPath();pts.forEach((p,i)=>i===0?ctx.moveTo(p.px,ty(p.y)):ctx.lineTo(p.px,ty(p.y)));
  ctx.lineTo(W,H-14);ctx.lineTo(0,H-14);ctx.closePath();
  ctx.fillStyle='rgba(255,255,255,.06)';ctx.fill();

  // 你以下区域（彩色）
  ctx.beginPath();pts.slice(0,spx+1).forEach((p,i)=>i===0?ctx.moveTo(p.px,ty(p.y)):ctx.lineTo(p.px,ty(p.y)));
  ctx.lineTo(spx,H-14);ctx.lineTo(0,H-14);ctx.closePath();
  const g=ctx.createLinearGradient(0,0,spx,0);
  g.addColorStop(0,'rgba(10,132,255,.2)');g.addColorStop(1,'rgba(48,209,88,.4)');
  ctx.fillStyle=g;ctx.fill();

  // 曲线
  ctx.beginPath();pts.forEach((p,i)=>i===0?ctx.moveTo(p.px,ty(p.y)):ctx.lineTo(p.px,ty(p.y)));
  ctx.strokeStyle='rgba(255,255,255,.2)';ctx.lineWidth=1.5;ctx.stroke();

  // 你的线
  const myY=ty(pts[Math.min(spx,W)].y);
  ctx.beginPath();ctx.moveTo(spx,myY);ctx.lineTo(spx,H-14);
  ctx.strokeStyle='#0A84FF';ctx.lineWidth=2;ctx.setLineDash([4,3]);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#0A84FF';ctx.font='600 11px -apple-system,sans-serif';
  ctx.textAlign=spx>W*.7?'right':'left';
  ctx.fillText(`你 ${score}分`,spx+(spx>W*.7?-6:6),myY-4);
  ctx.fillStyle='rgba(255,255,255,.3)';ctx.font='10px sans-serif';ctx.textAlign='center';
  [lo+(hi-lo)*.1,mean,lo+(hi-lo)*.9].forEach(v=>{
    ctx.fillText(Math.round(v),Math.round(((v-lo)/(hi-lo))*W),H-2);
  });
}

// ---- 分享链接 ----
function copyLink() {
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(D))));
  const url = `${location.origin}${location.pathname}#s=${encoded}`;
  navigator.clipboard?.writeText(url)
    .then(()=>toast('✅ 链接已复制，分享给朋友一起测！'))
    .catch(()=>prompt('复制此链接：', url));
}

// ---- 生成分享图（含雷达图+分析+行业曲线，不含薪资）----
async function genCard() {
  if (!lastResult) return;
  const r = lastResult;
  const lv = scoreLevel(r.finalScore);
  const ind = C.INDUSTRY_BENCH[D.industry]?.label || '';
  const co  = C.STABILITY[D.companyType]?.label || '';
  const jobR = (C.JOB_ROLES[D.industry] || []).find(j => j.k === D.jobRole)?.label || '';
  const city = C.CITY_COST[D.cityTier]?.label || '';
  const analysis = genAnalysis(r, D);

  const W = 1080, H = 1560;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  // —— 背景 ——
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0d0d0f'); bg.addColorStop(1, '#1a1a1e');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // 发光装饰
  const rg1 = ctx.createRadialGradient(100, 150, 0, 100, 150, 500);
  rg1.addColorStop(0, 'rgba(10,132,255,.15)'); rg1.addColorStop(1, 'transparent');
  ctx.fillStyle = rg1; ctx.fillRect(0, 0, W, H);
  const rg2 = ctx.createRadialGradient(W-100, H-200, 0, W-100, H-200, 400);
  rg2.addColorStop(0, `${lv.color}22`); rg2.addColorStop(1, 'transparent');
  ctx.fillStyle = rg2; ctx.fillRect(0, 0, W, H);

  // —— 顶部标题 ——
  ctx.font = '500 30px -apple-system,sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.4)';
  ctx.textAlign = 'center';
  ctx.fillText('💼  工作值不值  测评结果', W/2, 72);

  // 横线
  ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(80, 95); ctx.lineTo(W-80, 95); ctx.stroke();

  // —— 大分数环（Canvas） ——
  const scoreR = 110, scx = W/2, scy = 230;
  // 底环
  ctx.beginPath(); ctx.arc(scx, scy, scoreR, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 14; ctx.stroke();
  // 彩色弧
  const maxScore = 150;
  const ang = (Math.min(r.finalScore, maxScore) / maxScore) * Math.PI * 2 - Math.PI / 2;
  const arcG = ctx.createLinearGradient(scx - scoreR, 0, scx + scoreR, 0);
  arcG.addColorStop(0, '#0A84FF'); arcG.addColorStop(1, lv.color);
  ctx.beginPath(); ctx.arc(scx, scy, scoreR, -Math.PI/2, ang);
  ctx.strokeStyle = arcG; ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.stroke();
  // 分数数字
  ctx.font = '900 96px -apple-system,sans-serif';
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.fillText(Math.round(r.finalScore), scx, scy + 30);
  ctx.font = '400 22px -apple-system,sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.fillText('综合得分', scx, scy + 62);

  // —— 锐评徽章 ——
  const badgeY = 390;
  const badgeTxt = lv.label;
  ctx.font = '700 34px -apple-system,sans-serif';
  const tw = ctx.measureText(badgeTxt).width;
  const bx = (W - tw - 60) / 2, bw = tw + 60, bh = 68;
  ctx.beginPath(); ctx.roundRect(bx, badgeY, bw, bh, 34);
  ctx.fillStyle = lv.bg; ctx.fill();
  ctx.beginPath(); ctx.roundRect(bx, badgeY, bw, bh, 34);
  ctx.strokeStyle = lv.color + '55'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = lv.color; ctx.textAlign = 'center';
  ctx.fillText(badgeTxt, W/2, badgeY + 45);

  // 行业/岗位/城市标签
  const tagY = 482;
  const tags = [ind, jobR, city].filter(Boolean);
  ctx.font = '500 26px -apple-system,sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  ctx.fillText(tags.join('  ·  '), W/2, tagY);

  // 打败多少人
  const beatY = 538;
  ctx.font = '800 72px -apple-system,sans-serif';
  const beatG = ctx.createLinearGradient(W/2-220,0,W/2+220,0);
  beatG.addColorStop(0,'#0A84FF'); beatG.addColorStop(1,'#30D158');
  ctx.fillStyle = beatG;
  ctx.fillText(`打败 ${r.beat}% 打工人`, W/2, beatY);
  ctx.font = '400 22px -apple-system,sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.28)';
  ctx.fillText('* 行业统计分布模型估算，仅供参考', W/2, beatY + 38);

  ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(80, 600); ctx.lineTo(W-80, 600); ctx.stroke();

  // —— 五维雷达图 ——
  const radar = [
    { label:'薪资', v: Math.min(1, Math.max(0, r.effectiveHourlyRate / r.expectedRate / 1.5)) },
    { label:'稳定', v: radarVal(r.stabilityC, 0.75, 1.38) },
    { label:'氛围', v: radarVal(r.atmosphereC, 0.65, 1.28) },
    { label:'自由', v: radarVal(r.freedomC, 0.60, 1.28) },
    { label:'通勤', v: radarVal(r.commuteC, 0.68, 1.18) },
  ];
  const RRR = 158, rcx = W/2, rcy = 830;
  const NN = radar.length;
  const rangs = radar.map((_, i) => -Math.PI/2 + (i * 2 * Math.PI / NN));
  // 网格
  for (let ring = 1; ring <= 4; ring++) {
    const r2 = RRR * ring / 4;
    ctx.beginPath();
    rangs.forEach((a, i) => { const x=rcx+r2*Math.cos(a),y=rcy+r2*Math.sin(a); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = ring===4?2:1; ctx.stroke();
  }
  rangs.forEach(a => {
    ctx.beginPath(); ctx.moveTo(rcx,rcy); ctx.lineTo(rcx+RRR*Math.cos(a),rcy+RRR*Math.sin(a));
    ctx.strokeStyle='rgba(255,255,255,.12)'; ctx.lineWidth=1; ctx.stroke();
  });
  // 数据区
  ctx.beginPath();
  radar.forEach((d, i) => {
    const rv = RRR * d.v;
    const x = rcx + rv*Math.cos(rangs[i]), y = rcy + rv*Math.sin(rangs[i]);
    i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  });
  ctx.closePath();
  const rg3 = ctx.createLinearGradient(rcx-RRR,rcy-RRR,rcx+RRR,rcy+RRR);
  rg3.addColorStop(0,'rgba(10,132,255,.42)'); rg3.addColorStop(1,'rgba(48,209,88,.3)');
  ctx.fillStyle=rg3; ctx.fill();
  ctx.strokeStyle='#0A84FF'; ctx.lineWidth=3; ctx.stroke();
  // 节点
  radar.forEach((d, i) => {
    const rv = RRR * d.v;
    const x = rcx+rv*Math.cos(rangs[i]), y = rcy+rv*Math.sin(rangs[i]);
    ctx.beginPath(); ctx.arc(x,y,7,0,Math.PI*2);
    ctx.fillStyle='#0A84FF'; ctx.fill();
    ctx.strokeStyle='#111'; ctx.lineWidth=3; ctx.stroke();
  });
  // 标签
  ctx.font = '700 26px -apple-system,sans-serif';
  radar.forEach((d, i) => {
    const lx = rcx + (RRR+42)*Math.cos(rangs[i]);
    const ly = rcy + (RRR+42)*Math.sin(rangs[i]);
    ctx.fillStyle = 'rgba(235,235,245,.9)'; ctx.textAlign='center';
    ctx.fillText(d.label, lx, ly+2);
    ctx.font='600 22px -apple-system,sans-serif'; ctx.fillStyle='#0A84FF';
    ctx.fillText(Math.round(d.v*100)+'%', lx, ly+28);
    ctx.font='700 26px -apple-system,sans-serif';
  });

  ctx.strokeStyle='rgba(255,255,255,.07)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(80,1050); ctx.lineTo(W-80,1050); ctx.stroke();

  // —— 分析段落 ——
  const analysisY = 1082;
  ctx.font = '600 26px -apple-system,sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.textAlign = 'left';
  ctx.fillText('📝 综合分析', 80, analysisY);
  ctx.font = '400 24px -apple-system,sans-serif';
  ctx.fillStyle = 'rgba(235,235,245,.7)';
  // 自动折行
  const words = analysis, maxW = W - 160;
  let line = '', ty = analysisY + 40;
  const sentences = words.split(/[。]/);
  for (const s of sentences) {
    const str = s.trim(); if (!str) continue;
    const full = str + '。';
    let l = '', lx2 = 80;
    for (const ch of full) {
      const test = l + ch;
      if (ctx.measureText(test).width > maxW) {
        ctx.fillText(l, lx2, ty); ty += 38; l = ch;
      } else { l = test; }
    }
    if (l) { ctx.fillText(l, lx2, ty); ty += 44; }
    if (ty > 1300) break; // 防溢出
  }

  // —— 行业分布曲线 ——
  const curveY = 1330, curveH = 100, curveW = W - 160;
  ctx.font = '600 24px -apple-system,sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.textAlign='left';
  ctx.fillText('📊 行业分布曲线', 80, curveY - 14);
  // 简单正态曲线
  const dp = r.distParams;
  if (dp) {
    const { mean, std, lo, hi } = dp;
    const toX = v => 80 + ((v-lo)/(hi-lo)) * curveW;
    // 填充区
    ctx.beginPath();
    for (let v = lo; v <= hi; v += (hi-lo)/200) {
      const z = (v-mean)/std;
      const dens = Math.exp(-0.5*z*z);
      const x = toX(v), y = curveY + curveH - dens * curveH;
      v===lo ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    }
    ctx.lineTo(toX(hi), curveY+curveH);
    ctx.lineTo(toX(lo), curveY+curveH);
    ctx.closePath();
    const cg = ctx.createLinearGradient(80,0,80+curveW,0);
    cg.addColorStop(0,'rgba(10,132,255,.3)'); cg.addColorStop(1,'rgba(48,209,88,.3)');
    ctx.fillStyle=cg; ctx.fill();
    // 我的位置竖线
    const myX = toX(Math.min(r.finalScore, hi));
    ctx.beginPath(); ctx.moveTo(myX, curveY); ctx.lineTo(myX, curveY+curveH);
    ctx.strokeStyle = lv.color; ctx.lineWidth=3; ctx.stroke();
    ctx.font='600 22px -apple-system,sans-serif'; ctx.fillStyle=lv.color; ctx.textAlign='center';
    ctx.fillText(`我 ${Math.round(r.finalScore)}分`, myX, curveY-8);
  }

  // —— 底部品牌 ——
  ctx.strokeStyle='rgba(255,255,255,.07)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(80,1462); ctx.lineTo(W-80,1462); ctx.stroke();
  ctx.font='400 24px -apple-system,sans-serif'; ctx.fillStyle='rgba(255,255,255,.22)'; ctx.textAlign='center';
  ctx.fillText('扫码 / 访问链接测测你的工作值不值', W/2, 1496);
  ctx.font='600 26px -apple-system,sans-serif'; ctx.fillStyle='#0A84FF';
  ctx.fillText(location.hostname + location.pathname, W/2, 1534);

  showModal(cv.toDataURL('image/png'));
}




function showModal(url) {
  let m=document.getElementById('share-modal');
  if(!m){
    m=document.createElement('div'); m.id='share-modal'; m.className='modal-bg';
    m.innerHTML=`<div class="modal">
      <div class="modal-title">📷 分享图片已生成</div>
      <img id="share-img" class="modal-img">
      <div class="beat-note" style="margin-bottom:14px">图片不含薪资信息，可放心分享</div>
      <div class="modal-acts">
        <button class="btn btn-g" onclick="document.getElementById('share-modal').remove()">关闭</button>
        <button class="btn btn-p" onclick="dlShare()">⬇️ 下载图片</button>
      </div>
    </div>`;
    document.body.appendChild(m);
  }
  m.classList.remove('hidden');
  document.getElementById('share-img').src=url;
  document._shareUrl=url;
}
function dlShare() {
  const a=document.createElement('a');
  a.href=document._shareUrl;
  a.download=`工作值不值_${lastResult?.finalScore||0}分.png`;
  a.click();
}

// ---- Toast ----
function toast(msg) {
  const t=document.getElementById('toast');
  if(!t) return; t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2800);
}

// ---- 主题切换 ----
function setThemeUI(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon  = document.getElementById('theme-icon');
  const label = document.getElementById('theme-label');
  if (icon)  icon.textContent  = theme === 'dark' ? '☀️' : '🌙';
  if (label) label.textContent = theme === 'dark' ? '浅色' : '暗色';
}
function toggleTheme() {
  const cur  = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = cur === 'dark' ? 'light' : 'dark';
  setThemeUI(next);
  localStorage.setItem('theme', next);
}

// ---- Hash 还原 ----
function restoreHash() {
  const h=location.hash;
  if(!h.startsWith('#s=')) return false;
  try { Object.assign(D, JSON.parse(decodeURIComponent(escape(atob(h.slice(3)))))); return true; }
  catch { return false; }
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', ()=>{
  const saved = localStorage.getItem('theme') || 'dark';
  setThemeUI(saved);
  if(restoreHash()){ renderResult(); goTo(5); } else { goTo(0); }
});
