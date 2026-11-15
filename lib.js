/* OpenTree — MIT. No network, tracking or third-party runtime dependencies. */
export const AVATARS = [
  "🐱",
  "🐻",
  "🐰",
  "🦊",
  "🐧",
  "🐼",
  "🐸",
  "🦉",
  "🐨",
  "🐶",
  "🦌",
  "⛄",
];
export const DEFAULT_QUESTIONS = [
  {
    title: "冬天的周末，我更想做什么？",
    options: ["窝在被子里", "出门看风景", "约朋友吃饭", "打游戏"],
    answer: 0,
  },
  {
    title: "如果收到一份礼物，我最想要？",
    options: ["一封手写信", "好吃的零食", "实用的小物", "一次一起旅行"],
    answer: 0,
  },
  {
    title: "我更喜欢哪种天气？",
    options: ["晴空万里", "安静的雨天", "漫天飘雪", "凉爽的阴天"],
    answer: 0,
  },
  {
    title: "我的奶茶通常选什么甜度？",
    options: ["全糖快乐", "七分甜", "三分甜", "无糖"],
    answer: 0,
  },
  {
    title: "手机响了，我一般会？",
    options: ["秒回消息", "过会儿再回", "看心情回", "直接打电话"],
    answer: 0,
  },
  {
    title: "我会先选哪一种旅行？",
    options: ["去海边发呆", "山里看星星", "城市到处逛", "住在家里最舒服"],
    answer: 0,
  },
  {
    title: "聚会时，我通常是？",
    options: ["活跃气氛的人", "安静听故事的人", "拍照记录的人", "专心吃饭的人"],
    answer: 0,
  },
  {
    title: "如果可以拥有一种能力，我选？",
    options: ["瞬间移动", "和动物聊天", "时间暂停", "飞到云上"],
    answer: 0,
  },
  {
    title: "深夜饿了，我会想吃？",
    options: ["一碗热面", "炸鸡薯条", "水果酸奶", "忍住，明早再说"],
    answer: 0,
  },
  {
    title: "圣诞节我最想和朋友一起？",
    options: ["看一场电影", "吃一顿大餐", "散步看灯", "交换小礼物"],
    answer: 0,
  },
];

const KEY = "opentree.trees.v1";
const MAX_BYTES = 120000;
const MAX_CODE = 48000;
const record = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const idOK = (x) => typeof x === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(x);
function text(value, limit, label, allowEmpty = false) {
  if (typeof value !== "string") throw new Error(`${label}格式不正确`);
  const result = value.trim();
  if ((!allowEmpty && !result) || [...result].length > limit)
    throw new Error(
      `${label}请填写${allowEmpty ? "不超过" : "1–"}${limit}个字`,
    );
  return result;
}
function date(value) {
  if (
    typeof value !== "string" ||
    value.length > 40 ||
    !Number.isFinite(Date.parse(value))
  )
    throw new Error("记录时间不正确");
  return new Date(value).toISOString();
}
function questionsOf(values) {
  if (!Array.isArray(values) || values.length < 5 || values.length > 10)
    throw new Error("请准备5至10道题");
  return values.map((q) => {
    if (
      !record(q) ||
      !Array.isArray(q.options) ||
      q.options.length < 2 ||
      q.options.length > 4
    )
      throw new Error("每道题需要2至4个选项");
    const options = q.options.map((o) => text(o, 40, "选项"));
    if (new Set(options).size !== options.length)
      throw new Error("同一道题的选项不能重复");
    if (
      !Number.isInteger(q.answer) ||
      q.answer < 0 ||
      q.answer >= options.length
    )
      throw new Error("请为每道题选择自己的答案");
    return { title: text(q.title, 100, "题目"), options, answer: q.answer };
  });
}
export function scoreAnswers(tree, answers) {
  if (!Array.isArray(answers) || answers.length !== tree.questions.length)
    throw new Error("作答数量不正确");
  answers.forEach((a, i) => {
    if (!Number.isInteger(a) || a < 0 || a >= tree.questions[i].options.length)
      throw new Error("答案不在选项范围内");
  });
  return answers.reduce(
    (n, a, i) => n + Number(a === tree.questions[i].answer),
    0,
  );
}
export function validateResult(tree, r) {
  if (!record(r) || !idOK(r.id)) throw new Error("成绩记录格式不正确");
  const score = scoreAnswers(tree, r.answers);
  if (r.score !== score) throw new Error("成绩与作答不一致");
  return {
    id: r.id,
    name: text(r.name, 24, "昵称"),
    avatar: text(r.avatar, 8, "头像"),
    answers: [...r.answers],
    score,
    message: text(r.message ?? "", 120, "留言", true),
    createdAt: date(r.createdAt),
  };
}
export function validateTree(t) {
  if (!record(t) || t.v !== 1 || !idOK(t.id))
    throw new Error("这不是有效的 OpenTree 链接");
  const tree = {
    v: 1,
    id: t.id,
    name: text(t.name, 24, "昵称"),
    avatar: text(t.avatar, 8, "头像"),
    createdAt: date(t.createdAt),
    questions: questionsOf(t.questions),
    results: [],
  };
  if (t.mood !== undefined) tree.mood = text(t.mood, 24, "心情", true);
  if (!Array.isArray(t.results) || t.results.length > 100)
    throw new Error("每棵树最多收录100份成绩");
  tree.results = t.results.map((r) => validateResult(tree, r));
  if (new Set(tree.results.map((r) => r.id)).size !== tree.results.length)
    throw new Error("成绩记录重复");
  return tree;
}
export function createTree({ name, avatar, questions, mood }) {
  const t = {
    v: 1,
    id: crypto.randomUUID(),
    name,
    avatar,
    createdAt: new Date().toISOString(),
    questions,
    results: [],
  };
  if (mood !== undefined) t.mood = mood;
  return validateTree(t);
}

