import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventStore, OptimisticConcurrencyError } from "../EventStore";
import type { DomainEvent, Command } from "../../domain";
import { MemPoolFeeSpike } from "../../domain/events/MemPoolFeeSpike";
import { AlertTriggered } from "../../domain/events/AlertTriggered";
import { CreateAlertRule } from "../../domain/commands/CreateAlertRule";
import type { IEventBus } from "../EventBus";

/**
 * @test EventStore
 * Testa persistência de eventos com optimistic locking e publicação em EventBus.
 * Mock do db e EventBus isolam o EventStore logic.
 */

describe("EventStore", () => {
  let mockDb: any;
  let mockEventBus: IEventBus;
  let eventStore: EventStore;

  beforeEach(() => {
    // Mock database
    mockDb = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    };

    // Mock EventBus
    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockReturnValue(vi.fn()),
    };

    eventStore = new EventStore(mockDb, mockEventBus);
  });

  describe("append", () => {
    it("persists events to database when version does not conflict", async () => {
      const event = new MemPoolFeeSpike("agg-1", 1, {
        feeRateSatPerVb: 50,
        baselineSatPerVb: 30,
        deltaPct: 67,
      });

      const command = new CreateAlertRule("agg-1", {
        name: "Test Rule",
        ruleType: "FEE_SPIKE",
        configuration: {},
        requestedByUserId: "user-1",
      });

      await eventStore.append(command, [event]);

      expect(mockDb.insert).toHaveBeenCalledWith(expect.anything());
      expect(mockDb.values).toHaveBeenCalled();
    });

    it("publishes events to EventBus after successful append", async () => {
      const event = new MemPoolFeeSpike("agg-1", 1, {
        feeRateSatPerVb: 50,
        baselineSatPerVb: 30,
        deltaPct: 67,
      });

      const command = new CreateAlertRule("agg-1", {
        name: "Test Rule",
        ruleType: "FEE_SPIKE",
        configuration: {},
        requestedByUserId: "user-1",
      });

      await eventStore.append(command, [event]);

      expect(mockEventBus.publish).toHaveBeenCalledWith([event]);
    });

    it("throws OptimisticConcurrencyError when version constraint violated", async () => {
      const event = new MemPoolFeeSpike("agg-1", 2, {
        feeRateSatPerVb: 50,
        baselineSatPerVb: 30,
        deltaPct: 67,
      });

      const command = new CreateAlertRule("agg-1", {
        name: "Test Rule",
        ruleType: "FEE_SPIKE",
        configuration: {},
        requestedByUserId: "user-1",
      });

      mockDb.values = vi
        .fn()
        .mockRejectedValue(
          new Error(
            "duplicate key value violates unique constraint idx_events_aggregate_version"
          )
        );

      await expect(eventStore.append(command, [event])).rejects.toThrow(
        OptimisticConcurrencyError
      );
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it("appends multiple events from single command", async () => {
      const event1 = new AlertTriggered("agg-1", 1, {
        ruleId: "rule-1",
        severity: "HIGH",
        title: "Fee spike",
        sourceEventId: "evt-1",
      });

      const event2 = new MemPoolFeeSpike("agg-2", 1, {
        feeRateSatPerVb: 50,
        baselineSatPerVb: 30,
        deltaPct: 67,
      });

      const command = new CreateAlertRule("agg-1", {
        name: "Test Rule",
        ruleType: "FEE_SPIKE",
        configuration: {},
        requestedByUserId: "user-1",
      });

      await eventStore.append(command, [event1, event2]);

      expect(mockDb.insert).toHaveBeenCalledTimes(2);
      expect(mockEventBus.publish).toHaveBeenCalledWith([event1, event2]);
    });

    it("does nothing when events array is empty", async () => {
      const command = new CreateAlertRule("agg-1", {
        name: "Test Rule",
        ruleType: "FEE_SPIKE",
        configuration: {},
        requestedByUserId: "user-1",
      });

      await eventStore.append(command, []);

      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe("getEventsFor", () => {
    it("returns events for aggregate in version order", async () => {
      const mockRows = [
        {
          id: "evt-1",
          aggregateId: "agg-1",
          aggregateType: "Alert" as const,
          eventType: "ALERT_TRIGGERED",
          version: 1,
          payload: { ruleId: "rule-1", severity: "HIGH", title: "Test" },
          occurredAt: new Date("2026-06-27T10:00:00Z"),
        },
        {
          id: "evt-2",
          aggregateId: "agg-1",
          aggregateType: "Alert" as const,
          eventType: "ALERT_ACKNOWLEDGED",
          version: 2,
          payload: { acknowledgedByUserId: "user-1" },
          occurredAt: new Date("2026-06-27T10:01:00Z"),
        },
      ];

      mockDb.orderBy = vi.fn().mockResolvedValue(mockRows);

      const events = await eventStore.getEventsFor("agg-1");

      expect(events).toHaveLength(2);
      expect(events[0]!.version).toBe(1);
      expect(events[1]!.version).toBe(2);
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.orderBy).toHaveBeenCalled();
    });

    it("returns empty array for non-existent aggregate", async () => {
      mockDb.orderBy = vi.fn().mockResolvedValue([]);

      const events = await eventStore.getEventsFor("nonexistent");

      expect(events).toEqual([]);
    });
  });
});
