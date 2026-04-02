import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Button } from '../components/ui';

afterEach(() => {
  cleanup();
});

describe('Button', () => {
  it('exposes default variant and size contract', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: 'Click me' });

    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('data-variant', 'primary');
    expect(button).toHaveAttribute('data-size', 'default');
  });

  it('keeps legacy secondary and danger variants working', () => {
    render(
      <div>
        <Button variant="secondary">Secondary</Button>
        <Button variant="danger">Danger</Button>
      </div>
    );

    expect(screen.getByRole('button', { name: 'Secondary' })).toHaveAttribute('data-variant', 'secondary');
    expect(screen.getByRole('button', { name: 'Danger' })).toHaveAttribute('data-variant', 'danger');
  });
});
