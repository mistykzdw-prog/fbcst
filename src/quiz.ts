/**
 * 福报指数测试 · 题目与计分逻辑
 *
 * 五个维度：善念善行、感恩之心、利他付出、心态平和、行动积累
 * 共 10 题，每个维度 2 题；每题 3 个选项，分别计 4 / 2 / 0 分。
 * 每个维度换算成 0~100 分，总分为五个维度的平均分。
 */

export type DimKey = "kindness" | "gratitude" | "giving" | "calm" | "action";

export interface DimensionInfo {
  key: DimKey;
  name: string;
  /** 该维度得分最高时的解读（福报之源） */
  high: string;
  /** 该维度得分最低时的解读（需要留意） */
  low: string;
}

export const DIMENSIONS: DimensionInfo[] = [
  {
    key: "kindness",
    name: "善念善行",
    high: "「善念善行」是你的亮点。你的善意不流于口号，而是落进了日常的小动作里，这些微小的轨迹正在悄悄累积。",
    low: "「善念善行」还有空间。善意不必宏大，从顺手的一件小事开始就好，轨迹是一步一步留下的。",
  },
  {
    key: "gratitude",
    name: "感恩之心",
    high: "「感恩之心」被你养得很好。被你认真记住的每一份好，都在以另一种方式回流到你身上。",
    low: "「感恩之心」需要留意。试着每天记住一件值得说谢谢的小事，福气更喜欢流向懂得回头的人。",
  },
  {
    key: "giving",
    name: "利他付出",
    high: "「利他付出」是你的底色。你给出的时间和心力，都在为你积攒看不见的分量。",
    low: "「利他付出」暂时偏少。先从力所能及的小付出开始，不必勉强，也不必计较回报。",
  },
  {
    key: "calm",
    name: "心态平和",
    high: "「心态平和」是你的底气。情绪稳了，福气才留得住，这是你福报最大的护城河。",
    low: "「心态平和」是当前最需要照顾的一环。先睡好、少比较，内心松一寸，福气就近一尺。",
  },
  {
    key: "action",
    name: "行动积累",
    high: "「行动积累」是你目前的基础盘，稳中带升。继续把小而具体的事做下去，会越来越扎实。",
    low: "「行动积累」处于临界区，不留神就会成为消耗点。稍微收一收想法，聚焦一两件小事就好。",
  },
];

export const DIM_NAME: Record<DimKey, string> = DIMENSIONS.reduce(
  (map, d) => {
    map[d.key] = d.name;
    return map;
  },
  {} as Record<DimKey, string>
);

export interface Option {
  text: string;
  pts: number;
}

export interface Question {
  text: string;
  dim: DimKey;
  options: Option[];
}

