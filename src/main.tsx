/**
 * Application Entry Point
 */

import { render } from 'preact';
import { App } from './app';

const rootElement = document.getElementById('app');

if (rootElement) {
  render(<App />, rootElement);
} else {
  console.error('Root element #app not found');
}
