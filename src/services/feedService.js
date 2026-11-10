import apiService from './apiService';

/** Community feed API: statuses, likes and comments. */
const feedService = {
  list(before) {
    return apiService.get('/feed', before ? { before } : {});
  },
  create(content, attachments = []) {
    return apiService.post('/feed', { content, attachments });
  },
  remove(id) {
    return apiService.delete(`/feed/${id}`);
  },
  toggleLike(id) {
    return apiService.post(`/feed/${id}/like`, {});
  },
  comment(id, content) {
    return apiService.post(`/feed/${id}/comments`, { content });
  },
  removeComment(id, commentId) {
    return apiService.delete(`/feed/${id}/comments/${commentId}`);
  },
  async uploadImage(file) {
    const form = new FormData();
    form.append('file', file);
    return apiService.post('/chat/upload', form);
  },
  searchMembers(query) {
    return apiService.get('/chat/users/search', { query });
  },
};

export default feedService;
