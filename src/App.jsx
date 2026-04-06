import { useMemo, useState } from "react";
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

function SpringMassAnimation({ displacement, x0 }) {
  const scale = 70;
  const clampedDisplacement = Math.max(-2.5, Math.min(2.5, displacement ?? 0));
  const massOffset = clampedDisplacement * scale;
  const baseX = 160;
  const massX = baseX + massOffset;
  const wallX = 40;
  const springStart = wallX + 18;
  const springEnd = massX - 8;
  const springLength = Math.max(24, springEnd - springStart);
  const coils = 8;
  const springY = 90;

  const points = [];
  points.push(`${springStart},${springY}`);
  for (let i = 1; i <= coils * 2; i++) {
    const x = springStart + (springLength * i) / (coils * 2 + 1);
    const y = i % 2 === 0 ? springY - 18 : springY + 18;
    points.push(`${x},${y}`);
  }
  points.push(`${springEnd},${springY}`);

  const normalized = x0 === 0 ? 0 : clampedDisplacement / Math.max(Math.abs(x0), 0.4);
  const damperLength = Math.max(26, massX - 78);

  return (
    <div className="card animation-card">
      <div className="card-head">
        <h2>Spring–Mass Animation</h2>
        <span className="badge">x = {fmt(displacement, 3)} m</span>
      </div>
      <div className="animation-wrap">
        <svg viewBox="0 0 360 190" className="animation-svg" role="img" aria-label="Mass spring dashpot animation">
          <rect x="24" y="18" width="16" height="124" rx="2" className="wall" />
          {Array.from({ length: 9 }).map((_, i) => (
            <line key={i} x1="24" y1={24 + i * 13} x2="8" y2={36 + i * 13} className="wall-hatch" />
          ))}

          <line x1="24" y1="140" x2="334" y2="140" className="ground" />

          <polyline points={points.join(" ")} fill="none" className="spring" />

          <line x1="40" y1="52" x2="78" y2="52" className="damper" />
          <line x1="78" y1="38" x2="78" y2="66" className="damper" />
          <rect x="78" y="45" width={Math.max(14, damperLength - 42)} height="14" className="damper-body" rx="2" />
          <line x1={massX - 18} y1="52" x2={massX} y2="52" className="damper" />

          <rect x={massX} y="58" width="72" height="64" rx="8" className="mass" />
          <text x={massX + 36} y="96" textAnchor="middle" className="mass-label">
            m
          </text>

          <line x1="160" y1="155" x2={massX + 36} y2="155" className="axis-line" />
          <line x1="160" y1="149" x2="160" y2="161" className="axis-line" />
          <line x1={massX + 36} y1="149" x2={massX + 36} y2="161" className="axis-line" />
          <text x="156" y="176" className="axis-text">0</text>
          <text x={massX + 30} y="176" className="axis-text">x(t)</text>
        </svg>

        <div className="animation-stats">
          <div>
            <span>Relative displacement</span>
            <strong>{fmt(displacement, 4)} m</strong>
          </div>
          <div>
            <span>Scaled motion</span>
            <strong>{fmt(normalized * 100, 1)}%</strong>
          </div>
          <div>
            <span>Interpretation</span>
            <strong>{(displacement ?? 0) >= 0 ? "Right of equilibrium" : "Left of equilibrium"}</strong>
          </div>
        </div>
      </div>
    </div>
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

  return (
    <div className="page">
      <div className="container">
        <header className="hero">
          <h1>Mechanical Vibrations Study App</h1>
          <p>
            Visualize the free response of a mass-spring-dashpot system and see how mass, stiffness, damping,
            and initial conditions affect x(t).
          </p>
        </header>

        <div className="layout">
          <section className="card">
            <h2>Inputs</h2>
            <div className="fields">
              <RangeInput label="Mass, m" value={m} setValue={setM} min={0.1} max={20} step={0.1} unit="kg" />
              <RangeInput label="Stiffness, k" value={k} setValue={setK} min={1} max={500} step={1} unit="N/m" />
              <RangeInput label="Damping, c" value={c} setValue={setC} min={0} max={100} step={0.1} unit="N·s/m" />
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

            <SpringMassAnimation displacement={selectedX ?? 0} x0={x0} />

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
    </div>
  );
}
