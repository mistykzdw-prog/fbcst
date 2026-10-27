import { useState } from "react";
import { DIMENSIONS, QUESTIONS, scoreAnswers, type QuizResult } from "./quiz";
import RadarChart from "./RadarChart";

type Screen = "cover" | "quiz" | "result";

export default function App() {
  const [screen, setScreen] = useState<Screen>("cover");
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);

  const start = () => {
    setScreen("quiz");
    setCurrent(0);
    setAnswers([]);
    setResult(null);
  };

  const choose = (optionIndex: number) => {
    const next = [...answers, optionIndex];
    setAnswers(next);
    if (current + 1 < QUESTIONS.length) {
      setCurrent(current + 1);
    } else {
      setResult(scoreAnswers(next));
      setScreen("result");
    }
  };

  if (screen === "cover") {
    return <Cover onStart={start} />;
  }
  if (screen === "quiz") {
    return <Quiz current={current} onChoose={choose} />;
  }
  return <Result result={result!} onRestart={start} />;
}

/* ================= 封面 ================= */

function Cover({ onStart }: { onStart: () => void }) {
  return (
    <div className="page cover">
      <div className="cover-glow" />
      <Lotus />
      <h1 className="title">福报指数</h1>
      <p className="subtitle">
        福有来处，亦有去处
        <br />
        一念一行，皆在无形中留下轨迹
      </p>
      <div className="tags">
        {DIMENSIONS.map((d) => (
          <span key={d.key} className="tag">
            {d.name}
          </span>
        ))}
      </div>
      <button className="btn-primary" onClick={onStart}>
        开始测试
      </button>
      <p className="hint">共 {QUESTIONS.length} 题 · 约 2 分钟 · 结果仅保存在你的设备上</p>
      <a className="logout" href="/logout">
        退出访问
      </a>
    </div>
  );
}

/** 手绘风莲花插画（纯 SVG，无外部图片依赖） */
function Lotus() {
  return (
    <svg viewBox="0 0 200 140" className="lotus" role="img" aria-label="莲花">
      <ellipse cx="100" cy="120" rx="72" ry="10" fill="rgba(62,107,79,0.14)" />
      <circle cx="100" cy="58" r="54" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.5" opacity="0.7" />
      <path d="M100 26 C87 52 87 84 100 106 C113 84 113 52 100 26Z" fill="#ffffff" stroke="#d7e6d3" strokeWidth="1" />
      <path d="M58 52 C69 74 82 96 100 106 C97 82 84 60 58 52Z" fill="#f4faf2" stroke="#d7e6d3" strokeWidth="1" />
      <path d="M142 52 C131 74 118 96 100 106 C103 82 116 60 142 52Z" fill="#f4faf2" stroke="#d7e6d3" strokeWidth="1" />
      <path d="M32 88 C54 90 80 100 100 106 C88 88 60 80 32 88Z" fill="#e9f3e5" stroke="#d7e6d3" strokeWidth="1" />
      <path d="M168 88 C146 90 120 100 100 106 C112 88 140 80 168 88Z" fill="#e9f3e5" stroke="#d7e6d3" strokeWidth="1" />
    </svg>
  );
}

/* ================= 答题页 ================= */

function Quiz({ current, onChoose }: { current: number; onChoose: (i: number) => void }) {
  const q = QUESTIONS[current];
  const progress = ((current + 1) / QUESTIONS.length) * 100;

  return (
    <div className="page quiz">
      <div className="progress-text">
        {current + 1} / {QUESTIONS.length}
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: progress + "%" }} />
      </div>
      <div className="card question-card">
        <h2>{q.text}</h2>
        <div className="options">
          {q.options.map((o, i) => (
            <button key={i} className="option" onClick={() => onChoose(i)}>
              {o.text}
            </button>
          ))}
        </div>
      </div>
      <p className="hint center">凭第一直觉选择就好</p>
    </div>
  );
}

/* ================= 结果页 ================= */

function Result({ result, onRestart }: { result: QuizResult; onRestart: () => void }) {
  return (
    <div className="page result">
      <div className="card score-card">
        <ScoreCircle value={result.total} />
        <div>
          <span className="level-pill">{result.level.name}</span>
        </div>
        <p className="level-summary">{result.level.summary}</p>
      </div>

      <h3 className="section-title">详细解读</h3>
      <div className="card">
        <div className="detail-row">
          <span className="detail-label">福报之源</span>
          <p>{result.source.high}</p>
        </div>
        <div className="detail-row">
          <span className="detail-label">需要留意</span>
          <p>{result.watch.low}</p>
        </div>
        <div className="detail-row">
          <span className="detail-label">一句话</span>
          <p>{result.level.summary}</p>
        </div>
      </div>

      <h3 className="section-title">五维福报图谱</h3>
      <div className="card">
        <p className="radar-caption">五维福报图谱 · 分维度总结</p>
        <RadarChart scores={result.perDim} />
        <div className="bars">
          {DIMENSIONS.map((d) => (
            <div className="bar-row" key={d.key}>
              <span className="bar-name">{d.name}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: result.perDim[d.key] + "%" }} />
              </div>
              <span className="bar-score">{result.perDim[d.key]}</span>
            </div>
          ))}
        </div>
      </div>

      <button className="btn-primary" onClick={onRestart}>
        重新测试
      </button>
      <p className="hint center">
        结果仅供娱乐与自省 · <a className="logout" href="/logout">退出访问</a>
      </p>
    </div>
  );
}

/** 总分圆盘（对照参考样式：大数字 + 「福报指数」字样） */
function ScoreCircle({ value }: { value: number }) {
  return (
    <svg viewBox="0 0 200 200" className="score-circle" role="img" aria-label={"福报指数 " + value}>
      <defs>
        <radialGradient id="scoreGrad" cx="35%" cy="30%" r="85%">
          <stop offset="0%" stopColor="#7ba78a" />
          <stop offset="100%" stopColor="#3e6b4f" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="96" fill="url(#scoreGrad)" />
      <text x="100" y="98" textAnchor="middle" className="score-num">
        {value}
      </text>
      <text x="100" y="134" textAnchor="middle" className="score-label">
        福报指数
      </text>
    </svg>
  );
}
