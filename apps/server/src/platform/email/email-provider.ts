// An adapter to whoever delivers email (not chosen yet), like MessagingProvider is for WhatsApp. One
// method per kind of email, so each maps to one template and nothing free-form is ever sent.
export interface EmailProvider {
  // A link that lets someone create an admin account. English: admins are Hagz staff.
  sendAdminInvitation(email: AdminInvitationEmail): Promise<void>;
}

export interface AdminInvitationEmail {
  to: string;
  invitedBy: string;
  acceptUrl: string;
  expiresAt: Date;
}