export const QUESTIONS: Question[] = [
  {
    text: "最近一周里，你有没有做过「没人知道也没关系」的小好事（帮人扶门、让座、捡起垃圾）？",
    dim: "kindness",
    options: [
      { text: "有好几次，顺手就做了", pts: 4 },
      { text: "一两次，看心情", pts: 2 },
      { text: "好像没什么印象", pts: 0 },
    ],
  },
  {
    text: "看到别人遭遇不幸的新闻时，你的第一反应更接近——",
    dim: "kindness",
    options: [
      { text: "心里一紧，想着能帮上什么", pts: 4 },
      { text: "同情一下，继续往下看", pts: 2 },
      { text: "基本无感，很快划走", pts: 0 },
    ],
  },
  {
    text: "想想最近一个月，你说过「谢谢」或在心里感激过别人吗？",
    dim: "gratitude",
    options: [
      { text: "经常，连小事也会记着", pts: 4 },
      { text: "有，但多是被帮了大忙的时候", pts: 2 },
      { text: "很少，总觉得都是理所应当", pts: 0 },
    ],
  },
  {
    text: "对于家人、老朋友日复一日的付出，你的真实感受是——",
    dim: "gratitude",
    options: [
      { text: "常怀感激，也会表达出来", pts: 4 },
      { text: "心里知道，但很少说出口", pts: 2 },
      { text: "习以为常，偶尔还会嫌烦", pts: 0 },
    ],
  },
  {
    text: "朋友需要帮忙时（搬家、带饭、听他倒苦水），你通常——",
    dim: "giving",
    options: [
      { text: "能帮就帮，不太计较回报", pts: 4 },
      { text: "会帮，但先看自己方不方便", pts: 2 },
      { text: "尽量避开，怕麻烦", pts: 0 },
    ],
  },
  {
    text: "如果突然多出一小时空闲，你更愿意——",
    dim: "giving",
    options: [
      { text: "做点对别人也有益的事（答疑、帮忙、捐助）", pts: 4 },
      { text: "看情况，先把自己的事排好", pts: 2 },
      { text: "纯粹用来放松刷手机", pts: 0 },
    ],
  },
  {
    text: "最近一个月，因为比较、焦虑、生气而内耗的时间大约是——",
    dim: "calm",
    options: [
      { text: "很少，情绪来了也能很快放下", pts: 4 },
      { text: "一半一半，有起伏但有分寸", pts: 2 },
      { text: "比较多，常常夜里还在想", pts: 0 },
    ],
  },
  {
    text: "被别人批评或误解时，你通常——",
    dim: "calm",
    options: [
      { text: "先听一听，有理就改，没理也不太往心里去", pts: 4 },
      { text: "会难受一阵，但能慢慢消化", pts: 2 },
      { text: "很难释怀，会记很久", pts: 0 },
    ],
  },
  {
    text: "你想做的事（读书、锻炼、早睡），实际坚持得怎么样？",
    dim: "action",
    options: [
      { text: "说做就做，已经形成习惯", pts: 4 },
      { text: "三天打鱼两天晒网", pts: 2 },
      { text: "基本停在「想想而已」", pts: 0 },
    ],
  },
  {
    text: "对「每天进步一点点」这种小事，你的态度是——",
    dim: "action",
    options: [
      { text: "相信积累的力量，一直在做小而具体的事", pts: 4 },
      { text: "认同，但经常断", pts: 2 },
      { text: "觉得没用，不如等大机会", pts: 0 },
    ],
  },
];

export interface QuizResult {
  /** 总分 0~100 */
  total: number;
  /** 每个维度的得分 0~100 */
  perDim: Record<DimKey, number>;
  /** 等级名称与一句话总结 */
  level: { name: string; summary: string };
  /** 最强维度（福报之源） */
  source: DimensionInfo;
  /** 最弱维度（需要留意） */
  watch: DimensionInfo;
}

const MAX_PTS_PER_QUESTION = 4;

function levelOf(total: number): { name: string; summary: string } {
  if (total >= 70) {
    return {
      name: "福报深厚",
      summary: "你的福气像深潭静水，不喧哗却深厚。保持这份善念与平常心，福报会自己慢慢生长。",
    };
  }
  if (total >= 45) {
    return {
      name: "福报丰盛",
      summary: "你的福报积累可观，日常善行与平和心态是最大的底气。再少一点计较，福气会流动得更顺。",
    };
  }
  if (total >= 25) {
    return {
      name: "福报平稳",
      summary: "你的福报账户有进有出，正处在平稳线上。多一分感恩、多一分利他，变化会看得见。",
    };
  }
  return {
    name: "福报尚浅",
    summary: "每个人都有一块待开垦的福田。不急，从今天顺手的一件小事开始，轨迹就会慢慢改变。",
  };
}

/** 根据每题所选选项的序号，计算测试结果 */
export function scoreAnswers(answers: number[]): QuizResult {
  const raw: Record<DimKey, number> = { kindness: 0, gratitude: 0, giving: 0, calm: 0, action: 0 };

  QUESTIONS.forEach((q, i) => {
    const chosen = q.options[answers[i]];
    if (chosen) raw[q.dim] += chosen.pts;
  });

  const perDim = {} as Record<DimKey, number>;
  let sum = 0;
  for (const d of DIMENSIONS) {
    const count = QUESTIONS.filter((q) => q.dim === d.key).length;
    const score = Math.round((raw[d.key] / (count * MAX_PTS_PER_QUESTION)) * 100);
    perDim[d.key] = score;
    sum += score;
  }
  const total = Math.round(sum / DIMENSIONS.length);

  let source = DIMENSIONS[0];
  let watch = DIMENSIONS[0];
  for (const d of DIMENSIONS) {
    if (perDim[d.key] > perDim[source.key]) source = d;
    if (perDim[d.key] < perDim[watch.key]) watch = d;
  }

  return { total, perDim, level: levelOf(total), source, watch };
}
