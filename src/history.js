import React, { Component } from 'react'
import { cloneDeep, isArray, } from 'lodash'
import JSONTree from 'react-json-tree'

const history = []
let historyState = 'ready'
let rollbackIndex = null
let lastState

export function getHistory () {
  return history
}

export function getRollbackIndex() {
  return rollbackIndex
}

export function addToHistory(event) {
  if (historyState === 'accept rollback') {
    history[rollbackIndex] = cloneDeep(event)
    historyState = 'ready'
  } else {
    if (rollbackIndex !== null) {
      history.length = rollbackIndex + 1
      rollbackIndex = null
    }
    history.push(cloneDeep(event))
  }
  if (event.state) {
    lastState = event.state
  }
}

export class HistoryWidget extends Component {
  constructor (props) {
    super(props)
    this.toggleEvent = this.toggleEvent.bind(this)
    this.state = { show: false }
  }

  toggleEvent (e) {
    if (e.keyCode === 27) {
      this.setState({ show: !this.state.show })
    }
  }

  componentDidMount () {
    document.addEventListener("keydown", this.toggleEvent, false);
  }

  componentWillUnmount () {
    document.removeEventListener("keydown", this.toggleEvent, false);
  }

  rollback (event, index) {
    historyState = 'accept rollback'
    rollbackIndex = index
    event.onStateChange(event.state)
  }

  render () {
    if (!this.state.show) return ''
    const { history } = this.props
    const historyStyle = {
      position: 'fixed',
      top: 0,
      right: 0,
      height: '700px',
      width: '700px',
      backgroundColor: '#272822',
      color: 'white',
      border: '3px solid white',
      borderTop: 'none',
      flexDirection: 'column',
      justifyContent: 'top',
      borderBottomRightRadius: '10px',
      borderBottomLeftRadius: '10px'
    }
    const columnStyle = {
      float: 'left',
      overflow: 'auto',
      height: '693px',
      width: 'calc(50% - 11px)',
      borderRight: '1px solid white',
      padding: '5px'
    }
    const theme = {
      scheme: 'monokai',
      author: 'wimer hazenberg (http://www.monokai.nl)',
      base00: '#272822',
      base01: '#383830',
      base02: '#49483e',
      base03: '#75715e',
      base04: '#a59f85',
      base05: '#f8f8f2',
      base06: '#f5f4f1',
      base07: '#f9f8f5',
      base08: '#f92672',
      base09: '#fd971f',
      base0A: '#f4bf75',
      base0B: '#a6e22e',
      base0C: '#a1efe4',
      base0D: '#66d9ef',
      base0E: '#ae81ff',
      base0F: '#cc6633'
    }
    return <div style={historyStyle}>
      <div style={columnStyle}>
        {history.map((event, i) => {
          return <div key={i}>
            <pre style={{
              color: 'white',
              backgroundColor: '#272822',
              opacity: rollbackIndex === null || i < rollbackIndex + 1 ? '1' : '.5'
            }}>
              ({i}) {event.event}
              {event.event === 'setState' &&
                <button
                  style={{ marginLeft: '5px', backgroundColor: '#cc6633', color: 'black' }}
                  onClick={this.rollback.bind(null, event, i)}
                >
                  rollback
                </button>
              }
              <br/>
              {(event.action === 'set' || event.action === 'add') &&
                <span style={{color:event.action === 'add' ? 'green' : 'yellow'}}>
                  {event.path} = {isArray(event.val) ? `Array(${event.val.length})` : (event.val ? event.val.toString() : 'null')}
                </span>
              }
              {event.action === 'remove' &&
                <span style={{color:'red'}}>delete {event.path}</span>
              }
            </pre>
          </div>
        })}
      </div>
      <div style={columnStyle}>
        <JSONTree
          data={lastState.root}
          theme={theme}
          invertTheme={false}
          shouldExpandNode={(keyName, data, level) => level <= 1}
          hideRoot
        />
      </div>
    </div>
  }
}
