import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import {
  createTree,
  DEFAULT_QUESTIONS,
  decodeTree,
  validateTree,
  encodeReceipt,
  importReceipt,
} from "../lib.js";

const makeTree = () =>
  createTree({
    name: "测试小树",
    avatar: "🐱",
    questions: structuredClone(DEFAULT_QUESTIONS),
  });

test("small compressed payload cannot expand beyond the decoded size limit", async () => {
  const code =
    "d1." + deflateSync(Buffer.from("x".repeat(200000))).toString("base64url");
  assert.ok(code.length < 1000);
  await assert.rejects(() => decodeTree(code), /链接/);
});

test("untrusted extra properties are not retained in validated data", () => {
  const tree = makeTree();
  const extra = JSON.parse(
    '{"__proto__":{"opentreePolluted":true},"constructor":{"prototype":{"opentreePolluted":true}}}',
  );
  const input = { ...tree, ...extra };
  const result = validateTree(input);
  assert.equal(Object.hasOwn(result, "__proto__"), false);
  assert.equal(Object.hasOwn(result, "constructor"), false);
  assert.equal({}.opentreePolluted, undefined);
});

test("result capacity is enforced and repeated receipt remains idempotent at capacity", async () => {
  const tree = makeTree();
  const answers = tree.questions.map((q) => q.answer);
  const makeResult = () => ({
    id: crypto.randomUUID(),
    name: "测试朋友",
    avatar: "🐻",
    answers,
    score: 10,
    message: "圣诞快乐",
    createdAt: new Date().toISOString(),
  });
  tree.results = Array.from({ length: 100 }, makeResult);
  const repeated = await encodeReceipt(tree, tree.results[0]);
  assert.equal((await importReceipt(tree, repeated)).results.length, 100);
  const extra = await encodeReceipt(tree, makeResult());
  await assert.rejects(() => importReceipt(tree, extra), /100/);
  const duplicated = structuredClone(tree);
  duplicated.results[1].id = duplicated.results[0].id;
  assert.throws(() => validateTree(duplicated), /重复/);
});
