import { DIM_NAME, type DimKey } from "./quiz";

/**
 * 五维雷达图（纯 SVG 绘制，无第三方图表库）。
 * 布局对照参考样式：善念善行在正上方，顺时针依次为
 * 行动积累、心态平和、利他付出、感恩之心。
 */

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 108;

// 从正上方开始、顺时针排列的维度顺序
const ORDER: DimKey[] = ["kindness", "action", "calm", "giving", "gratitude"];

function point(index: number, ratio: number): [number, number] {
  const angle = (-90 + index * 72) * (Math.PI / 180);
  return [CENTER + RADIUS * ratio * Math.cos(angle), CENTER + RADIUS * ratio * Math.sin(angle)];
}

function polygon(ratio: number): string {
  return ORDER.map((_, i) => point(i, ratio).join(",")).join(" ");
}

export default function RadarChart({ scores }: { scores: Record<DimKey, number> }) {
  // 最低也给 4% 的可见面积，避免某维度为 0 时图形塌缩到圆心
  const dataPoints = ORDER.map((key, i) => point(i, Math.max(scores[key], 4) / 100).join(",")).join(" ");

  return (
    <svg viewBox={"0 0 " + SIZE + " " + SIZE} className="radar" role="img" aria-label="五维福报图谱雷达图">
      {/* 背景网格：5 圈五边形 */}
      {[0.2, 0.4, 0.6, 0.8, 1].map((r) => (
        <polygon key={r} points={polygon(r)} fill="none" stroke="#c9dcc9" strokeWidth="1" />
      ))}
      {/* 五条轴线 */}
      {ORDER.map((_, i) => {
        const [x, y] = point(i, 1);
        return <line key={i} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="#c9dcc9" strokeWidth="1" />;
      })}
      {/* 数据多边形 */}
      <polygon points={dataPoints} fill="rgba(74,124,89,0.35)" stroke="#3e6b4f" strokeWidth="2" />
      {/* 维度标签 */}
      {ORDER.map((key, i) => {
        const [x, y] = point(i, 1.24);
        const anchor = Math.abs(x - CENTER) < 12 ? "middle" : x > CENTER ? "start" : "end";
        return (
          <text key={key} x={x} y={y + 4} textAnchor={anchor} className="radar-label">
            {DIM_NAME[key]}
          </text>
        );
      })}
    </svg>
  );
}
