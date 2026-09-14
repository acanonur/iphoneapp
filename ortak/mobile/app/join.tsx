/**
 * Where an `ortak://join?code=…&server=…` link lands.
 *
 * A custom scheme with no authority puts the segment in the URL's host, which
 * expo-router maps to the path "join" — so this file is the route a tapped
 * invite matches. It holds no UI of its own: it hands the query straight to
 * onboarding, which knows what to do with a code and an address.
 */

import { Redirect, useLocalSearchParams } from 'expo-router';

export default function Join() {
  const { code, server } = useLocalSearchParams<{ code?: string; server?: string }>();

  return (
    <Redirect
      href={{
        pathname: '/onboarding',
        params: {
          ...(code ? { code: String(code) } : {}),
          ...(server ? { server: String(server) } : {}),
        },
      }}
    />
  );
}
