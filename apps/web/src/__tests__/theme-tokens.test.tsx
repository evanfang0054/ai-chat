import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ThemeProvider } from '../contexts/theme-context';

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.className = '';
});

describe('theme tokens', () => {
  it('mounts without removing the existing dark-class strategy', () => {
    localStorage.setItem('theme', 'dark');

    render(
      <ThemeProvider>
        <div>theme-ready</div>
      </ThemeProvider>
    );

    expect(document.documentElement).toHaveClass('dark');
  });
});
