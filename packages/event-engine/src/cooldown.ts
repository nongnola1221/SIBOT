export class CooldownController {
  private readonly map = new Map<string, number>();

  canTrigger(group: string, cooldownMs: number, now = Date.now()) {
    const last = this.map.get(group) ?? 0;
    return now - last >= cooldownMs;
  }

  markTriggered(group: string, now = Date.now()) {
    this.map.set(group, now);
  }

  remainingMs(group: string, cooldownMs: number, now = Date.now()) {
    const last = this.map.get(group) ?? 0;
    const remaining = cooldownMs - (now - last);
    return Math.max(0, remaining);
  }

  reset() {
    this.map.clear();
  }
}

