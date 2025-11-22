// src/components/PoolSimulator.tsx
import React, { useEffect, useRef, useState, type JSX } from "react";
import { Ball, velocityFromPolar } from "./billiardModel";
import "./PoolSimulator.css";

export default function PoolSimulator(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const ballRef = useRef<Ball | null>(null);

  // --- inputs como strings para permitir campo vazio ---
  const [v0, setV0] = useState<string>("2400");
  // valor inicial equivalente a -20 -> 340 continua ok mas agora 0 = cima
  const [angle, setAngle] = useState<string>("340");
  const [radius, setRadius] = useState<string>("12");

  const [status, setStatus] = useState<string>("pronto");
  const [speedDisplay, setSpeedDisplay] = useState<number>(0);
  const [showTrail] = useState<boolean>(false);

  // Valores fixos — usuário não altera mais fricção nem tamanho da mesa
  const FIXED_DAMPING = 0.0; // fricção fixa
  const TABLE_W = 900;
  const TABLE_H = 500;

  // Limites solicitados
  const MAX_V0 = 10000; // velocidade máxima
  const MAX_RADIUS = 36; // raio máximo da bola
  const MIN_RADIUS = 1; // raio mínimo
  // ângulo agora 0..360 com origem na vertical (cima)
  const ANGLE_MIN = 0;
  const ANGLE_MAX = 360;

  function clamp(n: number, a: number, b: number) {
    return Math.max(a, Math.min(b, n));
  }

  function handleV0Change(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (raw === "") {
      setV0("");
      return;
    }
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) return;
    const clamped = clamp(n, 0, MAX_V0);
    setV0(String(clamped));
  }

  function handleAngleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (raw === "") {
      setAngle(raw);
      return;
    }
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) return;
    const clamped = clamp(n, ANGLE_MIN, ANGLE_MAX);
    setAngle(String(clamped));
  }

  function handleRadiusChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (raw === "") {
      setRadius("");
      return;
    }
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) return;
    const rounded = Math.round(n);
    const clamped = clamp(rounded, MIN_RADIUS, MAX_RADIUS);
    setRadius(String(clamped));
  }

  function setCanvasSize(canvas: HTMLCanvasElement, width: number, height: number) {
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Converte ângulo do usuário (0 = cima, aumenta horário) -> ângulo do motor (0 = direita, aumenta horário)
  // Mapeamento: engine = (270 + user) % 360
  function userToEngineAngle(userDeg: number) {
    return (270 + userDeg) % 360;
  }

  // desenha pequena seta de projeção (somente quando a bola NÃO estiver movendo)
  // agora: círculo com radius = arrowLen / 2 e arco (apenas até o ângulo selecionado)
  function drawProjectionArrowIfNeeded(ctx: CanvasRenderingContext2D, cssW: number, cssH: number) {
    const ball = ballRef.current;
    const isMoving = !!(ball && ball.moving);
    if (isMoving) return;

    const start = ball ? { x: ball.pos.x, y: ball.pos.y } : { x: cssW / 2, y: cssH / 2 };

    if (!angle) return;
    const userAng = parseFloat(angle);
    if (!Number.isFinite(userAng)) return;

    // engine angle (for direction vector)
    const engineAng = userToEngineAngle(userAng);
    const dir = velocityFromPolar(1, engineAng);
    let ux = dir.x;
    let uy = dir.y;
    const mag = Math.hypot(ux, uy);
    if (mag === 0) return;
    ux /= mag;
    uy /= mag;

    // visual sizes: arrowLen controls overall scale; circleRadius is always half arrowLen
    const arrowLen = 44; // compr. seta (ajuste se quiser)
    const circleRadius = arrowLen / 2; // **metade do tamanho da seta**
    const tip = { x: start.x + ux * arrowLen, y: start.y + uy * arrowLen };

    // --- desenha setor (wedge) entre 0° (vertical cima) e userAng (sentido horário) ---
    const startDeg = userToEngineAngle(0); // 270
    let endDeg = userToEngineAngle(userAng);
    const toRad = (d: number) => (d * Math.PI) / 180;

    let startRad = toRad(startDeg);
    let endRad = toRad(endDeg);

    if (Math.round(userAng) !== 0) {
      if (endRad <= startRad) endRad += Math.PI * 2;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.arc(start.x, start.y, circleRadius, startRad, endRad, false);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fill();

      // contorno do arco entre startRad e endRad
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = "rgba(255, 255, 255, 1)";
      ctx.beginPath();
      ctx.arc(start.x, start.y, circleRadius, startRad, endRad, false);
      ctx.stroke();

      // ticks sutis apenas nos limites
      const tickLen = 6;
      const sx = start.x + Math.cos(startRad) * circleRadius;
      const sy = start.y + Math.sin(startRad) * circleRadius;
      const sx2 = start.x + Math.cos(startRad) * (circleRadius - tickLen);
      const sy2 = start.y + Math.sin(startRad) * (circleRadius - tickLen);
      const ex = start.x + Math.cos(endRad) * circleRadius;
      const ey = start.y + Math.sin(endRad) * circleRadius;
      const ex2 = start.x + Math.cos(endRad) * (circleRadius - tickLen);
      const ey2 = start.y + Math.sin(endRad) * (circleRadius - tickLen);

      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx2, sy2);
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex2, ey2);
      ctx.stroke();

      ctx.restore();
    } else {
      ctx.save();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.beginPath();
      const topRad = toRad(userToEngineAngle(0));
      const sx = start.x + Math.cos(topRad) * (circleRadius - 2);
      const sy = start.y + Math.sin(topRad) * (circleRadius - 2);
      ctx.moveTo(sx, sy);
      ctx.arc(start.x, start.y, circleRadius, topRad - 0.03, topRad + 0.03, false);
      ctx.stroke();
      ctx.restore();
    }

    // --- LINHA DA SETA: agora BEM FORTE (inteira branca) ---
    ctx.save();
    ctx.lineWidth = 3;               // mais grossa
    ctx.strokeStyle = "#ffffff";    // branca pura
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();

    // cabeça da seta (triângulo) — branca pura também
    const arrowSize = 8;
    const ox = -uy; // perpendicular vetor
    const oy = ux;

    ctx.beginPath();
    ctx.fillStyle = "#ffffff";
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(tip.x - ux * arrowSize + ox * (arrowSize * 0.6), tip.y - uy * arrowSize + oy * (arrowSize * 0.6));
    ctx.lineTo(tip.x - ux * arrowSize - ox * (arrowSize * 0.6), tip.y - uy * arrowSize - oy * (arrowSize * 0.6));
    ctx.closePath();
    ctx.fill();

  }

  function draw(clearBackground = true) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;

    if (clearBackground) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--table-bg") || "#163f2a";
      ctx.fillRect(0, 0, cssW, cssH);
    }

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cssW / 2, 0);
    ctx.lineTo(cssW / 2, cssH);
    ctx.stroke();
    ctx.restore();

    const ball = ballRef.current;
    if (ball) {
      if (showTrail) {
        ctx.beginPath();
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.arc(ball.pos.x, ball.pos.y, ball.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.ellipse(ball.pos.x + ball.radius * 0.3, ball.pos.y + ball.radius * 0.6, ball.radius * 0.9, ball.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = "#fff";
      ctx.arc(ball.pos.x, ball.pos.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.ellipse(ball.pos.x - ball.radius * 0.35, ball.pos.y - ball.radius * 0.35, ball.radius * 0.35, ball.radius * 0.2, -0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Desenha a mira (setor entre 0° e angulo) + seta + label
    drawProjectionArrowIfNeeded(ctx, cssW, cssH);
  }

  function step(ts: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const last = lastTsRef.current ?? ts;
    const dt = Math.min(0.05, (ts - last) / 1000);
    lastTsRef.current = ts;

    const ball = ballRef.current;
    if (ball && ball.moving) {
      if (FIXED_DAMPING > 0) {
        const factor = Math.max(0, 1 - FIXED_DAMPING * dt);
        ball.vel.x *= factor;
        ball.vel.y *= factor;
      }

      ball.update(dt, { width: canvas.width / (window.devicePixelRatio || 1), height: canvas.height / (window.devicePixelRatio || 1) });
      setSpeedDisplay(ball.speed());
      setStatus("movendo");
    } else if (ball && !ball.moving) {
      setStatus("parada");
    }

    draw(!showTrail);

    if (ball && ball.moving) rafRef.current = requestAnimationFrame(step);
    else {
      rafRef.current = null;
      lastTsRef.current = null;
    }
  }

  // --- parse seguro das entradas (fallbacks) ---
  function parseOrDefault(value: string, fallback: number) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function start() {
    const canvas = canvasRef.current!;
    if (!canvas) return;
    const w = TABLE_W;
    const h = TABLE_H;
    setCanvasSize(canvas, w, h);

    let v0n = parseOrDefault(v0, 0);
    v0n = clamp(v0n, 0, MAX_V0);

    let userAng = parseOrDefault(angle, 0);
    userAng = clamp(userAng, ANGLE_MIN, ANGLE_MAX);

    let radial = parseOrDefault(radius, 12);
    radial = clamp(radial, MIN_RADIUS, MAX_RADIUS);

    const engineAng = userToEngineAngle(userAng);
    const vel = velocityFromPolar(v0n, engineAng);
    const pos = { x: w / 2, y: h / 2 };
    ballRef.current = new Ball(pos, vel, radial);

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    lastTsRef.current = null;
    rafRef.current = requestAnimationFrame(step);
    setStatus("movendo");
  }

  function pause() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setStatus("pausado");
    }
  }

  function reset() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastTsRef.current = null;
    ballRef.current = null;
    setStatus("pronto");
    setSpeedDisplay(0);
    const canvas = canvasRef.current;
    if (canvas) {
      setCanvasSize(canvas, TABLE_W, TABLE_H);
      draw();
    }
  }

  // Redesenha canvas quando componente monta
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setCanvasSize(canvas, TABLE_W, TABLE_H);
    draw();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-desenha IMEDIATAMENTE quando usuário altera ângulo/velocidade/raio (para atualizar a mira)
  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [angle, v0, radius]);

  return (
    <div className="ps-root">
      <aside className="ps-panel">
        <h2>Simulador — Mesa de Bilhar</h2>

        <div className="ps-row">
          <label>Velocidade inicial (px/s)</label>
          <input
            type="number"
            placeholder="400"
            min={0}
            max={MAX_V0}
            value={v0}
            onChange={handleV0Change}
          />
        </div>

        <div className="ps-row">
          <label>Direção (graus, 0 = cima, aumenta no sentido horário)</label>
          <input
            type="number"
            placeholder="0"
            min={ANGLE_MIN}
            max={ANGLE_MAX}
            step={1}
            value={angle}
            onChange={handleAngleChange}
          />
        </div>

        <div className="ps-row small">
          <div>
            <label>Raio (px)</label>
            <input
              type="number"
              placeholder="12"
              min={MIN_RADIUS}
              max={MAX_RADIUS}
              value={radius}
              onChange={handleRadiusChange}
            />
          </div>
        </div>

        <div className="ps-actions">
          <button className="btn primary" onClick={start}>▶ Iniciar</button>
          <button className="btn" onClick={pause}>⏸ Pausar</button>
          <button className="btn" onClick={reset}>⟲ Resetar</button>
        </div>

        <div className="ps-row info">
          <div><strong>Status:</strong> {status}</div>
          <div><strong>Velocidade:</strong> {speedDisplay.toFixed(2)} px/s</div>
        </div>
      </aside>

      <main className="ps-canvas-wrap">
        <div className="ps-canvas-card">
          <canvas ref={canvasRef} />
        </div>
      </main>
    </div>
  );
}
