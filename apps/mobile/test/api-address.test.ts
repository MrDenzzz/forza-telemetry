import { describe, expect, it } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { apiUrlFromHostUri, loadApiUrl, saveApiUrl } from '../src/connect/api-address';

describe('apiUrlFromHostUri', () => {
  it.each([
    ['192.168.1.20:8081', 'http://192.168.1.20:4000'],
    ['[fe80::1]:8081', 'http://[fe80::1]:4000'],
    ['dev-pc.local:8081', 'http://dev-pc.local:4000'],
  ])('points %s at the API port of the same machine', (hostUri, url) => {
    expect(apiUrlFromHostUri(hostUri)).toBe(url);
  });

  it('has no guess outside development', () => {
    expect(apiUrlFromHostUri(undefined)).toBeNull();
  });
});

describe('saved API address', () => {
  it('is remembered between launches', async () => {
    await AsyncStorage.clear();
    expect(await loadApiUrl()).toBeNull();

    await saveApiUrl('http://192.168.1.20:4000');

    expect(await loadApiUrl()).toBe('http://192.168.1.20:4000');
  });

  it('is ignored when it no longer reads as an address', async () => {
    await AsyncStorage.setItem('apiUrl', 'ftp://somewhere');

    expect(await loadApiUrl()).toBeNull();
  });
});
