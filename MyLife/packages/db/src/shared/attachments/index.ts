/**
 * Shared Attachments — barrel.
 *
 * Unified photo/doc/voice store with polymorphic binding across modules.
 */

// Types + schemas
export type {
  Attachment,
  AttachmentLink,
  CreateAttachmentInput,
  LinkAttachmentInput,
} from './types';
export {
  AttachmentSchema,
  AttachmentLinkSchema,
  CreateAttachmentInputSchema,
  LinkAttachmentInputSchema,
} from './types';

// Operations
export {
  createAttachment,
  getAttachment,
  deleteAttachment,
  linkAttachment,
  unlinkAttachment,
  getAttachmentsFor,
  getLinksForAttachment,
} from './operations';
