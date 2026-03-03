import { MR_API_BASE_PATH } from "./constants";

/** Build the client-side API path for an MR's detail/action endpoints. */
export function mrApiPath(projectId: number, iid: number): string {
  return `${MR_API_BASE_PATH}/${projectId}/${iid}`;
}
