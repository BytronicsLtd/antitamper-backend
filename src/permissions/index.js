/**
 * Permissions registry — single source of truth for who can do what.
 *
 * Two layers:
 *   1. can(role, action)         — does the role unlock the verb at all?
 *   2. inScope(user, resource)   — does the user's scope reach this resource?
 *
 * Plus invitation rules:
 *   canInvite(inviter, target)
 *   inviteScopeFor(inviter)
 *
 * No HTTP, no DB. Pure data + helpers. Mirrored on the dashboard under
 * src/lib/permissions/.
 */

const levels = require('./levels');
const roles = require('./roles');
const actions = require('./actions');
const invitations = require('./invitations');
const scope = require('./scope');

module.exports = {
  ...levels,
  ...roles,
  ...actions,
  ...invitations,
  ...scope,
};
