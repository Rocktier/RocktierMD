/* 「最近打开」列表的纯函数。
 *
 * 抽出来的理由不是为了复用，是为了**能测**：沙箱版（Mac App Store）下 localStorage
 * 里的绝对路径重启后可能读不到（没有 security-scoped bookmark），
 * 失效条目必须能精确地逐条剔除、且不能误伤同名前缀的兄弟路径。
 * 这类边界放在 React 组件里只能靠人肉点，放纯函数里一条 vitest 就锁住了。
 */

/** 列表封顶条数。与侧栏能显示的行数一致，改这里即改全局。 */
export const RECENT_MAX = 5;

/**
 * 新开/新存一个文件后更新列表：去重、最新在前、封顶。
 * 传进来的 path 必须原样保留（不要在这里做路径归一化 —— 不同平台的
 * 分隔符与大小写规则不同，改了就和磁盘上的真实路径对不上）。
 */
export function pushRecent(list: string[], path: string, max: number = RECENT_MAX): string[] {
  if (!path) return list.slice(0, max);
  return [path, ...list.filter((p) => p !== path)].slice(0, max);
}

/**
 * 剔除一条失效路径。按**全等**比较，不是前缀/包含匹配 ——
 * `/a/report.md` 失效不能把 `/a/report.md.bak` 一起删掉。
 */
export function dropRecent(list: string[], path: string): string[] {
  return list.filter((p) => p !== path);
}

/** 从 JSON 字符串解析列表，坏数据一律当空表（旧版本可能写入了非数组）。 */
export function parseRecent(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is string => typeof x === "string" && x.length > 0).slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}
