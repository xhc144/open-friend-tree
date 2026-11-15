import {
  AVATARS,
  DEFAULT_QUESTIONS,
  createTree,
  validateTree,
  encodeTree,
  decodeTree,
  makeLink,
  encodeReceipt,
  decodeReceipt,
  importReceipt,
  scoreAnswers,
  loadTrees,
  saveTree,
  deleteTree,
  extractCode,
  validateResult,
} from "./lib.js";

const main = document.querySelector("main");
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const clone = (value) => JSON.parse(JSON.stringify(value));
let draft = null,
  editIndex = 0,
  identityDone = false,
  play = null,
  finished = null,
  routeVersion = 0,
  toastTimer,
  sound = false,
  audio;
const demoTree = createTree({
  name: "小鹿",
  avatar: "🦌",
  mood: "愿我们每年都一起过冬天",
  questions: clone(DEFAULT_QUESTIONS),
});
const sampleResults = [
  { name: "小熊", avatar: "🐻", score: 10 },
  { name: "阿橘", avatar: "🐱", score: 8 },
  { name: "小企鹅", avatar: "🐧", score: 6 },
  { name: "团子", avatar: "🐰", score: 4 },
];

$(".skip-link").addEventListener("click", (e) => {
  e.preventDefault();
  main.focus();
  main.scrollIntoView({ block: "start" });
});

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 3800);
}
function fail(error) {
  toast(error.message || "操作失败，请重试");
}
function go(hash = "") {
  if (location.hash === "#" + hash) {
    route();
  } else location.hash = hash;
}
function errorView(error) {
  main.innerHTML = `<section class="center-page panel"><div class="eyebrow">LET'S TRY AGAIN</div><h1>这次没有打开</h1><p class="muted long-wrap">${esc(error.message || "链接无法读取，请让朋友重新发一次。")}</p><a class="button primary" href="#">回到首页</a></section>`;
}
function chirp() {
  if (!sound) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    const osc = audio.createOscillator(),
      gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(659, audio.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, audio.currentTime + 0.12);
    gain.gain.setValueAtTime(0.05, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.21);
  } catch {}
}
$(".sound-toggle").addEventListener("click", () => {
  sound = !sound;
  const b = $(".sound-toggle");
  b.setAttribute("aria-pressed", String(sound));
  b.setAttribute("aria-label", sound ? "关闭提示音" : "开启提示音");
  b.title = sound ? "关闭提示音" : "开启提示音";
  $("span", b).textContent = sound ? "声音开" : "声音关";
  if (sound) chirp();
});
async function copy(value) {
  if (!value) throw new Error("链接尚未准备好，请稍等");
  try {
    if (!navigator.clipboard) throw new Error();
    await navigator.clipboard.writeText(value);
    toast("链接已复制，可以发给朋友啦");
  } catch {
    const area = $("#copy-fallback");
    area.value = value;
    $("#copy-dialog").showModal();
    area.focus();
    area.select();
  }
}
async function nativeShare(url, title) {
  if (navigator.share) {
    try {
      await navigator.share({
        title,
        text: "来看看你有多懂我，把默契挂到圣诞树上。",
        url,
      });
      return;
    } catch (e) {
      if (e.name === "AbortError") return;
    }
  }
  await copy(url);
}
function avatarPicker(value) {
  return `<div class="avatar-picker" role="group" aria-label="选择头像">${AVATARS.map((a) => `<button type="button" class="avatar-choice" data-avatar="${esc(a)}" aria-label="头像 ${esc(a)}" aria-pressed="${a === value}">${esc(a)}</button>`).join("")}</div>`;
}
function bindAvatar(initial, onChange) {
  let selected = initial;
  $$("[data-avatar]").forEach((b) =>
    b.addEventListener("click", () => {
      selected = b.dataset.avatar;
      $$("[data-avatar]").forEach((el) =>
        el.setAttribute("aria-pressed", String(el.dataset.avatar === selected)),
      );
      onChange(selected);
    }),
  );
}
function treeArt() {
  return `<svg class="tree-art" viewBox="0 0 460 470" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="pine" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#426e53"/><stop offset="1" stop-color="#274e3d"/></linearGradient><linearGradient id="pine2" x1="0" x2="1"><stop stop-color="#4d7859"/><stop offset="1" stop-color="#315d45"/></linearGradient><radialGradient id="halo"><stop stop-color="#ecd39a" stop-opacity=".2"/><stop offset="1" stop-color="#ecd39a" stop-opacity="0"/></radialGradient></defs><circle cx="230" cy="205" r="210" fill="url(#halo)"/><ellipse cx="230" cy="436" rx="152" ry="16" fill="#0d3028" opacity=".6"/><path d="M216 362h29v62q-15 10-29 0z" fill="#a07e51"/><path d="m230 59-85 114h31L110 267h39L63 374q168 26 334 0l-86-107h39l-66-94h31z" fill="url(#pine)"/><path d="m230 65-85 108q84 29 170 0z" fill="url(#pine2)"/><path d="m178 170-68 97q120 31 240 0l-68-97q-52 16-104 0" fill="url(#pine2)" opacity=".75"/><path d="m150 267-87 107q165 35 334 0l-87-107q-80 21-160 0" fill="url(#pine2)" opacity=".6"/><path d="M175 155q45 34 112 20M139 234q92 52 180 17M100 335q124 61 263 9" fill="none" stroke="#dec88c" stroke-width="2" opacity=".8"/><g fill="#f3d999"><circle class="light" cx="190" cy="165" r="4"/><circle class="light" cx="226" cy="176" r="3.5"/><circle class="light" cx="268" cy="178" r="4"/><circle class="light" cx="160" cy="245" r="4"/><circle class="light" cx="199" cy="259" r="4.5"/><circle class="light" cx="243" cy="267" r="3.5"/><circle class="light" cx="290" cy="262" r="4"/><circle class="light" cx="129" cy="349" r="4"/><circle class="light" cx="173" cy="362" r="4"/><circle class="light" cx="216" cy="372" r="4"/><circle class="light" cx="265" cy="371" r="4"/><circle class="light" cx="312" cy="363" r="4"/><circle class="light" cx="346" cy="350" r="4"/></g><g fill="#d68a73"><circle cx="212" cy="125" r="6"/><circle cx="270" cy="217" r="6.5"/><circle cx="176" cy="303" r="7"/><circle cx="283" cy="320" r="7"/></g><g stroke="#d6bd79" fill="none" opacity=".6"><path d="m230 37 3 9m-16 2-6-3m33 4 6-3"/></g><path d="m230 33 7 17 18 2-14 12 4 18-15-9-16 9 4-18-14-12 19-2z" fill="#f0cf85"/><path d="m230 45 4 11 11 1-8 7 2 10-9-5-9 5 2-10-8-7 11-1z" fill="#f8e3b2"/><g><path d="M122 403h43v34h-43z" fill="#cb7864"/><path d="M118 400h51v9h-51z" fill="#e39a83"/><path d="M141 400h6v37h-6z" fill="#eacb8c"/><path d="M290 395h37v42h-37z" fill="#ccb780"/><path d="M286 393h45v9h-45z" fill="#e3d09a"/><path d="M305 393h6v44h-6z" fill="#8b634d"/><path d="M260 412h31v26h-31z" fill="#a9ba91"/><path d="M257 409h37v7h-37z" fill="#c4d1ae"/><path d="M272 410h5v28h-5z" fill="#f3e3b2"/></g><g fill="#e6dfc3" opacity=".8"><path d="m87 110 2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path d="m364 174 2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><circle cx="102" cy="238" r="1.5"/><circle cx="340" cy="101" r="1.5"/><circle cx="369" cy="303" r="1.5"/><circle cx="124" cy="73" r="1.5"/></g></svg>`;
}
function treePanel(tree, { demo = false, current = null, empty = false } = {}) {
  const people = demo
    ? sampleResults
    : [
        ...(current ? [current] : []),
        ...tree.results.filter((r) => !current || r.id !== current.id),
      ];
  const groups = [[], [], [], []];
  for (const r of people) {
    const ratio = r.score / tree.questions.length;
    groups[ratio >= 0.9 ? 0 : ratio >= 0.7 ? 1 : ratio >= 0.5 ? 2 : 3].push(r);
  }
  const places = [
    [
      { x: 49, y: 25 },
      { x: 39, y: 35 },
      { x: 61, y: 35 },
    ],
    [
      { x: 39, y: 46 },
      { x: 63, y: 51 },
      { x: 50, y: 56 },
    ],
    [
      { x: 29, y: 64 },
      { x: 70, y: 68 },
      { x: 48, y: 73 },
    ],
    [
      { x: 31, y: 87 },
      { x: 66, y: 87 },
      { x: 49, y: 88 },
    ],
  ];
  const shown = groups.flatMap((group, level) =>
    group.slice(0, 3).map((r, i) => ({ r, ...places[level][i] })),
  );
  const ornaments = shown
    .map(
      ({ r, x, y }) =>
        `<div class="ornament ${current && r.id === current.id ? "current" : ""}" style="left:${x}%;top:${y}%" title="${esc(r.name)} · 答对${r.score}题"><span class="avatar">${esc(r.avatar)}</span><span class="friend-name">${esc(r.name)} · ${r.score}/${tree.questions.length}</span></div>`,
    )
    .join("");
  const truncated = shown.length < people.length;
  return `<section class="tree-panel" aria-label="${demo ? "圣诞树玩法示意" : esc(tree.name) + "的圣诞树"}">${demo ? '<div class="tree-panel-label">A LITTLE TREE, A LOT OF US.</div>' : `<div class="welcome-tree-head"><h2>${esc(tree.avatar)} ${esc(tree.name)}的圣诞树</h2><p>${esc(tree.mood || "每一份默契，都值得一颗小星星")}</p></div>`}<div class="tree-stage">${treeArt()}${ornaments}${empty && !people.length ? '<div class="tree-empty-caption">等你，把朋友挂上树。</div>' : ""}</div><p class="${demo ? "tree-caption" : "grow-label"}">${demo ? "懂你的人，会在最高的枝头。" : people.length ? (truncated ? `共 ${people.length} 份默契 · 树上展示 ${shown.length} 位，完整成绩见名单` : `已挂上 ${people.length} 份默契 · 越懂你，爬得越高`) : "树顶的位置，留给最懂你的人。"}</p>${demo ? '<span class="tree-note">玩法示意 · 非真实成绩</span>' : ""}</section>`;
}
function heading(title, subtitle, actions = "") {
  return `<div class="page-heading"><div><div class="eyebrow">FRIENDSHIP, IN FULL BLOOM</div><h1 tabindex="-1">${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ""}</div>${actions ? `<div class="header-actions">${actions}</div>` : ""}</div>`;
}

