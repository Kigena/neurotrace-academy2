/**
 * Focus Drills API client. The drill's questions live in their own bank
 * on the server and are scored there.
 */
import apiService from "./apiService";

export const drillApi = {
  getQuestions() {
    return apiService.get("/drill/questions");
  },
  getProgress() {
    return apiService.get("/drill/progress");
  },
  answer(questionId, selectedIndex, timeMs) {
    return apiService.post("/drill/answer", { questionId, selectedIndex, timeMs });
  },
  reset() {
    return apiService.post("/drill/reset", {});
  },
};

export default drillApi;
