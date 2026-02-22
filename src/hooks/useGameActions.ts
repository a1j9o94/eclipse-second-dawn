/**
 * React hooks for Eclipse game actions
 *
 * Wraps Convex mutations with React-friendly interfaces
 */

import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCallback } from "react";
import type { Id } from "../../convex/_generated/dataModel";

/**
 * Hook for explore action
 *
 * Usage:
 * ```tsx
 * const explore = useExploreAction();
 * await explore({ position: { q: 1, r: 0 } });
 * ```
 */
export function useExploreAction() {
  const exploreMutation = useMutation(api.mutations.actions.explore);

  return useCallback(
    async (args: {
      roomId: Id<"rooms">;
      playerId: string;
      position: { q: number; r: number };
    }) => {
      try {
        const result = await exploreMutation(args);
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Explore action failed",
        };
      }
    },
    [exploreMutation]
  );
}

/**
 * Hook for influence action
 *
 * Usage:
 * ```tsx
 * const influence = useInfluenceAction();
 * await influence({
 *   retrieveFrom: [sectorId1],
 *   placeTo: [sectorId2, sectorId3]
 * });
 * ```
 */
export function useInfluenceAction() {
  const influenceMutation = useMutation(api.mutations.actions.influence);

  return useCallback(
    async (args: {
      roomId: Id<"rooms">;
      playerId: string;
      retrieveFrom?: Id<"sectors">[];
      placeTo?: Id<"sectors">[];
    }) => {
      try {
        const result = await influenceMutation(args);
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Influence action failed",
        };
      }
    },
    [influenceMutation]
  );
}

/**
 * Hook for research action
 *
 * Usage:
 * ```tsx
 * const research = useResearchAction();
 * await research({ technologyId });
 * ```
 */
export function useResearchAction() {
  const researchMutation = useMutation(api.mutations.actions.research);

  return useCallback(
    async (args: {
      roomId: Id<"rooms">;
      playerId: string;
      technologyId: Id<"technologies">;
    }) => {
      try {
        const result = await researchMutation(args);
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Research action failed",
        };
      }
    },
    [researchMutation]
  );
}

/**
 * Hook for upgrade action
 *
 * Usage:
 * ```tsx
 * const upgrade = useUpgradeAction();
 * await upgrade({
 *   blueprintId,
 *   addParts: [partId1, partId2],
 *   removeParts: [partId3]
 * });
 * ```
 */
export function useUpgradeAction() {
  const upgradeMutation = useMutation(api.mutations.actions.upgrade);

  return useCallback(
    async (args: {
      roomId: Id<"rooms">;
      playerId: string;
      blueprintId: Id<"blueprints">;
      addParts?: Id<"parts">[];
      removeParts?: Id<"parts">[];
    }) => {
      try {
        const result = await upgradeMutation({
          ...args,
          addParts: args.addParts || [],
          removeParts: args.removeParts || [],
        });
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Upgrade action failed",
        };
      }
    },
    [upgradeMutation]
  );
}

/**
 * Hook for build action
 *
 * Usage:
 * ```tsx
 * const build = useBuildAction();
 * await build({
 *   sectorId,
 *   blueprintId,
 *   quantity: 2
 * });
 * ```
 */
export function useBuildAction() {
  const buildMutation = useMutation(api.mutations.actions.build);

  return useCallback(
    async (args: {
      roomId: Id<"rooms">;
      playerId: string;
      sectorId: Id<"sectors">;
      blueprintId: Id<"blueprints">;
    }) => {
      try {
        const result = await buildMutation(args);
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Build action failed",
        };
      }
    },
    [buildMutation]
  );
}

/**
 * Hook for move action
 *
 * Usage:
 * ```tsx
 * const move = useMoveAction();
 * await move({
 *   fromSectorId,
 *   toSectorId,
 *   shipIds: [shipId1, shipId2]
 * });
 * ```
 */
export function useMoveAction() {
  const moveMutation = useMutation(api.mutations.actions.move);

  return useCallback(
    async (args: {
      roomId: Id<"rooms">;
      playerId: string;
      fromSectorId: Id<"sectors">;
      toSectorId: Id<"sectors">;
      shipIds: Id<"ships">[];
    }) => {
      try {
        // The mutation expects a single shipId, so we'll move ships one at a time
        // This is a workaround for the API mismatch
        const results = [];
        for (const shipId of args.shipIds) {
          const result = await moveMutation({
            roomId: args.roomId,
            playerId: args.playerId,
            shipId,
            toSectorId: args.toSectorId,
          });
          results.push(result);
        }
        return { success: true, data: results };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Move action failed",
        };
      }
    },
    [moveMutation]
  );
}

/**
 * Hook for pass action
 *
 * Usage:
 * ```tsx
 * const pass = usePassAction();
 * await pass();
 * ```
 */
export function usePassAction() {
  const passMutation = useMutation(api.mutations.turns.passTurn);

  return useCallback(
    async (args: {
      roomId: Id<"rooms">;
      playerId: string;
    }) => {
      try {
        const result = await passMutation(args);
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Pass action failed",
        };
      }
    },
    [passMutation]
  );
}

/**
 * Combined hook for all game actions
 *
 * Usage:
 * ```tsx
 * const actions = useGameActions();
 * await actions.explore({ position: { q: 1, r: 0 } });
 * await actions.move({ fromSectorId, toSectorId, shipIds });
 * ```
 */
export function useGameActions() {
  return {
    explore: useExploreAction(),
    influence: useInfluenceAction(),
    research: useResearchAction(),
    upgrade: useUpgradeAction(),
    build: useBuildAction(),
    move: useMoveAction(),
    pass: usePassAction(),
  };
}
