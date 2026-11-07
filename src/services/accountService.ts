import { apiClient } from "./apiClient";

export type AccountProfile = {
  email: string;
  name: string;
  avatar?: string;
  isAdmin: boolean;
  canChangePassword: boolean;
  canDelete: boolean;
};

export function getAccount() {
  return apiClient.get<{ data: AccountProfile }>("/account");
}

export function updateAccount(payload: { name?: string; avatar?: string | null }) {
  return apiClient.patchJson<{ data: AccountProfile }>("/account", payload);
}

export function changePassword(currentPassword: string, newPassword: string) {
  return apiClient.postJson<{ data: { changed: boolean } }>("/account/password", {
    currentPassword,
    newPassword,
  });
}

export function deleteAccount(password: string) {
  return apiClient.deleteJson<{ data: { deleted: boolean } }>("/account", { password });
}
