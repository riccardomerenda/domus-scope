/**
 * @domus-scope/engine — pure domain engine for DomusScope.
 *
 * Deterministic (NFR-002): no clock, no randomness, no I/O. Every monetary
 * output carries an explanation trace (BR-021). Presentation code rounds;
 * the engine never does (§10 of the domain spec).
 */
export * from "./explain/line-item";
export * from "./schemas";
export * from "./mortgage";
