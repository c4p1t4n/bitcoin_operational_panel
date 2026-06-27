import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../EventBus";
import { MemPoolFeeSpike } from "../../domain/events/MemPoolFeeSpike";
import { AlertTriggered } from "../../domain/events/AlertTriggered";

/**
 * @test EventBus
 * Testa pub/sub local (em-memória). Pub/sub distribuído via Redis é Phase 5.
 */

describe("EventBus", () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe("subscribe and publish", () => {
    it("publishes event to single subscriber", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const event = new MemPoolFeeSpike("agg-1", 1, {
        feeRateSatPerVb: 50,
        baselineSatPerVb: 30,
        deltaPct: 67,
      });

      eventBus.subscribe(event.eventType, handler);
      await eventBus.publish([event]);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it("publishes event to multiple subscribers", async () => {
      const handler1 = vi.fn().mockResolvedValue(undefined);
      const handler2 = vi.fn().mockResolvedValue(undefined);
      const event = new MemPoolFeeSpike("agg-1", 1, {
        feeRateSatPerVb: 50,
        baselineSatPerVb: 30,
        deltaPct: 67,
      });

      eventBus.subscribe(event.eventType, handler1);
      eventBus.subscribe(event.eventType, handler2);
      await eventBus.publish([event]);

      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledWith(event);
    });

    it("does not publish to unregistered event types", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const event = new MemPoolFeeSpike("agg-1", 1, {
        feeRateSatPerVb: 50,
        baselineSatPerVb: 30,
        deltaPct: 67,
      });

      eventBus.subscribe("OTHER_EVENT", handler);
      await eventBus.publish([event]);

      expect(handler).not.toHaveBeenCalled();
    });

    it("publishes multiple events", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const event1 = new MemPoolFeeSpike("agg-1", 1, {
        feeRateSatPerVb: 50,
        baselineSatPerVb: 30,
        deltaPct: 67,
      });
      const event2 = new AlertTriggered("agg-2", 1, {
        ruleId: "rule-1",
        severity: "HIGH",
        title: "Fee spike",
        sourceEventId: "evt-1",
      });

      eventBus.subscribe(event1.eventType, handler);
      eventBus.subscribe(event2.eventType, handler);
      await eventBus.publish([event1, event2]);

      expect(handler).toHaveBeenCalledWith(event1);
      expect(handler).toHaveBeenCalledWith(event2);
    });
  });

  describe("unsubscribe", () => {
    it("removes subscriber when unsubscribe called", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const event = new MemPoolFeeSpike("agg-1", 1, {
        feeRateSatPerVb: 50,
        baselineSatPerVb: 30,
        deltaPct: 67,
      });

      const unsubscribe = eventBus.subscribe(event.eventType, handler);
      await unsubscribe();
      await eventBus.publish([event]);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("error isolation", () => {
    it("catches error from one subscriber, calls others", async () => {
      const handler1 = vi.fn().mockRejectedValue(new Error("Handler error"));
      const handler2 = vi.fn().mockResolvedValue(undefined);
      const event = new MemPoolFeeSpike("agg-1", 1, {
        feeRateSatPerVb: 50,
        baselineSatPerVb: 30,
        deltaPct: 67,
      });

      eventBus.subscribe(event.eventType, handler1);
      eventBus.subscribe(event.eventType, handler2);

      // publish should not throw, even if handler1 fails
      await eventBus.publish([event]);

      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledWith(event);
    });
  });
});
