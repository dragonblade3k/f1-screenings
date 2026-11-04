// Which candidates an approve may act on.
//
// Kept here rather than inside each route because the rule was a copy per route
// and the copies disagreed. `reject` put `status: "PENDING"` inside its own
// update and explained why the condition belongs in the write rather than in a
// read beforehand. Neither approve route had a condition at all: both matched on
// the id alone, so an approve posted for a candidate a human had already
// rejected flipped it to VERIFIED and published its Event.
//
// Both routes are reachable in that state. The inbox renders PENDING rows only,
// but a button does not have to be on a current page to be clicked: a history
// entry or a second tab still shows the card, and reject redirects back to the
// same list. `/admin/edit/<id>` is worse, because it renders the form for any id
// whatever status the row is in and says nothing about which. So the review
// queue refused to retract a published screening, which reject guards against
// deliberately, while publishing a refused one without complaint.

/**
 * The candidate statuses an approve may act on.
 *
 * REJECTED is excluded and the other two are not, because the three states
 * differ in what a second approve means. PENDING is the normal case. VERIFIED
 * is a correction: the candidate is published already, the reviewer is editing
 * the row that produced it, and both routes are written to update that Event in
 * place rather than create a second one, which is the only way to fix a typo on
 * a live listing. REJECTED is neither. It is a decision a human made against
 * this row, recorded nowhere else, and approving over it both publishes a
 * screening that was refused and erases the refusal.
 *
 * An allow list rather than "anything but REJECTED", so a status added later
 * has to be considered here instead of becoming approvable by default.
 */
export const APPROVABLE_STATUSES = ["PENDING", "VERIFIED"] as const;

/**
 * What to tell a reviewer whose approve was refused. Names the status the row is
 * in now, because that is the part they cannot see: the page they clicked from
 * still shows it as pending.
 */
export function approvalRefusal(status: string): string {
  return `Candidate is ${status} and cannot be approved`;
}
