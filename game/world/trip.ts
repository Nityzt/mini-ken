import { routesFrom, type NodeId, type Route } from "./map.ts";

/** About three seconds: long enough to enjoy, short enough to ride again. */
export const TRIP_TICKS = 180;
/** The press that caught the streetcar shouldn't also skip the ride. */
export const TRIP_SKIP_AFTER = 20;

export type Trip = { from: NodeId; to: NodeId; mode: Route["mode"]; east: boolean; ticks: number; done: boolean; hall?: "there" | "back" };

export function createTrip(from: NodeId, to: NodeId): Trip | null {
  const route = routesFrom(from).find((r) => r.to === to);
  return route ? { from, to, mode: route.mode, east: route.east, ticks: 0, done: false } : null;
}

/** The grading hall isn't on the map. The train leaves from wherever you are, and brings you back there. */
export const createHallTrip = (node: NodeId, hall: "there" | "back"): Trip => ({ from: node, to: node, mode: "train", east: hall === "there", ticks: 0, done: false, hall });

export function stepTrip(trip: Trip, skip: boolean): Trip {
  const ticks = trip.ticks + 1;
  return { ...trip, ticks, done: ticks >= TRIP_TICKS || (skip && trip.ticks >= TRIP_SKIP_AFTER) };
}

export const tripProgress = (trip: Trip): number => (trip.done ? 1 : trip.ticks / TRIP_TICKS);
