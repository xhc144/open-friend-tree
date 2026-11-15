import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  createTree,
  DEFAULT_QUESTIONS,
  validateTree,
  scoreAnswers,
  encodeTree,
  decodeTree,
  makeLink,
  encodeReceipt,
  decodeReceipt,
  importReceipt,
  loadTrees,
  saveTree,
  deleteTree,
  extractCode,
} from "../lib.js";

globalThis.crypto ??= webcrypto;
globalThis.location = {
  origin: "https://example.github.io",
  pathname: "/my-tree/",
};
const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => memory.set(k, String(v)),
};
beforeEach(() => memory.clear());
const tree = () =>
  createTree({
    name: "小树 🐱",
    avatar: "🐱",
    questions: structuredClone(DEFAULT_QUESTIONS),
    mood: "等一场雪",
  });
const result = (t, score = 7) => ({
  id: crypto.randomUUID(),
  name: "朋友🦊",
  avatar: "🦊",
  answers: t.questions.map((q, i) =>
    i < score ? q.answer : (q.answer + 1) % q.options.length,
  ),
  score,
  message: "明年也一起看雪！",
  createdAt: new Date().toISOString(),
});

test("中文、emoji及子路径分享可以无损往返", async () => {
  const t = tree(),
    code = await encodeTree(t),
    link = makeLink("play", code);
  assert.match(link, /^https:\/\/example.github.io\/my-tree\/#play=/);
  assert.deepEqual(await decodeTree(extractCode(link, "play")), t);
  assert.ok(code.length < 3000, "默认分享链接保持精简");
});
test("完整评分与错题记录核对", () => {
  const t = tree();
  assert.equal(scoreAnswers(t, result(t, 7).answers), 7);
  assert.equal(scoreAnswers(t, result(t, 0).answers), 0);
  assert.equal(scoreAnswers(t, result(t, 10).answers), 10);
  assert.throws(() => scoreAnswers(t, [0]));
  assert.throws(() => scoreAnswers(t, Array(10).fill(20)));
});
test("朋友回执在隔离设备导入，去重后成绩快照可再分享", async () => {
  const t = tree(),
    r = result(t),
    code = await encodeReceipt(t, r),
    link = makeLink("receipt", code);
  const receipt = await decodeReceipt(code);
  assert.equal(receipt.result.message, r.message);
  const updated = await importReceipt(t, link);
  assert.equal(updated.results.length, 1);
  assert.deepEqual(updated.results[0], r);
  assert.equal(t.results.length, 0);
  const duplicate = await importReceipt(updated, code);
  assert.equal(duplicate.results.length, 1);
  assert.deepEqual(await decodeTree(await encodeTree(updated)), updated);
});
test("阻止错树、错题版本、伪造分数和越界索引", async () => {
  const t = tree(),
    r = result(t),
    code = await encodeReceipt(t, r);
  await assert.rejects(() => importReceipt(tree(), code), /另一棵树/);
  const changed = structuredClone(t);
  changed.questions[0].title = "另一道题";
  await assert.rejects(() => importReceipt(changed, code), /版本不同/);
  await assert.rejects(() => encodeReceipt(t, { ...r, score: 10 }), /不一致/);
  await assert.rejects(
    () => encodeReceipt(t, { ...r, answers: Array(10).fill(-1) }),
    /范围/,
  );
});
test("本机树持久化、更新、删除与损坏存档保护", () => {
  const a = tree(),
    b = tree();
  saveTree(a);
  saveTree(b);
  assert.equal(loadTrees().length, 2);
  a.name = "改个名字";
  saveTree(a);
  assert.equal(loadTrees().find((x) => x.id === a.id).name, "改个名字");
  deleteTree(a.id);
  assert.deepEqual(loadTrees(), [b]);
  memory.set("opentree.trees.v1", "not-json");
  assert.throws(() => loadTrees(), /无法读取/);
  assert.throws(() => saveTree(a), /无法读取/);
  assert.equal(memory.get("opentree.trees.v1"), "not-json");
});
test("拒绝损坏链接、过大数据、重复选项与异常schema", async () => {
  for (const code of [
    "",
    "d1.invalid",
    "j1.eyJ2IjoxfQ",
    "d1." + "a".repeat(49000),
  ])
    await assert.rejects(() => decodeTree(code));
  const t = tree();
  t.questions[0].options = ["相同", "相同"];
  assert.throws(() => validateTree(t), /重复/);
  const n = tree();
  n.name = "字".repeat(25);
  assert.throws(() => validateTree(n), /昵称/);
  const q = tree();
  q.questions = q.questions.slice(0, 4);
  assert.throws(() => validateTree(q), /5至10/);
  assert.throws(
    () => extractCode("https://example.test/#play=abc", "receipt"),
    /回执/,
  );
});
test("创建端不支持压缩时仍可编码为通用JSON链接", async () => {
  const stream = globalThis.CompressionStream;
  try {
    globalThis.CompressionStream = undefined;
    const t = tree(),
      code = await encodeTree(t);
    assert.ok(code.startsWith("j1."));
    assert.deepEqual(await decodeTree(code), t);
  } finally {
    globalThis.CompressionStream = stream;
  }
});
