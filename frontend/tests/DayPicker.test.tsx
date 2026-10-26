import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DayPicker } from '../src/components/DayPicker';

const window = { from: '2026-10-26', to: '2026-11-01' };

describe('DayPicker', () => {
  it('muestra exactamente los 7 días de la ventana', () => {
    render(<DayPicker window={window} value="2026-10-26" onChange={() => {}} />);
    const days = screen.getAllByRole('button');
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.getAttribute('data-date'))).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
  });

  it('marca el seleccionado con aria-pressed y llama onChange', () => {
    const onChange = vi.fn();
    render(<DayPicker window={window} value="2026-10-28" onChange={onChange} />);
    const days = screen.getAllByRole('button');
    expect(days.filter((d) => d.getAttribute('aria-pressed') === 'true').map((d) => d.dataset.date)).toEqual([
      '2026-10-28',
    ]);
    fireEvent.click(days[6]);
    expect(onChange).toHaveBeenCalledWith('2026-11-01');
  });

  it('muestra el día de la semana en español', () => {
    render(<DayPicker window={window} value="2026-10-26" onChange={() => {}} />);
    // 2026-10-26 es lunes.
    expect(screen.getAllByRole('button')[0]).toHaveTextContent(/lun/i);
  });
});
