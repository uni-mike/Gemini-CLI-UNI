/**
 * Wrapper for yoga-wasm-web to handle top-level await issues
 * This module provides a safe way to load yoga without breaking CJS compatibility
 */

let yogaModule: any = null;

export async function loadYoga() {
  if (yogaModule) {
    return yogaModule;
  }

  try {
    // Try to load yoga-layout-prebuilt first (no top-level await)
    yogaModule = await import('yoga-layout-prebuilt');
    console.log('✅ Loaded yoga-layout-prebuilt');
    return yogaModule;
  } catch (error) {
    // Fallback to yoga-wasm-web if needed
    try {
      yogaModule = await import('yoga-wasm-web');
      console.log('✅ Loaded yoga-wasm-web');
      return yogaModule;
    } catch (fallbackError) {
      console.error('❌ Failed to load any yoga module:', fallbackError);
      throw new Error('Yoga layout engine not available');
    }
  }
}

export function isYogaAvailable(): boolean {
  return yogaModule !== null;
}