function home() {
  main.innerHTML = `<section class="hero"><div class="hero-copy"><div class="eyebrow">A CHRISTMAS FOR YOU & ME</div><h1>今年的圣诞树，<br>想挂满<em>你们。</em></h1><p class="hero-description">关于我的十个小问题，<br>你能猜中几个？让懂你的人，<br>在这棵树上找到自己的位置。</p><div class="hero-actions"><a class="button primary" href="#create">种下我的树 <span aria-hidden="true">↗</span></a><button class="button secondary" id="try-demo">先体验一下</button></div><div class="hero-caption"><span>不登录，也能玩</span><span>免费 · 无广告 · 开源</span></div></div>${treePanel(demoTree, { demo: true })}</section><section class="hero-steps" aria-label="怎么玩"><article><span class="step-no">01</span><div><h3>选出你的答案</h3><p>十个小问题，也可以改成你自己的。</p></div></article><article><span class="step-no">02</span><div><h3>邀请朋友来爬树</h3><p>发出链接，看谁能猜中你的心思。</p></div></article><article><span class="step-no">03</span><div><h3>收下一整树默契</h3><p>朋友把成绩发回来，你把他们挂上树。</p></div></article></section>`;
  $("#try-demo").addEventListener("click", async () => {
    try {
      go("play=" + (await encodeTree(demoTree)));
    } catch (e) {
      fail(e);
    }
  });
}
function startDraft() {
  draft = {
    name: "",
    avatar: AVATARS[0],
    mood: "愿我们每年都一起过冬天",
    questions: clone(DEFAULT_QUESTIONS).map((q) => ({ ...q, answer: -1 })),
  };
  editIndex = 0;
  identityDone = false;
}
function create() {
  if (!draft) startDraft();
  if (!identityDone) {
    main.innerHTML = `${heading("种一棵属于你的树", "先告诉朋友，这是谁的圣诞树。")}<div class="two-column">${treePanel({ ...demoTree, name: draft.name || "你", avatar: draft.avatar, mood: draft.mood }, { empty: true })}<section class="panel"><div class="plain-steps"><span class="active">1 介绍自己</span><span class="line"></span><span>2 选择答案</span><span class="line"></span><span>3 邀请朋友</span></div><form id="identity-form"><label class="field"><span>你希望朋友怎么称呼你？</span><input name="name" id="owner-name" placeholder="你的昵称" maxlength="24" required autocomplete="nickname" value="${esc(draft.name)}"></label><div class="field"><span>挑一个小头像</span>${avatarPicker(draft.avatar)}</div><label class="field"><span>送给这棵树的一句话</span><input name="mood" maxlength="24" value="${esc(draft.mood)}" placeholder="愿我们每年都一起过冬天"></label><div id="form-error" class="error-box" role="alert"></div><button class="button primary" type="submit">开始选答案 <span aria-hidden="true">→</span></button><p class="helper">不用注册。你的树保存在当前浏览器，分享链接就能邀请朋友。</p></form></section></div>`;
    bindAvatar(draft.avatar, (a) => (draft.avatar = a));
    $("#identity-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(e.target);
      draft.name = data.get("name").trim();
      draft.mood = data.get("mood").trim();
      if (!draft.name) {
        $("#form-error").textContent = "先写一个昵称吧";
        return;
      }
      identityDone = true;
      create();
    });
    return;
  }
  creatorQuestion();
}
function creatorQuestion() {
  const q = draft.questions[editIndex];
  main.innerHTML = `${heading(`${draft.name}，选出你的答案`, "朋友会在两个选项中猜你的选择。题目和选项都可以修改。", `<button class="button secondary small" id="edit-identity">修改资料</button>`)}<section class="center-page panel creator-card"><div class="progress-label"><span>正在种下默契</span><span>第 ${editIndex + 1} / ${draft.questions.length} 题</span></div><div class="progress"><span style="width:${((editIndex + 1) / draft.questions.length) * 100}%"></span></div><form id="question-form"><label for="question-title" class="helper">题目</label><input class="question-title" id="question-title" name="title" aria-label="题目" value="${esc(q.title)}" maxlength="100" required><div role="group" aria-label="选择自己的答案">${q.options.map((o, i) => `<div class="option-edit-row"><input type="radio" id="answer-${i}" name="answer" value="${i}" ${q.answer === i ? "checked" : ""} aria-label="选择选项${i + 1}作为我的答案"><input type="text" name="option-${i}" aria-label="选项${i + 1}" value="${esc(o)}" maxlength="40" required></div>`).join("")}</div><p class="edit-tip">点圆圈选择你的答案；点击文字可以直接编辑。</p><div id="form-error" class="error-box" role="alert"></div><div class="form-footer"><button type="button" class="button secondary" id="previous-question">${editIndex ? "上一题" : "返回资料"}</button><button type="submit" class="button primary">${editIndex === draft.questions.length - 1 ? "完成，种下我的树" : "下一题"} <span aria-hidden="true">→</span></button></div><div class="owner-tools">${draft.questions.length > 5 ? '<button type="button" class="text-button" id="remove-question">不出这道题</button>' : ""}<span class="helper">至少保留 5 题，最多 10 题</span></div></form></section>`;
  const form = $("#question-form");
  function capture() {
    q.title = $("#question-title").value;
    q.options = q.options.map((_, i) => $(`[name="option-${i}"]`).value);
    q.answer =
      form.elements.answer.value === ""
        ? -1
        : Number(form.elements.answer.value);
  }
  form.addEventListener("input", capture);
  $("#previous-question").addEventListener("click", () => {
    capture();
    if (editIndex) editIndex--;
    else identityDone = false;
    create();
  });
  $("#edit-identity").addEventListener("click", () => {
    capture();
    identityDone = false;
    create();
  });
  $("#remove-question")?.addEventListener("click", () => {
    draft.questions.splice(editIndex, 1);
    editIndex = Math.min(editIndex, draft.questions.length - 1);
    creatorQuestion();
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    capture();
    try {
      if (q.answer < 0) throw new Error("选一个最像你的答案吧");
      if (new Set(q.options.map((o) => o.trim())).size !== q.options.length)
        throw new Error("选项不能重复哦");
      if (editIndex < draft.questions.length - 1) {
        editIndex++;
        chirp();
        creatorQuestion();
        return;
      }
      const tree = createTree(draft);
      saveTree(tree);
      draft = null;
      go("manage=" + tree.id);
      chirp();
    } catch (e) {
      $("#form-error").textContent = e.message;
    }
  });
}

