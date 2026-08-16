/**
 * Values shared by the browser and the server. Kept apart from `engine.ts` on
 * purpose: importing anything from the engine pulls the Anthropic SDK into the
 * client bundle, which fails the build and would ship server code to readers.
 */

export const MAX_QUESTION_LENGTH = 2000;
export const MIN_QUESTION_LENGTH = 15;

export const MIN_SEATED = 4;
export const MAX_SEATED = 6;
export const MAX_EXCHANGES = 4;
