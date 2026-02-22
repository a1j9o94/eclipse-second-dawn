import { internalMutation } from "../_generated/server";

export const clearAllData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tables = [
      "actionLog", "blueprints", "combatLog", "fleetArchives",
      "gameResults", "gameState", "players", "rooms",
      "playerAmbassadors", "playerDiscoveryTiles", "playerReputationTiles",
      "playerResources", "playerTechnologies", "sectorResources",
      "sectors", "ships"
    ];

    let totalDeleted = 0;

    for (const tableName of tables) {
      const docs = await ctx.db.query(tableName as any).collect();
      for (const doc of docs) {
        await ctx.db.delete(doc._id);
        totalDeleted++;
      }
      console.log(`Cleared ${docs.length} documents from ${tableName}`);
    }

    return { success: true, totalDeleted };
  },
});
