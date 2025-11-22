// src/components/billiardModel.ts
export type Vec2 = { x: number; y: number };
export type Table = { width: number; height: number };

// converte ângulo e velocidade para vetor
export function velocityFromPolar(v0: number, angleDeg: number): Vec2 {
  const a = (angleDeg * Math.PI) / 180;
  return { x: v0 * Math.cos(a), y: v0 * Math.sin(a) };
}

export class Ball {
  pos: Vec2;
  vel: Vec2;
  radius: number;
  moving: boolean;

  constructor(pos: Vec2, vel: Vec2, radius = 10) {
    this.pos = { ...pos };
    this.vel = { ...vel };
    this.radius = radius;
    this.moving = true;
  }

  speed(): number {
    return Math.hypot(this.vel.x, this.vel.y);
  }

  update(dt: number, table: Table) {
    if (!this.moving) return;

    // mover
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;

    // colisões com paredes
    if (this.pos.x - this.radius <= 0 && this.vel.x < 0) {
      this.pos.x = this.radius;
      this.vel.x = -this.vel.x * 0.9;
      this.vel.y *= 0.9;
    }

    if (this.pos.x + this.radius >= table.width && this.vel.x > 0) {
      this.pos.x = table.width - this.radius;
      this.vel.x = -this.vel.x * 0.9;
      this.vel.y *= 0.9;
    }

    if (this.pos.y - this.radius <= 0 && this.vel.y < 0) {
      this.pos.y = this.radius;
      this.vel.y = -this.vel.y * 0.9;
      this.vel.x *= 0.9;
    }

    if (this.pos.y + this.radius >= table.height && this.vel.y > 0) {
      this.pos.y = table.height - this.radius;
      this.vel.y = -this.vel.y * 0.9;
      this.vel.x *= 0.9;
    }

    if (this.speed() < 1e-2) {
      this.vel.x = 0;
      this.vel.y = 0;
      this.moving = false;
    }
  }
}
