/**
 * Conversation Engine — single implementation.
 * Messages are WorkflowEvent rows with type conversation.message
 * (Timeline Engine = SoT). No parallel chat store.
 */
export const CONVERSATION_EVENT_TYPE = "conversation.message" as const;

export type ConversationMessage = {
  id: string;
  documentId: string;
  body: string;
  actorName: string | null;
  createdAt: string;
};
