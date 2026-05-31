// AI Conversation Management Module
// Handles conversation creation, loading, and management for the AI assistant

class AIConversationManager {
  constructor(supabase) {
    this.supabase = supabase;
    this.currentConversation = null;
    this.conversations = [];
  }

  async createConversation(title = 'Nova Conversa', context = 'general') {
    try {
      const { data, error } = await this.supabase
        .from('ai_conversations')
        .insert({
          title: title.substring(0, 255),
          context: context
        })
        .select()
        .single();

      if (error) throw error;

      this.currentConversation = data;
      await this.loadConversations();
      
      return data;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  async loadConversations() {
    try {
      const { data, error } = await this.supabase
        .from('ai_conversations')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      this.conversations = data || [];
      return this.conversations;
    } catch (error) {
      console.error('Error loading conversations:', error);
      throw error;
    }
  }

  async loadConversation(conversationId) {
    try {
      const { data, error } = await this.supabase
        .from('ai_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      this.currentConversation = this.conversations.find(c => c.id === conversationId);
      return data || [];
    } catch (error) {
      console.error('Error loading conversation messages:', error);
      throw error;
    }
  }

  async deleteConversation(conversationId) {
    try {
      const { error } = await this.supabase
        .from('ai_conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;

      if (this.currentConversation?.id === conversationId) {
        this.currentConversation = null;
      }

      await this.loadConversations();
      return true;
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }

  async updateConversationTitle(conversationId, title) {
    try {
      const { error } = await this.supabase
        .from('ai_conversations')
        .update({ title: title.substring(0, 255) })
        .eq('id', conversationId);

      if (error) throw error;

      await this.loadConversations();
      return true;
    } catch (error) {
      console.error('Error updating conversation title:', error);
      throw error;
    }
  }

  getCurrentConversation() {
    return this.currentConversation;
  }

  setCurrentConversation(conversation) {
    this.currentConversation = conversation;
  }

  getConversations() {
    return this.conversations;
  }
}

export default AIConversationManager;
