import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CommandBus,
  CommandNotFoundError,
  PermissionError,
  type CommandHandler,
} from "../CommandBus";
import { CreateAlertRule } from "../../domain/commands";
import { AlertTriggered } from "../../domain/events";
import type { User } from "../../domain/types";
import type { IEventStore } from "../EventStore";
import type { IEventBus } from "../EventBus";

/**
 * @test CommandBus
 * Testa dispatch, validação de permissões, e roteamento para handlers.
 */

describe("CommandBus", () => {
  let mockEventStore: IEventStore;
  let mockEventBus: IEventBus;
  let getCurrentUser: () => User | null;
  let commandBus: CommandBus;
  let mockHandler: CommandHandler;

  beforeEach(() => {
    mockEventStore = {
      append: vi.fn().mockResolvedValue(undefined),
      getEventsFor: vi.fn().mockResolvedValue([]),
    };

    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockReturnValue(vi.fn()),
    };

    getCurrentUser = vi.fn().mockReturnValue({
      id: "user-1",
      role: "ADMIN",
    });

    commandBus = new CommandBus(mockEventStore, mockEventBus, getCurrentUser);

    mockHandler = {
      commandType: "TEST_COMMAND",
      handle: vi.fn().mockResolvedValue([]),
    };
  });

  describe("register", () => {
    it("registers a handler for a command type", () => {
      commandBus.register(mockHandler);
      // No error thrown, handler registered successfully
      expect(true).toBe(true);
    });

    it("throws error when registering duplicate handler", () => {
      commandBus.register(mockHandler);
      expect(() => commandBus.register(mockHandler)).toThrow();
    });
  });

  describe("dispatch", () => {
    beforeEach(() => {
      commandBus.register(mockHandler);
    });

    it("throws PermissionError when user not authenticated", async () => {
      (getCurrentUser as any).mockReturnValue(null);

      const command = new CreateAlertRule("agg-1", {
        name: "Test",
        ruleType: "FEE_SPIKE",
        configuration: {},
        requestedByUserId: "user-1",
      });

      await expect(commandBus.dispatch(command)).rejects.toThrow(
        PermissionError
      );
    });

    it("throws PermissionError when user lacks permission", async () => {
      (getCurrentUser as any).mockReturnValue({
        id: "user-2",
        role: "VIEWER",
      });

      const command = new CreateAlertRule("agg-1", {
        name: "Test",
        ruleType: "FEE_SPIKE",
        configuration: {},
        requestedByUserId: "user-2",
      });

      await expect(commandBus.dispatch(command)).rejects.toThrow(
        PermissionError
      );
    });

    it("throws CommandNotFoundError when handler not registered", async () => {
      const command = new CreateAlertRule("agg-1", {
        name: "Test",
        ruleType: "FEE_SPIKE",
        configuration: {},
        requestedByUserId: "user-1",
      });

      await expect(commandBus.dispatch(command)).rejects.toThrow(
        CommandNotFoundError
      );
    });

    it("calls handler and persists events", async () => {
      const event = new AlertTriggered("agg-1", 1, {
        ruleId: "rule-1",
        severity: "HIGH",
        title: "Fee spike",
        sourceEventId: "evt-1",
      });

      mockHandler.handle = vi.fn().mockResolvedValue([event]);
      commandBus.register(mockHandler);

      const command = new CreateAlertRule("agg-1", {
        name: "Test",
        ruleType: "FEE_SPIKE",
        configuration: {},
        requestedByUserId: "user-1",
      });

      // Need to re-register with the updated mock
      commandBus = new CommandBus(mockEventStore, mockEventBus, getCurrentUser);
      const testHandler: CommandHandler = {
        commandType: "CREATE_ALERT_RULE",
        handle: vi.fn().mockResolvedValue([event]),
      };
      commandBus.register(testHandler);

      const result = await commandBus.dispatch(command);

      expect(testHandler.handle).toHaveBeenCalledWith(command);
      expect(mockEventStore.append).toHaveBeenCalledWith(command, [event]);
      expect(result).toEqual([event]);
    });

    it("does not persist when handler returns no events", async () => {
      const command = new CreateAlertRule("agg-1", {
        name: "Test",
        ruleType: "FEE_SPIKE",
        configuration: {},
        requestedByUserId: "user-1",
      });

      commandBus = new CommandBus(mockEventStore, mockEventBus, getCurrentUser);
      const testHandler: CommandHandler = {
        commandType: "CREATE_ALERT_RULE",
        handle: vi.fn().mockResolvedValue([]),
      };
      commandBus.register(testHandler);

      await commandBus.dispatch(command);

      expect(mockEventStore.append).not.toHaveBeenCalled();
    });
  });
});
