/**
 * Seam for circle lifecycle notifications (Phase 2 delivery implements it).
 * Keeps the circles domain independent of the concrete notifier, matching the
 * dispatcher pattern used by check-ins and touchpoints.
 */
export interface CircleEventDispatcher {
  /**
   * FR #3: notify existing members that a new member joined.
   * `recipientIds` are the members to alert (everyone except the new joiner).
   */
  memberAdded(input: {
    circleId: string;
    newMemberName: string;
    recipientIds: string[];
  }): Promise<void>;
}

export const noopCircleEventDispatcher: CircleEventDispatcher = {
  async memberAdded() {
    /* Phase 2 delivery wires the real push/email here. */
  },
};
