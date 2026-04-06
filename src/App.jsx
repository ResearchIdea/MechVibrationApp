import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function safeExp(value) {
  if (value < -50) return Math.exp(-50);
  if (value > 50) return Math.exp(50);
  return Math.exp(value);
}

function fmt(value, digits = 3) {
  if (!Number.isFinite(value)) return "—";
  return Number(value).toFixed(digits);
}

function solveResponse({ m, c, k, x0, v0, duration, samples }) {
  const wn = Math.sqrt(k / m);
  const cc = 2 * Math.sqrt(k * m);
  const zeta = c / cc;
  const alpha = c / (2 * m);
  const dt = duration / (samples - 1);

  let regime = "Underdamped";
  let formula = "";
  let detailLines = [];
  let evaluateAtTime = () => 0;

  if (Math.abs(zeta - 1) < 1e-3) {
    regime = "Critically damped";
    const C1 = x0;
    const C2 = v0 + wn * x0;

    formula = "x(t) = (C₁ + C₂ t)e^(-ωₙ t)";
    detailLines = [
      "m x'' + c x' + kx = 0",
      `ωₙ = √(k/m) = ${fmt(wn)} rad/s`,
      `c_c = 2√(km) = ${fmt(cc)} N·s/m`,
      `ζ = c/c_c = ${fmt(zeta)}`,
      `C₁ = x₀ = ${fmt(C1)}`,
      `C₂ = v₀ + ωₙx₀ = ${fmt(C2)}`,
      `x(t) = (${fmt(C1)} + ${fmt(C2)}t)e^(-${fmt(wn)}t)`,
    ];

    evaluateAtTime = (t) => (C1 + C2 * t) * safeExp(-wn * t);
  } else if (zeta < 1) {
    regime = "Underdamped";
    const wd = wn * Math.sqrt(1 - zeta * zeta);
    const A = x0;
    const B = (v0 + zeta * wn * x0) / wd;

    formula = "x(t) = e^(-ζωₙt)[A cos(ω_d t) + B sin(ω_d t)]";
    detailLines = [
      "m x'' + c x' + kx = 0",
      `ωₙ = √(k/m) = ${fmt(wn)} rad/s`,
      `c_c = 2√(km) = ${fmt(cc)} N·s/m`,
      `ζ = c/c_c = ${fmt(zeta)}`,
      `ω_d = ωₙ√(1-ζ²) = ${fmt(wd)} rad/s`,
      `A = x₀ = ${fmt(A)}`,
      `B = (v₀ + ζωₙx₀)/ω_d = ${fmt(B)}`,
      `x(t) = e^(-${fmt(zeta)}·${fmt(wn)}·t)[${fmt(A)}cos(${fmt(wd)}t) + ${fmt(B)}sin(${fmt(wd)}t)]`,
    ];

    evaluateAtTime = (t) =>
      safeExp(-zeta * wn * t) * (A * Math.cos(wd * t) + B * Math.sin(wd * t));
  } else {
    regime = "Overdamped";
    const beta = Math.sqrt(alpha * alpha - wn * wn);
    const r1 = -alpha + beta;
    const r2 = -alpha - beta;
    const C1 = (v0 - r2 * x0) / (r1 - r2);
    const C2 = x0 - C1;

    formula = "x(t) = C₁e^(r₁t) + C₂e^(r₂t)";
    detailLines = [
      "m x'' + c x' + kx = 0",
      `ωₙ = √(k/m) = ${fmt(wn)} rad/s`,
      `c_c = 2√(km) = ${fmt(cc)} N·s/m`,
      `ζ = c/c_c = ${fmt(zeta)}`,
      `r₁ = ${fmt(r1)}`,
      `r₂ = ${fmt(r2)}`,
      `C₁ = ${fmt(C1)}`,
      `C₂ = ${fmt(C2)}`,
      `x(t) = ${fmt(C1)}e^(${fmt(r1)}t) + ${fmt(C2)}e^(${fmt(r2)}t)`,
    ];

    evaluateAtTime = (t) => C1 * safeExp(r1 * t) + C2 * safeExp(r2 * t);
  }

  const data = [];
  for (let i = 0; i < samples; i++) {
    const t = i * dt;
    const x = evaluateAtTime(t);
    data.push({ t: Number(t.toFixed(3)), x: Number(x.toFixed(6)) });
  }

  return { data, wn, cc, zeta, regime, formula, detailLines, evaluateAtTime };
}

function NumberInput({ label, value, setValue, min, max, step, unit }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="field-row">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => setValue(Number(e.target.value))}
        />
        <small>{unit}</small>
      </div>
    </label>
  );
}

function RangeInput({ label, value, setValue, min, max, step, unit }) {
  return (
    <label className="field">
      <div className="field-top">
        <span>{label}</span>
        <strong>
          {value} {unit}
        </strong>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
      />
    </label>
  );
}

