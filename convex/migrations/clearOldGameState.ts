import { internalMutation } from "../_generated/server";

export const clearOldGameState = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Delete all existing gameState documents that don't match new schema
    const oldGameStates = await ctx.db.query("gameState").collect();
    let deleted = 0;
    for (const doc of oldGameStates) {
      await ctx.db.delete(doc._id);
      deleted++;
    }
    return { success: true, deleted };
  },
});
