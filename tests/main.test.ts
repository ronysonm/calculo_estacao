import { beforeEach, describe, expect, it, vi } from 'vitest';

const { renderMock } = vi.hoisted(() => ({
  renderMock: vi.fn(),
}));

vi.mock('preact', async () => {
  const actual = await vi.importActual<typeof import('preact')>('preact');
  return {
    ...actual,
    render: renderMock,
  };
});

vi.mock('../src/app', () => ({
  App: () => null,
}));

describe('main entrypoint', () => {
  beforeEach(() => {
    vi.resetModules();
    renderMock.mockReset();
    document.body.innerHTML = '';
  });

  it('renders App when #app exists', async () => {
    document.body.innerHTML = '<div id="app"></div>';

    await import('../src/main');

    const root = document.getElementById('app');
    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(renderMock).toHaveBeenCalledWith(expect.anything(), root);
  });

  it('logs an error when #app is missing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await import('../src/main');

    expect(renderMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith('Root element #app not found');
  });
});