async function shareBox(tree) {
  const url = makeLink("play", await encodeTree(tree));
  return `<div class="share-box"><h3>邀请朋友，来猜猜你</h3><p>复制链接发给朋友。朋友答完，把回执发给你；你导入后，他就会出现在这棵树上。</p><textarea readonly class="share-url" id="tree-share-url" aria-label="邀请朋友的链接">${esc(url)}</textarea><div class="share-actions"><button class="button primary" id="copy-tree">复制邀请链接</button><button class="button secondary" id="share-tree">分享给朋友 ↗</button></div></div>`;
}
function bindShare(tree) {
  $("#copy-tree")?.addEventListener("click", () =>
    copy($("#tree-share-url").value).catch(fail),
  );
  $("#share-tree")?.addEventListener("click", () =>
    nativeShare($("#tree-share-url").value, `${tree.name}邀请你上圣诞树`).catch(
      fail,
    ),
  );
}
function friendList(tree, owner = false) {
  if (!tree.results.length)
    return `<div class="empty-state"><div class="empty-icon">✉</div><p>树还很安静，<br>把链接发给第一个朋友吧。</p></div>`;
  return `<ol class="friend-list">${[...tree.results]
    .sort((a, b) => b.score - a.score)
    .map(
      (r) =>
        `<li class="friend-row"><span class="friend-avatar">${esc(r.avatar)}</span><div class="friend-info"><strong>${esc(r.name)}</strong><p>${esc(r.message || "留下一份默契，没有留言。")}</p>${owner ? `<button class="text-button remove-result" data-id="${esc(r.id)}" aria-label="移除${esc(r.name)}的成绩">移除</button>` : ""}</div><span class="friend-score">${r.score}<small> / ${tree.questions.length}</small></span></li>`,
    )
    .join("")}</ol>`;
}
function downloadTree(tree) {
  const blob = new Blob([JSON.stringify(tree, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `OpenTree-${tree.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  toast("备份已导出，请保存好这个文件");
}
async function restore(file) {
  if (!file) return;
  if (file.size > 120000) throw new Error("备份文件过大，最大120KB");
  const restored = validateTree(JSON.parse(await file.text()));
  const existing = loadTrees().find((t) => t.id === restored.id);
  if (existing) {
    if (
      JSON.stringify(existing.questions) !== JSON.stringify(restored.questions)
    )
      throw new Error(
        "这份备份的题目与本机版本不同，请在另一个浏览器中恢复，避免覆盖",
      );
    const results = new Map(existing.results.map((r) => [r.id, r]));
    restored.results.forEach((r) => {
      if (!results.has(r.id)) results.set(r.id, r);
    });
    restored.results = [...results.values()];
    validateTree(restored);
  }
  saveTree(restored);
  toast(existing ? "备份已合并，本机新成绩也保留了" : "备份已恢复");
  go("manage=" + restored.id);
}
function bindRestore() {
  const input = $("#restore-file");
  input?.addEventListener("change", async () => {
    try {
      await restore(input.files[0]);
    } catch (e) {
      fail(e);
    } finally {
      input.value = "";
    }
  });
}
async function manage(id, version) {
  const tree = loadTrees().find((t) => t.id === id);
  if (!tree)
    throw new Error(
      "当前浏览器找不到这棵树。请回到创建它的浏览器，或在“我的树”导入备份。",
    );
  const box = await shareBox(tree);
  if (version !== routeVersion) return;
  main.innerHTML = `${heading(`${tree.name}的圣诞树`, "这里是你的树。收下朋友的成绩，把新朋友挂上去。", `<a class="button secondary small" href="#my">我的树</a><button class="button secondary small" id="preview-tree">访客视角 ↗</button>`)}<div class="two-column">${treePanel(tree, { empty: true })}<div class="stack">${box}<section class="panel"><div class="section-title"><h2>朋友们的默契</h2><span class="count-badge">${tree.results.length} / 100 位</span></div>${friendList(tree, true)}${tree.results.length ? '<p class="helper">分享链接收录当前成绩；有新朋友后，重新复制邀请链接即可更新。</p>' : ""}</section><section class="panel"><div class="section-title"><h3>把朋友挂上树</h3><span aria-hidden="true">↗</span></div><form id="import-receipt" class="inline-form"><label for="receipt-input" class="helper">粘贴朋友发来的回执链接</label><textarea id="receipt-input" placeholder="粘贴完整回执链接，或回执码" required maxlength="60000" rows="2"></textarea><div id="receipt-error" class="error-box" role="alert"></div><button type="submit" class="button primary">导入成绩</button></form></section><section class="panel"><details class="details"><summary>备份与管理</summary><p class="helper">当前浏览器保存你的树。换设备前先导出备份；清理浏览器数据会移除本机记录。</p><div class="owner-tools"><button class="text-button" id="export-tree">导出备份</button><label class="text-button backup-label">导入备份<input type="file" id="restore-file" accept="application/json,.json"></label><button class="text-button" id="delete-tree">删除这棵树</button></div></details></section></div></div>`;
  bindShare(tree);
  bindRestore();
  $("#preview-tree").addEventListener("click", () =>
    go("play=" + extractCode($("#tree-share-url").value, "play")),
  );
  $("#export-tree").addEventListener("click", () => downloadTree(tree));
  $("#delete-tree").addEventListener("click", () => {
    if (confirm("确定删除当前浏览器里的这棵树吗？先导出备份，之后才能恢复。")) {
      try {
        deleteTree(id);
        go("my");
        toast("已删除本机记录");
      } catch (e) {
        fail(e);
      }
    }
  });
  $$(".remove-result").forEach((b) =>
    b.addEventListener("click", () => {
      const r = tree.results.find((r) => r.id === b.dataset.id);
      if (
        r &&
        confirm(`移除 ${r.name} 的成绩和留言？已有分享链接中的记录不会改变。`)
      ) {
        try {
          tree.results = tree.results.filter(
            (entry) => entry.id !== b.dataset.id,
          );
          saveTree(tree);
          route();
          toast("已移除，重新复制邀请链接可分享更新");
        } catch (e) {
          fail(e);
        }
      }
    }),
  );
  $("#import-receipt").addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = $("button[type=submit]", e.target);
    button.disabled = true;
    try {
      const updated = await importReceipt(tree, $("#receipt-input").value);
      saveTree(updated);
      await route();
      chirp();
      toast("已收下这份默契，朋友挂上树啦");
    } catch (e) {
      $("#receipt-error").textContent = e.message;
      button.disabled = false;
    }
  });
}
function myTrees() {
  const trees = loadTrees();
  main.innerHTML = `${heading("我的小树林", "树保存在这台设备的当前浏览器。换设备时，可以导入备份。", `<label class="button secondary small backup-label">导入备份<input type="file" id="restore-file" accept="application/json,.json"></label><a class="button primary small" href="#create">＋ 再种一棵</a>`)}${trees.length ? `<div class="saved-grid">${trees.map((t) => `<article class="panel saved-card"><span class="large-emoji">${esc(t.avatar)}</span><h2>${esc(t.name)}的树</h2><p>${t.questions.length} 道小问题 · ${t.results.length} 份默契<br>${esc(t.mood || "等朋友来，一起过冬天。")}</p><div class="card-actions"><a class="button primary small" href="#manage=${esc(t.id)}">照顾这棵树 →</a><span class="muted">🎄</span></div></article>`).join("")}</div>` : `<section class="center-page panel empty-state"><div class="empty-icon">🌱</div><h2>你的第一棵树，在等你</h2><p>选出关于你的答案，邀请朋友来找自己的位置。</p><a href="#create" class="button primary" style="margin-top:24px">种下我的树 →</a></section>`}`;
  bindRestore();
}

function invite(tree, code) {
  main.innerHTML = `<section class="center-page"><div class="invite-intro"><div class="eyebrow" style="justify-content:center">YOU HAVE A LITTLE INVITATION</div><div class="invite-avatar">${esc(tree.avatar)}</div><h1>${esc(tree.name)}邀请你，<br>来圣诞树上坐坐。</h1><p>${esc(tree.mood || "猜猜我的选择，看看你有多懂我。")}</p><div class="info-strip"><span>${tree.questions.length} 个小问题</span><span>每题两个选项</span><span>约 1 分钟</span></div></div><section class="panel"><form id="visitor-form"><label class="field"><span>告诉树主人，你是谁？</span><input id="visitor-name" placeholder="朋友能认出你的昵称" name="name" maxlength="24" required autocomplete="nickname"></label><div class="field"><span>挑一个挂上树的小头像</span>${avatarPicker(AVATARS[1])}</div><div id="visitor-error" class="error-box" role="alert"></div><button class="button primary" type="submit" style="width:100%">开始爬树 →</button><p class="helper">答完再揭晓默契。你的答案不会自动发送；可以把成绩回执发给主人。</p></form></section>${tree.results.length ? `<section class="panel" style="margin-top:18px"><div class="section-title"><h3>已经在枝头的朋友</h3><span class="count-badge">链接收录 ${tree.results.length} 位</span></div>${friendList(tree)}</section>` : ""}</section>`;
  let avatar = AVATARS[1];
  bindAvatar(avatar, (a) => (avatar = a));
  $("#visitor-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#visitor-name").value.trim();
    if (!name) {
      $("#visitor-error").textContent = "写一个朋友能认出的昵称吧";
      return;
    }
    play = {
      tree,
      code,
      name,
      avatar,
      index: 0,
      answers: [],
      pairs: tree.questions.map((q) => {
        const distractors = q.options
          .map((_, i) => i)
          .filter((i) => i !== q.answer);
        const pair = [
          q.answer,
          distractors[Math.floor(Math.random() * distractors.length)],
        ];
        return Math.random() < 0.5 ? pair : pair.reverse();
      }),
    };
    finished = null;
    quiz();
  });
}
function quiz() {
  const { tree, index } = play,
    q = tree.questions[index];
  main.innerHTML = `<section class="center-page panel"><div class="quiz-owner">${esc(tree.avatar)} 正在猜 ${esc(tree.name)} 的心思</div><div class="progress-label"><span>慢慢想，选一个最像 TA 的答案</span><span>${index + 1} / ${tree.questions.length}</span></div><div class="progress"><span style="width:${(index / tree.questions.length) * 100}%"></span></div><h1 class="quiz-heading">${esc(q.title)}</h1><div class="choice-list" role="group" aria-label="选择答案">${play.pairs[index].map((option, i) => `<button type="button" class="choice" data-answer="${option}" aria-pressed="${play.answers[index] === option}"><span class="letter">${"AB"[i]}</span><span>${esc(q.options[option])}</span></button>`).join("")}</div><div class="form-footer"><button type="button" class="text-button" id="back-quiz" ${index === 0 ? "disabled" : ""}>← 上一题</button><button class="button primary" id="next-quiz" ${play.answers[index] === undefined ? "disabled" : ""}>${index === tree.questions.length - 1 ? "看看我的位置" : "下一题"} →</button></div><p class="helper" style="margin-top:21px">${esc(play.avatar)} 已走过 ${index} 段树枝 · 答完一起揭晓</p></section>`;
  $$("[data-answer]").forEach((b) =>
    b.addEventListener("click", () => {
      play.answers[index] = Number(b.dataset.answer);
      $$("[data-answer]").forEach((el) =>
        el.setAttribute("aria-pressed", String(el === b)),
      );
      $("#next-quiz").disabled = false;
      chirp();
    }),
  );
  $("#back-quiz").addEventListener("click", () => {
    if (play.index > 0) {
      play.index--;
      quiz();
    }
  });
  $("#next-quiz").addEventListener("click", () => {
    if (play.answers[index] === undefined) return;
    if (index < tree.questions.length - 1) {
      play.index++;
      quiz();
    } else {
      finished = {
        id: crypto.randomUUID(),
        name: play.name,
        avatar: play.avatar,
        answers: [...play.answers],
        score: scoreAnswers(tree, play.answers),
        message: "",
        createdAt: new Date().toISOString(),
      };
      result();
    }
  });
}
function levelName(score, total) {
  const n = score / total;
  return n >= 0.9
    ? "树顶的星光，果然属于你。"
    : n >= 0.7
      ? "这根 C 位树枝，为你留好了。"
      : n >= 0.5
        ? "在温暖的枝头，慢慢靠近。"
        : "先坐礼物箱，故事才刚开始。";
}
function result() {
  const tree = play.tree,
    r = finished;
  main.innerHTML = `${heading("你的位置，找到了", "一份默契，一颗小星星。")}<div class="two-column">${treePanel(tree, { current: r })}<div class="stack"><section class="panel"><div class="result-heading"><span class="pill">${esc(r.avatar)} ${esc(r.name)}的默契成绩</span><div class="score-big">${r.score}<small> / ${tree.questions.length}</small></div><h1>${levelName(r.score, tree.questions.length)}</h1><p>关于 ${esc(tree.name)} 的小心思，你猜中了 ${r.score} 个。</p></div><form id="message-form" class="message-form"><label class="field"><span>给树主人留一句话</span><textarea id="friend-message" maxlength="120" rows="3" placeholder="这个冬天，也要一起好好过。">${esc(r.message)}</textarea></label><button class="button primary" type="submit" style="width:100%">生成回执，发给 ${esc(tree.name)} →</button><p class="helper">成绩尚未发送。把回执发给主人，对方导入后，你就会挂上 TA 的树。</p></form><div id="receipt-ready"></div></section><section class="panel"><details class="details"><summary>看看我们的答案</summary><ol class="review-list">${tree.questions.map((q, i) => `<li><h3>${i + 1}. ${esc(q.title)}</h3><p class="${r.answers[i] === q.answer ? "correct" : "wrong"}">${r.answers[i] === q.answer ? "✓ 猜中了" : "↗ 这次没猜中"} · 你的答案：${esc(q.options[r.answers[i]])}</p>${r.answers[i] !== q.answer ? `<p>TA 的选择：${esc(q.options[q.answer])}</p>` : ""}</li>`).join("")}</ol></details></section><a class="button secondary" href="#create">我也种一棵，把朋友挂上去 ↗</a></div></div>`;
  $("#message-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      r.message = $("#friend-message").value.trim();
      const code = await encodeReceipt(tree, validateResult(tree, r)),
        url = makeLink("receipt", code);
      $("#receipt-ready").innerHTML =
        `<div class="share-box" style="margin-top:20px"><h3>这份默契，带回去吧</h3><p>把下面的回执链接发给 ${esc(tree.name)}，让 TA 在创建树的浏览器里打开或粘贴导入。</p><textarea class="share-url" readonly id="receipt-url" aria-label="成绩回执链接">${esc(url)}</textarea><div class="share-actions"><button type="button" class="button primary" id="copy-receipt">复制成绩回执</button><button type="button" class="button secondary" id="share-receipt">发给树主人 ↗</button></div></div>`;
      $("#copy-receipt").addEventListener("click", () => copy(url).catch(fail));
      $("#share-receipt").addEventListener("click", () =>
        nativeShare(
          url,
          `${r.name}的默契成绩：${r.score}/${tree.questions.length}`,
        ).catch(fail),
      );
      $("#receipt-ready").scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    } catch (e) {
      fail(e);
    }
  });
}
async function receiptPage(code, version) {
  const receipt = await decodeReceipt(code);
  if (version !== routeVersion) return;
  const trees = loadTrees(),
    tree = trees.find((t) => t.id === receipt.treeId),
    r = receipt.result;
  main.innerHTML = `<section class="center-page panel"><div class="eyebrow">A LITTLE MESSAGE FOR YOU</div><h1>收到一份默契</h1><div class="receipt-preview"><span class="friend-avatar">${esc(r.avatar)}</span><div><strong>${esc(r.name)}来过你的树</strong><p>猜中 ${r.score} 题 · ${esc(r.message || "给你留下一颗小星星。")}</p></div></div>${tree ? `<p class="muted">确认后，这份成绩和留言会加入 ${esc(tree.name)} 的圣诞树。</p><div id="receipt-page-error" class="error-box" role="alert"></div><button class="button primary" id="accept-receipt">收下，挂到我的树上 →</button>` : '<div class="notice">这台设备的当前浏览器里，没有找到对应的树。请回到创建这棵树的浏览器打开回执，或先在“我的树”导入树的备份。</div><a class="button primary" href="#my">前往我的树 / 导入备份</a>'}<p class="helper" style="margin-top:20px">回执需要树主人确认后收录，打开链接不会自动更改你的记录。</p></section>`;
  $("#accept-receipt")?.addEventListener("click", async () => {
    const b = $("#accept-receipt");
    b.disabled = true;
    try {
      const updated = await importReceipt(tree, code);
      saveTree(updated);
      go("manage=" + tree.id);
      chirp();
      toast("收下啦，朋友已经挂上树");
    } catch (e) {
      $("#receipt-page-error").textContent = e.message;
      b.disabled = false;
    }
  });
}
function about() {
  main.innerHTML = `<article class="center-page panel about-content"><div class="eyebrow">A SMALL TREE, OPEN TO EVERYONE</div><h1>关于这棵树</h1><p>OpenTree「树上的朋友」是一款免费的好友默契小游戏。选出关于你的答案，把链接发给朋友，看看谁最懂你。</p><h2>怎么玩？</h2><ol><li>点击「种下我的树」，填写昵称，选择 5–10 道题的答案。你也可以修改问题和选项。</li><li>复制邀请链接发给朋友。朋友打开链接，填写昵称，每题在两个选项中猜你会选哪一个。</li><li>答完后朋友生成成绩回执，发回给你。在创建树的浏览器中打开回执并确认，或在管理页粘贴导入。</li><li>新朋友挂上树以后，重新复制邀请链接，就能向大家分享带有最新成绩的树。</li></ol><h2>为什么需要回传成绩？</h2><p>这个版本完全运行在浏览器中，没有后台数据库。题目和已收录成绩随分享链接携带；它们不会在不同设备之间自动同步。回执就是朋友把成绩带回来的方式，榜单表示这份链接当时收录的成绩。</p><h2>我的树怎么保存？</h2><p>树主记录保存在当前浏览器。换设备或清理浏览器数据前，请进入树的「备份与管理」导出备份文件；之后可以在「我的树」导入恢复。同一棵树的备份会合并新成绩。</p><h2>分享与隐私</h2><p>这是轻松的朋友游戏。链接里包含题目、正确答案及已收录的昵称和留言，拿到链接的人可以查看。请只写适合分享的内容，不用于考试、秘密问卷或存放敏感信息。</p><h2>想拥有自己的网站？</h2><p>代码以 MIT 许可证公开。前往 <a href="https://github.com/xhc144/open-friend-tree" target="_blank" rel="noopener noreferrer">GitHub 仓库 ↗</a>，点击「Use this template」复制为自己的仓库，再按 README 开启 GitHub Pages，即可获得自己的网址。没有广告、统计脚本或第三方运行时依赖。</p><a class="button primary" href="#create">种下我的树 →</a></article>`;
}

async function route() {
  const version = ++routeVersion;
  const hash = location.hash.slice(1);
  if (hash === "content") return;
  try {
    if (!hash) {
      home();
    } else if (hash === "create") {
      create();
    } else if (hash === "my") {
      myTrees();
    } else if (hash === "about") {
      about();
    } else if (hash.startsWith("manage=")) {
      main.innerHTML = '<div class="loading">正在照顾你的树…</div>';
      await manage(decodeURIComponent(hash.slice(7)), version);
    } else if (hash.startsWith("play=")) {
      main.innerHTML = '<div class="loading">正在打开朋友的邀请…</div>';
      const code = extractCode(hash.slice(5), "play"),
        tree = await decodeTree(code);
      if (version !== routeVersion) return;
      play = null;
      finished = null;
      invite(tree, code);
    } else if (hash.startsWith("receipt=")) {
      main.innerHTML = '<div class="loading">正在打开这份默契…</div>';
      await receiptPage(extractCode(hash.slice(8), "receipt"), version);
    } else {
      throw new Error("这个链接暂时无法识别，请重新打开朋友发来的完整链接。");
    }
    if (version !== routeVersion) return;
    window.scrollTo({ top: 0 });
    $("h1", main)?.focus({ preventScroll: true });
  } catch (e) {
    if (version === routeVersion) errorView(e);
  }
}
window.addEventListener("hashchange", route);
window.addEventListener("beforeunload", (e) => {
  if (play && !finished && play.answers.length) {
    e.preventDefault();
    e.returnValue = "";
  }
});
route();
