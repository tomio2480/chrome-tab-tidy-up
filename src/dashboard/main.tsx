import { render } from 'preact'
import { App } from './App'

const container = document.getElementById('app')
if (!container) {
  throw new Error('App mount point not found')
}
render(<App />, container)