function SpringMassAnimation({ displacement }) {
  const clamped = Math.max(-1.8, Math.min(1.8, displacement ?? 0));
  const pxPerMeter = 42;

  const anchorX = 52;
  const massWidth = 88;
  const massHeight = 62;
  const restMassX = 240;
  const massX = restMassX + clamped * pxPerMeter;
  const massY = 78;

  const centerY = massY + massHeight / 2;
  const springY = centerY - 20;
  const damperY = centerY + 20;

  const springStartX = anchorX;
  const springEndX = massX;
  const springLength = Math.max(70, springEndX - springStartX);

  const waveCount = 10;
  const amplitude = 10;
  let springPath = `M ${springStartX} ${springY}`;
  for (let i = 0; i <= waveCount; i++) {
    const x = springStartX + (springLength * i) / waveCount;
    const y = springY + amplitude * Math.sin((i / waveCount) * Math.PI * waveCount);
    springPath += ` L ${x} ${y}`;
  }

  const pistonLeft = 98;
  const pistonRight = massX;
  const bodyWidth = Math.max(42, pistonRight - pistonLeft - 28);
  const bodyRight = pistonLeft + bodyWidth;
  const bodyCenterX = pistonLeft + bodyWidth / 2;

  return (
    <section className="card animation-card">
      <div className="card-head">
        <h2>Spring–Mass Animation</h2>
        <span className="badge">x = {fmt(displacement, 3)} m</span>
      </div>

      <div className="animation-wrap">
        <svg
          viewBox="0 0 440 220"
          className="animation-svg"
          role="img"
          aria-label="Mass spring dashpot system"
        >
          <rect x="28" y="22" width="20" height="126" rx="2" className="wall" />
          {Array.from({ length: 9 }).map((_, i) => (
            <line
              key={i}
              x1="28"
              y1={28 + i * 13}
              x2="10"
              y2={40 + i * 13}
              className="wall-hatch"
            />
          ))}
          <line x1="26" y1="160" x2="408" y2="160" className="ground" />

          <line x1={anchorX} y1={springY} x2={anchorX} y2={damperY} className="wall-link" />

          <path d={springPath} className="spring" fill="none" />

          <line
            x1={anchorX}
            y1={damperY}
            x2={pistonLeft}
            y2={damperY}
            className="damper-line"
          />
          <rect
            x={pistonLeft}
            y={damperY - 12}
            width={bodyWidth}
            height="24"
            rx="4"
            className="damper-body"
          />
          <line
            x1={bodyCenterX}
            y1={damperY - 22}
            x2={bodyCenterX}
            y2={damperY + 22}
            className="damper-line"
          />
          <line
            x1={bodyRight}
            y1={damperY}
            x2={massX}
            y2={damperY}
            className="damper-line"
          />

          <line
            x1={massX}
            y1={springY}
            x2={massX}
            y2={damperY}
            className="mass-connector"
          />

          <rect
            x={massX}
            y={massY}
            width={massWidth}
            height={massHeight}
            rx="10"
            className="mass"
          />
          <text
            x={massX + massWidth / 2}
            y={massY + 38}
            textAnchor="middle"
            className="mass-label"
          >
            m
          </text>

          <line
            x1={restMassX + massWidth / 2}
            y1="177"
            x2={massX + massWidth / 2}
            y2="177"
            className="axis-line"
          />
          <line
            x1={restMassX + massWidth / 2}
            y1="171"
            x2={restMassX + massWidth / 2}
            y2="183"
            className="axis-line"
          />
          <line
            x1={massX + massWidth / 2}
            y1="171"
            x2={massX + massWidth / 2}
            y2="183"
            className="axis-line"
          />
          <text x={restMassX + massWidth / 2 - 6} y="197" className="axis-text">
            0
          </text>
          <text x={restMassX + 54} y="197" className="axis-text">
            x(t)
          </text>
        </svg>

        <div className="animation-stats">
          <div>
            <span>Current displacement</span>
            <strong>{fmt(displacement, 4)} m</strong>
          </div>
          <div>
            <span>Direction</span>
            <strong>{(displacement ?? 0) >= 0 ? "Extension" : "Compression"}</strong>
          </div>
          <div>
            <span>What to watch</span>
            <strong>Spring length and mass position</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [m, setM] = useState(1.0);
  const [k, setK] = useState(25.0);
  const [c, setC] = useState(1.5);
  const [x0, setX0] = useState(1.0);
  const [v0, setV0] = useState(0.0);
  const [duration, setDuration] = useState(12);
  const [timeCursor, setTimeCursor] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const samples = 500;

  const stableInputs =
    [m, k, duration].every((v) => Number.isFinite(v) && v > 0) &&
    Number.isFinite(c) &&
    c >= 0 &&
    Number.isFinite(x0) &&
    Number.isFinite(v0);

  const result = useMemo(() => {
    if (!stableInputs) return null;
    return solveResponse({ m, c, k, x0, v0, duration, samples });
  }, [m, c, k, x0, v0, duration, stableInputs]);

  const selectedTime = Math.min(Math.max(timeCursor, 0), duration);
  const selectedX = result ? result.evaluateAtTime(selectedTime) : null;

  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      setTimeCursor((t) => {
        const next = t + 0.03;
        return next > duration ? 0 : next;
      });
    }, 30);
    return () => window.clearInterval(id);
  }, [isPlaying, duration]);

  return (
    <div className="page">
      <div className="container">
        <header className="hero">
          <h1>Mechanical Vibrations Study App</h1>
          <p>
            Visualize the free response of a mass-spring-dashpot system and see how mass,
            stiffness, damping, and initial conditions affect x(t).
          </p>
        </header>

        <div className="layout">
          <section className="card">
            <h2>Inputs</h2>
            <div className="fields">
              <RangeInput label="Mass, m" value={m} setValue={setM} min={0.1} max={20} step={0.1} unit="kg" />
              <RangeInput label="Stiffness, k" value={k} setValue={setK} min={1} max={500} step={1} unit="N/m" />
              <RangeInput label="Damping, c" value={c} setValue={setC} min={0} max={20} step={0.05} unit="N·s/m" />
              <NumberInput label="Initial displacement, x₀" value={x0} setValue={setX0} min={-5} max={5} step={0.1} unit="m" />
              <NumberInput label="Initial velocity, v₀" value={v0} setValue={setV0} min={-10} max={10} step={0.1} unit="m/s" />
              <RangeInput label="Duration" value={duration} setValue={setDuration} min={2} max={30} step={0.5} unit="s" />
            </div>
          </section>

          <div className="main">
            <section className="card">
              <div className="card-head">
                <h2>Displacement Response</h2>
                <span className="badge">{result ? result.regime : "—"}</span>
              </div>

              {!result ? (
                <div className="empty">Enter valid parameters to view the response.</div>
              ) : (
                <>
                  <div className="chart-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={result.data} margin={{ top: 10, right: 20, left: 8, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="t"
                          type="number"
                          domain={[0, duration]}
                          label={{ value: "Time, t (s)", position: "insideBottom", offset: -2 }}
                        />
                        <YAxis label={{ value: "x(t) (m)", angle: -90, position: "insideLeft" }} />
                        <Tooltip formatter={(value) => [value, "x(t)"]} labelFormatter={(label) => `t = ${label} s`} />
                        <ReferenceLine y={0} />
                        <ReferenceLine x={selectedTime} strokeDasharray="4 4" />
                        <Line type="monotone" dataKey="x" dot={false} strokeWidth={2.5} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="timebox">
                    <div className="timebox-top">
                      <strong>Evaluate at time t</strong>
                      <span>
                        t = {selectedTime.toFixed(2)} s, x(t) = {selectedX?.toFixed(6)} m
                      </span>
                    </div>
                    <div className="timebox-actions">
                      <button className="play-button" onClick={() => setIsPlaying((v) => !v)}>
                        {isPlaying ? "Pause animation" : "Play animation"}
                      </button>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={duration}
                      step="0.01"
                      value={selectedTime}
                      onChange={(e) => setTimeCursor(Number(e.target.value))}
                    />
                  </div>
                </>
              )}
            </section>

            <SpringMassAnimation displacement={selectedX ?? 0} />

            <div className="grid-two">
              <section className="card">
                <h2>Derived Quantities</h2>
                {result ? (
                  <div className="stats">
                    <div><span>Natural frequency, ωₙ</span><strong>{result.wn.toFixed(3)} rad/s</strong></div>
                    <div><span>Critical damping, c_c</span><strong>{result.cc.toFixed(3)} N·s/m</strong></div>
                    <div><span>Damping ratio, ζ</span><strong>{result.zeta.toFixed(3)}</strong></div>
                    <div><span>System regime</span><strong>{result.regime}</strong></div>
                  </div>
                ) : (
                  <p className="muted">Waiting for valid inputs.</p>
                )}
              </section>

              <section className="card">
                <h2>Equations</h2>
                <p className="muted">Response form</p>
                <p className="formula">{result ? result.formula : "—"}</p>

                <p className="muted top-gap">Values for current inputs</p>
                {result ? (
                  <div className="equations">
                    {result.detailLines.map((line) => (
                      <div key={line}>{line}</div>
                    ))}
                    <div className="eq-divider">
                      At t = {selectedTime.toFixed(2)} s, x(t) = {selectedX?.toFixed(6)} m
                    </div>
                  </div>
                ) : (
                  <p className="muted">Waiting for valid inputs.</p>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
      <footer className="footer">
  Developed by <strong>Raúl Muñoz</strong>, University of Salamanca (Spain)
</footer>
    </div>
  );
}
