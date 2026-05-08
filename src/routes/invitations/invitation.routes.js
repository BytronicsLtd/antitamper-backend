const authenticate = require('../../middlewares/authenticate.middleware');
const invitationController = require('../../controllers/invitations/invitation.controller');

module.exports = ({ app }) => {
  // PUBLIC — preview an invitation by raw token (used by /accept-invite page).
  app.get('/api/v1/invitations/accept', {}, invitationController.preview);

  // PUBLIC — accept an invitation: creates a User, returns auth token.
  app.post('/api/v1/invitations/accept', {}, invitationController.accept);

  // AUTH — list invitations within caller's invite scope.
  app.get(
    '/api/v1/invitations/',
    { preHandler: [authenticate] },
    invitationController.list
  );

  // AUTH — create an invitation. Authorisation enforced by canInvite()
  // inside the controller (driven by registry + caller's scope).
  app.post(
    '/api/v1/invitations/',
    { preHandler: [authenticate] },
    invitationController.create
  );

  // AUTH — re-mint token + resend the invitation email.
  app.post(
    '/api/v1/invitations/:id/resend',
    { preHandler: [authenticate] },
    invitationController.resend
  );

  // AUTH — revoke a pending invitation.
  app.delete(
    '/api/v1/invitations/:id',
    { preHandler: [authenticate] },
    invitationController.revoke
  );
};
