// A fixed-step, bounded combat simulation. Units are scene metres and seconds.
// Sphere contacts are an intentional approximation for airborne choreography.
export class Body {
  constructor(x = 0, y = 0, z = 0, radius = .75, mass = 1) {
    this.position = { x, y, z };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.target = { x, y, z };
    this.radius = radius;
    this.mass = mass;
  }
  impulse(x, y = 0, z = 0) {
    this.velocity.x += x / this.mass;
    this.velocity.y += y / this.mass;
    this.velocity.z += z / this.mass;
  }
}

export class CombatPhysics {
  constructor(solo = false) {
    this.origins = solo ? [0] : [-3.35, 3.35];
    this.bodies = this.origins.map(x => new Body(x));
    this.accumulator = 0;
    this.stepSize = 1 / 120;
    this.time = 0;
    this.enabled = true;
    this.contacts = 0;
    this.oncontact = null;
  }
  reset() {
    this.accumulator = 0;
    this.time = 0;
    this.bodies.forEach((b, i) => {
      Object.assign(b.position, { x: this.origins[i], y: 0, z: 0 });
      Object.assign(b.target, b.position);
      Object.assign(b.velocity, { x: 0, y: 0, z: 0 });
    });
  }
  update(dt) {
    if (!this.enabled) return;
    this.accumulator += Math.max(0, Math.min(dt, .1));
    while (this.accumulator + 1e-10 >= this.stepSize) {
      this.step(this.stepSize);
      this.accumulator -= this.stepSize;
    }
  }
  step(dt) {
    this.time += dt;
    for (const body of this.bodies) {
      for (const axis of ['x', 'y', 'z']) {
        const acceleration = (body.target[axis] - body.position[axis]) * 28 - body.velocity[axis] * 7.5;
        body.velocity[axis] += acceleration * dt;
        body.position[axis] += body.velocity[axis] * dt;
        const bound = axis === 'x' ? 7 : 3;
        if (Math.abs(body.position[axis]) > bound) {
          body.position[axis] = Math.sign(body.position[axis]) * bound;
          body.velocity[axis] *= -.3;
        }
      }
    }
    if (this.bodies.length < 2) return;
    const [a, b] = this.bodies;
    const d = { x: b.position.x - a.position.x, y: b.position.y - a.position.y, z: b.position.z - a.position.z };
    const distance = Math.hypot(d.x, d.y, d.z);
    if (distance >= a.radius + b.radius) return;
    const n = distance > 1e-8 ? { x: d.x / distance, y: d.y / distance, z: d.z / distance } : { x: 1, y: 0, z: 0 };
    const totalInverseMass = 1 / a.mass + 1 / b.mass;
    const overlap = a.radius + b.radius - distance;
    let relative = 0;
    for (const axis of ['x', 'y', 'z']) {
      a.position[axis] -= n[axis] * overlap / (a.mass * totalInverseMass);
      b.position[axis] += n[axis] * overlap / (b.mass * totalInverseMass);
      relative += (b.velocity[axis] - a.velocity[axis]) * n[axis];
    }
    if (relative >= 0) return;
    const impulse = -(1 + .45) * relative / totalInverseMass;
    a.impulse(-n.x * impulse, -n.y * impulse, -n.z * impulse);
    b.impulse(n.x * impulse, n.y * impulse, n.z * impulse);
    this.contacts++;
    this.oncontact?.({ x: (a.position.x + b.position.x) / 2, y: (a.position.y + b.position.y) / 2 + .7, z: (a.position.z + b.position.z) / 2, strength: Math.min(1, impulse / 8) });
  }
}
