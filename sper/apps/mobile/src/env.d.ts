/**
 * Minimal ambient typing for the Expo-exposed env vars used by the client.
 * Avoids pulling all of @types/node (which clashes with React Native globals).
 */
declare const process: {
  env: {
    EXPO_PUBLIC_API_URL?: string;
    [key: string]: string | undefined;
  };
};
