import * as SecureStore from "expo-secure-store";

export async function saveTokens(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  await SecureStore.setItemAsync("accessToken", accessToken);
  await SecureStore.setItemAsync("refreshToken", refreshToken);
}

export async function getAccessToken(): Promise<string | null> {
  return await SecureStore.getItemAsync("accessToken");
}

export async function getRefreshToken(): Promise<string | null> {
  return await SecureStore.getItemAsync("refreshToken");
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync("accessToken");
  await SecureStore.deleteItemAsync("refreshToken");
  await SecureStore.deleteItemAsync("pitchId");
}

export async function saveLocale(locale: string): Promise<void> {
  await SecureStore.setItemAsync("locale", locale);
}

export async function getLocale(): Promise<string | null> {
  return await SecureStore.getItemAsync("locale");
}

export async function saveActivePitch(pitchId: string): Promise<void> {
  await SecureStore.setItemAsync("pitchId", pitchId);
}

export async function getActivePitch(): Promise<string | null> {
  return await SecureStore.getItemAsync("pitchId");
};
