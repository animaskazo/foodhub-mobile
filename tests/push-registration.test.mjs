import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';

async function setup({ permitted = true, enrolled = true, flag = 'true' } = {}) {
  const storage = new Map();
  const calls = [];
  let permissions = permitted;
  let currentUser = 'user-a';
  const context = createContext({ process: { env: { EXPO_PUBLIC_PUSH_PILOT: flag } } });
  const session = () => ({ data: { session: { user: { id: currentUser } } } });
  const supabase = {
    auth: { getSession: async () => session() },
    rpc: async (name, params) => {
      calls.push({ name, params });
      if (name === 'push_pilot_info') return { data: enrolled ? { organization_id: 'org-a', expo_project_id: 'project-a' } : null };
      return { data: 'device-a' };
    },
  };
  const modules = {
    '@react-native-async-storage/async-storage': { default: { getItem: async key => storage.get(key) ?? null, setItem: async (key,value) => storage.set(key,value), removeItem: async key => storage.delete(key) } },
    'expo-crypto': { randomUUID: () => 'device-a' },
    'expo-notifications': {
      getPermissionsAsync: async () => ({ granted: permissions, canAskAgain: true }),
      requestPermissionsAsync: async () => { calls.push({ name: 'permissionPrompt' }); return { granted: permissions }; },
      getExpoPushTokenAsync: async () => { calls.push({ name: 'getToken' }); return { data: 'ExpoPushToken[token-a]' }; },
    },
    'expo-constants': { default: { expoConfig: { extra: { eas: { projectId: 'project-a' } } } } },
    'react-native': { Platform: { OS: 'ios' } },
    './supabase': { supabase },
  };
  const module = new SourceTextModule(await readFile(new URL('../lib/push.js', import.meta.url), 'utf8'), { context });
  await module.link(specifier => {
    const exports = modules[specifier];
    return new SyntheticModule(Object.keys(exports), function () { for (const [key,value] of Object.entries(exports)) this.setExport(key,value); }, { context });
  });
  await module.evaluate();
  return { api: module.namespace, calls, storage, revokePermission: () => { permissions = false; }, changeUser: () => { currentUser = 'user-b'; } };
}

test('opt-in only, registration, rotation/renewal, revoked OS permission, logout', async () => {
  const { api, calls, revokePermission } = await setup();
  assert.equal(await api.registerPush('user-a'), false);
  assert.equal(calls.length, 0, 'no registration before opt-in');
  assert.equal(await api.registerPush('user-a', true), true);
  const saved = calls.find(call => call.name === 'register_push_device');
  assert.equal(saved.params.p_token, 'ExpoPushToken[token-a]');
  assert.equal(saved.params.p_project_id, 'project-a');
  assert.equal(saved.params.organization_id, undefined, 'server chooses business');
  assert.equal(await api.registerPush('user-a'), true);
  revokePermission();
  assert.equal(await api.registerPush('user-a'), false);
  assert.ok(calls.some(call => call.name === 'unregister_push_device'));
  assert.equal(calls.filter(call => call.name === 'permissionPrompt').length, 0, 'renewal never prompts');
});

test('unauthorized user cannot prompt or get a token; disabled flag is inert', async () => {
  const denied = await setup({ enrolled: false });
  await assert.rejects(denied.api.registerPush('user-a', true), /habilitada/);
  assert.equal(denied.calls.some(call => call.name === 'getToken' || call.name === 'permissionPrompt'), false);
  const disabled = await setup({ flag: 'false' });
  assert.equal(await disabled.api.registerPush('user-a', true), false);
  assert.equal(disabled.calls.length, 0);
});

test('logout cancels queued registration and unregisters before sign-out', async () => {
  const { api, calls } = await setup();
  await api.registerPush('user-a', true);
  const queued = api.registerPush('user-a');
  await api.unregisterPush();
  assert.equal(await queued, false);
  assert.equal(calls.at(-1).name, 'unregister_push_device');
  assert.equal(await api.registerPush('user-a'), false);
});

test('session changed while acquiring token cannot register for another account', async () => {
  const { api, calls, changeUser } = await setup();
  changeUser();
  assert.equal(await api.registerPush('user-a', true), false);
  assert.equal(calls.some(call => call.name === 'register_push_device'), false);
});
