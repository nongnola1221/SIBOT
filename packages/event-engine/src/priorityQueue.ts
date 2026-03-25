import type { AnalysisEvent } from "@sibot/shared";

export class PriorityEventQueue {
  private readonly queue: AnalysisEvent[] = [];

  push(event: AnalysisEvent) {
    this.queue.push(event);
    this.queue.sort((left, right) => {
      if (right.priorityScore === left.priorityScore) {
        return right.timestamp - left.timestamp;
      }

      return right.priorityScore - left.priorityScore;
    });
  }

  shift() {
    return this.queue.shift() ?? null;
  }

  peek() {
    return this.queue[0] ?? null;
  }

  clear() {
    this.queue.length = 0;
  }

  size() {
    return this.queue.length;
  }

  toArray() {
    return [...this.queue];
  }
}

