// An adapter to whoever delivers email (not chosen yet), like MessagingProvider is for WhatsApp. One
// method per kind of email, so each maps to one template and nothing free-form is ever sent.
export interface EmailProvider {
  // A link that lets someone create an admin account. English: admins are Hagz staff.
  sendAdminInvitation(email: AdminInvitationEmail): Promise<void>;
  // A link that lets an admin choose a new password, sent at another admin's request.
  sendAdminPasswordReset(email: AdminPasswordResetEmail): Promise<void>;
}

export interface AdminInvitationEmail {
  to: string;
  invitedBy: string;
  acceptUrl: string;
  expiresAt: Date;
}

export interface AdminPasswordResetEmail {
  to: string;
  name: string;
  requestedBy: string;
  resetUrl: string;
  expiresAt: Date;
}
