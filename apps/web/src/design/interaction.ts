/**
 * Shared press feedback for functional buttons — a quick scale-down on tap
 * so a click always reads as registered, even before whatever it triggers
 * (a mutation, a sheet opening) actually finishes. Append to a button's
 * className; safe to combine with any background/border classes.
 */
export const PRESSABLE = 'transition-transform duration-100 active:scale-95';
