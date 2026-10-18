// Asset module shapes for the web build (Vite resolves these to URLs).
declare module '*.ttf' {
  const url: string;
  export default url;
}
declare module '*.png' {
  // Metro: asset id (number); Vite: URL string. Both are accepted by <Image source>.
  const source: import('react-native').ImageSourcePropType;
  export default source;
}
