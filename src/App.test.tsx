import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /calculo estacao/i })).toBeInTheDocument();
  });

  it('applies Tailwind classes', () => {
    render(<App />);
    const heading = screen.getByRole('heading', { name: /calculo estacao/i });
    expect(heading).toHaveClass('text-2xl', 'font-bold');
  });
});
