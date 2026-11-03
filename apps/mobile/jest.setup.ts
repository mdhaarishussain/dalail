/* Native modules are not available under Jest; screens get data through injected services. */
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = `file:///mock/${parts.map(String).join('/')}`;
    }
    create() {}
    write() {
      return Promise.resolve();
    }
  }
  return { File, Paths: { cache: 'cache', document: 'document' } };
});
