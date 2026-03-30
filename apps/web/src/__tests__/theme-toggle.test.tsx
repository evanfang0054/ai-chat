import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from '../contexts/theme-context';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function TestComponent() {
  const { theme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <button onClick={toggleTheme}>Toggle</button>
    </div>
  );
}

describe('ThemeProvider', () => {
  it('defaults to light theme', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
  });

  it('toggles between light and dark', async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
  });
});
