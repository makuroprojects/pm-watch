import { $ } from "bun";

const SERVICE = "pm-watch";
const ACCOUNT_TOKEN = "webhook-token";

export async function setToken(token: string): Promise<void> {
  await $`security add-generic-password -U -a ${ACCOUNT_TOKEN} -s ${SERVICE} -w ${token}`.quiet();
}

export async function getToken(): Promise<string | null> {
  try {
    const result = await $`security find-generic-password -a ${ACCOUNT_TOKEN} -s ${SERVICE} -w`.quiet();
    return result.stdout.toString().trim() || null;
  } catch {
    return null;
  }
}

export async function deleteToken(): Promise<void> {
  try {
    await $`security delete-generic-password -a ${ACCOUNT_TOKEN} -s ${SERVICE}`.quiet();
  } catch {}
}

export async function hasToken(): Promise<boolean> {
  return (await getToken()) !== null;
}
