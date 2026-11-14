import { describe, expect, it } from "vitest";
import { RECENT_MAX, dropRecent, parseRecent, pushRecent } from "../recent";

describe("pushRecent", () => {
  it("新条目排最前", () => {
    expect(pushRecent(["/a.md", "/b.md"], "/c.md")).toEqual(["/c.md", "/a.md", "/b.md"]);
  });

  it("重复打开只保留一份，并提到最前", () => {
    expect(pushRecent(["/a.md", "/b.md"], "/b.md")).toEqual(["/b.md", "/a.md"]);
  });

  it(`封顶 ${RECENT_MAX} 条`, () => {
    const six = ["/1.md", "/2.md", "/3.md", "/4.md", "/5.md"];
    const out = pushRecent(six, "/6.md");
    expect(out).toHaveLength(RECENT_MAX);
    expect(out[0]).toBe("/6.md");
    expect(out).not.toContain("/5.md");
  });

  it("空路径不动列表（保存新文档前 path 可能为 null）", () => {
    expect(pushRecent(["/a.md"], "")).toEqual(["/a.md"]);
  });
});

describe("dropRecent", () => {
  it("只删完全相等的那一条", () => {
    expect(dropRecent(["/a/report.md", "/a/report.md.bak"], "/a/report.md")).toEqual([
      "/a/report.md.bak",
    ]);
  });

  it("不存在的路径是无操作", () => {
    expect(dropRecent(["/a.md"], "/z.md")).toEqual(["/a.md"]);
  });
});

describe("parseRecent", () => {
  it("正常数组原样返回", () => {
    expect(parseRecent('["/a.md","/b.md"]')).toEqual(["/a.md", "/b.md"]);
  });

  it("坏 JSON 当空表，不抛", () => {
    expect(parseRecent("{oops")).toEqual([]);
  });

  it("非数组当空表（旧版本可能存过对象）", () => {
    expect(parseRecent('{"path":"/a.md"}')).toEqual([]);
  });

  it("剔掉非字符串与空串，避免脏数据渲染成空白行", () => {
    expect(parseRecent('["/a.md",null,3,""]')).toEqual(["/a.md"]);
  });

  it("超长列表按上限截断", () => {
    const long = JSON.stringify(Array.from({ length: 20 }, (_, i) => `/${i}.md`));
    expect(parseRecent(long)).toHaveLength(RECENT_MAX);
  });

  it("null 当空表", () => {
    expect(parseRecent(null)).toEqual([]);
  });
});
