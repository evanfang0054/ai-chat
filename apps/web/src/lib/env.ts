type RuntimeConfig = {
  apiBaseUrl?: string;
};

declare global {
  interface Window {
    __AI_CHAT_RUNTIME_CONFIG__?: RuntimeConfig;
  }
}

const fallbackApiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export function getApiBaseUrl() {
  return window.__AI_CHAT_RUNTIME_CONFIG__?.apiBaseUrl || fallbackApiBaseUrl;
}

export const env = {
  get apiBaseUrl() {
    return getApiBaseUrl();
  }
};
