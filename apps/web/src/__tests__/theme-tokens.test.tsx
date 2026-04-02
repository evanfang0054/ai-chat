import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ThemeProvider } from '../contexts/theme-context';

const currentDir = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(currentDir, '..', '..');
const srcRoot = resolve(webRoot, 'src');

function readWebFile(relativePath: string) {
  return readFileSync(resolve(webRoot, relativePath), 'utf8');
}

function readSrcFile(relativePath: string) {
  return readFileSync(resolve(srcRoot, relativePath), 'utf8');
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.className = '';
});

describe('shadcn theme foundation', () => {
  it('keeps ThemeProvider on the .dark class strategy', () => {
    localStorage.setItem('theme', 'dark');

    render(
      <ThemeProvider>
        <div>theme</div>
      </ThemeProvider>
    );

    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('defines shadcn semantic tokens and inline theme mapping', () => {
    const tokensCss = readSrcFile('styles/tokens.css');
    const stylesCss = readSrcFile('styles.css');

    expect(tokensCss).toContain('--card:');
    expect(tokensCss).toContain('--popover:');
    expect(tokensCss).toContain('--primary:');
    expect(tokensCss).toContain('--secondary:');
    expect(tokensCss).toContain('--muted:');
    expect(tokensCss).toContain('--destructive:');
    expect(tokensCss).toContain('--input:');
    expect(tokensCss).toContain('--ring:');
    expect(tokensCss).toContain('--radius:');
    expect(tokensCss).toContain('.dark');

    expect(stylesCss).toContain('@theme inline');
    expect(stylesCss).toContain('--color-background: rgb(var(--background))');
    expect(stylesCss).toContain('--color-card: rgb(var(--card))');
    expect(stylesCss).toContain('--radius-sm: calc(var(--radius) - 4px)');
  });

  it('adds the shadcn base config and supporting dependencies', () => {
    const packageJson = readWebFile('package.json');
    const tailwindConfig = readWebFile('tailwind.config.js');
    const componentsJson = readWebFile('components.json');
    const utilsFile = readSrcFile('lib/utils.ts');

    expect(packageJson).toContain('@radix-ui/react-dialog');
    expect(packageJson).toContain('@radix-ui/react-dropdown-menu');
    expect(packageJson).toContain('@radix-ui/react-label');
    expect(packageJson).toContain('@radix-ui/react-scroll-area');
    expect(packageJson).toContain('@radix-ui/react-select');
    expect(packageJson).toContain('@radix-ui/react-separator');
    expect(packageJson).toContain('@radix-ui/react-slot');
    expect(packageJson).toContain('@radix-ui/react-tabs');
    expect(packageJson).toContain('@radix-ui/react-tooltip');
    expect(packageJson).toContain('class-variance-authority');
    expect(packageJson).toContain('clsx');
    expect(packageJson).toContain('lucide-react');
    expect(packageJson).toContain('tailwind-merge');

    expect(tailwindConfig).not.toContain('colors:');
    expect(tailwindConfig).toContain('accordion-down');
    expect(tailwindConfig).toContain('accordion-up');
    expect(tailwindConfig).toContain('accordion-down 0.2s ease-out');
    expect(tailwindConfig).toContain('accordion-up 0.2s ease-out');

    expect(componentsJson).toContain('"style": "new-york"');
    expect(componentsJson).toContain('"tailwind":');
    expect(componentsJson).toContain('"css": "src/styles.css"');
    expect(componentsJson).toContain('"utils": "@/lib/utils"');

    expect(utilsFile).toContain('export function cn');
    expect(utilsFile).toContain('twMerge(clsx(inputs))');
  });
});
