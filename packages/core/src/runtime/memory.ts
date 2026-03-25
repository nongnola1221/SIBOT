import type { AnalysisEvent, ConversationTurn, Utterance } from "@sibot/shared";
import { DEFAULT_MEMORY_LIMIT, DEFAULT_UTTERANCE_LIMIT, limitList } from "@sibot/shared";

export class ConversationMemory {
  private recentEvents: AnalysisEvent[] = [];
  private recentUtterances: Utterance[] = [];
  private recentTurns: ConversationTurn[] = [];

  addEvent(event: AnalysisEvent) {
    this.recentEvents = limitList([event, ...this.recentEvents], DEFAULT_MEMORY_LIMIT);
  }

  addUtterance(utterance: Utterance) {
    this.recentUtterances = limitList([utterance, ...this.recentUtterances], DEFAULT_UTTERANCE_LIMIT);
  }

  addTurn(turn: ConversationTurn) {
    this.recentTurns = limitList([turn, ...this.recentTurns], 10);
  }

  getEvents() {
    return [...this.recentEvents];
  }

  getUtterances() {
    return [...this.recentUtterances];
  }

  getTurns() {
    return [...this.recentTurns];
  }

  getLatestEvent() {
    return this.recentEvents[0] ?? null;
  }

  getLatestUtterance() {
    return this.recentUtterances[0] ?? null;
  }

  clear() {
    this.recentEvents = [];
    this.recentUtterances = [];
    this.recentTurns = [];
  }
}

