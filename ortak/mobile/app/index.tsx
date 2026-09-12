import { Redirect } from 'expo-router';

/** The root path just hands over to the tabs; _layout redirects if there's no session. */
export default function Index() {
  return <Redirect href="/(tabs)/today" />;
}