async function readBounded(stream) {
  const reader = stream.getReader();
  let length = 0;
  const chunks = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BYTES) {
        await reader.cancel();
        throw new Error("链接内容过大，请用备份文件传递");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
function b64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 4096)
    binary += String.fromCharCode(...bytes.subarray(i, i + 4096));
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
async function pack(value) {
  let bytes = new TextEncoder().encode(JSON.stringify(value));
  if (bytes.length > MAX_BYTES)
    throw new Error("记录过大，请分开分享或导出备份");
  let prefix = "j1.";
  if (typeof CompressionStream !== "undefined") {
    bytes = await readBounded(
      new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate")),
    );
    prefix = "d1.";
  }
  const code = prefix + b64(bytes);
  if (code.length > MAX_CODE)
    throw new Error("分享链接太长，请减少收录的成绩或用备份文件传递");
  return code;
}
async function unpack(code) {
  try {
    if (
      typeof code !== "string" ||
      code.length > MAX_CODE ||
      !/^[dj]1\.[A-Za-z0-9_-]+$/.test(code)
    )
      throw new Error();
    const binary = atob(
      code.slice(3).replaceAll("-", "+").replaceAll("_", "/"),
    );
    let bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    if (code.startsWith("d1.")) {
      if (typeof DecompressionStream === "undefined")
        throw new Error("请使用较新版本的浏览器打开此链接");
      bytes = await readBounded(
        new Blob([bytes])
          .stream()
          .pipeThrough(new DecompressionStream("deflate")),
      );
    }
    if (bytes.length > MAX_BYTES) throw new Error();
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (e) {
    if (e?.message?.startsWith("请使用")) throw e;
    throw new Error("链接不完整或格式不正确，请重新复制整条链接");
  }
}
export const encodeTree = async (tree) => pack(validateTree(tree));
export const decodeTree = async (code) => validateTree(await unpack(code));
export function makeLink(kind, code) {
  if (!["play", "receipt"].includes(kind)) throw new Error("未知的分享类型");
  return `${location.origin}${location.pathname}#${kind}=${code}`;
}
export function extractCode(input, kind) {
  const value = String(input ?? "").trim();
  if (value.startsWith("d1.") || value.startsWith("j1.")) return value;
  const marker = `#${kind}=`;
  const i = value.indexOf(marker);
  if (i < 0)
    throw new Error(
      kind === "receipt" ? "请粘贴完整的成绩回执链接" : "请粘贴完整的树链接",
    );
  try {
    return decodeURIComponent(value.slice(i + marker.length));
  } catch {
    throw new Error("链接编码不正确");
  }
}
async function quizHash(tree) {
  const bytes = new TextEncoder().encode(
    JSON.stringify({ id: tree.id, questions: tree.questions }),
  );
  return b64(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}
export async function encodeReceipt(tree, result) {
  return pack({
    v: 1,
    treeId: tree.id,
    quizHash: await quizHash(tree),
    result: validateResult(tree, result),
  });
}
export async function decodeReceipt(code) {
  const r = await unpack(extractCode(code, "receipt"));
  if (
    !record(r) ||
    r.v !== 1 ||
    !idOK(r.treeId) ||
    typeof r.quizHash !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(r.quizHash) ||
    !record(r.result)
  )
    throw new Error("回执格式不正确");
  return r;
}
export async function importReceipt(tree, codeOrURL) {
  const clean = validateTree(tree),
    receipt = await decodeReceipt(codeOrURL);
  if (receipt.treeId !== clean.id) throw new Error("这份成绩属于另一棵树");
  if (receipt.quizHash !== (await quizHash(clean)))
    throw new Error("题目版本不同，不能导入这份成绩");
  const result = validateResult(clean, receipt.result);
  if (clean.results.some((r) => r.id === result.id)) return clean;
  if (clean.results.length >= 100)
    throw new Error("这棵树已收录100份成绩，请先备份或移除部分成绩");
  clean.results.push(result);
  return clean;
}
export function loadTrees() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const values = JSON.parse(raw);
    if (!Array.isArray(values) || values.length > 100) throw new Error();
    return values.map(validateTree);
  } catch {
    throw new Error(
      "本机存档无法读取。请先导出浏览器中的原始数据，或导入之前的备份；不要清理浏览器数据。",
    );
  }
}
export function saveTree(tree) {
  const clean = validateTree(tree),
    trees = loadTrees(),
    index = trees.findIndex((t) => t.id === clean.id);
  if (index >= 0) trees[index] = clean;
  else {
    if (trees.length >= 100) throw new Error("本机最多保存100棵树");
    trees.unshift(clean);
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(trees));
  } catch {
    throw new Error("浏览器没有保存成功，请允许本地存储或先导出备份");
  }
  return clean;
}
export function deleteTree(id) {
  localStorage.setItem(
    KEY,
    JSON.stringify(loadTrees().filter((t) => t.id !== id)),
  );
}
