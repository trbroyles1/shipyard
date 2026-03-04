import { http, HttpResponse } from "msw";
import {
  MOCK_MERGE_REQUEST,
  MOCK_MERGE_REQUEST_MINIMAL,
} from "@/lib/__tests__/fixtures/gitlab-mr.fixture";
import { MOCK_APPROVALS } from "@/lib/__tests__/fixtures/gitlab-approvals.fixture";

const GITLAB_API = "*/api/v4";

export const gitlabHandlers = [
  http.get(`${GITLAB_API}/groups/:groupId/merge_requests`, () => {
    return HttpResponse.json([MOCK_MERGE_REQUEST, MOCK_MERGE_REQUEST_MINIMAL], {
      headers: { "x-total-pages": "1" },
    });
  }),

  http.get(
    `${GITLAB_API}/projects/:projectId/merge_requests/:iid`,
    () => {
      return HttpResponse.json(MOCK_MERGE_REQUEST);
    },
  ),

  http.get(
    `${GITLAB_API}/projects/:projectId/merge_requests/:iid/approvals`,
    () => {
      return HttpResponse.json(MOCK_APPROVALS);
    },
  ),
];
