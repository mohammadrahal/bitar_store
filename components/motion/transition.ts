/**
 * One easing and one duration for every entrance in the app, so a page, a card
 * and a table row all arrive with the same hand.
 */
export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

export const FADE_DURATION = 0.6
export const ITEM_DURATION = 0.5

/** The skeleton's fade out, which runs before the rows start arriving. */
export const SWAP_DURATION = 0.25

/** How long a list keeps staggering before late arrivals simply appear. */
export const STAGGER_STEP = 0.06
export const STAGGER_LIMIT = 20
