/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as engine_actions from "../engine/actions.js";
import type * as engine_combat from "../engine/combat.js";
import type * as engine_resources from "../engine/resources.js";
import type * as engine_technology from "../engine/technology.js";
import type * as engine_turns from "../engine/turns.js";
import type * as helpers_economy from "../helpers/economy.js";
import type * as helpers_log from "../helpers/log.js";
import type * as mutations_actions from "../mutations/actions.js";
import type * as mutations_seed from "../mutations/seed.js";
import type * as mutations_turns from "../mutations/turns.js";
import type * as queries_galaxy from "../queries/galaxy.js";
import type * as queries_game from "../queries/game.js";
import type * as queries_gameData from "../queries/gameData.js";
import type * as queries_players from "../queries/players.js";
import type * as queries_rooms from "../queries/rooms.js";
import type * as queries_technologies from "../queries/technologies.js";
import type * as seedData_factions from "../seedData/factions.js";
import type * as seedData_index from "../seedData/index.js";
import type * as seedData_parts from "../seedData/parts.js";
import type * as seedData_technologies from "../seedData/technologies.js";
import type * as seedData_tiles from "../seedData/tiles.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "engine/actions": typeof engine_actions;
  "engine/combat": typeof engine_combat;
  "engine/resources": typeof engine_resources;
  "engine/technology": typeof engine_technology;
  "engine/turns": typeof engine_turns;
  "helpers/economy": typeof helpers_economy;
  "helpers/log": typeof helpers_log;
  "mutations/actions": typeof mutations_actions;
  "mutations/seed": typeof mutations_seed;
  "mutations/turns": typeof mutations_turns;
  "queries/galaxy": typeof queries_galaxy;
  "queries/game": typeof queries_game;
  "queries/gameData": typeof queries_gameData;
  "queries/players": typeof queries_players;
  "queries/rooms": typeof queries_rooms;
  "queries/technologies": typeof queries_technologies;
  "seedData/factions": typeof seedData_factions;
  "seedData/index": typeof seedData_index;
  "seedData/parts": typeof seedData_parts;
  "seedData/technologies": typeof seedData_technologies;
  "seedData/tiles": typeof seedData_tiles;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
